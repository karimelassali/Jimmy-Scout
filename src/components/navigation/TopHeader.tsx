import React from 'react';
import { PWAInstallButton } from '../pwa/PWAInstallButton.tsx';
import { TourHelpButton } from '../guide/TourHelpButton.tsx';
import { TabId } from './BottomBar.tsx';

interface TopHeaderProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  unreadCount?: number;
  onPrimaryAction?: () => void;
  isAgentActive?: boolean;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeTab,
  onSelectTab,
  unreadCount = 0,
  onPrimaryAction,
  isAgentActive = false,
}) => {
  const navItems: Array<{ id: TabId; label: string }> = [
    { id: 'control', label: 'Dashboard' },
    {
      id: 'leads',
      label: unreadCount > 0 ? `Deals (${unreadCount})` : 'Deals',
    },
    { id: 'targets', label: 'Regions' },
    { id: 'scanner', label: 'Scan Cards' },
    { id: 'persona', label: 'Settings' },
  ];

  return (
    <header className="sticky top-0 w-full z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 pt-safe">
      <div className="max-w-7xl mx-auto h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Official JimiScout Logo & Live Agent Status */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="#control"
            data-tour="header-wordmark"
            onClick={(e) => {
              e.preventDefault();
              onSelectTab('control');
            }}
            className="flex items-center gap-2 shrink-0"
          >
            <img
              src="/assets/jimiscout-logo.png"
              alt="JimiScout"
              className="h-10 w-auto object-contain rounded-lg"
            />
          </a>

          <span className="hidden sm:inline-block h-4 w-px bg-slate-200" />

          <div
            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
              isAgentActive
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                : 'bg-orange-50 text-[#FF6B00] border-orange-200/80'
            }`}
            title={isAgentActive ? 'Agent Jimy is actively working' : 'Agent Jimy is waiting on standby'}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isAgentActive ? 'bg-emerald-500 animate-pulse' : 'bg-[#FF6B00]'
              }`}
            />
            <span>{isAgentActive ? 'Jimy is working' : 'Jimy is waiting'}</span>
          </div>
        </div>

        {/* Zone 2: Navigation tabs */}
        <nav
          data-tour="nav-tabs"
          className="hidden md:flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/70"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-white text-[#0B2240] shadow-2xs border border-slate-200/70 font-semibold'
                    : 'text-slate-600 hover:text-[#0B2240] hover:bg-white/60'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <TourHelpButton />
          <PWAInstallButton />
          <button
            data-tour="process-inbound-btn"
            onClick={onPrimaryAction}
            className="h-9 px-4 rounded-lg bg-[#FF6B00] hover:bg-[#E05E00] text-white font-medium text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
          >
            Paste Seller Reply
          </button>
        </div>
      </div>
    </header>
  );
};
