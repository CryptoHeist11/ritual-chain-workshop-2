import fs from "node:fs";
import path from "node:path";

const artifactPath = path.resolve(
  "artifacts/contracts/RitualNames.sol/RitualNames.json"
);
const outputPath = path.resolve("../web/src/contracts/RitualNames.json");

if (!fs.existsSync(artifactPath)) {
  console.error("Artifact not found. Run `npx hardhat build` or `npx hardhat test` first.");
  process.exit(1);
}

const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(artifact.abi, null, 2));

console.log(`Exported RitualNames ABI to ${outputPath}`);
