import React, { useState } from 'react';
import {
  AgentSettings,
  Company,
  OutboundLog,
  SchedulerStatus,
} from '@/packages/types/src/database.ts';
import { InboundLead } from '@/packages/types/src/lead.ts';
import {
  CANTON_BY_CODE,
  parsePriceString,
  convertToChf,
} from '@/packages/types/src/swiss.ts';
import {
  Play,
  Pause,
  Send,
  Download,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  PhoneCall,
  Bell,
  Plus,
  Check,
  Camera,
  Building2,
  MailCheck,
  Flame,
  Coins,
  MapPin,
  SlidersHorizontal,
  Clock,
} from 'lucide-react';

interface ControlScreenProps {
  settings: AgentSettings;
  onUpdateSettings: (patch: Partial<AgentSettings>) => Promise<void>;
  leads: InboundLead[];
  companies: Company[];
  logs: OutboundLog[];
  sqlReady: boolean;
  schedulerStatus?: SchedulerStatus | null;
  onRefreshAll: () => Promise<void>;
  onNavigateToLeads: (leadId?: string) => void;
  onNavigateToTargets: () => void;
  onNavigateToPersona: () => void;
  onNavigateToScanner?: () => void;
  onNavigateToEmails?: (logId?: string) => void;
  todaySentCount: number;
}

function safeCsvField(val: unknown): string {
  const raw = val === null || val === undefined ? '' : String(val);
  const neutralized = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

export const ControlScreen: React.FC<ControlScreenProps> = ({
  settings,
  onUpdateSettings,
  leads,
  companies,
  logs,
  schedulerStatus,
  onRefreshAll,
  onNavigateToLeads,
  onNavigateToTargets,
  onNavigateToPersona,
  onNavigateToScanner,
  onNavigateToEmails,
  todaySentCount,
}) => {
  const [isPollingImap, setIsPollingImap] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [toast, setToast] = useState<{ msg: string; isError?: boolean } | null>(null);

  const showToast = (msg: string, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 4500);
  };

  const toggleActiveScouting = async () => {
    const nextState = !settings.is_active;
    try {
      await onUpdateSettings({ is_active: nextState });
      await onRefreshAll();
      showToast(
        nextState
          ? 'Jimy is now working — outreach active during Swiss business hours (08:30–17:00 Europe/Zurich)'
          : 'Jimy is now waiting on standby'
      );
    } catch (err: any) {
      showToast(err?.message || 'Failed to update automation status', true);
    }
  };

  const handlePollImap = async () => {
    setIsPollingImap(true);
    try {
      const res = await fetch('/api/imap/poll', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(
          `Could not check mailbox: ${data.error || 'Please check your connection'}`,
          true
        );
      } else {
        await onRefreshAll();
        showToast(
          data.messagesProcessed > 0
            ? `Jimy found ${data.messagesProcessed} new reply!`
            : 'Jimy checked your mailbox — all replies are up to date'
        );
      }
    } catch (err: any) {
      showToast(`Mailbox error: ${err?.message || 'Connection failed'}`, true);
    } finally {
      setIsPollingImap(false);
    }
  };

  const handleDispatchStep = async () => {
    setIsDispatching(true);
    try {
      const res = await fetch('/api/worker/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manualOverride: true }),
      });
      const data = await res.json();
      await onRefreshAll();
      if (res.ok && data.status === 'dispatched') {
        showToast(`Jimy sent an email to ${data.company} (${data.email})`);
      } else {
        showToast(data.message || data.error || 'Could not send email', true);
      }
    } catch (err: any) {
      showToast(`Failed to send email: ${err?.message || 'Connection error'}`, true);
    } finally {
      setIsDispatching(false);
    }
  };

  const handleTestTelegram = async () => {
    setIsTestingTelegram(true);
    try {
      const res = await fetch('/api/test-telegram', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(
          `Test phone alert sent to Telegram (@${data.botUsername || 'Jimy_scout_bot'})`
        );
      } else {
        showToast(
          `Alert error: ${data.error || 'Could not send phone alert'}`,
          true
        );
      }
    } catch (err: any) {
      showToast(`Alert error: ${err?.message}`, true);
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const handleExportCSV = () => {
    if (leads.length === 0) {
      showToast('No deals available to export yet.', true);
      return;
    }
    const headers = [
      'ID',
      'Company',
      'Canton',
      'Machinery',
      'Asking_Price_Raw',
      'Asking_Price_CHF',
      'Contact_Phone',
      'Status',
      'Next_Action',
    ];
    const rows = leads.map((l) => {
      const firstPrice = l.machinery_detected[0]?.asking_price || '';
      const parsed = parsePriceString(firstPrice);
      const chfVal =
        l.machinery_detected[0]?.asking_price_chf ??
        convertToChf(parsed.amount, parsed.currency) ??
        '';
      return [
        safeCsvField(l.id),
        safeCsvField(l.company_name || ''),
        safeCsvField(l.canton || ''),
        safeCsvField(l.machinery_detected.map((m) => m.make_model).join('; ')),
        safeCsvField(firstPrice),
        safeCsvField(chfVal),
        safeCsvField(l.contact_phone || ''),
        safeCsvField(l.lead_status),
        safeCsvField(l.next_action || ''),
      ].join(',');
    });
    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'JimyScout-Swiss-Deals.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Downloaded formula-safe deals spreadsheet');
  };

  // Real metrics from database state
  const activeContractorsCount = companies.filter(
    (c) => !c.unsubscribed && c.email && c.verified_email !== false
  ).length;
  const deliveredLogsCount = logs.filter(
    (l) =>
      l.delivery_status === 'delivered' ||
      l.delivery_status === 'accepted' ||
      l.delivery_status === 'simulated'
  ).length;
  const newLeadsCount = leads.filter((l) => l.lead_status === 'new').length;

  // Currency-aware CHF calculation (prevents decimal-stripping inflation and converts EUR/USD)
  const totalAskingValueChf = leads.reduce((sum, lead) => {
    for (const m of lead.machinery_detected || []) {
      if (typeof m.asking_price_chf === 'number' && m.asking_price_chf > 0) {
        sum += m.asking_price_chf;
      } else if (m.asking_price) {
        const parsed = parsePriceString(m.asking_price);
        const chf = convertToChf(parsed.amount, parsed.currency);
        if (chf && chf > 0) {
          sum += chf;
        }
      }
    }
    return sum;
  }, 0);

  const formattedPipelineChf =
    totalAskingValueChf > 0
      ? `CHF ${totalAskingValueChf.toLocaleString('de-CH')}`
      : 'CHF 0';

  const quotaPercent = Math.min(
    100,
    Math.round((todaySentCount / Math.max(1, settings.daily_limit)) * 100)
  );
  const topLead = leads[0];
  const companyById = new Map(companies.map((c) => [c.id, c]));

  const getDynamicGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    if (hour >= 17 && hour < 22) return 'Good evening';
    return 'Good night';
  };

  const timeGreeting = getDynamicGreeting();
  const adminName = settings.sender_name?.trim() || 'Jamal';
  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const getSchedulerBadge = () => {
    if (!settings.is_active) {
      return { label: 'Paused by Owner', color: 'bg-slate-100 text-slate-700' };
    }
    if (schedulerStatus?.state === 'waiting_for_hours') {
      return {
        label: 'Standby until Swiss Business Hours (08:30 Zurich)',
        color: 'bg-amber-50 text-amber-800 border border-amber-200',
      };
    }
    if (schedulerStatus?.state === 'quota_reached') {
      return {
        label: 'Daily Quota Reached',
        color: 'bg-blue-50 text-blue-800 border border-blue-200',
      };
    }
    return {
      label: 'Active in Swiss Business Window',
      color: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    };
  };

  const schedulerBadge = getSchedulerBadge();

  return (
    <div className="space-y-6 pb-24 md:pb-12">
      {/* Snackbar Toast */}
      {toast && (
        <div
          className={`fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-white shadow-lg flex items-center gap-2.5 text-xs sm:text-sm font-medium max-w-xl ${
            toast.isError ? 'bg-red-700' : 'bg-[#0B2240]'
          }`}
        >
          {toast.isError ? (
            <AlertCircle className="w-4 h-4 text-white shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-[#FF6B00] shrink-0" />
          )}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span className="w-2 h-2 rounded-full bg-[#FF6B00]" />
            <span>{formattedDate} · Swiss Procurement Workspace</span>
          </div>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-[#0B2240] tracking-tight mt-1">
            {timeGreeting}, {adminName}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleTestTelegram}
            disabled={isTestingTelegram}
            className="h-9 px-3.5 rounded-xl bg-white hover:bg-orange-50/50 border border-slate-200 hover:border-orange-200 text-[#0B2240] font-medium text-xs flex items-center gap-2 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Bell className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span>{isTestingTelegram ? 'Sending...' : 'Test Phone Alert'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="h-9 px-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-[#0B2240] font-medium text-xs flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* COMPACT AGENT JIMY CONTROL BAR */}
      <section
        className={`bg-white rounded-2xl border shadow-2xs overflow-hidden transition-colors ${
          settings.is_active ? 'border-emerald-300/90' : 'border-orange-200/90'
        }`}
      >
        <div
          className={`h-1 w-full ${
            settings.is_active
              ? 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-500'
              : 'bg-gradient-to-r from-[#FF6B00] via-orange-400 to-amber-400'
          }`}
        />

        <div className="p-4 sm:px-5 sm:py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl p-1.5 shrink-0 flex items-center justify-center border ${
                settings.is_active
                  ? 'bg-emerald-50/50 border-emerald-200/70'
                  : 'bg-orange-50/50 border-orange-200/70'
              }`}
            >
              <img
                src={
                  settings.is_active
                    ? '/assets/illustrations/Working%20late.gif'
                    : '/assets/illustrations/Mindfulness.gif'
                }
                alt={settings.is_active ? 'Jimy is working' : 'Jimy is waiting'}
                className="w-full h-full object-contain select-none"
              />
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="font-heading font-bold text-base sm:text-lg text-[#0B2240] flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      settings.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-[#FF6B00]'
                    }`}
                  />
                  <span>{settings.is_active ? 'Jimy is working' : 'Jimy is waiting'}</span>
                </h2>

                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${schedulerBadge.color}`}
                >
                  {schedulerBadge.label}
                </span>

                {/* Compact Inline Quota Pill */}
                <div
                  data-tour="daily-limit-slider"
                  className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200/80 text-xs"
                >
                  <span className="font-mono font-semibold text-[#FF6B00] tabular-nums">
                    {todaySentCount}/{settings.daily_limit}
                  </span>
                  <span className="text-slate-500 text-[11px]">today (Zurich)</span>
                  <div className="w-14 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-[#FF6B00] h-full rounded-full transition-all duration-500"
                      style={{ width: `${quotaPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-500 truncate flex items-center gap-2">
                <span>
                  {settings.is_active
                    ? `Sending from ${settings.sender_email} · ${settings.selected_cantons.length} Cantons · Mon–Fri 08:30–17:00 Europe/Zurich`
                    : `Paused · ${activeContractorsCount} verified companies ready across ${settings.selected_cantons.length} Cantons`}
                </span>
                {schedulerStatus?.next_send_at && settings.is_active && (
                  <span className="inline-flex items-center gap-1 text-slate-600 font-mono text-[11px]">
                    <Clock className="w-3 h-3 text-[#FF6B00]" />
                    Next slot:{' '}
                    {new Date(schedulerStatus.next_send_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Right: Action Controls */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              data-tour="poll-imap-btn"
              onClick={handlePollImap}
              disabled={isPollingImap}
              className="h-9 px-3 rounded-xl bg-white hover:bg-slate-50 text-[#0B2240] border border-slate-200 font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-slate-500 ${isPollingImap ? 'animate-spin' : ''}`}
              />
              <span>{isPollingImap ? 'Checking...' : 'Check Replies'}</span>
            </button>

            <button
              type="button"
              data-tour="manual-dispatch-btn"
              onClick={handleDispatchStep}
              disabled={isDispatching}
              className="h-9 px-3.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-[#FF6B00] border border-orange-200/90 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isDispatching ? 'Sending...' : 'Send 1 Now'}</span>
            </button>

            <div data-tour="auto-scout-switch">
              <button
                type="button"
                onClick={toggleActiveScouting}
                className={`h-9 px-4 rounded-xl font-heading font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-2xs ${
                  settings.is_active
                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                    : 'bg-[#059669] hover:bg-[#047857] text-white'
                }`}
              >
                {settings.is_active ? (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>Pause Jimy</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Put Jimy to Work</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4-COLUMN VIVID KPI STRIP */}
      <section
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        data-tour="pipeline-stats"
      >
        <div
          onClick={onNavigateToTargets}
          className="bg-white rounded-2xl p-5 border border-slate-200/90 hover:border-blue-300 shadow-2xs hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Target Companies</span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 font-heading font-bold text-2xl sm:text-3xl text-[#0B2240] tabular-nums">
              {companies.length}
            </div>
            <span className="text-xs text-slate-500 mt-1 block">
              {activeContractorsCount} verified &amp; eligible
            </span>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-blue-600 font-medium text-xs group-hover:text-blue-700">
            <span>View company directory</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        <div
          onClick={() => onNavigateToEmails && onNavigateToEmails()}
          className="bg-white rounded-2xl p-5 border border-slate-200/90 hover:border-blue-400 shadow-2xs hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Emails Sent by Jimy</span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#1A73E8] border border-blue-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                <MailCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 font-heading font-bold text-2xl sm:text-3xl text-[#0B2240] tabular-nums">
              {deliveredLogsCount}
            </div>
            <span className="text-xs text-slate-500 mt-1 block">
              {todaySentCount} sent today
            </span>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[#1A73E8] font-medium text-xs group-hover:text-blue-700">
            <span>View sent emails &amp; table</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        <div
          onClick={() => onNavigateToLeads()}
          className="bg-gradient-to-b from-white to-orange-50/30 rounded-2xl p-5 border border-orange-200 hover:border-[#FF6B00] shadow-2xs hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#FF6B00]">Machines Offered</span>
              <div className="w-9 h-9 rounded-xl bg-orange-100/80 text-[#FF6B00] border border-orange-200/80 flex items-center justify-center">
                <Flame className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 font-heading font-bold text-2xl sm:text-3xl text-[#FF6B00] tabular-nums">
              {leads.length}
            </div>
            <span className="text-xs text-slate-600 mt-1 block">
              {newLeadsCount} unread seller {newLeadsCount === 1 ? 'reply' : 'replies'}
            </span>
          </div>
          <div className="mt-4 pt-3 border-t border-orange-100 flex items-center justify-between text-[#FF6B00] font-semibold text-xs group-hover:text-[#E05E00]">
            <span>Review machine deals</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Total Offer Value</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 font-heading font-bold text-2xl sm:text-3xl text-[#0B2240] tabular-nums">
              {formattedPipelineChf}
            </div>
            <span className="text-xs text-emerald-600 font-medium mt-1 block">
              Normalized to CHF
            </span>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-slate-500 text-xs">
            <span>Direct seller quotes</span>
          </div>
        </div>
      </section>

      {/* 2-COLUMN WORKSPACE: Outbound Activity + Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-6">
          {topLead && (
            <div className="bg-gradient-to-br from-white via-white to-orange-50/40 rounded-2xl p-6 border border-orange-200/90 shadow-2xs space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-orange-100/80 text-[#FF6B00] font-semibold text-xs border border-orange-200 flex items-center gap-1.5">
                    <Flame className="w-3 h-3 fill-[#FF6B00]" />
                    <span>Latest Seller Offer</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono font-medium text-xs">
                    Canton {topLead.canton || 'CH'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateToLeads(topLead.id)}
                  className="text-xs font-semibold text-[#FF6B00] hover:text-[#E05E00] flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>Open Deal in CRM</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-4 rounded-xl bg-white border border-orange-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-heading font-bold text-base sm:text-lg text-[#0B2240]">
                    {topLead.machinery_detected[0]?.make_model || 'Heavy Machinery'}
                  </h3>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-slate-700">{topLead.company_name}</span>
                    {topLead.contact_name && (
                      <>
                        <span>·</span>
                        <span>{topLead.contact_name}</span>
                      </>
                    )}
                    {topLead.machinery_detected[0]?.year && (
                      <>
                        <span>·</span>
                        <span>{topLead.machinery_detected[0].year}</span>
                      </>
                    )}
                    {topLead.machinery_detected[0]?.hours && (
                      <>
                        <span>·</span>
                        <span>{topLead.machinery_detected[0].hours.toLocaleString()} hrs</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="px-3 py-1.5 rounded-xl bg-orange-50 border border-orange-200 text-[#FF6B00] font-bold font-mono text-sm">
                    {topLead.machinery_detected[0]?.asking_price || 'Price on request'}
                  </div>

                  {topLead.contact_phone && (
                    <a
                      href={`tel:${topLead.contact_phone.replace(/\s+/g, '')}`}
                      className="h-9 px-4 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-medium text-xs flex items-center justify-center gap-1.5 shrink-0 transition-colors cursor-pointer shadow-2xs"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      <span>Call Seller</span>
                    </a>
                  )}
                </div>
              </div>

              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {topLead.ai_summary}
              </p>
            </div>
          )}

          {/* Outbound Dispatch Stream */}
          <div
            className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden"
            data-tour="activity-log"
          >
            <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-heading font-bold text-base text-[#0B2240]">
                  Jimy&apos;s Outbound Activity
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Recent inquiries sent from {settings.sender_email}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {onNavigateToEmails && (
                  <button
                    type="button"
                    onClick={() => onNavigateToEmails()}
                    className="h-8 px-3 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200/80 text-[#1A73E8] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <MailCheck className="w-3.5 h-3.5" />
                    <span>View All ({logs.length}) in Table</span>
                  </button>
                )}
                {onNavigateToScanner && (
                  <button
                    type="button"
                    onClick={onNavigateToScanner}
                    className="h-8 px-3 rounded-lg bg-orange-50 hover:bg-orange-100 border border-orange-200/80 text-[#FF6B00] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Scan Cards</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onNavigateToTargets}
                  className="h-8 px-3 rounded-lg bg-slate-100 hover:bg-slate-200/70 border border-slate-200 text-[#0B2240] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Company</span>
                </button>
              </div>
            </div>

            {logs.length === 0 ? (
              <div className="p-8 text-center space-y-1.5">
                <p className="text-sm font-semibold text-[#0B2240]">
                  Jimy hasn&apos;t dispatched any emails yet
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  Put Jimy to work above to start scheduled outreach, or click &ldquo;Send 1 Now&rdquo; to dispatch an immediate inquiry.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {logs.slice(0, 10).map((log) => {
                  const comp = log.company_id ? companyById.get(log.company_id) : undefined;
                  const sentDate = new Date(log.sent_at);
                  const formattedTime = sentDate.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const isOk =
                    log.delivery_status === 'delivered' ||
                    log.delivery_status === 'accepted' ||
                    log.delivery_status === 'simulated';

                  return (
                    <div
                      key={log.id}
                      onClick={() => onNavigateToEmails && onNavigateToEmails(log.id)}
                      className="p-4 sm:px-6 hover:bg-slate-50/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                          <span className="font-semibold text-[#0B2240]">
                            {log.company_name || comp?.name || 'Company'}
                          </span>
                          {(log.canton || comp?.canton) && (
                            <>
                              <span>·</span>
                              <span className="font-mono text-slate-600">
                                {log.canton || comp?.canton}
                              </span>
                            </>
                          )}
                          <span>·</span>
                          <span className="uppercase">{log.language}</span>
                          <span>·</span>
                          <span className="tabular-nums">{formattedTime}</span>
                        </div>
                        <p className="text-xs font-medium text-slate-700 truncate">
                          {log.subject}
                        </p>
                      </div>

                      <span
                        className={`self-start sm:self-center shrink-0 font-medium px-2 py-0.5 rounded-md text-[11px] capitalize ${
                          isOk
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                            : 'bg-red-50 text-red-600 border border-red-200/60'
                        }`}
                      >
                        {log.delivery_status === 'accepted'
                          ? 'Accepted by SMTP'
                          : log.delivery_status}
                      </span>
                    </div>
                  );
                })}
                {onNavigateToEmails && (
                  <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
                    <button
                      type="button"
                      onClick={() => onNavigateToEmails()}
                      className="text-xs font-semibold text-[#1A73E8] hover:text-blue-700 flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
                    >
                      <span>Open Full Sent Emails Table &amp; Analytics</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right 5 Columns: Configuration Summary */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-50 text-[#FF6B00] border border-orange-200/80 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-base text-[#0B2240] leading-tight">
                    Target Swiss Regions
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {settings.selected_cantons.length} of 26 cantons active
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onNavigateToTargets}
                className="h-8 px-3 rounded-full bg-slate-100 hover:bg-slate-200 text-[#0B2240] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <span>Manage</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#FF6B00]" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1">
              {settings.selected_cantons.map((canton) => {
                const info = CANTON_BY_CODE.get(canton);
                const countInCanton = companies.filter(
                  (c) =>
                    c.canton === canton &&
                    !c.unsubscribed &&
                    c.email &&
                    c.verified_email !== false
                ).length;

                return (
                  <button
                    key={canton}
                    type="button"
                    onClick={onNavigateToTargets}
                    className="p-2.5 rounded-xl bg-slate-50/90 hover:bg-orange-50/50 border border-slate-200/80 hover:border-orange-300 text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="px-1.5 py-0.5 rounded-md bg-white border border-slate-200 group-hover:border-orange-200 font-mono font-bold text-[11px] text-[#0B2240]">
                        {canton}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">
                        {info?.language || 'DE'}
                      </span>
                    </div>
                    <div className="font-semibold text-xs text-[#0B2240] mt-1.5 truncate">
                      {info?.name || `Canton ${canton}`}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {countInCanton} {countInCanton === 1 ? 'company' : 'companies'}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-[11px] text-slate-500 block">Eligible companies</span>
                <span className="font-mono font-bold text-sm text-[#0B2240] tabular-nums mt-0.5 block">
                  {activeContractorsCount} of {companies.length}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-orange-50/50 border border-orange-200/70">
                <span className="text-[11px] text-slate-600 block">Daily speed limit</span>
                <span className="font-mono font-bold text-sm text-[#FF6B00] tabular-nums mt-0.5 block">
                  {settings.daily_limit} emails / day
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-200/70 flex items-center justify-center">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <h3 className="font-heading font-bold text-base text-[#0B2240]">
                  Jimy&apos;s Outreach Persona
                </h3>
              </div>
              <button
                type="button"
                onClick={onNavigateToPersona}
                className="text-xs font-semibold text-[#FF6B00] hover:text-[#E05E00] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Edit</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center gap-3">
                <img
                  src="/assets/jimy-export-avatar.jpg"
                  alt="Jimy Export Profile Avatar"
                  className="w-10 h-10 rounded-full object-cover border border-slate-300 shrink-0"
                />
                <div className="min-w-0">
                  <span className="font-semibold text-[#202124] block truncate">
                    {settings.sender_name} - JIMY EXPORT
                  </span>
                  <span className="text-[11px] text-[#5f6368] block truncate">
                    {settings.sender_email} · Lastwagen &amp; Baumaschine Händler
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                <span className="text-slate-500 block">Target equipment</span>
                <span className="font-medium text-[#0B2240] leading-relaxed block mt-0.5">
                  {settings.equipment_focus}
                </span>
              </div>

              <div className="pt-1 space-y-2">
                <span className="font-semibold text-[#0B2240] block">
                  Included purchase terms
                </span>
                <div className="space-y-1.5 text-slate-700">
                  {settings.hooks.cash_settlement && (
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#FF6B00] stroke-[2.5] shrink-0" />
                      <span>Immediate wire settlement prior to pickup</span>
                    </div>
                  )}
                  {settings.hooks.transport_covered && (
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#FF6B00] stroke-[2.5] shrink-0" />
                      <span>Heavy transport organized and covered</span>
                    </div>
                  )}
                  {settings.hooks.as_is && (
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#FF6B00] stroke-[2.5] shrink-0" />
                      <span>Purchased as-is without warranty obligation</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
