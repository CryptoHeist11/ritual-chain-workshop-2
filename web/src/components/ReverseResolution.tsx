import React, { useState } from "react";
import { ArrowRightLeft, Search, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useNames } from "../context/NamesContext";
import { truncateAddress } from "../config";

export const ReverseResolution: React.FC = () => {
  const { reverseResolve, getRecord, setSelectedName } = useNames();
  const [addressInput, setAddressInput] = useState<string>("");
  const [searching, setSearching] = useState<boolean>(false);
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressInput || !addressInput.startsWith("0x")) return;

    setSearching(true);
    setHasSearched(false);
    setResolvedName(null);

    const name = await reverseResolve(addressInput.trim());
    setResolvedName(name);
    setSearching(false);
    setHasSearched(true);
  };

  const handleViewResolved = async () => {
    if (!resolvedName) return;
    const clean = resolvedName.replace(/\.ritual$/, "");
    const rec = await getRecord(clean);
    if (rec) setSelectedName(rec);
  };

  return (
    <div className="reverse-card">
      <div className="flex items-center gap-2 mb-3">
        <ArrowRightLeft className="w-4 h-4 text-purple-400" />
        <h3 className="reverse-card-title">Reverse Resolution</h3>
      </div>
      <p className="reverse-card-desc">
        Paste any Ritual Chain address to look up its configured primary <code>.ritual</code> identity.
      </p>

      <form onSubmit={handleLookup} className="reverse-search-form mt-4">
        <div className="search-input-wrapper">
          <Search className="search-icon w-4 h-4" />
          <input
            type="text"
            value={addressInput}
            onChange={(e) => {
              setAddressInput(e.target.value);
              setHasSearched(false);
            }}
            placeholder="Paste address e.g. 0x82F9291A..."
            className="reverse-search-input"
          />
          <button type="submit" disabled={searching} className="reverse-search-btn">
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Lookup"}
          </button>
        </div>
      </form>

      {hasSearched && (
        <div className="mt-4 pt-3 border-t border-slate-800">
          {resolvedName ? (
            <div className="flex items-center justify-between bg-purple-950/40 p-3 rounded-lg border border-purple-500/30">
              <div className="flex items-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 mr-2 shrink-0" />
                <div>
                  <span className="text-xs text-slate-400">Primary Name:</span>
                  <div className="text-base font-bold text-purple-300">{resolvedName}</div>
                </div>
              </div>
              <button onClick={handleViewResolved} className="view-profile-btn">
                View Detail
              </button>
            </div>
          ) : (
            <div className="flex items-center bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-slate-400 text-sm">
              <AlertCircle className="w-4 h-4 text-amber-400 mr-2 shrink-0" />
              <span>No primary name set for {truncateAddress(addressInput)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
