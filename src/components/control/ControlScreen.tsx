import React, { useState } from 'react';
import {
  AgentSettings,
  Company,
  DiscoverySchedulerStatus,
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
  Search,
  Globe2,
  Database,
} from 'lucide-react';

interface ControlScreenProps {
  settings: AgentSettings;
  onUpdateSettings: (patch: Partial<AgentSettings>) => Promise<void>;
  leads: InboundLead[];
  companies: Company[];
  logs: OutboundLog[];
  sqlReady: boolean;
  schedulerStatus?: SchedulerStatus | null;
  discoveryStatus?: DiscoverySchedulerStatus | null;
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
  discoveryStatus,
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
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [toast, setToast] = useState<{ msg: string; isError?: boolean } | null>(null);

  const showToast = (msg: string, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 4500);
  };

  /**
   * A remote mailbox can occasionally leave a request open indefinitely.  The
   * UI must always recover, even when the provider does not answer.
   */
  const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 15_000) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const toggleActiveScouting = async () => {
    const nextState = !settings.is_active;
    try {
      await onUpdateSettings({ is_active: nextState });
      await onRefreshAll();
      showToast(
        nextState
          ? 'Jimy is now working — company discovery and enabled outreach are running automatically'
          : 'Jimy is now waiting on standby'
      );
    } catch (err: any) {
      showToast(err?.message || 'Failed to update automation status', true);
    }
  };

  const toggleEngine = async (key: 'discovery_active' | 'outreach_active') => {
    const nextState = !settings[key];
    try {
      await onUpdateSettings({ [key]: nextState });
      await onRefreshAll();
      showToast(
        `${key === 'discovery_active' ? 'Recherche de sociétés' : 'Envoi automatique'} ${
          nextState ? 'activé' : 'en pause'
        }`
      );
    } catch (err: any) {
      showToast(err?.message || 'Failed to update Jimy engine', true);
    }
  };

  const handleDiscoveryStep = async () => {
    setIsDiscovering(true);
    try {
      const res = await fetch('/api/discovery/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manualOverride: true }),
      });
      const data = await res.json();
      await onRefreshAll();
      if (res.ok && data.status === 'completed') {
        showToast(
          `Recherche terminée : ${data.ready || 0} prêtes, ${data.missingEmail || 0} sans courriel, ${data.duplicates || 0} doublons`
        );
      } else {
        showToast(data.message || data.error || 'La recherche ne peut pas démarrer', true);
      }
    } catch (err: any) {
      showToast(`Recherche échouée : ${err?.message || 'Erreur de connexion'}`, true);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handlePollImap = async () => {
    setIsPollingImap(true);
    try {
      const res = await fetchWithTimeout('/api/imap/poll', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(
          `Impossible de vérifier la boîte mail : ${data.error || 'vérifiez votre connexion'}`,
          true
        );
      } else {
        await onRefreshAll();
        showToast(
          data.messagesProcessed > 0
            ? `Jimy a trouvé ${data.messagesProcessed} nouvelle${data.messagesProcessed > 1 ? 's' : ''} réponse${data.messagesProcessed > 1 ? 's' : ''}.`
            : 'Jimy a vérifié votre boîte mail : toutes les réponses sont à jour.'
        );
      }
    } catch (err: any) {
      const message = err?.name === 'AbortError'
        ? 'La vérification prend trop de temps. Réessayez dans un instant.'
        : `Erreur de boîte mail : ${err?.message || 'échec de connexion'}`;
      showToast(message, true);
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
      const res = await fetchWithTimeout('/api/test-telegram', { method: 'POST' }, 10_000);
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(
          `Alerte de test envoyée sur Telegram (@${data.botUsername || 'Jimy_scout_bot'}).`
        );
      } else {
        showToast(
          `Erreur d’alerte : ${data.error || 'impossible d’envoyer l’alerte Telegram'}`,
          true
        );
      }
    } catch (err: any) {
      const message = err?.name === 'AbortError'
        ? 'L’alerte prend trop de temps. Vérifiez Telegram puis réessayez.'
        : `Erreur d’alerte : ${err?.message || 'échec de connexion'}`;
      showToast(message, true);
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
      'Société',
      'Canton',
      'Machinery',
      'Asking_Price_Raw',
      'Asking_Price_CHF',
      'Contact_Phone',
      'Status',
      'Action_suivante',
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
  const canDispatchNow = Boolean(
    settings.is_active &&
      settings.outreach_active &&
      schedulerStatus?.is_swiss_business_hours
  );
  const dispatchTitle = !settings.is_active || !settings.outreach_active
    ? 'Activez Jimy et l’envoi automatique pour envoyer un courriel.'
    : !schedulerStatus?.is_swiss_business_hours
      ? 'Les envois sont disponibles du lundi au vendredi, de 08:30 à 17:00 (Zurich).'
      : 'Envoyer le prochain courriel de la file maintenant.';
  const topLead = leads[0];
  const companyById = new Map(companies.map((c) => [c.id, c]));

  const getDynamicGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Bonjour';
    if (hour >= 12 && hour < 17) return 'Bon après-midi';
    if (hour >= 17 && hour < 22) return 'Bonsoir';
    return 'Bonne nuit';
  };

  const timeGreeting = getDynamicGreeting();
  const adminName = settings.sender_name?.trim() || 'Jamal';
  const formattedDate = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const getSchedulerBadge = () => {
    if (!settings.is_active || !settings.outreach_active) {
      return { label: 'En pause', color: 'bg-slate-100 text-slate-700' };
    }
    if (schedulerStatus?.state === 'waiting_for_hours') {
      return {
        label: 'En attente jusqu’à 08 h 30 (Zurich)',
        color: 'bg-amber-50 text-amber-800 border border-amber-200',
      };
    }
    if (schedulerStatus?.state === 'quota_reached') {
      return {
        label: 'Limite du jour atteinte',
        color: 'bg-blue-50 text-blue-800 border border-blue-200',
      };
    }
    return {
      label: 'Actif pendant les heures suisses',
      color: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    };
  };

  const schedulerBadge = getSchedulerBadge();
  const statusFr = (value?: string | null) => ({
    paused: 'en pause', enabled: 'activée', waiting: 'en attente', running: 'en cours',
    waiting_for_hours: 'en attente des heures', quota_reached: 'limite atteinte', failed: 'erreur',
  }[value || ''] || value || 'en pause');

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
            <span>{formattedDate} · Espace d’achat suisse</span>
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
            <span>{isTestingTelegram ? 'Envoi...' : 'Tester l’alerte'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="h-9 px-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-[#0B2240] font-medium text-xs flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Exporter CSV</span>
          </button>
        </div>
      </div>

      {/* CONVERSATIONAL AGENT JIMY PANEL */}
      <section
        className={`bg-white rounded-[28px] border shadow-sm overflow-hidden transition-colors ${
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

        <div className="p-6 sm:p-10 flex flex-col items-center gap-7 text-center">
          <div className="flex flex-col items-center gap-5 min-w-0 w-full">
            <div
              className="w-56 h-56 sm:w-72 sm:h-72 shrink-0 flex items-center justify-center overflow-visible"
            >
              <video
                src="/assets/illustrations/jimmymascut.webm"
                autoPlay
                loop
                muted
                playsInline
                aria-label="Jimy mascot"
                className="w-full h-full object-contain select-none"
              />
            </div>

            <div className="min-w-0 space-y-3 max-w-2xl">
              <div className="flex items-center justify-center gap-2.5 flex-wrap">
                <h2 className="font-heading font-bold text-xl sm:text-2xl text-[#0B2240] flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      settings.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-[#FF6B00]'
                    }`}
                  />
                  <span>{settings.is_active ? 'Je m’en occupe' : 'Je suis prêt quand vous l’êtes'}</span>
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
                  <span className="text-slate-500 text-[11px]">aujourd’hui (Zurich)</span>
                  <div className="w-14 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-[#FF6B00] h-full rounded-full transition-all duration-500"
                      style={{ width: `${quotaPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              <p className="text-base leading-7 text-slate-600 max-w-xl mx-auto">
                <span>
                  {settings.is_active
                    ? `Je surveille ${settings.selected_cantons.length} cantons suisses et je vous préviendrai dès qu’une occasion mérite votre attention.`
                    : `Vous avez ${activeContractorsCount} sociétés vérifiées. Activez-moi et je chercherai les prochaines bonnes occasions pour vous.`}
                </span>
              </p>
              <div className="flex flex-wrap justify-center items-center gap-2 text-[11px] text-slate-500">
                <span className="rounded-full bg-slate-100 px-2.5 py-1">{todaySentCount} échanges aujourd’hui</span>
                {schedulerStatus?.next_send_at && settings.is_active && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-orange-700">
                    <Clock className="w-3 h-3" />
                    Prochaine vérification {new Date(schedulerStatus.next_send_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Action Controls */}
          <div className="flex flex-wrap items-center justify-center gap-2 shrink-0">
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
            <span>{isPollingImap ? 'Vérification...' : 'Vérifier les réponses'}</span>
            </button>

            <button
              type="button"
              data-tour="manual-dispatch-btn"
              onClick={handleDispatchStep}
              disabled={isDispatching || !canDispatchNow}
              title={dispatchTitle}
              className="h-9 px-3.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-[#FF6B00] border border-orange-200/90 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isDispatching ? 'Envoi...' : 'Envoyer 1 maintenant'}</span>
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
                    <span>Mettre Jimy en pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Mettre Jimy au travail</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 bg-slate-50/70 p-4 sm:px-5 grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-blue-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                <Globe2 className={`w-5 h-5 ${discoveryStatus?.state === 'running' ? 'animate-pulse' : ''}`} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-heading font-bold text-sm text-[#0B2240]">Recherche de sociétés</h3>
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                    settings.discovery_active ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {settings.discovery_active ? statusFr(discoveryStatus?.state) : 'en pause'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Recherche dans les cantons choisis toutes les {settings.discovery_interval_minutes} minutes.
                </p>
                {(!settings.is_active || !settings.discovery_active) && discoveryStatus?.provider_configured && (
                  <p className="text-[11px] text-blue-700 mt-1.5">
                    Jimy est en pause, mais vous pouvez lancer une recherche unique avec « Chercher maintenant ».
                  </p>
                )}
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px]">
                  <span className="font-semibold text-[#0B2240]">{discoveryStatus?.found_today || 0} trouvées aujourd’hui</span>
                  <span className="text-emerald-700">{discoveryStatus?.ready_today || 0} prêtes</span>
                  <span className="text-amber-700">{discoveryStatus?.missing_email_today || 0} sans courriel</span>
                  <span className="text-slate-500">{discoveryStatus?.duplicates_today || 0} doublons</span>
                </div>
                {!discoveryStatus?.provider_configured && (
                  <p className="text-[11px] text-amber-700 mt-2">Ajoutez une source de recherche pour commencer.</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDiscoveryStep}
                disabled={isDiscovering || !discoveryStatus?.provider_configured}
                className="h-9 px-3 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Search className={`w-3.5 h-3.5 ${isDiscovering ? 'animate-spin' : ''}`} />
                <span>{isDiscovering ? 'Recherche...' : 'Chercher maintenant'}</span>
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={settings.discovery_active}
                aria-label="Recherche automatique de sociétés"
                onClick={() => toggleEngine('discovery_active')}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${settings.discovery_active ? 'bg-blue-600' : 'bg-slate-300'}`}
                title="Activer ou arrêter la recherche automatique"
              >
                <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.discovery_active ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-heading font-bold text-sm text-[#0B2240]">Envoi automatique</h3>
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                    settings.outreach_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {settings.outreach_active ? statusFr(schedulerStatus?.state) : 'en pause'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Envoie des courriels aux sociétés vérifiées pendant les heures suisses.
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px]">
                  <span className="font-semibold text-[#0B2240]">{todaySentCount}/{settings.daily_limit} envoyés aujourd’hui</span>
                  <span className="text-emerald-700">{activeContractorsCount} prêtes</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.outreach_active}
              aria-label="Envoi automatique"
              onClick={() => toggleEngine('outreach_active')}
              className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer shrink-0 ${settings.outreach_active ? 'bg-emerald-600' : 'bg-slate-300'}`}
              title="Activer ou arrêter l’envoi automatique"
            >
              <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.outreach_active ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
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
              <span className="text-xs font-medium text-slate-500">Sociétés cibles</span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 font-heading font-bold text-2xl sm:text-3xl text-[#0B2240] tabular-nums">
              {companies.length}
            </div>
            <span className="text-xs text-slate-500 mt-1 block">
              {activeContractorsCount} vérifiées et prêtes
            </span>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-blue-600 font-medium text-xs group-hover:text-blue-700">
            <span>Voir la liste des sociétés</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        <div
          onClick={() => onNavigateToEmails && onNavigateToEmails()}
          className="bg-white rounded-2xl p-5 border border-slate-200/90 hover:border-blue-400 shadow-2xs hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Courriels envoyés par Jimy</span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#1A73E8] border border-blue-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                <MailCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 font-heading font-bold text-2xl sm:text-3xl text-[#0B2240] tabular-nums">
              {deliveredLogsCount}
            </div>
            <span className="text-xs text-slate-500 mt-1 block">
              {todaySentCount} envoyés aujourd’hui
            </span>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[#1A73E8] font-medium text-xs group-hover:text-blue-700">
              <span>Voir les courriels</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        <div
          onClick={() => onNavigateToLeads()}
          className="bg-gradient-to-b from-white to-orange-50/30 rounded-2xl p-5 border border-orange-200 hover:border-[#FF6B00] shadow-2xs hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#FF6B00]">Machines proposées</span>
              <div className="w-9 h-9 rounded-xl bg-orange-100/80 text-[#FF6B00] border border-orange-200/80 flex items-center justify-center">
                <Flame className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 font-heading font-bold text-2xl sm:text-3xl text-[#FF6B00] tabular-nums">
              {leads.length}
            </div>
            <span className="text-xs text-slate-600 mt-1 block">
              {newLeadsCount} {newLeadsCount === 1 ? 'réponse non lue' : 'réponses non lues'}
            </span>
          </div>
          <div className="mt-4 pt-3 border-t border-orange-100 flex items-center justify-between text-[#FF6B00] font-semibold text-xs group-hover:text-[#E05E00]">
            <span>Voir les dossiers machines</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Valeur totale des offres</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 font-heading font-bold text-2xl sm:text-3xl text-[#0B2240] tabular-nums">
              {formattedPipelineChf}
            </div>
            <span className="text-xs text-emerald-600 font-medium mt-1 block">
              Convertie en CHF
            </span>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-slate-500 text-xs">
            <span>Prix donnés par les vendeurs</span>
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
                    <span>Dernière offre du vendeur</span>
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
                  <span>Ouvrir le dossier</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-4 rounded-xl bg-white border border-orange-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-heading font-bold text-base sm:text-lg text-[#0B2240]">
                    {topLead.machinery_detected[0]?.make_model || 'Machine de chantier'}
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
                      <span>Appeler le vendeur</span>
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
                  Activité d’envoi de Jimy
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dernières demandes envoyées depuis {settings.sender_email}
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
                    <span>Voir tout ({logs.length})</span>
                  </button>
                )}
                {onNavigateToScanner && (
                  <button
                    type="button"
                    onClick={onNavigateToScanner}
                    className="h-8 px-3 rounded-lg bg-orange-50 hover:bg-orange-100 border border-orange-200/80 text-[#FF6B00] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Scanner des cartes</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onNavigateToTargets}
                  className="h-8 px-3 rounded-lg bg-slate-100 hover:bg-slate-200/70 border border-slate-200 text-[#0B2240] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter une société</span>
                </button>
              </div>
            </div>

            {logs.length === 0 ? (
              <div className="p-8 text-center space-y-1.5">
                <p className="text-sm font-semibold text-[#0B2240]">
                  Jimy n’a encore envoyé aucun courriel
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  Activez Jimy pour commencer les envois, ou cliquez sur « Envoyer 1 maintenant ».
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
                            ? 'Accepté par le serveur'
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
                      <span>Ouvrir tous les courriels et les statistiques</span>
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
                    Régions suisses ciblées
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {settings.selected_cantons.length} sur 26 cantons actifs
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onNavigateToTargets}
                className="h-8 px-3 rounded-full bg-slate-100 hover:bg-slate-200 text-[#0B2240] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <span>Gérer</span>
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
                      {countInCanton} {countInCanton === 1 ? 'société' : 'sociétés'}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-[11px] text-slate-500 block">Sociétés prêtes</span>
                <span className="font-mono font-bold text-sm text-[#0B2240] tabular-nums mt-0.5 block">
                  {activeContractorsCount} sur {companies.length}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-orange-50/50 border border-orange-200/70">
                <span className="text-[11px] text-slate-600 block">Limite par jour</span>
                <span className="font-mono font-bold text-sm text-[#FF6B00] tabular-nums mt-0.5 block">
                  {settings.daily_limit} courriels / jour
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
                  Profil de Jimy
                </h3>
              </div>
              <button
                type="button"
                onClick={onNavigateToPersona}
                className="text-xs font-semibold text-[#FF6B00] hover:text-[#E05E00] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Modifier</span>
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
                <span className="text-slate-500 block">Machines recherchées</span>
                <span className="font-medium text-[#0B2240] leading-relaxed block mt-0.5">
                  {settings.equipment_focus}
                </span>
              </div>

              <div className="pt-1 space-y-2">
                <span className="font-semibold text-[#0B2240] block">
                  Conditions d’achat
                </span>
                <div className="space-y-1.5 text-slate-700">
                  {settings.hooks.cash_settlement && (
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#FF6B00] stroke-[2.5] shrink-0" />
                      <span>Paiement immédiat avant l’enlèvement</span>
                    </div>
                  )}
                  {settings.hooks.transport_covered && (
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#FF6B00] stroke-[2.5] shrink-0" />
                      <span>Transport lourd organisé et payé</span>
                    </div>
                  )}
                  {settings.hooks.as_is && (
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#FF6B00] stroke-[2.5] shrink-0" />
                      <span>Achat en l’état, sans garantie demandée</span>
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
