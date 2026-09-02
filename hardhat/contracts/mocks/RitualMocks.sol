// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IScheduler, IRitualWallet} from "../ritual/RitualChain.sol";

contract MockScheduler is IScheduler {
    uint256 private _nextCallId = 1;
    mapping(address => address) public approved;

    struct ScheduledCall {
        address caller;
        bytes data;
        uint32 gas;
        uint32 startBlock;
        uint32 numCalls;
        uint32 frequency;
        uint32 ttl;
        uint256 maxFeePerGas;
        uint256 maxPriorityFeePerGas;
        uint256 value;
        address payer;
        uint8 state;
    }

    mapping(uint256 => ScheduledCall) public calls;

    function schedule(
        bytes calldata data,
        uint32 gas,
        uint32 startBlock,
        uint32 numCalls,
        uint32 frequency,
        uint32 ttl,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 value,
        address payer
    ) external override returns (uint256 callId) {
        callId = _nextCallId++;
        calls[callId] = ScheduledCall({
            caller: msg.sender,
            data: data,
            gas: gas,
            startBlock: startBlock,
            numCalls: numCalls,
            frequency: frequency,
            ttl: ttl,
            maxFeePerGas: maxFeePerGas,
            maxPriorityFeePerGas: maxPriorityFeePerGas,
            value: value,
            payer: payer,
            state: 1
        });
    }

    function cancel(uint256 callId) external override {
        calls[callId].state = 2; // Cancelled
    }

    function getCallState(uint256 callId) external view override returns (uint8) {
        return calls[callId].state;
    }

    function approveScheduler(address schedulerContract) external override {
        approved[msg.sender] = schedulerContract;
    }

    function triggerCallback(uint256 callId, uint256 executionIndex) external returns (bool success) {
        ScheduledCall storage c = calls[callId];
        bytes memory callData = c.data;
        // Overwrite bytes 4-35 with executionIndex
        assembly {
            mstore(add(callData, 0x24), executionIndex)
        }
        (success, ) = c.caller.call{gas: c.gas}(callData);
    }
}

contract MockRitualWallet is IRitualWallet {
    mapping(address => uint256) private _balances;
    mapping(address => uint256) private _locks;

    function deposit(uint256 lockDuration) external payable override {
        _balances[msg.sender] += msg.value;
        _locks[msg.sender] = block.number + lockDuration;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    function lockUntil(address account) external view override returns (uint256) {
        return _locks[account];
    }
}
