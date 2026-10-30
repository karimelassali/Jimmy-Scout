import React from 'react';
import { Gauge, Inbox, MapPin, Camera, SlidersHorizontal } from 'lucide-react';

export type TabId = 'control' | 'leads' | 'targets' | 'scanner' | 'persona';

interface BottomBarProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  leadsCount?: number;
}

export const BottomBar: React.FC<BottomBarProps> = ({
  activeTab,
  onSelectTab,
  leadsCount = 0,
}) => {
  const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode; badge?: number }> = [
    {
      id: 'control',
      label: 'Dashboard',
      icon: <Gauge className="w-5 h-5" />,
    },
    {
      id: 'leads',
      label: 'Deals',
      icon: <Inbox className="w-5 h-5" />,
      badge: leadsCount,
    },
    {
      id: 'targets',
      label: 'Regions',
      icon: <MapPin className="w-5 h-5" />,
    },
    {
      id: 'scanner',
      label: 'Scan Cards',
      icon: <Camera className="w-5 h-5" />,
    },
    {
      id: 'persona',
      label: 'Settings',
      icon: <SlidersHorizontal className="w-5 h-5" />,
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 pb-safe bg-white/95 backdrop-blur-md border-t border-slate-200">
      <div className="grid grid-cols-5 items-center h-16 max-w-lg mx-auto px-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className="flex flex-col items-center justify-center min-h-[48px] min-w-[48px] py-1 transition-colors cursor-pointer"
            >
              <div
                className={`relative flex items-center justify-center w-14 h-8 rounded-full transition-colors ${
                  isActive
                    ? 'bg-[#FFF0E5] text-[#FF6B00]'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.icon}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1 right-1 px-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-[#FF6B00] text-white text-[10px] font-mono font-semibold rounded-full tabular-nums">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[11px] tracking-tight mt-1 whitespace-nowrap ${
                  isActive ? 'font-semibold text-[#0B2240]' : 'font-medium text-slate-600'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
