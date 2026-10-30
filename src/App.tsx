import { useState, useEffect } from 'react';
import { TopHeader } from './components/navigation/TopHeader.tsx';
import { BottomBar, TabId } from './components/navigation/BottomBar.tsx';
import { ControlScreen } from './components/control/ControlScreen.tsx';
import { LeadsScreen } from './components/leads/LeadsScreen.tsx';
import { TargetsScreen } from './components/targets/TargetsScreen.tsx';
import { PersonaScreen } from './components/persona/PersonaScreen.tsx';
import { AgentSettings, Company, DealStatus, OutboundLog } from '@/packages/types/src/database.ts';
import { InboundLead } from '@/packages/types/src/lead.ts';
import { WifiOff } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('control');
  const [openInboundModal, setOpenInboundModal] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

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

    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
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

  const unreadHotLeadsCount = leads.filter((l) => l.lead_status === 'new').length;

  const handlePrimaryTrigger = () => {
    setActiveTab('leads');
    setOpenInboundModal(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F0F4F9] text-[#0B2240] antialiased selection:bg-[#FF6B00]/15">
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
        unreadCount={unreadHotLeadsCount}
        onPrimaryAction={handlePrimaryTrigger}
      />

      {/* Responsive Workspace Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <div className="space-y-6 pt-2">
            <div className="h-10 w-64 bg-white/70 rounded-2xl animate-pulse" />
            <div className="h-48 w-full bg-white rounded-3xl border border-slate-200/60 animate-pulse" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="h-28 bg-white rounded-3xl border border-slate-200/60 animate-pulse" />
              <div className="h-28 bg-white rounded-3xl border border-slate-200/60 animate-pulse" />
              <div className="h-28 bg-white rounded-3xl border border-slate-200/60 animate-pulse" />
              <div className="h-28 bg-white rounded-3xl border border-slate-200/60 animate-pulse" />
            </div>
          </div>
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

            {activeTab === 'targets' && (
              <TargetsScreen
                settings={settings}
                companies={companies}
                onUpdateSettings={handleUpdateSettings}
                onRefreshCompanies={fetchData}
              />
            )}

            {activeTab === 'persona' && (
              <PersonaScreen
                settings={settings}
                companies={companies}
                onUpdateSettings={handleUpdateSettings}
              />
            )}
          </>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <BottomBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        leadsCount={unreadHotLeadsCount}
      />
    </div>
  );
}
