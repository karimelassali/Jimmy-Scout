import React from 'react';
import { PWAInstallButton } from '../pwa/PWAInstallButton.tsx';
import { TabId } from './BottomBar.tsx';

interface TopHeaderProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  unreadCount?: number;
  onPrimaryAction?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeTab,
  onSelectTab,
  unreadCount = 0,
  onPrimaryAction,
}) => {
  const navItems: Array<{ id: TabId; label: string }> = [
    { id: 'control', label: 'Mission Control' },
    {
      id: 'leads',
      label: unreadCount > 0 ? `Incoming Deals (${unreadCount})` : 'Incoming Deals',
    },
    { id: 'targets', label: 'Swiss Cantons' },
    { id: 'persona', label: 'Email Persona' },
  ];

  return (
    <header className="sticky top-0 w-full z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 pt-safe">
      <div className="max-w-7xl mx-auto h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#control"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('control');
          }}
          className="font-heading font-bold text-xl tracking-tight text-[#0B2240] whitespace-nowrap shrink-0"
        >
          JimiScout
        </a>

        {/* Zone 2: 4 clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'border-[#FF6B00] text-[#0B2240] font-semibold'
                    : 'border-transparent text-slate-600 hover:text-[#0B2240]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <PWAInstallButton />
          <button
            onClick={onPrimaryAction}
            className="h-10 px-4 rounded-full bg-[#FF6B00] hover:bg-[#E05E00] text-white font-heading font-semibold text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
          >
            Process Inbound Reply
          </button>
        </div>
      </div>
    </header>
  );
};
