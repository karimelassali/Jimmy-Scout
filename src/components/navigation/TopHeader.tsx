import React from 'react';
import { Compass, Bell, Mail, Sparkles, Moon, Sun } from 'lucide-react';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Badge } from '@astryxdesign/core/Badge';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { TabList, Tab } from '@astryxdesign/core/TabList';
import { PWAInstallButton } from '../pwa/PWAInstallButton.tsx';
import { TabId } from './BottomBar.tsx';

interface TopHeaderProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  unreadCount?: number;
  sentCount?: number;
  onPrimaryAction?: () => void;
  isAgentActive?: boolean;
  onOpenGuide?: () => void;
  notificationCount?: number;
  onOpenNotifications?: () => void;
  onOpenJimmy?: () => void;
  colorMode?: 'light' | 'dark';
  onToggleColorMode?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeTab,
  onSelectTab,
  unreadCount = 0,
  sentCount = 0,
  onPrimaryAction,
  isAgentActive = false,
  onOpenGuide,
  notificationCount = 0,
  onOpenNotifications,
  onOpenJimmy,
  colorMode = 'light',
  onToggleColorMode,
}) => {
  const navItems: Array<{ id: TabId; label: string; count?: number }> = [
    { id: 'control', label: 'Accueil' },
    { id: 'leads', label: 'Dossiers', count: unreadCount },
    { id: 'emails', label: 'Courriels', count: sentCount },
    { id: 'targets', label: 'Régions' },
    { id: 'scanner', label: 'Scanner' },
    { id: 'persona', label: 'Réglages' },
    { id: 'zefix', label: 'Zefix' },
  ];

  const tabValue = activeTab === 'guide' ? 'control' : activeTab;

  return (
    <header className="sticky top-0 w-full z-40 bg-(--color-background-surface)/95 backdrop-blur-md border-b border-(--color-border-emphasized) pt-safe">
      <div className="max-w-7xl mx-auto h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 sm:gap-6">
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

          <span className="hidden sm:inline-block h-4 w-px bg-(--color-border-emphasized)" />

          <div
            className="hidden sm:inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-(--color-background-muted) border border-(--color-border)"
            title={isAgentActive ? 'Jimy travaille' : 'Jimy attend'}
          >
            <StatusDot
              variant={isAgentActive ? 'success' : 'warning'}
              isPulsing={isAgentActive}
              label={isAgentActive ? 'Jimy travaille' : 'Jimy attend'}
            />
            <span className="text-xs font-semibold text-(--color-text-primary)">
              {isAgentActive ? 'Jimy travaille' : 'Jimy attend'}
            </span>
          </div>
        </div>

        {/* Zone 2: Astryx TabList Navigation */}
        <div data-tour="nav-tabs" className="hidden md:flex items-center shrink-0">
          <TabList
            value={tabValue}
            onChange={(val) => onSelectTab(val as TabId)}
            size="sm"
            overflow="visible"
            aria-label="Navigation principale JimiScout"
          >
            {navItems.map((item) => (
              <Tab
                key={item.id}
                value={item.id}
                label={item.label}
                endContent={
                  item.count && item.count > 0 ? (
                    <Badge
                      label={String(item.count)}
                      variant={item.id === 'leads' ? 'orange' : 'blue'}
                    />
                  ) : undefined
                }
              />
            ))}
          </TabList>
        </div>

        {/* Zone 3: Astryx Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {onOpenJimmy && (
            <Button
              label="Jimmy"
              variant="secondary"
              size="sm"
              icon={<Sparkles className="w-4 h-4 text-[#FF6B00]" />}
              onClick={onOpenJimmy}
              tooltip="Discuter avec l’assistant IA Jimmy"
            />
          )}

          {onOpenNotifications && (
            <div className="relative">
              <IconButton
                label="Activité et alertes"
                tooltip="Activité et alertes"
                variant="ghost"
                size="sm"
                icon={<Bell className="w-4 h-4" />}
                onClick={onOpenNotifications}
              />
              {notificationCount > 0 && (
                <span className="pointer-events-none absolute -top-1 -right-1 px-1 min-w-[17px] h-[17px] flex items-center justify-center bg-[#FF6B00] text-white text-[10px] font-mono font-bold rounded-full tabular-nums shadow-xs">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </div>
          )}

          {onOpenGuide && (
            <Button
              label="Aide"
              variant={activeTab === 'guide' ? 'primary' : 'ghost'}
              size="sm"
              icon={
                <Compass
                  className={`w-4 h-4 ${
                    activeTab === 'guide' ? 'text-white' : 'text-[#FF6B00]'
                  }`}
                />
              }
              onClick={onOpenGuide}
              tooltip="Ouvrir le guide de Jimy"
            />
          )}

          <PWAInstallButton />

          {activeTab !== 'leads' && onPrimaryAction && (
            <div data-tour="process-inbound-btn">
              <Button
                label="Coller une réponse"
                variant="primary"
                size="sm"
                icon={<Mail className="w-4 h-4" />}
                onClick={onPrimaryAction}
                tooltip="Analyser et créer un dossier depuis une réponse reçue"
              />
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
