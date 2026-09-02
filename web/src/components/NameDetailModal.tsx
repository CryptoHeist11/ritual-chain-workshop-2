import React, { useState } from "react";
import {
  Calendar,
  Clock,
  Cpu,
  Globe,
  Loader2,
  ShieldCheck,
  ShieldX,
  User,
  Wallet,
  Zap,
  Edit3,
  Check,
} from "lucide-react";
import { useNames } from "../context/NamesContext";
import { truncateAddress } from "../config";

export const NameDetailModal: React.FC = () => {
  const { selectedName, setSelectedName, mode, toggleAutoRenew, updateResolvedAddress, walletAddress, isLoading } = useNames();
  const [activeTargetTab, setActiveTargetTab] = useState<"wallet" | "contract" | "dapp" | "profile">("wallet");
  const [isEditingTarget, setIsEditingTarget] = useState<boolean>(false);
  const [newTargetInput, setNewTargetInput] = useState<string>("");

  if (!selectedName) return null;

  const isOwner = walletAddress
    ? selectedName.owner.toLowerCase() === walletAddress.toLowerCase()
    : true; // In demo mode, allow editing for convenience

  const handleUpdateTarget = async () => {
    if (!newTargetInput || !newTargetInput.startsWith("0x")) return;
    const ok = await updateResolvedAddress(selectedName.label, newTargetInput);
    if (ok) {
      setIsEditingTarget(false);
    }
  };

  const handleToggleAutoRenew = async () => {
    await toggleAutoRenew(selectedName.label, !selectedName.autoRenew);
  };

  const isExpired = selectedName.status === "Expired";

  return (
    <div className="modal-backdrop" onClick={() => setSelectedName(null)}>
      <div className="detail-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="detail-modal-header">
          <div className="flex items-center gap-3">
            <h2 className="detail-name-title">{selectedName.domain}</h2>
            <span className={`status-pill ${isExpired ? "status-pill-expired" : "status-pill-active"}`}>
              {isExpired ? (
                <>
                  <ShieldX className="w-3.5 h-3.5 mr-1" />
                  Expired
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                  Active
                </>
              )}
            </span>
          </div>

          <button onClick={() => setSelectedName(null)} className="close-modal-btn">
            ✕
          </button>
        </div>

        <div className="detail-modal-body space-y-6">
          {/* Key-Value Card */}
          <div className="keyvalue-card">
            <div className="keyvalue-grid">
              <div className="kv-item">
                <span className="kv-label">
                  <User className="w-3.5 h-3.5 mr-1 inline text-purple-400" />
                  Owner
                </span>
                <span className="kv-value font-mono" title={selectedName.owner}>
                  {truncateAddress(selectedName.owner)}
                </span>
              </div>

              <div className="kv-item">
                <span className="kv-label">
                  <Globe className="w-3.5 h-3.5 mr-1 inline text-purple-400" />
                  Network
                </span>
                <span className="kv-value">
                  {mode === "testnet" ? "Ritual Testnet" : "Demo Mode"}
                </span>
              </div>

              <div className="kv-item">
                <span className="kv-label">
                  <Calendar className="w-3.5 h-3.5 mr-1 inline text-purple-400" />
                  Registered
                </span>
                <span className="kv-value">{selectedName.registeredDateFormatted}</span>
              </div>

              <div className="kv-item">
                <span className="kv-label">
                  <Calendar className="w-3.5 h-3.5 mr-1 inline text-purple-400" />
                  Expires
                </span>
                <span className={`kv-value ${isExpired ? "text-rose-400" : ""}`}>
                  {selectedName.expiresDateFormatted}
                </span>
              </div>

              <div className="kv-item">
                <span className="kv-label">
                  <Zap className="w-3.5 h-3.5 mr-1 inline text-purple-400" />
                  Auto-renew
                </span>
                <span className={`kv-value font-semibold ${selectedName.autoRenew ? "text-emerald-400" : "text-slate-400"}`}>
                  {selectedName.autoRenew ? "ON" : "OFF"}
                </span>
              </div>

              <div className="kv-item">
                <span className="kv-label">
                  <Clock className="w-3.5 h-3.5 mr-1 inline text-purple-400" />
                  Last checked
                </span>
                <span className="kv-value">12 blocks ago</span>
              </div>
            </div>
          </div>

          {/* Resolved-Targets Section */}
          <div className="section-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="section-title">Resolved Targets</h3>
              <span className="text-xs text-purple-300">Where this name points</span>
            </div>

            {/* Target Type Tabs */}
            <div className="target-tabs">
              <button
                type="button"
                onClick={() => setActiveTargetTab("wallet")}
                className={`tab-btn ${activeTargetTab === "wallet" ? "tab-btn-active" : ""}`}
              >
                <Wallet className="w-3.5 h-3.5 mr-1.5 inline" />
                Wallet
              </button>
              <button
                type="button"
                disabled
                className="tab-btn tab-btn-disabled"
                title="Contract target type stubbed for future expansion"
              >
                <Cpu className="w-3.5 h-3.5 mr-1.5 inline" />
                Contract (Stub)
              </button>
              <button
                type="button"
                disabled
                className="tab-btn tab-btn-disabled"
                title="dApp target type stubbed for future expansion"
              >
                <Globe className="w-3.5 h-3.5 mr-1.5 inline" />
                dApp (Stub)
              </button>
              <button
                type="button"
                disabled
                className="tab-btn tab-btn-disabled"
                title="Builder Profile stubbed for future expansion"
              >
                <User className="w-3.5 h-3.5 mr-1.5 inline" />
                Builder Profile (Stub)
              </button>
            </div>

            {/* Tab content for Wallet */}
            {activeTargetTab === "wallet" && (
              <div className="target-box mt-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Target Address:</span>
                    {!isEditingTarget ? (
                      <code className="font-mono text-purple-300 text-sm">
                        {selectedName.resolvedAddress}
                      </code>
                    ) : (
                      <input
                        type="text"
                        value={newTargetInput}
                        onChange={(e) => setNewTargetInput(e.target.value)}
                        placeholder="0x..."
                        className="edit-target-input"
                      />
                    )}
                  </div>

                  {isOwner && (
                    <div>
                      {!isEditingTarget ? (
                        <button
                          onClick={() => {
                            setNewTargetInput(selectedName.resolvedAddress);
                            setIsEditingTarget(true);
                          }}
                          className="edit-btn"
                        >
                          <Edit3 className="w-3.5 h-3.5 mr-1 inline" />
                          Edit
                        </button>
                      ) : (
                        <button
                          onClick={handleUpdateTarget}
                          disabled={isLoading}
                          className="save-btn"
                        >
                          <Check className="w-3.5 h-3.5 mr-1 inline" />
                          Save
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Scheduled Maintenance Section */}
          <div className="section-card maintenance-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="section-title flex items-center">
                <Zap className="w-4 h-4 text-purple-400 mr-2" />
                Scheduled Maintenance
              </h3>
              <span className="text-xs text-purple-300 font-mono">
                {selectedName.autoRenew ? "Ritual Scheduler Active" : "Auto-renew Disabled"}
              </span>
            </div>

            {isExpired ? (
              /* Expired State Display */
              <div className="expired-maintenance-box">
                <ShieldX className="w-6 h-6 text-rose-400 mr-3 shrink-0" />
                <div>
                  <h4 className="font-semibold text-rose-300">Name Has Lapsed to Expired</h4>
                  <p className="text-xs text-rose-200/80 mt-1">
                    The registration term passed without auto-renewal. Anyone can now re-register this name label on Ritual Chain.
                  </p>
                </div>
              </div>
            ) : selectedName.autoRenew ? (
              /* Auto-renew Active Display */
              <div className="maintenance-details-box">
                <div className="maintenance-status-row">
                  <span className="text-xs text-slate-400">Auto-renew State:</span>
                  <span className="text-sm font-semibold text-emerald-400 flex items-center">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-2" />
                    ● Scheduled
                  </span>
                </div>

                <div className="maintenance-status-row">
                  <span className="text-xs text-slate-400">Next Check:</span>
                  <span className="text-sm font-mono text-purple-200">
                    {selectedName.maintenance?.nextCheckTimestamp || "Sep 09 · 18:00 UTC"}
                  </span>
                </div>

                <div className="maintenance-footer-note">
                  <Cpu className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>
                    <strong>Ritual Scheduler</strong> handles execution — no keeper, no cron.
                  </span>
                </div>

                <div className="mt-3 text-right">
                  <button
                    onClick={handleToggleAutoRenew}
                    disabled={isLoading}
                    className="disable-autorenew-btn"
                  >
                    {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1 inline" /> : null}
                    Disable Auto-Renew
                  </button>
                </div>
              </div>
            ) : (
              /* Auto-renew OFF Display */
              <div className="maintenance-off-box">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-200">Auto-renew is OFF</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Plain countdown active. Name will lapse to Expired on {selectedName.expiresDateFormatted}.
                    </p>
                  </div>
                  <button
                    onClick={handleToggleAutoRenew}
                    disabled={isLoading}
                    className="enable-autorenew-btn"
                  >
                    {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1 inline" /> : null}
                    Enable Auto-Renew
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
