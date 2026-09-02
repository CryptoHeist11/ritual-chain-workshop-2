import React, { useState, useEffect } from "react";
import { Search, CheckCircle2, XCircle, Loader2, ArrowRight, ShieldAlert } from "lucide-react";
import { useNames } from "../context/NamesContext";
import type { NameRecordUI } from "../context/NamesContext";
import { formatLabel, isValidLabel, truncateAddress } from "../config";

export const HeroSearch: React.FC = () => {
  const { checkAvailability, registerName, setSelectedName, isLoading, error } = useNames();
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusState, setStatusState] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [existingRecord, setExistingRecord] = useState<NameRecordUI | null>(null);
  const [autoRenewOptIn, setAutoRenewOptIn] = useState<boolean>(true);
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);

  const cleanLabel = formatLabel(searchTerm);
  const display = cleanLabel ? `${cleanLabel}.ritual` : "";

  useEffect(() => {
    if (!cleanLabel) {
      setStatusState("idle");
      setExistingRecord(null);
      return;
    }

    if (!isValidLabel(cleanLabel)) {
      setStatusState("idle");
      return;
    }

    setStatusState("checking");
    const timer = setTimeout(async () => {
      const res = await checkAvailability(cleanLabel);
      if (res.available) {
        setStatusState("available");
        setExistingRecord(null);
      } else {
        setStatusState("taken");
        setExistingRecord(res.record || null);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cleanLabel || statusState !== "available") return;
    const ok = await registerName(cleanLabel, autoRenewOptIn);
    if (ok) {
      setShowRegisterModal(false);
      setSearchTerm("");
      setStatusState("idle");
    }
  };

  return (
    <section className="hero-section">
      {/* Background glow effects */}
      <div className="hero-glow hero-glow-purple" />
      <div className="hero-glow hero-glow-blue" />

      <div className="hero-content">
        <h1 className="hero-headline">
          Give Ritual addresses a name.
        </h1>
        <p className="hero-subhead">
          Human readable identities for the Ritual Chain.
        </p>

        {/* Large Centered Search Box */}
        <div className="search-box-card">
          <div className="search-input-wrapper">
            <Search className="search-icon" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search for a name…"
              className="search-input"
            />
            {cleanLabel && (
              <span className="search-suffix-badge">
                {display}
              </span>
            )}
          </div>

          {/* Live Status indicator */}
          {cleanLabel && isValidLabel(cleanLabel) && (
            <div className="status-indicator-bar">
              {statusState === "checking" && (
                <div className="status-row status-checking">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-400 mr-2" />
                  <span>checking availability for <strong>{display}</strong>…</span>
                </div>
              )}

              {statusState === "available" && (
                <div className="status-row status-available">
                  <div className="flex items-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mr-2" />
                    <span>
                      <strong className="text-emerald-300">{display}</strong> is available!
                    </span>
                  </div>
                  <button
                    onClick={() => setShowRegisterModal(true)}
                    className="register-cta-btn"
                  >
                    <span>Register Name</span>
                    <ArrowRight className="w-4 h-4 ml-1.5" />
                  </button>
                </div>
              )}

              {statusState === "taken" && (
                <div className="status-row status-taken">
                  <div className="flex items-center">
                    <XCircle className="w-5 h-5 text-rose-400 mr-2" />
                    <span>
                      <strong className="text-rose-300">{display}</strong> is taken by{" "}
                      <code className="text-purple-300 font-mono">
                        {existingRecord ? truncateAddress(existingRecord.owner) : "another owner"}
                      </code>
                    </span>
                  </div>
                  {existingRecord && (
                    <button
                      onClick={() => setSelectedName(existingRecord)}
                      className="view-profile-btn"
                    >
                      View Profile
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Registration Modal */}
      {showRegisterModal && (
        <div className="modal-backdrop" onClick={() => setShowRegisterModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Register {display}</h3>
              <button onClick={() => setShowRegisterModal(false)} className="close-modal-btn">
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} className="modal-body">
              <div className="form-group">
                <label>Target Domain</label>
                <div className="read-only-box">{display}</div>
              </div>

              <div className="form-group">
                <label>Registration Period</label>
                <div className="read-only-box flex justify-between items-center">
                  <span>7 Days (Standard Term)</span>
                  <span className="text-xs text-purple-300 font-mono">35,000 blocks</span>
                </div>
              </div>

              {/* Auto-renew Opt-in */}
              <div className="autorenew-optin-box">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="autorenew-check"
                    checked={autoRenewOptIn}
                    onChange={(e) => setAutoRenewOptIn(e.target.checked)}
                    className="optin-checkbox"
                  />
                  <div>
                    <label htmlFor="autorenew-check" className="optin-label">
                      Enable Autonomous Auto-Renew (Ritual Scheduler)
                    </label>
                    <p className="optin-help">
                      Books a recurring maintenance execution on-chain with the Ritual Scheduler.
                      The chain auto-renews your name before expiry — no keeper bot required.
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="error-alert">
                  <ShieldAlert className="w-4 h-4 mr-2 inline" />
                  {error}
                </div>
              )}

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="confirm-register-btn"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Registering...
                    </>
                  ) : (
                    "Confirm Registration"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
