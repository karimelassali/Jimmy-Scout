import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { Theme } from '@astryxdesign/core/theme';
import { InternationalizationProvider } from '@astryxdesign/core/i18n';
import frFR from '@astryxdesign/core/locales/fr-FR.generated.js';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { TextInput } from '@astryxdesign/core/TextInput';
import { themes, defaultThemeSlug } from './astryx-themes.ts';
import { TopHeader } from './components/navigation/TopHeader.tsx';
import { BottomBar, TabId } from './components/navigation/BottomBar.tsx';
import { SplashScreen } from './components/common/SplashScreen.tsx';
import { ScreenLoader } from './components/common/ScreenLoader.tsx';
import type { NotificationItem } from './components/notifications/NotificationCenterModal.tsx';
import {
  AgentSettings,
  Company,
  DealStatus,
  DiscoverySchedulerStatus,
  OutboundLog,
  SchedulerStatus,
} from '@/packages/types/src/database.ts';
import { InboundLead } from '@/packages/types/src/lead.ts';
import { Lock, KeyRound } from 'lucide-react';
import { JimmyChatModal } from './components/jimmy/JimmyChatModal.tsx';
import { getJimmyMascotState } from './components/jimmy/jimmy-mascot.ts';

// Code-split heavy screens & modals
const ControlScreen = lazy(() =>
  import('./components/control/ControlScreen.tsx').then((m) => ({
    default: m.ControlScreen,
  }))
);
const LeadsScreen = lazy(() =>
  import('./components/leads/LeadsScreen.tsx').then((m) => ({
    default: m.LeadsScreen,
  }))
);
const TargetsScreen = lazy(() =>
  import('./components/targets/TargetsScreen.tsx').then((m) => ({
    default: m.TargetsScreen,
  }))
);
const PersonaScreen = lazy(() =>
  import('./components/persona/PersonaScreen.tsx').then((m) => ({
    default: m.PersonaScreen,
  }))
);
const BusinessCardScannerScreen = lazy(() =>
  import('./components/scanner/BusinessCardScannerScreen.tsx').then((m) => ({
    default: m.BusinessCardScannerScreen,
  }))
);
const OutboundEmailsScreen = lazy(() =>
  import('./components/emails/OutboundEmailsScreen.tsx').then((m) => ({
    default: m.OutboundEmailsScreen,
  }))
);
const GuideScreen = lazy(() =>
  import('./components/guide/GuideScreen.tsx').then((m) => ({
    default: m.GuideScreen,
  }))
);
const ZefixCheckerScreen = lazy(() =>
  import('./components/zefix/ZefixCheckerScreen.tsx').then((m) => ({
    default: m.ZefixCheckerScreen,
  }))
);
const SetupWizardModal = lazy(() =>
  import('./components/onboarding/SetupWizardModal.tsx').then((m) => ({
    default: m.SetupWizardModal,
  }))
);
const NotificationCenterModal = lazy(() =>
  import('./components/notifications/NotificationCenterModal.tsx').then((m) => ({
    default: m.NotificationCenterModal,
  }))
);

const MINIMUM_SPLASH_TIME_MS = 700;
const SPLASH_FADE_TIME_MS = 400;
// Hard ceiling: even if the first data fetch is slow, the splash never
// holds the screen longer than this (fade included).
const MAX_SPLASH_TIME_MS = 2500;

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const param = params.get('tab');
      if (
        param === 'control' ||
        param === 'leads' ||
        param === 'emails' ||
        param === 'targets' ||
        param === 'scanner' ||
        param === 'persona' ||
        param === 'guide' ||
        param === 'zefix'
      ) {
        return param;
      }
      if (params.get('leadId')) return 'leads';
      if (params.get('logId')) return 'emails';
    }
    return 'control';
  });

  const [focusedLeadId, setFocusedLeadId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('leadId');
    }
    return null;
  });

  const [focusedLogId, setFocusedLogId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('logId');
    }
    return null;
  });

  const [targetsCanton, setTargetsCanton] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('canton');
    }
    return null;
  });

  const selectTab = (tab: TabId, extraParams?: Record<string, string>) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      if (tab !== 'leads') url.searchParams.delete('leadId');
      if (tab !== 'emails') url.searchParams.delete('logId');
      if (extraParams) {
        for (const [key, value] of Object.entries(extraParams)) {
          url.searchParams.set(key, value);
        }
      }
      if (tab === 'targets' && !extraParams?.canton) url.searchParams.delete('canton');
      window.history.replaceState({}, '', url);
    }
  };

  // Clears the deep-linked lead (state + URL) so the dossier modal cannot
  // re-open itself when the leads list refreshes.
  const handleClearFocusedLead = () => {
    setFocusedLeadId(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('leadId');
      window.history.replaceState({}, '', url);
    }
  };

  const handleClearFocusedLog = () => {
    setFocusedLogId(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('logId');
      window.history.replaceState({}, '', url);
    }
  };

  const [openInboundModal, setOpenInboundModal] = useState(false);
  const [isJimmyChatOpen, setIsJimmyChatOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isSetupWizardOpen, setIsSetupWizardOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('jimiscout_setup_completed') !== 'true';
    }
    return false;
  });
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [colorMode] = useState<'light' | 'dark'>('light');
  const toggleColorMode = undefined;

  // Authentication state (when JIMISCOUT_ADMIN_TOKEN is configured on backend)
  const [authRequired, setAuthRequired] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [loginToken, setLoginToken] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Persistent seen / unseen state for badges and notification center
  const [seenState, setSeenState] = useState<{
    seenLeadIds: string[];
    lastSeenLogsCount: number;
    readNotificationIds: string[];
  }>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('jimiscout_seen_state');
        if (stored) return JSON.parse(stored);
      } catch (e) {}
    }
    return { seenLeadIds: [], lastSeenLogsCount: 0, readNotificationIds: [] };
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('jimiscout_seen_state', JSON.stringify(seenState));
      } catch (e) {}
    }
  }, [seenState]);

  const [settings, setSettings] = useState<AgentSettings>({
    id: '00000000-0000-4000-8000-000000000001',
    is_active: false,
    discovery_active: true,
    outreach_active: true,
    discovery_daily_limit: 25,
    discovery_interval_minutes: 120,
    discovery_keywords: [
      'entreprise de terrassement',
      'Tiefbauunternehmen',
      'entreprise de démolition',
      'Baumaschinen Vermietung',
      'genio civile',
    ],
    daily_limit: 25,
    selected_cantons: ['BE', 'ZH', 'VD', 'TI', 'GE', 'VS'],
    sender_name: 'Jamal',
    sender_email: 'info@jimyexport.ch',
    sender_phone: '+41 79 123 45 67',
    tone: 'swiss_formal',
    hooks: {
      cash_settlement: true,
      transport_covered: true,
      as_is: true,
    },
    equipment_focus:
      'Pelles sur chenilles 15–30t, camions benne 4 essieux, chargeuses sur pneus, concasseurs',
    feature_controls: {
      deal_scoring: 'auto',
      follow_ups: 'approval',
      qualification: 'approval',
      price_comparison: 'auto',
      watchlists: 'auto',
      daily_briefing: 'auto',
      negotiation: 'approval',
      seller_intelligence: 'auto',
    },
    follow_up_first_business_days: 4,
    follow_up_final_business_days: 9,
    daily_briefing_hour: 7,
    updated_at: new Date().toISOString(),
  });

  const [leads, setLeads] = useState<InboundLead[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [logs, setLogs] = useState<OutboundLog[]>([]);
  const [todaySentCount, setTodaySentCount] = useState(0);
  const [zefixConfigured, setZefixConfigured] = useState(false);
  const [sqlReady, setSqlReady] = useState(true);
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null);
  const [discoveryStatus, setDiscoveryStatus] = useState<DiscoverySchedulerStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const splashStartedAt = useRef(Date.now());
  const [showStartupSplash, setShowStartupSplash] = useState(true);
  const [isSplashLeaving, setIsSplashLeaving] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('SW registration skipped:', err);
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchData = async () => {
    try {
      const sessionRes = await fetch('/api/auth/session');
      if (sessionRes.ok) {
        const s = await sessionRes.json();
        setAuthRequired(Boolean(s.authRequired));
        setIsAuthenticated(Boolean(s.authenticated));
        if (s.authRequired && !s.authenticated) {
          setIsLoading(false);
          return;
        }
      }

      const [settingsRes, leadsRes, companiesRes, logsRes, healthRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/leads'),
        fetch('/api/companies'),
        fetch('/api/logs'),
        fetch('/api/health'),
      ]);

      if (settingsRes.status === 401 || leadsRes.status === 401) {
        setAuthRequired(true);
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      if (settingsRes.ok) {
        const sData = await settingsRes.json();
        setSettings(sData);
      }
      if (leadsRes.ok) {
        const lData = await leadsRes.json();
        setLeads(Array.isArray(lData) ? lData : []);
      }
      if (companiesRes.ok) {
        const cData = await companiesRes.json();
        setCompanies(Array.isArray(cData) ? cData : []);
      }
      if (logsRes.ok) {
        const lgData = await logsRes.json();
        setLogs(Array.isArray(lgData) ? lgData : []);
      }
      if (healthRes.ok) {
        const hData = await healthRes.json();
        setTodaySentCount(typeof hData.today_sent === 'number' ? hData.today_sent : 0);
        setSqlReady(Boolean(hData.sql_ready));
        if (hData.integrations) {
          setZefixConfigured(Boolean(hData.integrations.zefix_configured));
        }
        if (hData.scheduler) {
          setSchedulerStatus(hData.scheduler);
        }
        if (hData.discovery) {
          setDiscoveryStatus(hData.discovery);
        }
      }
    } catch (err) {
      console.error('Failed to fetch live backend state:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // The server ingests replies continuously. Refresh the dashboard in the
  // background so a newly triaged seller reply appears without a manual reload.
  useEffect(() => {
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchData();
      }
    }, 30_000);

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void fetchData();
    };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshWhenVisible);

    return () => {
      window.clearInterval(refreshTimer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshWhenVisible);
    };
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const elapsed = Date.now() - splashStartedAt.current;
    const timeBeforeFade = Math.max(0, MINIMUM_SPLASH_TIME_MS - elapsed);
    const fadeTimer = window.setTimeout(() => setIsSplashLeaving(true), timeBeforeFade);
    const removeTimer = window.setTimeout(
      () => setShowStartupSplash(false),
      timeBeforeFade + SPLASH_FADE_TIME_MS
    );

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
    };
  }, [isLoading]);

  // Hard ceiling on the splash: if the first fetch is slow, fade the splash
  // out anyway so the app itself is usable instead of a blank logo screen.
  useEffect(() => {
    const fadeTimer = window.setTimeout(
      () => setIsSplashLeaving(true),
      MAX_SPLASH_TIME_MS
    );
    const removeTimer = window.setTimeout(
      () => setShowStartupSplash(false),
      MAX_SPLASH_TIME_MS + SPLASH_FADE_TIME_MS
    );

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: loginToken.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.authenticated) {
        setLoginError(data.error || 'Code d’accès incorrect');
      } else {
        setIsAuthenticated(true);
        setLoginToken('');
        await fetchData();
      }
    } catch (err: any) {
      setLoginError(err?.message || 'Connexion impossible');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Guards the parent-level settings race (QA #3): PATCH responses are only
  // applied when they belong to the latest save; a late response from an
  // older click must not overwrite newer local state, and a failed older
  // save must not roll back a newer choice.
  const settingsSaveSeq = useRef(0);

  const handleUpdateSettings = async (patch: Partial<AgentSettings>) => {
    const previous = settings;
    const seq = ++settingsSaveSeq.current;
    setSettings((prev: AgentSettings) => ({ ...prev, ...patch }));
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        if (seq === settingsSaveSeq.current) setSettings(previous);
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Impossible d’enregistrer les réglages (HTTP ${res.status})`);
      }
      const updated = await res.json();
      if (seq === settingsSaveSeq.current) setSettings(updated);
    } catch (err) {
      if (seq === settingsSaveSeq.current) setSettings(previous);
      console.error('Settings patch failed:', err);
      throw err;
    }
  };

  const handleUpdateLeadStatus = async (leadId: string, status: DealStatus) => {
    const previousLeads = leads;
    setLeads((prev: InboundLead[]) =>
      prev.map((l) => (l.id === leadId ? { ...l, lead_status: status } : l))
    );
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_status: status }),
      });
      if (!res.ok) {
        setLeads(previousLeads);
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Impossible de modifier le dossier (HTTP ${res.status})`);
      }
      const updated = await res.json();
      setLeads((prev) => prev.map((l) => (l.id === leadId ? updated : l)));
    } catch (err) {
      setLeads(previousLeads);
      console.error('Lead update status error:', err);
      throw err;
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    const previousLeads = leads;
    setLeads((prev: InboundLead[]) => prev.filter((l) => l.id !== leadId));
    try {
      const res = await fetch(`/api/leads/${leadId}`, { method: 'DELETE' });
      if (!res.ok) {
        setLeads(previousLeads);
        throw new Error(`Impossible de supprimer le dossier (HTTP ${res.status})`);
      }
    } catch (err) {
      setLeads(previousLeads);
      console.error('Lead delete error:', err);
      throw err;
    }
  };

  useEffect(() => {
    if (activeTab === 'leads' && leads.length > 0) {
      const activeIds = leads
        .filter((l) => l.lead_status !== 'deleted' && !(l as any).is_deleted)
        .map((l) => l.id);
      setSeenState((prev) => {
        const merged = Array.from(new Set([...prev.seenLeadIds, ...activeIds]));
        if (merged.length !== prev.seenLeadIds.length) {
          return { ...prev, seenLeadIds: merged };
        }
        return prev;
      });
    }
  }, [activeTab, leads]);

  useEffect(() => {
    if (activeTab === 'emails' && logs.length > 0) {
      setSeenState((prev) => {
        if (prev.lastSeenLogsCount !== logs.length) {
          return { ...prev, lastSeenLogsCount: logs.length };
        }
        return prev;
      });
    }
  }, [activeTab, logs.length]);

  const unseenLeadsCount = leads.filter(
    (l) =>
      l.lead_status !== 'deleted' &&
      !(l as any).is_deleted &&
      !seenState.seenLeadIds.includes(l.id)
  ).length;

  const unseenLogsCount = Math.max(0, logs.length - (seenState.lastSeenLogsCount || 0));

  const notifications: NotificationItem[] = [
    ...leads
      .filter((l) => l.lead_status !== 'deleted' && !(l as any).is_deleted)
      .map((lead) => ({
        id: `lead-${lead.id}`,
        type: 'offer' as const,
        title: lead.contact_name || lead.company_name || 'Offre d’une société',
        subtitle:
          lead.ai_summary ||
          lead.machinery_detected.map((m) => m.make_model || m.type).join(', ') ||
          lead.raw_subject ||
          'Nouvelle réponse avec une offre de machine',
        timestamp: lead.received_at,
        isRead: seenState.readNotificationIds.includes(`lead-${lead.id}`),
        leadId: lead.id,
        canton: lead.canton,
        price: lead.machinery_detected[0]?.asking_price || undefined,
        companyName: lead.company_name,
      })),
    ...logs.map((log) => ({
      id: `log-${log.id}`,
      type: 'email_sent' as const,
      title: log.company_name ? `Demande envoyée à ${log.company_name}` : 'Demande envoyée',
      subtitle: `${log.subject} · Status: ${log.delivery_status}`,
      timestamp: log.sent_at,
      isRead: seenState.readNotificationIds.includes(`log-${log.id}`),
      logId: log.id,
      canton: log.canton,
      companyName: log.company_name,
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const unreadNotificationsCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAsRead = (id: string) => {
    setSeenState((prev) => {
      const nextRead = Array.from(new Set([...prev.readNotificationIds, id]));
      let nextLeads = prev.seenLeadIds;
      if (id.startsWith('lead-')) {
        const leadId = id.replace('lead-', '');
        nextLeads = Array.from(new Set([...nextLeads, leadId]));
      }
      return { ...prev, readNotificationIds: nextRead, seenLeadIds: nextLeads };
    });
  };

  const handleMarkAsUnread = (id: string) => {
    setSeenState((prev) => ({
      ...prev,
      readNotificationIds: prev.readNotificationIds.filter((item) => item !== id),
    }));
  };

  const handleMarkAllAsRead = () => {
    const activeLeadIds = leads
      .filter((l) => l.lead_status !== 'deleted' && !(l as any).is_deleted)
      .map((l) => l.id);
    const allNotifIds = notifications.map((n) => n.id);
    setSeenState({
      seenLeadIds: activeLeadIds,
      lastSeenLogsCount: logs.length,
      readNotificationIds: allNotifIds,
    });
  };

  const handleClearSeenCounters = () => {
    handleMarkAllAsRead();
  };

  const handlePrimaryTrigger = () => {
    selectTab('leads');
    setOpenInboundModal(true);
  };

  const startupSplash = showStartupSplash ? (
    <SplashScreen
      isLeaving={isSplashLeaving}
      statusText={isLoading ? 'Chargement de vos données…' : 'C’est prêt !'}
    />
  ) : null;

  // Owner Authentication Gate when JIMISCOUT_ADMIN_TOKEN is enabled
  if (!isLoading && authRequired && !isAuthenticated) {
    return (
      <InternationalizationProvider locale="fr-FR" messages={{ 'fr-FR': frFR }}>
        <Theme theme={themes[defaultThemeSlug]} mode={colorMode}>
          {startupSplash}
          <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
            <div className="w-full max-w-md">
              <Card>
                <div className="p-4 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-orange-50 border border-orange-200 text-[#FF6B00] flex items-center justify-center">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <h1 className="font-heading font-bold text-xl text-[#0B2240]">
                        JimiScout Owner Access
                      </h1>
                      <p className="text-xs text-slate-500">
                        Espace privé d’achat de machines suisses — JIMY EXPORT
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleLoginSubmit} className="space-y-4">
                    <TextInput
                      label="Admin Access Token"
                      type="password"
                      isRequired
                      value={loginToken}
                      onChange={setLoginToken}
                      placeholder="Entrez le code d’accès JimyScout…"
                    />

                    {loginError && (
                      <Banner
                        status="error"
                        container="card"
                        collapsible={false}
                        title={loginError}
                      />
                    )}

                    <Button
                      label="Ouvrir mon espace"
                      type="submit"
                      variant="primary"
                      size="lg"
                      isLoading={isLoggingIn}
                      width="100%"
                    />
                  </form>
                </div>
              </Card>
            </div>
          </div>
        </Theme>
      </InternationalizationProvider>
    );
  }

  return (
    <InternationalizationProvider locale="fr-FR" messages={{ 'fr-FR': frFR }}>
      <Theme theme={themes[defaultThemeSlug]} mode={colorMode}>
        <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900 antialiased selection:bg-slate-900/10 relative overflow-x-hidden w-full max-w-full">
          {startupSplash}

          {/* Offline Banner */}
          {!isOnline && (
            <Banner
              status="warning"
              container="section"
              collapsible={false}
              title="Mode hors ligne — données suisses en cache"
            />
          )}

          {/* Top Navigation Bar */}
          <TopHeader
            activeTab={activeTab}
            onSelectTab={selectTab}
            unreadCount={unseenLeadsCount}
            sentCount={unseenLogsCount}
            notificationCount={unreadNotificationsCount}
            onOpenNotifications={() => setIsNotificationOpen(true)}
            onOpenJimmy={() => setIsJimmyChatOpen(true)}
            onPrimaryAction={handlePrimaryTrigger}
            isAgentActive={settings.is_active}
            onOpenGuide={() => selectTab('guide')}
            colorMode={colorMode}
            onToggleColorMode={toggleColorMode}
          />

      {/* Responsive Workspace Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 min-w-0">
          <Suspense fallback={<ScreenLoader />}>
            {activeTab === 'control' && (
              <ControlScreen
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
                leads={leads}
                companies={companies}
                logs={logs}
                sqlReady={sqlReady}
                schedulerStatus={schedulerStatus}
                discoveryStatus={discoveryStatus}
                onRefreshAll={fetchData}
                onNavigateToLeads={(leadId?: string) => {
                  if (leadId) setFocusedLeadId(leadId);
                  selectTab('leads', leadId ? { leadId } : undefined);
                }}
                onNavigateToTargets={(canton?: string) => {
                  setTargetsCanton(canton ?? null);
                  selectTab('targets', canton ? { canton } : undefined);
                }}
                onNavigateToPersona={() => selectTab('persona')}
                onNavigateToScanner={() => selectTab('scanner')}
                onNavigateToEmails={(logId?: string) => {
                  if (logId) setFocusedLogId(logId);
                  selectTab('emails', logId ? { logId } : undefined);
                }}
                todaySentCount={todaySentCount}
              />
            )}

            {activeTab === 'leads' && (
              <LeadsScreen
                leads={leads}
                companies={companies}
                initialLeadId={focusedLeadId}
                onClearFocusedLead={handleClearFocusedLead}
                onUpdateLeadStatus={handleUpdateLeadStatus}
                onDeleteLead={handleDeleteLead}
                onRefreshLeads={fetchData}
                openInboundModalInitially={openInboundModal}
                onInboundModalClose={() => setOpenInboundModal(false)}
              />
            )}

            {activeTab === 'emails' && (
              <OutboundEmailsScreen
                logs={logs}
                companies={companies}
                settings={settings}
                todaySentCount={todaySentCount}
                initialLogId={focusedLogId}
                onClearFocusedLog={handleClearFocusedLog}
                onRefreshLogs={fetchData}
                onNavigateToTargets={(_query?: string) => selectTab('targets')}
                onNavigateToPersona={() => selectTab('persona')}
              />
            )}

            {activeTab === 'targets' && (
              <TargetsScreen
                settings={settings}
                companies={companies}
                initialCanton={targetsCanton}
                onUpdateSettings={handleUpdateSettings}
                onRefreshCompanies={fetchData}
                onNavigateToScanner={() => selectTab('scanner')}
              />
            )}

            {activeTab === 'scanner' && (
              <BusinessCardScannerScreen
                existingCompanies={companies}
                onRefreshCompanies={fetchData}
                onNavigateToTargets={() => selectTab('targets')}
              />
            )}

            {activeTab === 'persona' && (
              <PersonaScreen
                settings={settings}
                companies={companies}
                onUpdateSettings={handleUpdateSettings}
                onOpenGuide={() => selectTab('guide')}
                onOpenSetupWizard={() => setIsSetupWizardOpen(true)}
              />
            )}

            {activeTab === 'guide' && (
              <GuideScreen onNavigate={(tab) => selectTab(tab)} />
            )}

            {activeTab === 'zefix' && (
              <ZefixCheckerScreen zefixConfigured={zefixConfigured} />
            )}
          </Suspense>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <BottomBar
        activeTab={activeTab}
        onSelectTab={selectTab}
        leadsCount={unseenLeadsCount}
        sentCount={unseenLogsCount}
      />

      <Suspense fallback={<ScreenLoader />}>
        {/* Personalized First-Time Setup Wizard */}
        <SetupWizardModal
          isOpen={!isLoading && isSetupWizardOpen}
          settings={settings}
          onSaveAndComplete={handleUpdateSettings}
          onClose={() => {
            if (typeof window !== 'undefined') {
              localStorage.setItem('jimiscout_setup_completed', 'true');
            }
            setIsSetupWizardOpen(false);
          }}
        />

        {/* Activity & Notifications Modal */}
        <NotificationCenterModal
          isOpen={isNotificationOpen}
          onClose={() => setIsNotificationOpen(false)}
          notifications={notifications}
          onMarkAsRead={handleMarkAsRead}
          onMarkAsUnread={handleMarkAsUnread}
          onMarkAllAsRead={handleMarkAllAsRead}
          onNavigateToDeals={(leadId) => {
            if (leadId) setFocusedLeadId(leadId);
            selectTab('leads', leadId ? { leadId } : undefined);
          }}
          onNavigateToEmails={(logId) => {
            if (logId) setFocusedLogId(logId);
            selectTab('emails', logId ? { logId } : undefined);
          }}
          onClearSeenCounters={handleClearSeenCounters}
        />
      </Suspense>
      <JimmyChatModal
        open={isJimmyChatOpen}
        onClose={() => setIsJimmyChatOpen(false)}
        onNavigate={(tab) => {
          selectTab(tab);
          setIsJimmyChatOpen(false);
        }}
        mascotState={getJimmyMascotState({
          isActive: settings.is_active,
          schedulerState: schedulerStatus?.state,
          discoveryState: discoveryStatus?.state,
        })}
      />
        </div>
      </Theme>
    </InternationalizationProvider>
  );
}
