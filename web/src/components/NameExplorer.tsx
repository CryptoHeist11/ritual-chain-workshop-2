import React from "react";
import { Compass, ExternalLink, ShieldCheck, ShieldX, Zap } from "lucide-react";
import { useNames } from "../context/NamesContext";
import type { NameRecordUI } from "../context/NamesContext";
import { truncateAddress } from "../config";

export const NameExplorer: React.FC = () => {
  const { names, setSelectedName } = useNames();

  return (
    <div className="explorer-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-purple-400" />
          <h3 className="explorer-title">Name Explorer</h3>
        </div>
        <span className="text-xs text-purple-300 font-mono">
          {names.length} {names.length === 1 ? "Name" : "Names"} Registered
        </span>
      </div>

      {names.length === 0 ? (
        <div className="empty-explorer">
          <p>No registered names found yet.</p>
        </div>
      ) : (
        <div className="explorer-table-wrapper">
          <table className="explorer-table">
            <thead>
              <tr>
                <th>Domain Name</th>
                <th>Owner Address</th>
                <th>Registered</th>
                <th>Auto-Renew</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {names.map((item: NameRecordUI) => (
                <tr key={item.label} className="explorer-row" onClick={() => setSelectedName(item)}>
                  <td className="font-semibold text-purple-200">
                    {item.domain}
                  </td>
                  <td className="font-mono text-xs text-slate-300">
                    {truncateAddress(item.owner)}
                  </td>
                  <td className="text-xs text-slate-400">
                    {item.registeredDateFormatted}
                  </td>
                  <td>
                    {item.autoRenew ? (
                      <span className="inline-flex items-center text-xs text-emerald-400 font-mono">
                        <Zap className="w-3 h-3 mr-1" />
                        ON
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500 font-mono">OFF</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`status-pill ${
                        item.status === "Expired" ? "status-pill-expired" : "status-pill-active"
                      }`}
                    >
                      {item.status === "Expired" ? (
                        <>
                          <ShieldX className="w-3 h-3 mr-1" /> Expired
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3 h-3 mr-1" /> Active
                        </>
                      )}
                    </span>
                  </td>
                  <td className="text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedName(item);
                      }}
                      className="table-action-btn"
                    >
                      <span>View</span>
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
