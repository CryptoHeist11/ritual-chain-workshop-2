import React, { useState } from "react";
import { NamesProvider } from "./context/NamesContext";
import { Header } from "./components/Header";
import { HeroSearch } from "./components/HeroSearch";
import { ReverseResolution } from "./components/ReverseResolution";
import { NameExplorer } from "./components/NameExplorer";
import { NameDetailModal } from "./components/NameDetailModal";
import { FAUCET_URL, RITUAL_CHAIN } from "./config";
import { Cpu, ExternalLink, X } from "lucide-react";

const MainLayout: React.FC = () => {
  const [showBanner, setShowBanner] = useState<boolean>(true);

  return (
    <div className="app-viewport">
      <Header />

      {/* Dismissible Demo Mode Status Banner */}
      {showBanner && (
        <div className="status-banner-container">
          <div className="status-banner-content">
            <div className="status-banner-text-wrapper">
              <span className="status-banner-title">⚠️ Demo Mode Active</span>
              <span className="status-banner-message">
                The Ritual Testnet is temporarily unavailable. You can continue exploring the application and testing its features in Demo Mode. Live testnet interactions will resume once the network is back online.
              </span>
            </div>
            <button
              onClick={() => setShowBanner(false)}
              className="status-banner-close-btn"
              title="Dismiss banner"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <main className="main-content-container">
        {/* Landing Hero & Search Component */}
        <HeroSearch />

        {/* Two Column Grid: Reverse Resolution & Name Explorer */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-12">
          <div className="lg:col-span-1">
            <ReverseResolution />
          </div>
          <div className="lg:col-span-2">
            <NameExplorer />
          </div>
        </div>
      </main>

      {/* Detail Modal */}
      <NameDetailModal />

      {/* Footer */}
      <footer className="footer-container">
        <div className="footer-content">
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Cpu className="w-4 h-4 text-purple-400" />
            <span>Powered by <strong>Ritual Chain</strong> Scheduler & Precompiles</span>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-400">
            <a href="https://docs.ritualfoundation.org" target="_blank" rel="noreferrer" className="hover:text-purple-300 transition-colors flex items-center">
              Ritual Docs <ExternalLink className="w-3 h-3 ml-1" />
            </a>
            <a href={FAUCET_URL} target="_blank" rel="noreferrer" className="hover:text-purple-300 transition-colors flex items-center">
              Testnet Faucet <ExternalLink className="w-3 h-3 ml-1" />
            </a>
            <a href={RITUAL_CHAIN.blockExplorers.default.url} target="_blank" rel="noreferrer" className="hover:text-purple-300 transition-colors flex items-center">
              Block Explorer <ExternalLink className="w-3 h-3 ml-1" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export function App() {
  return (
    <NamesProvider>
      <MainLayout />
    </NamesProvider>
  );
}

export default App;
