import React from 'react';
import { Gauge, Inbox, MapPin, Camera, SlidersHorizontal, MailCheck } from 'lucide-react';

export type TabId = 'control' | 'leads' | 'emails' | 'targets' | 'scanner' | 'persona';

interface BottomBarProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  leadsCount?: number;
  sentCount?: number;
}

export const BottomBar: React.FC<BottomBarProps> = ({
  activeTab,
  onSelectTab,
  leadsCount = 0,
  sentCount = 0,
}) => {
  const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode; badge?: number }> = [
    {
      id: 'control',
      label: 'Accueil',
      icon: <Gauge className="w-4 h-4 sm:w-5 sm:h-5" />,
    },
    {
      id: 'leads',
      label: 'Dossiers',
      icon: <Inbox className="w-4 h-4 sm:w-5 sm:h-5" />,
      badge: leadsCount,
    },
    {
      id: 'emails',
      label: 'Envoyés',
      icon: <MailCheck className="w-4 h-4 sm:w-5 sm:h-5" />,
      badge: sentCount,
    },
    {
      id: 'targets',
      label: 'Régions',
      icon: <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />,
    },
    {
      id: 'scanner',
      label: 'Scanner',
      icon: <Camera className="w-4 h-4 sm:w-5 sm:h-5" />,
    },
    {
      id: 'persona',
      label: 'Réglages',
      icon: <SlidersHorizontal className="w-4 h-4 sm:w-5 sm:h-5" />,
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 pb-safe bg-white/95 backdrop-blur-md border-t border-slate-200">
      <div className="grid grid-cols-6 items-center h-16 max-w-lg mx-auto px-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className="flex flex-col items-center justify-center min-h-[48px] py-1 transition-colors cursor-pointer"
            >
              <div
                className={`relative flex items-center justify-center w-11 h-7 rounded-full transition-colors ${
                  isActive
                    ? 'bg-[#FFF0E5] text-[#FF6B00]'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.icon}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-1 px-1 min-w-[16px] h-[16px] flex items-center justify-center bg-[#FF6B00] text-white text-[9px] font-mono font-semibold rounded-full tabular-nums">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] mt-0.5 tracking-tight ${
                  isActive ? 'text-[#FF6B00] font-bold' : 'text-slate-600'
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
