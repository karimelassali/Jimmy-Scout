import React, { useState } from 'react';
import { AgentSettings, Company, OutboundLog } from '@/packages/types/src/database.ts';
import { InboundLead } from '@/packages/types/src/lead.ts';
import {
  Power,
  Send,
  Download,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  SlidersHorizontal,
  MapPin,
  PhoneCall,
  Bell,
  Copy,
  Plus,
} from 'lucide-react';

interface ControlScreenProps {
  settings: AgentSettings;
  onUpdateSettings: (patch: Partial<AgentSettings>) => Promise<void>;
  leads: InboundLead[];
  companies: Company[];
  logs: OutboundLog[];
  sqlReady: boolean;
  onRefreshAll: () => Promise<void>;
  onNavigateToLeads: () => void;
  onNavigateToTargets: () => void;
  onNavigateToPersona: () => void;
  todaySentCount: number;
}

export const ControlScreen: React.FC<ControlScreenProps> = ({
  settings,
  onUpdateSettings,
  leads,
  companies,
  logs,
  sqlReady,
  onRefreshAll,
  onNavigateToLeads,
  onNavigateToTargets,
  onNavigateToPersona,
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
    await onUpdateSettings({ is_active: nextState });
    showToast(
      nextState
        ? 'Automated scouting enabled — outbound dispatch active during Swiss business hours'
        : 'Automated scouting paused'
    );
  };

  const handlePollImap = async () => {
    setIsPollingImap(true);
    try {
      const res = await fetch('/api/imap/poll', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(`IMAP Error: ${data.error || 'Failed to poll inbox'}`, true);
      } else {
        await onRefreshAll();
        showToast(
          data.messagesProcessed > 0
            ? `Processed ${data.messagesProcessed} new email(s) from IMAP inbox`
            : 'IMAP inbox checked — 0 new unread emails'
        );
      }
    } catch (err: any) {
      showToast(`IMAP connection error: ${err?.message || 'Unknown error'}`, true);
    } finally {
      setIsPollingImap(false);
    }
  };

  const handleDispatchStep = async () => {
    setIsDispatching(true);
    try {
      const res = await fetch('/api/worker/step', { method: 'POST' });
      const data = await res.json();
      await onRefreshAll();
      if (res.ok && data.status === 'dispatched') {
        showToast(`Dispatched ${data.language.toUpperCase()} email to ${data.company} (${data.email})`);
      } else {
        showToast(data.message || data.error || 'Dispatch could not complete', true);
      }
    } catch (err: any) {
      showToast(`Dispatch failed: ${err?.message || 'Network error'}`, true);
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
        showToast(`Telegram alert delivered via @${data.botUsername || 'Jimy_scout_bot'}`);
      } else {
        showToast(`Telegram error: ${data.error || 'Delivery failed'}`, true);
      }
    } catch (err: any) {
      showToast(`Telegram error: ${err?.message}`, true);
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const handleCopySqlMigration = async () => {
    try {
      const res = await fetch('/api/sql-migration');
      const data = await res.json();
      if (data.sql) {
        await navigator.clipboard.writeText(data.sql);
        showToast('Copied SQL DDL migration to clipboard — paste into Supabase SQL Editor');
      }
    } catch {
      showToast('Failed to copy SQL migration', true);
    }
  };

  const handleExportCSV = () => {
    if (leads.length === 0) {
      showToast('No deals available to export yet.', true);
      return;
    }
    const csvContent =
      'data:text/csv;charset=utf-8,ID,Company,Canton,Machinery,Asking_Price_CHF,Contact_Phone,Status\n' +
      leads
        .map(
          (l) =>
            `"${l.id}","${l.company_name || ''}","${l.canton || ''}","${l.machinery_detected
              .map((m) => m.make_model)
              .join('; ')}","${l.machinery_detected[0]?.asking_price || ''}","${
              l.contact_phone || ''
            }","${l.lead_status}"`
        )
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'JimiScout-Swiss-Deals.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Downloaded JimiScout-Swiss-Deals.csv');
  };

  // Compute 100% real metrics from database state
  const activeContractorsCount = companies.filter((c) => !c.unsubscribed).length;
  const deliveredLogsCount = logs.filter((l) => l.delivery_status === 'delivered').length;
  const bouncedLogsCount = logs.filter((l) => l.delivery_status === 'bounced').length;
  const newLeadsCount = leads.filter((l) => l.lead_status === 'new').length;

  const totalAskingValueChf = leads.reduce((sum, lead) => {
    for (const m of lead.machinery_detected || []) {
      if (m.asking_price) {
        const digits = m.asking_price.replace(/[^0-9]/g, '');
        const parsed = parseInt(digits, 10);
        if (!isNaN(parsed) && parsed > 0) {
          sum += parsed;
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

  return (
    <div className="space-y-6 pb-24 md:pb-12">
      {/* Clean Google-style Snackbar Toast */}
      {toast && (
        <div
          className={`fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full text-white shadow-lg flex items-center gap-2.5 text-sm font-medium max-w-xl ${
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

      {/* Page Title & Live Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-[#0B2240] tracking-tight">
            Mission Control
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Live B2B outreach, IMAP inbox polling, and Gemini 3.8 Flash reply triage for Swiss heavy machinery.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleTestTelegram}
            disabled={isTestingTelegram}
            className="h-10 px-4 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-[#0B2240] font-heading font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Bell className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span>{isTestingTelegram ? 'Sending...' : 'Test Telegram Alert'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="h-10 px-4 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-[#0B2240] font-heading font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Deals CSV</span>
          </button>
        </div>
      </div>

      {/* HERO CONTROL CARD: Master Automation Toggle & Daily Quota */}
      <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div className="space-y-1.5 max-w-2xl">
            <div className="text-xs font-medium text-slate-500">
              <span>Outreach Engine</span>
              <span className="mx-2">·</span>
              <span>Swiss Working Hours (08:30–17:00 CET, Mon–Fri)</span>
              <span className="mx-2">·</span>
              <span>8–18 min anti-spam delay</span>
            </div>
            <h2 className="font-heading font-bold text-xl sm:text-2xl text-[#0B2240]">
              {settings.is_active
                ? 'Autonomous Scouting is Active'
                : 'Autonomous Scouting is Paused'}
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              {settings.is_active
                ? `Sending trilingual purchase inquiries (DE, FR, IT) from ${settings.sender_email} to contractors in ${settings.selected_cantons.join(', ')} and routing seller offers to Telegram.`
                : 'Outbound acquisition emails are currently paused. Enable the engine below to allow live SMTP dispatches.'}
            </p>
          </div>

          {/* Primary Master Toggle Button */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={toggleActiveScouting}
              className={`h-12 px-6 rounded-full font-heading font-semibold text-sm flex items-center gap-2.5 transition-all cursor-pointer ${
                settings.is_active
                  ? 'bg-[#059669] hover:bg-[#047857] text-white shadow-xs'
                  : 'bg-slate-200 hover:bg-slate-300 text-[#0B2240]'
              }`}
            >
              <Power className="w-4 h-4" />
              <span>{settings.is_active ? 'Active — Pause Engine' : 'Paused — Start Engine'}</span>
            </button>
          </div>
        </div>

        {/* Daily Dispatch Progress & Action Bar */}
        <div className="pt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-2.5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-[#0B2240]">
                Daily Email Quota
              </span>
              <span className="font-mono text-sm font-semibold text-[#FF6B00] tabular-nums">
                {todaySentCount} / {settings.daily_limit} sent today ({quotaPercent}%)
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className="bg-[#FF6B00] h-full rounded-full transition-all duration-500"
                style={{ width: `${quotaPercent}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">
              Enforces a strict 30-day cooldown per contractor and automatic STOP unsubscribe compliance.
            </p>
          </div>

          <div className="lg:col-span-5 flex flex-wrap items-center lg:justify-end gap-3">
            <button
              type="button"
              onClick={handleDispatchStep}
              disabled={isDispatching}
              className="h-11 px-5 rounded-full bg-[#FF6B00] hover:bg-[#E05E00] text-white font-heading font-semibold text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Send className={`w-4 h-4 ${isDispatching ? 'animate-pulse' : ''}`} />
              <span>{isDispatching ? 'Dispatching...' : 'Send Next Email Now'}</span>
            </button>

            <button
              type="button"
              onClick={handlePollImap}
              disabled={isPollingImap}
              className="h-11 px-4 rounded-full bg-slate-100 hover:bg-slate-200 text-[#0B2240] font-heading font-semibold text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isPollingImap ? 'animate-spin' : ''}`} />
              <span>{isPollingImap ? 'Checking IMAP...' : 'Poll IMAP Inbox'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* 4-COLUMN LIVE KPI SUMMARY STRIP */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={onNavigateToTargets}
          className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 hover:border-[#0B2240] transition-colors cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Contractors in Pool</span>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-[#0B2240] transition-colors" />
          </div>
          <div className="my-2 font-heading font-bold text-2xl sm:text-3xl text-[#0B2240] tabular-nums">
            {companies.length}
          </div>
          <span className="text-xs text-slate-600">
            {activeContractorsCount} eligible · {companies.length - activeContractorsCount} opted out
          </span>
        </div>

        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500">Outbound Dispatches</span>
          <div className="my-2 font-heading font-bold text-2xl sm:text-3xl text-[#0B2240] tabular-nums">
            {deliveredLogsCount}
          </div>
          <span className="text-xs text-slate-600">
            {todaySentCount} delivered today{bouncedLogsCount > 0 ? ` · ${bouncedLogsCount} failed` : ''}
          </span>
        </div>

        <div
          onClick={onNavigateToLeads}
          className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 hover:border-[#FF6B00] transition-colors cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Hot Machinery Deals</span>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-[#FF6B00] transition-colors" />
          </div>
          <div className="my-2 font-heading font-bold text-2xl sm:text-3xl text-[#FF6B00] tabular-nums">
            {leads.length}
          </div>
          <span className="text-xs text-slate-600">
            {newLeadsCount} unread offer{newLeadsCount === 1 ? '' : 's'} ready to call
          </span>
        </div>

        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500">Tracked Deal Value</span>
          <div className="my-2 font-heading font-bold text-2xl sm:text-3xl text-[#0B2240] tabular-nums">
            {formattedPipelineChf}
          </div>
          <span className="text-xs text-[#059669] font-medium">
            Sum of parsed seller asking prices
          </span>
        </div>
      </section>

      {/* 2-COLUMN WORKSPACE: Live Outbound Logs + Active Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Columns: Priority Deal Spotlight & Live Outbound Dispatch Stream */}
        <div className="lg:col-span-7 space-y-6">
          {/* Spotlight Card for Latest Hot Deal (only shown when real deals exist) */}
          {topLead && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-[#FF6B00]">
                  <span>Latest Seller Offer</span>
                  <span className="mx-2">·</span>
                  <span>Canton {topLead.canton || 'CH'}</span>
                </div>
                <button
                  onClick={onNavigateToLeads}
                  className="text-xs font-semibold text-[#0B2240] hover:text-[#FF6B00] flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>View all {leads.length} deals</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-heading font-bold text-lg text-[#0B2240]">
                    {topLead.machinery_detected[0]?.make_model || 'Heavy Machinery'} —{' '}
                    <span className="text-[#FF6B00] font-mono tabular-nums">
                      {topLead.machinery_detected[0]?.asking_price || 'Price on request'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    <span>{topLead.company_name}</span>
                    {topLead.contact_name && (
                      <>
                        <span className="mx-1.5">·</span>
                        <span>{topLead.contact_name}</span>
                      </>
                    )}
                    {topLead.machinery_detected[0]?.year && (
                      <>
                        <span className="mx-1.5">·</span>
                        <span>Year {topLead.machinery_detected[0].year}</span>
                      </>
                    )}
                    {topLead.machinery_detected[0]?.hours && (
                      <>
                        <span className="mx-1.5">·</span>
                        <span>{topLead.machinery_detected[0].hours.toLocaleString()} hrs</span>
                      </>
                    )}
                  </p>
                </div>

                {topLead.contact_phone && (
                  <a
                    href={`tel:${topLead.contact_phone.replace(/\s+/g, '')}`}
                    className="h-11 px-5 rounded-full bg-[#FF6B00] hover:bg-[#E05E00] text-white font-heading font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shrink-0 transition-colors"
                  >
                    <PhoneCall className="w-4 h-4" />
                    <span>Appeler ({topLead.contact_phone})</span>
                  </a>
                )}
              </div>

              <p className="text-sm text-slate-600 leading-relaxed pt-2 border-t border-slate-100">
                {topLead.ai_summary}
              </p>
            </div>
          )}

          {/* Real Outbound Dispatch Logs */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading font-bold text-lg text-[#0B2240]">
                  Outbound Dispatch Log
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time record of acquisition emails sent via {settings.sender_email}
                </p>
              </div>
              <button
                type="button"
                onClick={onNavigateToTargets}
                className="h-9 px-3.5 rounded-full bg-slate-100 hover:bg-slate-200 text-[#0B2240] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Contractors</span>
              </button>
            </div>

            {logs.length === 0 ? (
              <div className="py-8 text-center space-y-3 border-t border-slate-100">
                <p className="text-sm font-medium text-[#0B2240]">
                  No outbound emails dispatched yet
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  Add verified Swiss contractors in the Swiss Cantons tab, enable the engine above, and click &ldquo;Send Next Email Now&rdquo; to dispatch via SMTP.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {logs.slice(0, 12).map((log) => {
                  const comp = companyById.get(log.company_id);
                  const sentDate = new Date(log.sent_at);
                  const formattedTime = sentDate.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={log.id}
                      className="py-4 first:pt-2 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                          <span className="font-semibold text-[#0B2240]">
                            {comp?.name || 'Contractor'}
                          </span>
                          {comp?.canton && (
                            <>
                              <span>·</span>
                              <span>Canton {comp.canton}</span>
                            </>
                          )}
                          <span>·</span>
                          <span>{log.language.toUpperCase()}</span>
                          <span>·</span>
                          <span className="tabular-nums">{formattedTime}</span>
                          <span>·</span>
                          <span
                            className={`font-semibold ${
                              log.delivery_status === 'delivered'
                                ? 'text-[#059669]'
                                : 'text-red-600'
                            }`}
                          >
                            {log.delivery_status === 'delivered' ? 'Delivered' : 'Failed'}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-[#0B2240]">{log.subject}</p>
                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                          {log.body_snippet}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right 5 Columns: Active Targeting & Persona Configuration Summary */}
        <div className="lg:col-span-5 space-y-6">
          {/* Active Targeting Summary Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <MapPin className="w-5 h-5 text-[#FF6B00]" />
                <h3 className="font-heading font-bold text-base text-[#0B2240]">
                  Active Swiss Regions
                </h3>
              </div>
              <button
                type="button"
                onClick={onNavigateToTargets}
                className="text-xs font-semibold text-[#1A73E8] hover:underline cursor-pointer"
              >
                Manage cantons &amp; directory
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-slate-600">Selected Cantons</span>
                <span className="font-mono font-semibold text-[#0B2240]">
                  {settings.selected_cantons.join(', ')}
                </span>
              </div>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-slate-600">Directory Contractors</span>
                <span className="font-mono font-semibold text-[#0B2240] tabular-nums">
                  {companies.length} total ({activeContractorsCount} active)
                </span>
              </div>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-slate-600">Daily Pace Limit</span>
                <span className="font-mono font-semibold text-[#0B2240] tabular-nums">
                  {settings.daily_limit} emails / day
                </span>
              </div>
            </div>
          </div>

          {/* Active Persona & Buyer Hooks Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <SlidersHorizontal className="w-5 h-5 text-[#FF6B00]" />
                <h3 className="font-heading font-bold text-base text-[#0B2240]">
                  Buyer Persona &amp; Terms
                </h3>
              </div>
              <button
                type="button"
                onClick={onNavigateToPersona}
                className="text-xs font-semibold text-[#1A73E8] hover:underline cursor-pointer"
              >
                Edit email template
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-xs text-slate-500 block">Sender Identity</span>
                <span className="font-medium text-[#0B2240]">
                  {settings.sender_name} · {settings.sender_email}
                </span>
              </div>

              <div>
                <span className="text-xs text-slate-500 block">Target Machinery Focus</span>
                <span className="font-medium text-[#0B2240] leading-snug block mt-0.5">
                  {settings.equipment_focus}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                <div className="font-semibold text-[#0B2240]">Active Acquisition Hooks:</div>
                {settings.hooks.cash_settlement && (
                  <div>✓ Immediate wire / cash settlement before pickup</div>
                )}
                {settings.hooks.transport_covered && (
                  <div>✓ Lowbed heavy transport fully organized &amp; covered</div>
                )}
                {settings.hooks.as_is && (
                  <div>✓ Purchased as-is without warranty obligations</div>
                )}
              </div>
            </div>
          </div>

          {/* Optional SQL Table Migration Helper if SQL tables aren't created yet */}
          {!sqlReady && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 space-y-3">
              <div className="font-heading font-bold text-sm text-[#0B2240]">
                Supabase SQL Schema Migration
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Your data is currently persisted live in your Supabase project storage bucket. To switch to native PostgreSQL tables, copy the SQL schema below and run it in your Supabase SQL Editor.
              </p>
              <button
                type="button"
                onClick={handleCopySqlMigration}
                className="h-9 px-4 rounded-full bg-slate-100 hover:bg-slate-200 text-[#0B2240] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy SQL Schema Migration</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
