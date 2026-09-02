import RitualNamesAbi from "./contracts/RitualNames.json";

export const RITUAL_CHAIN = {
  id: 1979,
  name: "Ritual Chain Testnet",
  nativeCurrency: {
    name: "Ritual",
    symbol: "RITUAL",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [import.meta.env.VITE_RITUAL_RPC_URL || "https://rpc.ritualfoundation.org"] },
    public: { http: [import.meta.env.VITE_RITUAL_RPC_URL || "https://rpc.ritualfoundation.org"] },
  },
  blockExplorers: {
    default: { name: "Ritual Explorer", url: "https://explorer.ritualfoundation.org" },
  },
} as const;

export const CONTRACT_ADDRESS = (import.meta.env.VITE_NAMES_ADDRESS || "") as `0x${string}`;
export const RITUAL_NAMES_ABI = RitualNamesAbi;
export const FAUCET_URL = "https://faucet.ritualfoundation.org";

export function truncateAddress(address: string): string {
  if (!address) return "";
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

export function formatLabel(label: string): string {
  if (!label) return "";
  const clean = label.trim().toLowerCase().replace(/\.ritual$/, "");
  return clean;
}

export function displayDomain(label: string): string {
  const clean = formatLabel(label);
  return clean ? `${clean}.ritual` : "";
}

export function isValidLabel(label: string): boolean {
  const clean = formatLabel(label);
  return /^[a-z0-9-]{3,32}$/.test(clean);
}
