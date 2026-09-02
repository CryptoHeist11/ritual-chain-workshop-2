// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {RitualChain, IScheduler, IRitualWallet} from "./ritual/RitualChain.sol";

/**
 * @title RitualNames
 * @notice Human-readable naming layer for Ritual Chain with autonomous on-chain maintenance.
 *
 * Names are stored on-chain as lowercase labels (e.g. "alice") without the ".ritual" suffix.
 * The contract integrates directly with the Ritual Chain Scheduler system contract (0x56e7...D58B)
 * to perform recurring auto-renewal maintenance callbacks without requiring backend keepers or cron jobs.
 */
contract RitualNames {
    // ────────────────────────────── Types ───────────────────────────────

    enum NameStatus {
        Active,
        Expired
    }

    struct NameRecord {
        string label;
        address owner;
        address resolvedAddress;
        uint64 registrationBlock;
        uint64 expiryBlock;
        uint64 lastCheckedBlock;
        bool autoRenew;
        uint256 scheduleId;
        string metadataUri;
    }

    // ────────────────────────────── Constants ────────────────────────────

    /// Gas limit for the recurring maintenance execution callback.
    uint32 public constant MAINTENANCE_GAS_LIMIT = 300_000;

    /// Scheduler TTL in blocks.
    uint32 public constant SCHEDULER_TTL_BLOCKS = 150;

    /// Floor for fee per gas.
    uint256 public constant MIN_MAX_FEE_PER_GAS = 1 gwei;

    /// Fixed registration duration: 7 days.
    uint256 public constant REGISTRATION_DURATION_SECONDS = 7 days;

    // ────────────────────────────── Storage ──────────────────────────────

    /// Block time in milliseconds (e.g., ~195ms on Ritual Chain testnet).
    uint256 public immutable blockTimeMs;

    /// Registration duration expressed in blocks.
    uint256 public immutable durationBlocks;

    mapping(bytes32 => NameRecord) private _records;
    mapping(address => string) private _primaryNames;
    bytes32[] private _allNameHashes;

    // ────────────────────────────── Events ───────────────────────────────

    event NameRegistered(
        bytes32 indexed nameHash,
        string label,
        address indexed owner,
        uint64 expiryBlock,
        bool autoRenew,
        uint256 scheduleId
    );
    event NameTransferred(
        bytes32 indexed nameHash,
        string label,
        address indexed oldOwner,
        address indexed newOwner
    );
    event ResolvedAddressUpdated(
        bytes32 indexed nameHash,
        string label,
        address indexed target
    );
    event PrimaryNameSet(address indexed account, string label);
    event AutoRenewSet(bytes32 indexed nameHash, string label, bool enabled);
    event NameRenewed(bytes32 indexed nameHash, string label, uint64 newExpiryBlock);
    event NameExpired(bytes32 indexed nameHash, string label);
    event MaintenanceScheduled(
        bytes32 indexed nameHash,
        uint256 scheduleId,
        uint64 targetBlock
    );
    event MaintenanceExecuted(
        bytes32 indexed nameHash,
        uint256 executionIndex,
        bool renewed,
        string reason
    );

    // ────────────────────────────── Errors ───────────────────────────────

    error UnknownName();
    error InvalidLabel();
    error NameAlreadyTaken();
    error NotNameOwner();
    error InvalidAddress();
    error OnlyScheduler();
    error BadDuration();
    error TransferFailed();

    // ───────────────────────────── Constructor ───────────────────────────

    constructor(uint256 blockTimeMs_) {
        if (blockTimeMs_ == 0) revert BadDuration();
        blockTimeMs = blockTimeMs_;

        // Convert 7 days into block count based on measured block time
        uint256 blocks = (REGISTRATION_DURATION_SECONDS * 1000) / blockTimeMs_;
        durationBlocks = blocks > 0 ? blocks : 1;

        // Authorise the Scheduler system contract to call back into this contract
        IScheduler(RitualChain.SCHEDULER).approveScheduler(RitualChain.SCHEDULER);
    }

    // ───────────────────────────── Validation ────────────────────────────

    /**
     * @notice Validates a label string.
     * @dev Must be 3 to 32 characters, lowercase alphanumeric (a-z, 0-9) or hyphens (-).
     */
    function validateLabel(string memory label) public pure returns (bool) {
        bytes memory b = bytes(label);
        if (b.length < 3 || b.length > 32) return false;

        for (uint256 i = 0; i < b.length; i++) {
            bytes1 char = b[i];
            bool isLower = (char >= 0x61 && char <= 0x7A); // a-z
            bool isDigit = (char >= 0x30 && char <= 0x39); // 0-9
            bool isHyphen = (char == 0x2D);               // -

            if (!isLower && !isDigit && !isHyphen) {
                return false;
            }
        }
        return true;
    }

    // ────────────────────────── Name Registration ────────────────────────

    /**
     * @notice Register a new .ritual name label.
     * @param label The string label (without .ritual suffix).
     * @param autoRenewOptIn Whether to enable recurring maintenance auto-renewal.
     */
    function register(
        string calldata label,
        bool autoRenewOptIn
    ) external payable returns (bytes32 nameHash) {
        if (!validateLabel(label)) revert InvalidLabel();

        nameHash = keccak256(bytes(label));
        NameRecord storage record = _records[nameHash];

        // If registered and active, revert.
        if (record.registrationBlock != 0 && block.number <= record.expiryBlock) {
            revert NameAlreadyTaken();
        }

        uint64 expiry = uint64(block.number + durationBlocks);

        if (record.registrationBlock == 0) {
            _allNameHashes.push(nameHash);
        }

        record.label = label;
        record.owner = msg.sender;
        record.resolvedAddress = msg.sender;
        record.registrationBlock = uint64(block.number);
        record.expiryBlock = expiry;
        record.lastCheckedBlock = uint64(block.number);
        record.autoRenew = autoRenewOptIn;
        record.metadataUri = "";

        // Automatically set as primary name if sender currently has no primary name
        if (bytes(_primaryNames[msg.sender]).length == 0) {
            _primaryNames[msg.sender] = label;
            emit PrimaryNameSet(msg.sender, label);
        }

        uint256 scheduleId = 0;
        if (autoRenewOptIn) {
            scheduleId = _scheduleMaintenance(nameHash, expiry);
            record.scheduleId = scheduleId;
            emit MaintenanceScheduled(nameHash, scheduleId, expiry);
        }

        emit NameRegistered(nameHash, label, msg.sender, expiry, autoRenewOptIn, scheduleId);
    }

    // ─────────────────────────── Owner Actions ───────────────────────────

    /**
     * @notice Point name resolution to a target address.
     */
    function setResolvedAddress(string calldata label, address target) external {
        bytes32 nameHash = _getNameHashAndAssertOwner(label);
        _records[nameHash].resolvedAddress = target;
        emit ResolvedAddressUpdated(nameHash, label, target);
    }

    /**
     * @notice Set caller's primary reverse-resolution name.
     */
    function setPrimaryName(string calldata label) external {
        bytes32 nameHash = keccak256(bytes(label));
        NameRecord storage record = _records[nameHash];
        if (record.registrationBlock == 0) revert UnknownName();
        if (record.owner != msg.sender) revert NotNameOwner();

        _primaryNames[msg.sender] = label;
        emit PrimaryNameSet(msg.sender, label);
    }

    /**
     * @notice Transfer ownership of a name to a new address.
     */
    function transfer(string calldata label, address newOwner) external {
        if (newOwner == address(0)) revert InvalidAddress();
        bytes32 nameHash = _getNameHashAndAssertOwner(label);

        address oldOwner = _records[nameHash].owner;
        _records[nameHash].owner = newOwner;

        // If old owner had this label as primary name, clear it
        if (keccak256(bytes(_primaryNames[oldOwner])) == keccak256(bytes(label))) {
            delete _primaryNames[oldOwner];
        }

        emit NameTransferred(nameHash, label, oldOwner, newOwner);
    }

    /**
     * @notice Toggle auto-renewal flag for a name.
     */
    function setAutoRenew(string calldata label, bool enabled) external {
        bytes32 nameHash = _getNameHashAndAssertOwner(label);
        NameRecord storage record = _records[nameHash];

        record.autoRenew = enabled;
        emit AutoRenewSet(nameHash, label, enabled);

        // If enabling auto-renew and no schedule exists yet, schedule maintenance
        if (enabled && record.scheduleId == 0) {
            uint256 scheduleId = _scheduleMaintenance(nameHash, record.expiryBlock);
            record.scheduleId = scheduleId;
            emit MaintenanceScheduled(nameHash, scheduleId, record.expiryBlock);
        }
    }

    /**
     * @notice Manually extend expiry by 7 days worth of blocks.
     */
    function renew(string calldata label) external {
        bytes32 nameHash = keccak256(bytes(label));
        NameRecord storage record = _records[nameHash];
        if (record.registrationBlock == 0) revert UnknownName();

        record.expiryBlock += uint64(durationBlocks);
        emit NameRenewed(nameHash, label, record.expiryBlock);
    }

    // ─────────────────────── Scheduled Maintenance ───────────────────────

    /**
     * @notice Callback from the Ritual Scheduler system contract.
     * @dev executionIndex is populated in bytes 4-35 by the Scheduler.
     */
    function onScheduledMaintenance(
        uint256 executionIndex,
        bytes32 nameHash
    ) external {
        if (msg.sender != RitualChain.SCHEDULER) revert OnlyScheduler();

        NameRecord storage record = _records[nameHash];
        if (record.registrationBlock == 0 || record.owner == address(0)) {
            return;
        }

        record.lastCheckedBlock = uint64(block.number);

        if (record.autoRenew) {
            // Auto-renew: extend expiry by 1 renewal term (7 days worth of blocks)
            record.expiryBlock += uint64(durationBlocks);
            emit NameRenewed(nameHash, record.label, record.expiryBlock);
            emit MaintenanceExecuted(nameHash, executionIndex, true, "Auto-renewed by Ritual Scheduler");
        } else {
            if (block.number > record.expiryBlock) {
                emit NameExpired(nameHash, record.label);
                emit MaintenanceExecuted(nameHash, executionIndex, false, "Name Expired");
            } else {
                emit MaintenanceExecuted(nameHash, executionIndex, false, "Auto-renew disabled");
            }
        }
    }

    // ────────────────────────────── Views ───────────────────────────────

    /**
     * @notice Forward resolution: returns target address for a label.
     */
    function resolve(string calldata label) external view returns (address) {
        bytes32 nameHash = keccak256(bytes(label));
        NameRecord storage record = _records[nameHash];
        if (record.registrationBlock == 0 || block.number > record.expiryBlock) {
            return address(0);
        }
        return record.resolvedAddress;
    }

    /**
     * @notice Reverse resolution: returns primary label for an address.
     */
    function reverseResolve(address target) external view returns (string memory) {
        return _primaryNames[target];
    }

    /**
     * @notice Returns current status and expiry info for a label.
     */
    function getStatus(
        string calldata label
    )
        external
        view
        returns (
            NameStatus status,
            uint64 expiryBlock,
            uint64 lastCheckedBlock,
            bool autoRenew
        )
    {
        bytes32 nameHash = keccak256(bytes(label));
        NameRecord storage record = _records[nameHash];
        if (record.registrationBlock == 0) revert UnknownName();

        status = (block.number > record.expiryBlock)
            ? NameStatus.Expired
            : NameStatus.Active;

        return (status, record.expiryBlock, record.lastCheckedBlock, record.autoRenew);
    }

    /**
     * @notice Returns the full NameRecord for a label.
     */
    function getRecord(string calldata label) external view returns (NameRecord memory) {
        bytes32 nameHash = keccak256(bytes(label));
        NameRecord storage record = _records[nameHash];
        if (record.registrationBlock == 0) revert UnknownName();
        return record;
    }

    /**
     * @notice Returns all registered name records (newest first).
     */
    function getAllNames() external view returns (NameRecord[] memory names) {
        uint256 len = _allNameHashes.length;
        names = new NameRecord[](len);
        for (uint256 i = 0; i < len; i++) {
            names[i] = _records[_allNameHashes[len - 1 - i]];
        }
    }

    // ───────────────────────── Fee Management ───────────────────────────

    /**
     * @notice Prepay Scheduler execution fees into RitualWallet escrow.
     */
    function fundExecution(uint256 lockDurationBlocks) external payable {
        if (msg.value == 0) revert TransferFailed();
        IRitualWallet(RitualChain.RITUAL_WALLET).deposit{value: msg.value}(
            lockDurationBlocks
        );
    }

    function executionBalance() external view returns (uint256) {
        return IRitualWallet(RitualChain.RITUAL_WALLET).balanceOf(address(this));
    }

    // ──────────────────────── Internals ─────────────────────────────────

    function _scheduleMaintenance(
        bytes32 nameHash,
        uint64 targetBlock
    ) private returns (uint256 callId) {
        bytes memory data = abi.encodeWithSelector(
            this.onScheduledMaintenance.selector,
            uint256(0), // executionIndex placeholder
            nameHash
        );

        uint32 startBlock = targetBlock > uint64(block.number)
            ? uint32(targetBlock)
            : uint32(block.number + 1);

        callId = IScheduler(RitualChain.SCHEDULER).schedule(
            data,
            MAINTENANCE_GAS_LIMIT,
            startBlock,
            10, // recurring execution calls
            uint32(durationBlocks), // frequency matching renewal period
            SCHEDULER_TTL_BLOCKS,
            MIN_MAX_FEE_PER_GAS,
            0,
            0,
            address(this)
        );
    }

    function _getNameHashAndAssertOwner(
        string calldata label
    ) private view returns (bytes32 nameHash) {
        nameHash = keccak256(bytes(label));
        NameRecord storage record = _records[nameHash];
        if (record.registrationBlock == 0) revert UnknownName();
        if (record.owner != msg.sender) revert NotNameOwner();
        if (block.number > record.expiryBlock) revert UnknownName();
    }

    receive() external payable {}
}
