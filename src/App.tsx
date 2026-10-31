import { useState, useEffect } from 'react';
import { TopHeader } from './components/navigation/TopHeader.tsx';
import { BottomBar, TabId } from './components/navigation/BottomBar.tsx';
import { ControlScreen } from './components/control/ControlScreen.tsx';
import { LeadsScreen } from './components/leads/LeadsScreen.tsx';
import { TargetsScreen } from './components/targets/TargetsScreen.tsx';
import { PersonaScreen } from './components/persona/PersonaScreen.tsx';
import { BusinessCardScannerScreen } from './components/scanner/BusinessCardScannerScreen.tsx';
import { OutboundEmailsScreen } from './components/emails/OutboundEmailsScreen.tsx';
import { GoogleAppGuideModal } from './components/guide/GoogleAppGuideModal.tsx';
import { SplashScreen } from './components/common/SplashScreen.tsx';
import {
  NotificationCenterModal,
  NotificationItem,
} from './components/notifications/NotificationCenterModal.tsx';
import { AgentSettings, Company, DealStatus, OutboundLog } from '@/packages/types/src/database.ts';
import { InboundLead } from '@/packages/types/src/lead.ts';
import { WifiOff } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (typeof window !== 'undefined') {
      const param = new URLSearchParams(window.location.search).get('tab');
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
    }
    return 'control';
  });
  const [openInboundModal, setOpenInboundModal] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

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

  // Sync seenState to localStorage
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
      const [settingsRes, leadsRes, companiesRes, logsRes, healthRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/leads'),
        fetch('/api/companies'),
        fetch('/api/logs'),
        fetch('/api/health'),
      ]);

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

  const handleUpdateSettings = async (patch: Partial<AgentSettings>) => {
    setSettings((prev: AgentSettings) => ({ ...prev, ...patch }));
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
      }
    } catch (err) {
      console.error('Settings patch failed:', err);
    }
  };

  const handleUpdateLeadStatus = async (leadId: string, status: DealStatus) => {
    setLeads((prev: InboundLead[]) =>
      prev.map((l) => (l.id === leadId ? { ...l, lead_status: status } : l))
    );
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_status: status }),
      });
    } catch (err) {
      console.error('Lead update status error:', err);
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    setLeads((prev: InboundLead[]) => prev.filter((l) => l.id !== leadId));
    try {
      await fetch(`/api/leads/${leadId}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Lead delete error:', err);
    }
  };

  // When visiting Deals tab, mark all current active leads as seen so Deals badge clears
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

  // When visiting Sent Emails tab, mark all logs as seen so Sent badge clears
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

  // Active leads badge (only count leads the user hasn't seen yet)
  const unseenLeadsCount = leads.filter(
    (l) =>
      l.lead_status !== 'deleted' &&
      !(l as any).is_deleted &&
      !seenState.seenLeadIds.includes(l.id)
  ).length;

  // Sent logs badge (only count new logs since last visit to Sent tab)
  const unseenLogsCount = Math.max(0, logs.length - (seenState.lastSeenLogsCount || 0));

  // Build notifications feed from leads & logs
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
        price: lead.machinery_detected[0]?.asking_price,
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

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900 antialiased selection:bg-slate-900/10 relative overflow-x-hidden w-full max-w-full">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-amber-600 text-white px-4 py-2 text-xs font-medium flex items-center justify-center gap-2">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Offline Mode — Showing cached Swiss procurement data</span>
        </div>
      )}

      {/* Top Navigation Bar (3-zone contract on desktop, compact on mobile) */}
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
          <>
            {activeTab === 'control' && (
              <ControlScreen
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
                leads={leads}
                companies={companies}
                logs={logs}
                sqlReady={sqlReady}
                onRefreshAll={fetchData}
                onNavigateToLeads={() => setActiveTab('leads')}
                onNavigateToTargets={() => setActiveTab('targets')}
                onNavigateToPersona={() => setActiveTab('persona')}
                onNavigateToScanner={() => setActiveTab('scanner')}
                onNavigateToEmails={() => setActiveTab('emails')}
                todaySentCount={todaySentCount}
              />
            )}

            {activeTab === 'leads' && (
              <LeadsScreen
                leads={leads}
                companies={companies}
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
              />
            )}
          </>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <BottomBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        leadsCount={unseenLeadsCount}
        sentCount={unseenLogsCount}
      />

      {/* Google Style Interactive App Guide Modal */}
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
        onNavigateToDeals={(_leadId) => {
          setActiveTab('leads');
        }}
        onNavigateToEmails={(_logId) => {
          setActiveTab('emails');
        }}
        onClearSeenCounters={handleClearSeenCounters}
      />
    </div>
  );
}
