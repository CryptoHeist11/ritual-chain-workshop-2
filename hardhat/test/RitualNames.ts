import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { keccak256, parseEther, stringToBytes } from "viem";

const SCHEDULER_ADDRESS = "0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B";
const RITUAL_WALLET_ADDRESS = "0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948";

describe("RitualNames Smart Contract", async function () {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();
  const testClient = await viem.getTestClient();
  const [deployer, user1, user2] = await viem.getWalletClients();

  // Helper to deploy contract with mock scheduler system contract etched at canonical address
  async function deployFixture() {
    const mockScheduler = await viem.deployContract("MockScheduler");
    const mockWallet = await viem.deployContract("MockRitualWallet");

    // Etch mock scheduler code to canonical SCHEDULER address
    const schedulerCode = await publicClient.getBytecode({ address: mockScheduler.address });
    if (schedulerCode) {
      await testClient.setCode({
        address: SCHEDULER_ADDRESS,
        bytecode: schedulerCode,
      });
    }

    // Etch mock wallet code to canonical RITUAL_WALLET address
    const walletCode = await publicClient.getBytecode({ address: mockWallet.address });
    if (walletCode) {
      await testClient.setCode({
        address: RITUAL_WALLET_ADDRESS,
        bytecode: walletCode,
      });
    }

    const blockTimeMs = 200n; // 200ms
    const names = await viem.deployContract("RitualNames", [blockTimeMs]);
    return { names, mockScheduler, mockWallet };
  }

  it("Validates label character set and length rules", async function () {
    const { names } = await deployFixture();

    assert.equal(await names.read.validateLabel(["alice"]), true);
    assert.equal(await names.read.validateLabel(["alice-123"]), true);
    assert.equal(await names.read.validateLabel(["al"]), false); // too short
    assert.equal(await names.read.validateLabel(["ALICE"]), false); // uppercase
    assert.equal(await names.read.validateLabel(["alice_bob"]), false); // underscore invalid
    assert.equal(await names.read.validateLabel(["a".repeat(33)]), false); // too long
  });

  it("Registers a label and sets forward + reverse resolution", async function () {
    const { names } = await deployFixture();

    const hash = await names.write.register(["alice", true], {
      account: user1.account,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    const resolved = await names.read.resolve(["alice"]);
    assert.equal(resolved.toLowerCase(), user1.account.address.toLowerCase());

    const reverse = await names.read.reverseResolve([user1.account.address]);
    assert.equal(reverse, "alice");

    const [status, expiryBlock, lastChecked, autoRenew] = await names.read.getStatus(["alice"]);
    assert.equal(status, 0); // NameStatus.Active
    assert.equal(autoRenew, true);
    assert.ok(expiryBlock > 0n);
  });

  it("Reverts registration for an already taken label", async function () {
    const { names } = await deployFixture();

    await names.write.register(["alice", true], { account: user1.account });

    await assert.rejects(async () => {
      await names.write.register(["alice", false], { account: user2.account });
    });
  });

  it("Allows owner to set resolved target address", async function () {
    const { names } = await deployFixture();

    await names.write.register(["alice", true], { account: user1.account });
    await names.write.setResolvedAddress(["alice", user2.account.address], {
      account: user1.account,
    });

    const resolved = await names.read.resolve(["alice"]);
    assert.equal(resolved.toLowerCase(), user2.account.address.toLowerCase());
  });

  it("Allows owner to update primary reverse name", async function () {
    const { names } = await deployFixture();

    await names.write.register(["alice", true], { account: user1.account });
    await names.write.register(["bob", true], { account: user1.account });

    await names.write.setPrimaryName(["bob"], { account: user1.account });

    const primary = await names.read.reverseResolve([user1.account.address]);
    assert.equal(primary, "bob");
  });

  it("Allows owner to transfer a name", async function () {
    const { names } = await deployFixture();

    await names.write.register(["alice", true], { account: user1.account });
    await names.write.transfer(["alice", user2.account.address], {
      account: user1.account,
    });

    const record = await names.read.getRecord(["alice"]);
    assert.equal(record.owner.toLowerCase(), user2.account.address.toLowerCase());
  });

  it("Supports auto-renew toggling and manual renewal", async function () {
    const { names } = await deployFixture();

    await names.write.register(["alice", false], { account: user1.account });
    let status = await names.read.getStatus(["alice"]);
    assert.equal(status[3], false); // autoRenew is false

    await names.write.setAutoRenew(["alice", true], { account: user1.account });
    status = await names.read.getStatus(["alice"]);
    assert.equal(status[3], true); // autoRenew is true

    const oldExpiry = status[1];
    await names.write.renew(["alice"], { account: user1.account });
    const newStatus = await names.read.getStatus(["alice"]);
    assert.ok(newStatus[1] > oldExpiry);
  });

  it("Executes scheduled maintenance callback from Scheduler", async function () {
    const { names } = await deployFixture();

    await names.write.register(["alice", true], { account: user1.account });
    const record = await names.read.getRecord(["alice"]);
    const initialExpiry = record.expiryBlock;

    // Simulate Scheduler calling onScheduledMaintenance from SCHEDULER address
    await testClient.impersonateAccount({ address: SCHEDULER_ADDRESS });
    await testClient.setBalance({
      address: SCHEDULER_ADDRESS,
      value: parseEther("1"),
    });

    const nameHash = keccak256(stringToBytes("alice"));

    // Call onScheduledMaintenance as Scheduler
    const tx = await names.write.onScheduledMaintenance([1n, nameHash], {
      account: SCHEDULER_ADDRESS as `0x${string}`,
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });

    const updatedRecord = await names.read.getRecord(["alice"]);
    assert.ok(updatedRecord.expiryBlock > initialExpiry);
  });
});
