import React from "react";
import { ExternalLink, ShieldCheck, Wallet, Sparkles, Network } from "lucide-react";
import { useNames } from "../context/NamesContext";
import { FAUCET_URL, truncateAddress } from "../config";

export const Header: React.FC = () => {
  const { mode, setMode, walletAddress, connectWallet, disconnectWallet } = useNames();

  return (
    <header className="header-container">
      <div className="header-content">
        {/* Brand */}
        <div className="brand-badge">
          <div className="brand-icon">
            <Sparkles className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="brand-title">Ritual Names</h1>
            <span className="brand-subtitle">Chain Native Identity</span>
          </div>
        </div>

        {/* Center Mode Switch */}
        <div className="mode-switch-wrapper">
          <button
            type="button"
            onClick={() => setMode("demo")}
            className={`mode-btn ${mode === "demo" ? "mode-btn-active" : ""}`}
          >
            <Sparkles className="w-4 h-4 mr-1.5 inline" />
            Demo Mode
          </button>
          <button
            type="button"
            onClick={() => setMode("testnet")}
            className={`mode-btn ${mode === "testnet" ? "mode-btn-active" : ""}`}
          >
            <Network className="w-4 h-4 mr-1.5 inline" />
            Testnet Mode
          </button>
        </div>

        {/* Right side action controls */}
        <div className="flex items-center gap-3">
          {/* Faucet Link */}
          <a
            href={FAUCET_URL}
            target="_blank"
            rel="noreferrer"
            className="faucet-link"
          >
            Faucet
            <ExternalLink className="w-3.5 h-3.5 ml-1" />
          </a>

          {/* Wallet Connect */}
          {walletAddress ? (
            <button onClick={disconnectWallet} className="wallet-connected-btn">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{truncateAddress(walletAddress)}</span>
            </button>
          ) : (
            <button onClick={connectWallet} className="wallet-connect-btn">
              <Wallet className="w-4 h-4 mr-1.5" />
              <span>Connect {mode === "testnet" ? "Testnet" : "Wallet"}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
