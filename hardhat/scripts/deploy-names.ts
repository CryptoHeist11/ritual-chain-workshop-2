/**
 * Deploy RitualNames to Ritual Chain and prepay its execution fees.
 *
 *   npx hardhat run scripts/deploy-names.ts
 */
import { parseEther } from "viem";
import {
  RITUAL,
  RITUAL_WALLET_ABI,
  connectRitual,
  explorerAddress,
  explorerTx,
  measureBlockTimeMs,
  ritual,
} from "./ritual.ts";

/** Blocks the RitualWallet deposit stays locked. */
const FUNDING_LOCK_BLOCKS = 500_000n;

const { connection, publicClient, wallet, viem } = await connectRitual();
const deployer = wallet.account.address;

console.log("── Preflight ─────────────────────────────────────────────");
console.log(`Deployer:          ${deployer}`);

const nativeBalance = await publicClient.getBalance({ address: deployer });
console.log(`Native balance:    ${ritual(nativeBalance)}`);
if (nativeBalance === 0n) {
  throw new Error(`Deployer has no RITUAL. Get testnet funds at ${RITUAL.faucet}`);
}

const measured = await measureBlockTimeMs(publicClient, 200);
const blockTimeMs = BigInt(process.env.BLOCK_TIME_MS ?? Math.round(measured));
console.log(`Block time:        ${measured.toFixed(2)} ms measured → using ${blockTimeMs} ms`);

console.log("");
console.log("── Deploy RitualNames ────────────────────────────────────");

const names = await viem.deployContract("RitualNames", [blockTimeMs]);
console.log(`RitualNames:       ${names.address}`);
console.log(`                   ${explorerAddress(names.address)}`);

console.log("");
console.log("── Prepay execution fees ─────────────────────────────────");

const funding = parseEther(process.env.EXECUTION_FUNDING ?? "0.5");
const fundHash = await names.write.fundExecution([FUNDING_LOCK_BLOCKS], { value: funding });
await publicClient.waitForTransactionReceipt({ hash: fundHash });
console.log(`Deposited:         ${ritual(funding)}`);
console.log(`                   ${explorerTx(fundHash)}`);

const [executionBalance, lockUntil] = await Promise.all([
  publicClient.readContract({
    address: RITUAL.ritualWallet,
    abi: RITUAL_WALLET_ABI,
    functionName: "balanceOf",
    args: [names.address],
  }),
  publicClient.readContract({
    address: RITUAL.ritualWallet,
    abi: RITUAL_WALLET_ABI,
    functionName: "lockUntil",
    args: [names.address],
  }),
]);
console.log(`Execution balance: ${ritual(executionBalance)} (locked until block ${lockUntil})`);

console.log("");
console.log("── Next steps ────────────────────────────────────────────");
console.log("Put this in web/.env.local:");
console.log(`NEXT_PUBLIC_NAMES_ADDRESS=${names.address}`);

await connection.close();
