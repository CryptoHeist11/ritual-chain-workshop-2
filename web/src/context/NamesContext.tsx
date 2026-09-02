import React, { createContext, useContext, useEffect, useState } from "react";
import { createPublicClient, createWalletClient, custom, http } from "viem";
import {
  CONTRACT_ADDRESS,
  RITUAL_CHAIN,
  RITUAL_NAMES_ABI,
  formatLabel,
  isValidLabel,
} from "../config";

export type Mode = "demo" | "testnet";

export interface MaintenanceLog {
  scheduleId: number;
  targetBlock: number;
  nextCheckTimestamp: string;
  autoRenewScheduled: boolean;
}

export interface NameRecordUI {
  label: string;
  domain: string;
  owner: string;
  resolvedAddress: string;
  registrationBlock: number;
  expiryBlock: number;
  lastCheckedBlock: number;
  autoRenew: boolean;
  scheduleId: number;
  status: "Active" | "Expired";
  registeredDateFormatted: string;
  expiresDateFormatted: string;
  maintenance?: MaintenanceLog;
}

interface NamesContextType {
  mode: Mode;
  setMode: (m: Mode) => void;
  walletAddress: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  names: NameRecordUI[];
  checkAvailability: (label: string) => Promise<{ available: boolean; record?: NameRecordUI }>;
  getRecord: (label: string) => Promise<NameRecordUI | null>;
  reverseResolve: (address: string) => Promise<string | null>;
  registerName: (label: string, autoRenew: boolean) => Promise<boolean>;
  toggleAutoRenew: (label: string, enabled: boolean) => Promise<boolean>;
  updateResolvedAddress: (label: string, target: string) => Promise<boolean>;
  setPrimaryName: (label: string) => Promise<boolean>;
  transferName: (label: string, newOwner: string) => Promise<boolean>;
  selectedName: NameRecordUI | null;
  setSelectedName: (record: NameRecordUI | null) => void;
  isLoading: boolean;
  error: string | null;
  currentBlock: number;
}

const SEEDED_DEMO_NAMES: NameRecordUI[] = [
  {
    label: "alice",
    domain: "alice.ritual",
    owner: "0x82F9291A2357731804E19C0842e4726b2707f91A",
    resolvedAddress: "0x82F9291A2357731804E19C0842e4726b2707f91A",
    registrationBlock: 120500,
    expiryBlock: 155500,
    lastCheckedBlock: 120512,
    autoRenew: true,
    scheduleId: 101,
    status: "Active",
    registeredDateFormatted: "Sep 02, 2026",
    expiresDateFormatted: "Sep 09, 2026",
    maintenance: {
      scheduleId: 101,
      targetBlock: 155500,
      nextCheckTimestamp: "Sep 09, 2026 · 18:00 UTC",
      autoRenewScheduled: true,
    },
  },
  {
    label: "bob",
    domain: "bob.ritual",
    owner: "0x4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97",
    resolvedAddress: "0x4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97",
    registrationBlock: 118000,
    expiryBlock: 153000,
    lastCheckedBlock: 118045,
    autoRenew: false,
    scheduleId: 0,
    status: "Active",
    registeredDateFormatted: "Aug 31, 2026",
    expiresDateFormatted: "Sep 07, 2026",
    maintenance: {
      scheduleId: 0,
      targetBlock: 153000,
      nextCheckTimestamp: "Sep 07, 2026 · 12:00 UTC",
      autoRenewScheduled: false,
    },
  },
  {
    label: "vitalik",
    domain: "vitalik.ritual",
    owner: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    resolvedAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    registrationBlock: 121000,
    expiryBlock: 156000,
    lastCheckedBlock: 121002,
    autoRenew: true,
    scheduleId: 103,
    status: "Active",
    registeredDateFormatted: "Sep 02, 2026",
    expiresDateFormatted: "Sep 09, 2026",
    maintenance: {
      scheduleId: 103,
      targetBlock: 156000,
      nextCheckTimestamp: "Sep 09, 2026 · 20:15 UTC",
      autoRenewScheduled: true,
    },
  },
  {
    label: "lapsed-demo",
    domain: "lapsed-demo.ritual",
    owner: "0x1111111111111111111111111111111111111111",
    resolvedAddress: "0x1111111111111111111111111111111111111111",
    registrationBlock: 80000,
    expiryBlock: 115000,
    lastCheckedBlock: 115120,
    autoRenew: false,
    scheduleId: 0,
    status: "Expired",
    registeredDateFormatted: "Aug 15, 2026",
    expiresDateFormatted: "Aug 22, 2026",
    maintenance: {
      scheduleId: 0,
      targetBlock: 115000,
      nextCheckTimestamp: "Lapsed / Expired",
      autoRenewScheduled: false,
    },
  },
];

const NamesContext = createContext<NamesContextType | null>(null);

export const NamesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<Mode>("demo");
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [demoNames, setDemoNames] = useState<NameRecordUI[]>(() => {
    const saved = localStorage.getItem("ritual_names_demo_v2");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing saved demo names", e);
      }
    }
    return SEEDED_DEMO_NAMES;
  });

  const [testnetNames, setTestnetNames] = useState<NameRecordUI[]>([]);
  const [selectedName, setSelectedName] = useState<NameRecordUI | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentBlock, setCurrentBlock] = useState<number>(121500);

  useEffect(() => {
    localStorage.setItem("ritual_names_demo_v2", JSON.stringify(demoNames));
  }, [demoNames]);

  // Viem Public Client for Testnet Mode
  const getPublicClient = () => {
    return createPublicClient({
      chain: {
        id: RITUAL_CHAIN.id,
        name: RITUAL_CHAIN.name,
        nativeCurrency: RITUAL_CHAIN.nativeCurrency,
        rpcUrls: RITUAL_CHAIN.rpcUrls,
      },
      transport: http(RITUAL_CHAIN.rpcUrls.default.http[0]),
    });
  };

  // Fetch block number and names on Testnet mode
  useEffect(() => {
    if (mode === "testnet") {
      const client = getPublicClient();
      client
        .getBlockNumber()
        .then((bn) => setCurrentBlock(Number(bn)))
        .catch(() => {});

      if (CONTRACT_ADDRESS && CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000") {
        client.readContract({
          address: CONTRACT_ADDRESS,
          abi: RITUAL_NAMES_ABI,
          functionName: "getAllNames",
        }).then((rawList: any) => {
          if (Array.isArray(rawList)) {
            const parsed: NameRecordUI[] = rawList.map((r: any) => ({
              label: r.label,
              domain: `${r.label}.ritual`,
              owner: r.owner,
              resolvedAddress: r.resolvedAddress,
              registrationBlock: Number(r.registrationBlock),
              expiryBlock: Number(r.expiryBlock),
              lastCheckedBlock: Number(r.lastCheckedBlock),
              autoRenew: Boolean(r.autoRenew),
              scheduleId: Number(r.scheduleId),
              status: Number(r.expiryBlock) < currentBlock ? "Expired" : "Active",
              registeredDateFormatted: "Sep 02, 2026",
              expiresDateFormatted: "Sep 09, 2026",
            }));
            setTestnetNames(parsed);
          }
        }).catch(() => {});
      }
    }
  }, [mode, currentBlock]);

  // Connect wallet
  const connectWallet = async () => {
    if (mode === "demo") {
      setWalletAddress("0x71C7656EC7ab88b098defB751B7401B5f6d8976F");
      return;
    }

    if (typeof window !== "undefined" && (window as any).ethereum) {
      try {
        const client = createWalletClient({
          chain: {
            id: RITUAL_CHAIN.id,
            name: RITUAL_CHAIN.name,
            nativeCurrency: RITUAL_CHAIN.nativeCurrency,
            rpcUrls: RITUAL_CHAIN.rpcUrls,
          },
          transport: custom((window as any).ethereum),
        });
        const [account] = await client.requestAddresses();
        setWalletAddress(account);
      } catch (err: any) {
        setError(err.message || "Failed to connect wallet");
      }
    } else {
      setError("No Web3 wallet found. Please install MetaMask or similar browser extension.");
    }
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
  };

  const activeNames = mode === "demo" ? demoNames : testnetNames;

  // Check Availability
  const checkAvailability = async (
    rawLabel: string
  ): Promise<{ available: boolean; record?: NameRecordUI }> => {
    const clean = formatLabel(rawLabel);
    if (!isValidLabel(clean)) return { available: false };

    if (mode === "demo") {
      const found = demoNames.find((n) => n.label === clean);
      if (found && found.status === "Active") {
        return { available: false, record: found };
      }
      return { available: true };
    } else {
      if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
        return { available: true };
      }
      try {
        const client = getPublicClient();
        const res: any = await client.readContract({
          address: CONTRACT_ADDRESS,
          abi: RITUAL_NAMES_ABI,
          functionName: "getStatus",
          args: [clean],
        });
        const statusEnum = res[0]; // 0 = Active, 1 = Expired
        if (statusEnum === 0) {
          const rec = await getRecord(clean);
          return { available: false, record: rec || undefined };
        }
        return { available: true };
      } catch (e) {
        // UnknownName error means available!
        return { available: true };
      }
    }
  };

  // Get Record
  const getRecord = async (rawLabel: string): Promise<NameRecordUI | null> => {
    const clean = formatLabel(rawLabel);
    if (mode === "demo") {
      return demoNames.find((n) => n.label === clean) || null;
    } else {
      if (!CONTRACT_ADDRESS) return null;
      try {
        const client = getPublicClient();
        const rawRecord: any = await client.readContract({
          address: CONTRACT_ADDRESS,
          abi: RITUAL_NAMES_ABI,
          functionName: "getRecord",
          args: [clean],
        });
        const statusRes: any = await client.readContract({
          address: CONTRACT_ADDRESS,
          abi: RITUAL_NAMES_ABI,
          functionName: "getStatus",
          args: [clean],
        });

        const statusStr = statusRes[0] === 0 ? "Active" : "Expired";

        return {
          label: rawRecord.label,
          domain: `${rawRecord.label}.ritual`,
          owner: rawRecord.owner,
          resolvedAddress: rawRecord.resolvedAddress,
          registrationBlock: Number(rawRecord.registrationBlock),
          expiryBlock: Number(rawRecord.expiryBlock),
          lastCheckedBlock: Number(rawRecord.lastCheckedBlock),
          autoRenew: Boolean(rawRecord.autoRenew),
          scheduleId: Number(rawRecord.scheduleId),
          status: statusStr,
          registeredDateFormatted: "Sep 02, 2026",
          expiresDateFormatted: "Sep 09, 2026",
          maintenance: {
            scheduleId: Number(rawRecord.scheduleId),
            targetBlock: Number(rawRecord.expiryBlock),
            nextCheckTimestamp: "Sep 09, 2026 · 18:00 UTC",
            autoRenewScheduled: Boolean(rawRecord.autoRenew),
          },
        };
      } catch (e) {
        return null;
      }
    }
  };

  // Reverse Resolve
  const reverseResolve = async (address: string): Promise<string | null> => {
    if (!address) return null;
    const cleanAddr = address.toLowerCase();

    if (mode === "demo") {
      const match = demoNames.find((n) => n.owner.toLowerCase() === cleanAddr && n.status === "Active");
      return match ? match.domain : null;
    } else {
      if (!CONTRACT_ADDRESS) return null;
      try {
        const client = getPublicClient();
        const primaryLabel: any = await client.readContract({
          address: CONTRACT_ADDRESS,
          abi: RITUAL_NAMES_ABI,
          functionName: "reverseResolve",
          args: [address as `0x${string}`],
        });
        return primaryLabel ? `${primaryLabel}.ritual` : null;
      } catch (e) {
        return null;
      }
    }
  };

  // Register Name
  const registerName = async (rawLabel: string, autoRenew: boolean): Promise<boolean> => {
    const clean = formatLabel(rawLabel);
    if (!isValidLabel(clean)) {
      setError("Invalid label format. Must be 3-32 lowercase letters, numbers, or hyphens.");
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (mode === "demo") {
        const owner = walletAddress || "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";
        const newRecord: NameRecordUI = {
          label: clean,
          domain: `${clean}.ritual`,
          owner: owner,
          resolvedAddress: owner,
          registrationBlock: currentBlock,
          expiryBlock: currentBlock + 35000,
          lastCheckedBlock: currentBlock,
          autoRenew: autoRenew,
          scheduleId: autoRenew ? Math.floor(Math.random() * 900) + 100 : 0,
          status: "Active",
          registeredDateFormatted: new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "2-digit",
            year: "numeric",
          }),
          expiresDateFormatted: new Date(Date.now() + 7 * 86400 * 1000).toLocaleDateString(
            "en-US",
            { month: "short", day: "2-digit", year: "numeric" }
          ),
          maintenance: {
            scheduleId: autoRenew ? Math.floor(Math.random() * 900) + 100 : 0,
            targetBlock: currentBlock + 35000,
            nextCheckTimestamp: `${new Date(Date.now() + 7 * 86400 * 1000).toLocaleDateString("en-US", { month: "short", day: "2-digit" })} · 18:00 UTC`,
            autoRenewScheduled: autoRenew,
          },
        };

        setDemoNames((prev) => [newRecord, ...prev.filter((n) => n.label !== clean)]);
        setSelectedName(newRecord);
        setIsLoading(false);
        return true;
      } else {
        if (!CONTRACT_ADDRESS) {
          throw new Error("CONTRACT_ADDRESS not configured in .env");
        }
        const walletClient = createWalletClient({
          chain: {
            id: RITUAL_CHAIN.id,
            name: RITUAL_CHAIN.name,
            nativeCurrency: RITUAL_CHAIN.nativeCurrency,
            rpcUrls: RITUAL_CHAIN.rpcUrls,
          },
          transport: custom((window as any).ethereum),
        });

        const [account] = await walletClient.requestAddresses();
        const hash = await walletClient.writeContract({
          address: CONTRACT_ADDRESS,
          abi: RITUAL_NAMES_ABI,
          functionName: "register",
          args: [clean, autoRenew],
          account,
        });

        const publicClient = getPublicClient();
        await publicClient.waitForTransactionReceipt({ hash });
        const newRec = await getRecord(clean);
        if (newRec) setSelectedName(newRec);
        setIsLoading(false);
        return true;
      }
    } catch (err: any) {
      setError(err.message || "Registration failed");
      setIsLoading(false);
      return false;
    }
  };

  // Toggle Auto Renew
  const toggleAutoRenew = async (rawLabel: string, enabled: boolean): Promise<boolean> => {
    const clean = formatLabel(rawLabel);
    setIsLoading(true);

    try {
      if (mode === "demo") {
        setDemoNames((prev) =>
          prev.map((n) => {
            if (n.label === clean) {
              const updated = {
                ...n,
                autoRenew: enabled,
                scheduleId: enabled ? (n.scheduleId || 205) : n.scheduleId,
                maintenance: {
                  ...n.maintenance!,
                  autoRenewScheduled: enabled,
                },
              };
              if (selectedName?.label === clean) setSelectedName(updated);
              return updated;
            }
            return n;
          })
        );
        setIsLoading(false);
        return true;
      } else {
        const walletClient = createWalletClient({
          chain: {
            id: RITUAL_CHAIN.id,
            name: RITUAL_CHAIN.name,
            nativeCurrency: RITUAL_CHAIN.nativeCurrency,
            rpcUrls: RITUAL_CHAIN.rpcUrls,
          },
          transport: custom((window as any).ethereum),
        });
        const [account] = await walletClient.requestAddresses();
        const hash = await walletClient.writeContract({
          address: CONTRACT_ADDRESS,
          abi: RITUAL_NAMES_ABI,
          functionName: "setAutoRenew",
          args: [clean, enabled],
          account,
        });
        await getPublicClient().waitForTransactionReceipt({ hash });
        const updated = await getRecord(clean);
        if (updated) setSelectedName(updated);
        setIsLoading(false);
        return true;
      }
    } catch (e: any) {
      setError(e.message || "Failed to update auto-renew");
      setIsLoading(false);
      return false;
    }
  };

  // Update Resolved Target
  const updateResolvedAddress = async (rawLabel: string, target: string): Promise<boolean> => {
    const clean = formatLabel(rawLabel);
    setIsLoading(true);

    try {
      if (mode === "demo") {
        setDemoNames((prev) =>
          prev.map((n) => {
            if (n.label === clean) {
              const updated = { ...n, resolvedAddress: target };
              if (selectedName?.label === clean) setSelectedName(updated);
              return updated;
            }
            return n;
          })
        );
        setIsLoading(false);
        return true;
      } else {
        const walletClient = createWalletClient({
          chain: {
            id: RITUAL_CHAIN.id,
            name: RITUAL_CHAIN.name,
            nativeCurrency: RITUAL_CHAIN.nativeCurrency,
            rpcUrls: RITUAL_CHAIN.rpcUrls,
          },
          transport: custom((window as any).ethereum),
        });
        const [account] = await walletClient.requestAddresses();
        const hash = await walletClient.writeContract({
          address: CONTRACT_ADDRESS,
          abi: RITUAL_NAMES_ABI,
          functionName: "setResolvedAddress",
          args: [clean, target as `0x${string}`],
          account,
        });
        await getPublicClient().waitForTransactionReceipt({ hash });
        const updated = await getRecord(clean);
        if (updated) setSelectedName(updated);
        setIsLoading(false);
        return true;
      }
    } catch (e: any) {
      setError(e.message || "Failed to update target address");
      setIsLoading(false);
      return false;
    }
  };

  // Set Primary Name
  const setPrimaryName = async (rawLabel: string): Promise<boolean> => {
    const clean = formatLabel(rawLabel);
    setIsLoading(true);
    try {
      if (mode === "demo") {
        setIsLoading(false);
        return true;
      } else {
        const walletClient = createWalletClient({
          chain: {
            id: RITUAL_CHAIN.id,
            name: RITUAL_CHAIN.name,
            nativeCurrency: RITUAL_CHAIN.nativeCurrency,
            rpcUrls: RITUAL_CHAIN.rpcUrls,
          },
          transport: custom((window as any).ethereum),
        });
        const [account] = await walletClient.requestAddresses();
        const hash = await walletClient.writeContract({
          address: CONTRACT_ADDRESS,
          abi: RITUAL_NAMES_ABI,
          functionName: "setPrimaryName",
          args: [clean],
          account,
        });
        await getPublicClient().waitForTransactionReceipt({ hash });
        setIsLoading(false);
        return true;
      }
    } catch (e: any) {
      setError(e.message || "Failed to set primary name");
      setIsLoading(false);
      return false;
    }
  };

  // Transfer Name
  const transferName = async (rawLabel: string, newOwner: string): Promise<boolean> => {
    const clean = formatLabel(rawLabel);
    setIsLoading(true);

    try {
      if (mode === "demo") {
        setDemoNames((prev) =>
          prev.map((n) => {
            if (n.label === clean) {
              const updated = { ...n, owner: newOwner };
              if (selectedName?.label === clean) setSelectedName(updated);
              return updated;
            }
            return n;
          })
        );
        setIsLoading(false);
        return true;
      } else {
        const walletClient = createWalletClient({
          chain: {
            id: RITUAL_CHAIN.id,
            name: RITUAL_CHAIN.name,
            nativeCurrency: RITUAL_CHAIN.nativeCurrency,
            rpcUrls: RITUAL_CHAIN.rpcUrls,
          },
          transport: custom((window as any).ethereum),
        });
        const [account] = await walletClient.requestAddresses();
        const hash = await walletClient.writeContract({
          address: CONTRACT_ADDRESS,
          abi: RITUAL_NAMES_ABI,
          functionName: "transfer",
          args: [clean, newOwner as `0x${string}`],
          account,
        });
        await getPublicClient().waitForTransactionReceipt({ hash });
        const updated = await getRecord(clean);
        if (updated) setSelectedName(updated);
        setIsLoading(false);
        return true;
      }
    } catch (e: any) {
      setError(e.message || "Failed to transfer name");
      setIsLoading(false);
      return false;
    }
  };

  return (
    <NamesContext.Provider
      value={{
        mode,
        setMode,
        walletAddress,
        connectWallet,
        disconnectWallet,
        names: activeNames,
        checkAvailability,
        getRecord,
        reverseResolve,
        registerName,
        toggleAutoRenew,
        updateResolvedAddress,
        setPrimaryName,
        transferName,
        selectedName,
        setSelectedName,
        isLoading,
        error,
        currentBlock,
      }}
    >
      {children}
    </NamesContext.Provider>
  );
};

export const useNames = () => {
  const context = useContext(NamesContext);
  if (!context) {
    throw new Error("useNames must be used within a NamesProvider");
  }
  return context;
};
