# Ritual Names

A human-readable naming layer for [Ritual Chain](https://docs.ritualfoundation.org) featuring autonomous on-chain maintenance.

Register `.ritual` names (e.g. `alice.ritual`), resolve names to wallet addresses, set primary reverse resolution, and enjoy **scheduled auto-renewal maintenance** powered directly by the **Ritual Chain Scheduler system contract** (`0x56e7...D58B`) — no keeper bots or external cron jobs required.

---

## Architecture

```
                                    register()
    user  ─────────────────────────────────────────────────────────────▶ ┌──────────────────────────┐
    user  ─────────────── setResolvedAddress / setPrimaryName ─────────▶ │  RitualNames.sol         │
                                                                         │                          │
                                                     schedule() ◀────────┤  names, owners, targets  │
                                                                         └──────────────────────────┘
     ┌─────────────────────────────┐                                           ▲              │
     │ Scheduler  0x56e7…D58B      │  onScheduledMaintenance                   │              │ deposit()
     │ system contract             │───────────────────────────────────────────┘              ▼
     │ recurring execution         │                                              ┌────────────────────────┐
     │ frequency = durationBlocks  │                                              │ RitualWallet 0x532F…   │
     └─────────────────────────────┘                                              │ prepaid execution fees │
                                                                                  └────────────────────────┘
```

---

## Features

- **On-Chain Label Storage**: Stores lowercase labels (e.g. `alice`) on-chain to minimize gas usage; appends `.ritual` in the frontend UI.
- **Label Validation**: Enforces 3 to 32 characters, lowercase alphanumeric (`a-z`, `0-9`) and hyphens (`-`).
- **Forward & Reverse Resolution**: Map names to target addresses (`resolve`) and addresses back to primary names (`reverseResolve`).
- **Autonomous Maintenance (Ritual Scheduler)**: When auto-renew is enabled, `register()` calls `IScheduler.schedule()` with recurring maintenance executions. The contract auto-extends expiry or flags names as `Expired` when lapsed.
- **Dual-Mode Web Application**:
  - **Demo Mode**: Instant off-chain testing with pre-seeded mock names and local state. Zero wallet setup required.
  - **Testnet Mode**: Connects directly to Ritual Testnet via Web3 wallet / Viem to interact with `RitualNames.sol`.

---

## Quickstart

### Smart Contracts (Hardhat)

```bash
cd hardhat
pnpm install
cp .env.example .env

# Run unit tests
npx hardhat test

# Deploy to Ritual Testnet
npx hardhat run scripts/deploy-names.ts
```

### Frontend Web App

```bash
cd web
pnpm install
cp .env.example .env.local

# Run development server
pnpm dev
```

---

## Reference

- Ritual Chain docs — <https://docs.ritualfoundation.org>
- Explorer — <https://explorer.ritualfoundation.org>
- Faucet — <https://faucet.ritualfoundation.org>
