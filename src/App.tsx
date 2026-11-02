import React, { useState, useEffect, Suspense, lazy } from 'react';
import { TopHeader } from './components/navigation/TopHeader.tsx';
import { BottomBar, TabId } from './components/navigation/BottomBar.tsx';
import { SplashScreen } from './components/common/SplashScreen.tsx';
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
import { WifiOff, Lock, KeyRound, AlertCircle } from 'lucide-react';

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
const GoogleAppGuideModal = lazy(() =>
  import('./components/guide/GoogleAppGuideModal.tsx').then((m) => ({
    default: m.GoogleAppGuideModal,
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
        param === 'persona'
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

  const [openInboundModal, setOpenInboundModal] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
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
    updated_at: new Date().toISOString(),
  });

  const [leads, setLeads] = useState<InboundLead[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [logs, setLogs] = useState<OutboundLog[]>([]);
  const [todaySentCount, setTodaySentCount] = useState(0);
  const [sqlReady, setSqlReady] = useState(true);
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null);
  const [discoveryStatus, setDiscoveryStatus] = useState<DiscoverySchedulerStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
        setLoginError(data.error || 'Invalid access token');
      } else {
        setIsAuthenticated(true);
        setLoginToken('');
        await fetchData();
      }
    } catch (err: any) {
      setLoginError(err?.message || 'Login failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleUpdateSettings = async (patch: Partial<AgentSettings>) => {
    const previous = settings;
    setSettings((prev: AgentSettings) => ({ ...prev, ...patch }));
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        setSettings(previous);
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to save settings (HTTP ${res.status})`);
      }
      const updated = await res.json();
      setSettings(updated);
    } catch (err) {
      setSettings(previous);
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
        throw new Error(errData.error || `Failed to update deal status (HTTP ${res.status})`);
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
        throw new Error(`Failed to delete deal (HTTP ${res.status})`);
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
        title: lead.contact_name || lead.company_name || 'Contractor Offer',
        subtitle:
          lead.ai_summary ||
          lead.machinery_detected.map((m) => m.make_model || m.type).join(', ') ||
          lead.raw_subject ||
          'New machinery equipment inquiry reply',
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
      title: log.company_name ? `Inquiry sent to ${log.company_name}` : 'Inquiry Dispatched',
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
    setActiveTab('leads');
    setOpenInboundModal(true);
  };

  // Owner Authentication Gate when JIMISCOUT_ADMIN_TOKEN is enabled
  if (!isLoading && authRequired && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 border border-slate-200 shadow-xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-orange-50 border border-orange-200 text-[#FF6B00] flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-xl text-[#0B2240]">
                JimiScout Owner Access
              </h1>
              <p className="text-xs text-slate-500">
                Private Swiss Machinery Procurement CRM — JIMY EXPORT
              </p>
            </div>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Admin Access Token
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={loginToken}
                  onChange={(e) => setLoginToken(e.target.value)}
                  placeholder="Enter JIMISCOUT_ADMIN_TOKEN..."
                  className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 text-sm text-[#0B2240] focus:outline-none focus:border-[#FF6B00]"
                />
              </div>
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full h-11 rounded-full bg-[#FF6B00] hover:bg-[#E05E00] text-white font-heading font-semibold text-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {isLoggingIn ? 'Signing in...' : 'Sign In to Workspace'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900 antialiased selection:bg-slate-900/10 relative overflow-x-hidden w-full max-w-full">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-amber-600 text-white px-4 py-2 text-xs font-medium flex items-center justify-center gap-2">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Offline Mode — Showing cached Swiss procurement data</span>
        </div>
      )}

      {/* Top Navigation Bar */}
      <TopHeader
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        unreadCount={unseenLeadsCount}
        sentCount={unseenLogsCount}
        notificationCount={unreadNotificationsCount}
        onOpenNotifications={() => setIsNotificationOpen(true)}
        onPrimaryAction={handlePrimaryTrigger}
        isAgentActive={settings.is_active}
        onOpenGuide={() => setIsGuideOpen(true)}
      />

      {/* Responsive Workspace Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 min-w-0">
        {isLoading ? (
          <SplashScreen />
        ) : (
          <Suspense fallback={<SplashScreen />}>
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
                  setActiveTab('leads');
                }}
                onNavigateToTargets={() => setActiveTab('targets')}
                onNavigateToPersona={() => setActiveTab('persona')}
                onNavigateToScanner={() => setActiveTab('scanner')}
                onNavigateToEmails={(logId?: string) => {
                  if (logId) setFocusedLogId(logId);
                  setActiveTab('emails');
                }}
                todaySentCount={todaySentCount}
              />
            )}

            {activeTab === 'leads' && (
              <LeadsScreen
                leads={leads}
                companies={companies}
                initialLeadId={focusedLeadId}
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
                onRefreshLogs={fetchData}
                onNavigateToTargets={(_query?: string) => setActiveTab('targets')}
                onNavigateToPersona={() => setActiveTab('persona')}
              />
            )}

            {activeTab === 'targets' && (
              <TargetsScreen
                settings={settings}
                companies={companies}
                onUpdateSettings={handleUpdateSettings}
                onRefreshCompanies={fetchData}
                onNavigateToScanner={() => setActiveTab('scanner')}
              />
            )}

            {activeTab === 'scanner' && (
              <BusinessCardScannerScreen
                existingCompanies={companies}
                onRefreshCompanies={fetchData}
                onNavigateToTargets={() => setActiveTab('targets')}
              />
            )}

            {activeTab === 'persona' && (
              <PersonaScreen
                settings={settings}
                companies={companies}
                onUpdateSettings={handleUpdateSettings}
                onOpenGuide={() => setIsGuideOpen(true)}
                onOpenSetupWizard={() => setIsSetupWizardOpen(true)}
              />
            )}
          </Suspense>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <BottomBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        leadsCount={unseenLeadsCount}
        sentCount={unseenLogsCount}
      />

      <Suspense fallback={null}>
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

        {/* Interactive App Guide Modal */}
        <GoogleAppGuideModal
          isOpen={isGuideOpen}
          onClose={() => setIsGuideOpen(false)}
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
            setActiveTab('leads');
          }}
          onNavigateToEmails={(logId) => {
            if (logId) setFocusedLogId(logId);
            setActiveTab('emails');
          }}
          onClearSeenCounters={handleClearSeenCounters}
        />
      </Suspense>
    </div>
  );
}
