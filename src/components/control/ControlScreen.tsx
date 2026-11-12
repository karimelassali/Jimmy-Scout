import React, { useState, useEffect } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Switch } from '@astryxdesign/core/Switch';
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
import { AgentActionsPanel } from './AgentActionsPanel.tsx';
import {
  getJimmyMascotState,
  JIMMY_MASCOT_SRC,
  JIMMY_MASCOT_ALT,
} from '../jimmy/jimmy-mascot.ts';

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
  onNavigateToTargets: (canton?: string) => void;
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
  const [isEnablingPush, setIsEnablingPush] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | null>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : null
  );
  const [pushHelpVisible, setPushHelpVisible] = useState(false);
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
          ? 'Jimy travaille maintenant. La recherche et les envois activés sont automatiques.'
          : 'Jimy est maintenant en pause.'
      );
    } catch (err: any) {
      showToast(err?.message || 'Impossible de changer l’état de Jimy', true);
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
      showToast(err?.message || 'Impossible de changer ce réglage', true);
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
      if (!res.ok || data.success === false) {
        showToast(
          data.message ||
            `Impossible de vérifier la boîte mail : ${data.error || 'vérifiez votre connexion'}`,
          true
        );
      } else {
        await onRefreshAll();
        showToast(
          data.message ||
            (data.messagesProcessed > 0
              ? `Jimy a trouvé ${data.messagesProcessed} nouvelle${data.messagesProcessed > 1 ? 's' : ''} réponse${data.messagesProcessed > 1 ? 's' : ''}.`
              : 'Jimy a vérifié votre boîte mail : toutes les réponses sont à jour.')
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

  const subscribePush = async () => {
    const keyRes = await fetch('/api/push/public-key');
    const keyData = await keyRes.json();
    if (!keyRes.ok || !keyData.publicKey) throw new Error(keyData.error || 'Notifications not configured');
    const publicKey = Uint8Array.from(
      atob(keyData.publicKey.replace(/-/g, '+').replace(/_/g, '/')),
      (char) => char.charCodeAt(0)
    );
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: publicKey,
    });
    const saveRes = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription),
    });
    const saveData = await saveRes.json();
    if (!saveRes.ok) throw new Error(saveData.error || 'Unable to save notification settings');
    showToast('Notifications activées : Jimy vous alertera même lorsque l’application est fermée.');
  };

  const handleEnablePush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      showToast('Les notifications ne sont pas prises en charge par ce navigateur.', true);
      return;
    }
    // Permission refusée : pas de toast rouge, on explique calmement sur place.
    if (Notification.permission === 'denied') {
      setPushPermission('denied');
      setPushHelpVisible(true);
      return;
    }
    setIsEnablingPush(true);
    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      if (permission === 'denied') {
        setPushHelpVisible(true);
        return;
      }
      if (permission !== 'granted') return;
      await subscribePush();
      setPushHelpVisible(false);
    } catch (err: any) {
      showToast(`Notifications impossibles : ${err?.message || 'erreur inconnue'}`, true);
    } finally {
      setIsEnablingPush(false);
    }
  };

  // L'utilisateur a pu réactiver les notifications dans les réglages du
  // navigateur : on vérifie à nouveau au lieu de redemander aveuglément.
  const handleRecheckPush = async () => {
    if (!('Notification' in window)) return;
    const permission = Notification.permission;
    setPushPermission(permission);
    if (permission === 'denied') return;
    setPushHelpVisible(false);
    if (permission === 'granted') {
      setIsEnablingPush(true);
      try {
        await subscribePush();
      } catch (err: any) {
        showToast(`Notifications impossibles : ${err?.message || 'erreur inconnue'}`, true);
      } finally {
        setIsEnablingPush(false);
      }
    } else {
      await handleEnablePush();
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
        showToast(`Jimy a envoyé un courriel à ${data.company} (${data.email})`);
      } else {
        showToast(data.message || data.error || 'Impossible d’envoyer le courriel', true);
      }
    } catch (err: any) {
      showToast(`Envoi impossible : ${err?.message || 'erreur de connexion'}`, true);
    } finally {
      setIsDispatching(false);
    }
  };

  const handleTestTelegram = async () => {
    setIsTestingTelegram(true);
    try {
      const res = await fetchWithTimeout('/api/test-telegram', { method: 'POST' }, 10_000);
      const data = await res.json();
      if (res.ok && data.success !== false) {
        showToast(
          data.message ||
            `Alerte de test envoyée sur Telegram (@${data.botUsername || 'Jimy_scout_bot'}).`
        );
      } else {
        showToast(
          data.message ||
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
      showToast('Aucun dossier à exporter pour le moment.', true);
      return;
    }
    const headers = [
      'ID',
      'Société',
      'Canton',
      'Machine',
      'Prix_demandé',
      'Prix_CHF',
      'Téléphone',
      'État',
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
    showToast('Le fichier des dossiers a été téléchargé.');
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

  // Provenance note for the offers total (QA #23): the server's
  // /api/leads/offers-summary explains the conversion (e.g. how many offers
  // were converted from EUR). Falls back to the plain label if unavailable.
  const [offersNote, setOffersNote] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/leads/offers-summary')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.note) setOffersNote(data.note);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [leads.length]);

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

  const adminName = settings.sender_name?.trim() || 'Jamal';
  const formattedDate = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const getSchedulerBadge = (): {
    label: string;
    variant: 'gray' | 'orange' | 'blue' | 'green';
  } => {
    if (!settings.is_active || !settings.outreach_active) {
      return { label: 'En pause', variant: 'gray' };
    }
    if (schedulerStatus?.state === 'waiting_for_hours') {
      return {
        label: 'En attente jusqu’à 08 h 30 (Zurich)',
        variant: 'orange',
      };
    }
    if (schedulerStatus?.state === 'quota_reached') {
      return {
        label: 'Limite du jour atteinte',
        variant: 'blue',
      };
    }
    return {
      label: 'Actif pendant les heures suisses',
      variant: 'green',
    };
  };

  const schedulerBadge = getSchedulerBadge();
  // Source unique de vérité : l'interrupteur principal. « Jimy travaille »
  // ne s'affiche que pendant une exécution réelle, sinon « En attente ».
  const isRunInProgress =
    schedulerStatus?.state === 'running' || discoveryStatus?.state === 'running';
  const missionHeading = !settings.is_active
    ? 'Jimy est en pause'
    : isRunInProgress
      ? 'Jimy travaille'
      : 'En attente';
  const mascotState = getJimmyMascotState({
    isActive: settings.is_active,
    schedulerState: schedulerStatus?.state,
    discoveryState: discoveryStatus?.state,
  });
  const statusFr = (value?: string | null) => ({
    paused: 'en pause', enabled: 'activée', waiting: 'en attente', running: 'en cours',
    waiting_for_hours: 'en attente des heures', quota_reached: 'limite atteinte', failed: 'erreur',
  }[value || ''] || value || 'en pause');

  return (
    <div className="space-y-6 pb-24 md:pb-12">
      {/* Snackbar Toast */}
      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4">
          <Banner
            status={toast.isError ? 'error' : 'info'}
            container="card"
            collapsible={false}
            isDismissable
            title={toast.msg}
            onDismiss={() => setToast(null)}
          />
        </div>
      )}

      {/* Page context */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <StatusDot variant={settings.is_active ? 'success' : 'warning'} isPulsing={settings.is_active} label="Statut" />
            <span>{formattedDate} · Espace d’achat suisse</span>
          </div>
          <h1 className="font-heading font-semibold text-2xl sm:text-3xl text-[#0B2240] tracking-tight mt-1">
            Poste de commande
          </h1>
          <p className="mt-1 text-sm text-slate-500">{adminName} · vos recherches, envois et occasions au même endroit</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <Button
            label="Tester l’alerte"
            variant="secondary"
            size="sm"
            onClick={handleTestTelegram}
            isLoading={isTestingTelegram}
            icon={<Bell className="w-3.5 h-3.5 text-[#FF6B00]" />}
          />

          <Button
            label="Exporter CSV"
            variant="secondary"
            size="sm"
            onClick={handleExportCSV}
            icon={<Download className="w-3.5 h-3.5 text-slate-500" />}
          />
        </div>
      </div>

      <AgentActionsPanel />

      {/* Jimy briefing */}
      <section
        className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-colors ${
          settings.is_active ? 'border-emerald-300/90' : 'border-orange-200/90'
        }`}
      >
        <div
          className={`h-1 w-full ${
            settings.is_active
              ? 'bg-emerald-500'
              : 'bg-[#FF6B00]'
          }`}
        />

        <div className="p-5 sm:p-8 lg:p-10 grid grid-cols-1 md:grid-cols-[minmax(216px,0.8fr)_minmax(0,1.2fr)] items-center gap-6 sm:gap-8">
          <div className="flex items-center justify-center min-w-0">
            <div className="w-40 h-40 sm:w-48 sm:h-48 lg:w-56 lg:h-56 shrink-0 flex items-center justify-center overflow-visible">
              <img src={JIMMY_MASCOT_SRC[mascotState]} alt={JIMMY_MASCOT_ALT[mascotState]} aria-label="Mascotte Jimy" className="w-full h-full object-contain select-none" />
            </div>
          </div>

          <div className="min-w-0 space-y-5 md:text-left">
            <div className="flex items-start gap-2.5 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <StatusDot
                    variant={settings.is_active ? 'success' : 'warning'}
                    isPulsing={settings.is_active}
                    label="Mission Jimy"
                  />
                  <span className="text-xs font-medium text-slate-500">Mission Jimy</span>
                </div>
                <h2 className="font-heading font-semibold text-xl sm:text-2xl text-[#0B2240] mt-1">
                  {missionHeading}
                </h2>
              </div>
              <div className="ml-0 md:ml-auto">
                <Badge label={schedulerBadge.label} variant={schedulerBadge.variant} />
              </div>
            </div>

            <p className="text-base leading-7 text-slate-600 max-w-xl">
              {settings.is_active
                ? isRunInProgress
                  ? `Je cherche en ce moment dans ${settings.selected_cantons.length} cantons suisses et je vous préviendrai dès qu’une occasion mérite votre attention.`
                  : `Je surveille ${settings.selected_cantons.length} cantons suisses et je vous préviendrai dès qu’une occasion mérite votre attention.${schedulerStatus?.next_send_at ? ` Prochain passage ${new Date(schedulerStatus.next_send_at).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}.` : ''}`
                : `Vous avez ${activeContractorsCount} sociétés prêtes sur ${companies.length} vérifiées. Lancez-moi quand vous voulez chercher les prochaines bonnes occasions.`}
            </p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
              <span className="font-mono font-medium text-[#0B2240] tabular-nums">{todaySentCount}/{settings.daily_limit} envois aujourd’hui</span>
              <span className="hidden sm:block h-3 w-px bg-slate-200" />
              <span>{todaySentCount} échanges suivis</span>
              {schedulerStatus?.next_send_at && settings.is_active && (
                <span className="inline-flex items-center gap-1 text-slate-600">
                  <Clock className="w-3.5 h-3.5 text-[#FF6B00]" />
                  Prochain passage {new Date(schedulerStatus.next_send_at).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            <div data-tour="daily-limit-slider" className="max-w-md">
              <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                <span>Rythme d’envoi</span>
                <span className="font-mono tabular-nums">{quotaPercent}% de la limite</span>
              </div>
              <ProgressBar
                label="Rythme d’envoi"
                value={quotaPercent}
                max={100}
                variant="accent"
                isLabelHidden
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <div data-tour="poll-imap-btn">
                <Button
                  label="Vérifier les réponses"
                  variant="secondary"
                  size="sm"
                  onClick={handlePollImap}
                  isLoading={isPollingImap}
                  icon={<RefreshCw className="w-3.5 h-3.5 text-slate-500" />}
                />
              </div>
              <Button
                label={pushPermission === 'denied' ? 'Notifications bloquées — voir comment activer' : 'Activer les alertes'}
                variant="secondary"
                size="sm"
                onClick={handleEnablePush}
                isLoading={isEnablingPush}
                icon={<Bell className="w-3.5 h-3.5 text-[#FF6B00]" />}
              />
              <div data-tour="manual-dispatch-btn" title={dispatchTitle}>
                <Button
                  label="Envoyer 1 maintenant"
                  variant="secondary"
                  size="sm"
                  onClick={handleDispatchStep}
                  isLoading={isDispatching}
                  isDisabled={!canDispatchNow}
                  icon={<Send className="w-3.5 h-3.5 text-[#FF6B00]" />}
                />
              </div>
              <div data-tour="auto-scout-switch">
                <Button
                  label={settings.is_active ? 'Mettre Jimy en pause' : 'Mettre Jimy au travail'}
                  variant={settings.is_active ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={toggleActiveScouting}
                  icon={
                    settings.is_active ? (
                      <Pause className="w-3.5 h-3.5 fill-current" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )
                  }
                />
              </div>
            </div>

            {pushHelpVisible && pushPermission === 'denied' && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 max-w-xl">
                <p className="text-sm font-medium text-[#0B2240]">Les notifications sont bloquées pour ce site.</p>
                <p className="text-xs text-slate-600 leading-relaxed mt-1">
                  Pour les réactiver : ouvrez les réglages du navigateur (icône cadenas à gauche de l’adresse),
                  autorisez les notifications pour ce site, puis revenez ici et touchez « Vérifier à nouveau ».
                </p>
                <div className="mt-3">
                  <Button
                    label="Vérifier à nouveau"
                    variant="secondary"
                    size="sm"
                    onClick={handleRecheckPush}
                    isLoading={isEnablingPush}
                    icon={<Bell className="w-3.5 h-3.5 text-[#FF6B00]" />}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100 bg-slate-50/70 p-4 sm:px-5 grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-slate-100 text-[#0B2240] flex items-center justify-center shrink-0">
                <Globe2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-heading font-medium text-sm text-[#0B2240]">Recherche de sociétés</h3>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${
                    settings.is_active && settings.discovery_active ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {settings.is_active && settings.discovery_active ? statusFr(discoveryStatus?.state) : 'en pause'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Recherche dans les cantons choisis toutes les {settings.discovery_interval_minutes} minutes.
                </p>
                {!settings.is_active && (
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Sans effet — l’interrupteur principal est éteint.
                  </p>
                )}
                {(!settings.is_active || !settings.discovery_active) && discoveryStatus?.provider_configured && (
                  <p className="text-[11px] text-blue-700 mt-1.5">
                    Jimy est en pause, mais vous pouvez lancer une recherche unique avec « Chercher maintenant ».
                  </p>
                )}
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px]">
                  <span className="font-semibold text-[#0B2240]">{(discoveryStatus?.scanned_today ?? (discoveryStatus?.found_today || 0) + (discoveryStatus?.duplicates_today || 0))} examinées aujourd’hui</span>
                  <span className="text-slate-500">{discoveryStatus?.found_today || 0} trouvées</span>
                  <span className="text-emerald-700">{discoveryStatus?.ready_today || 0} prêtes</span>
                  <span className="text-slate-500">{discoveryStatus?.rejected_today || 0} écartées</span>
                  <span className="text-amber-700">{discoveryStatus?.missing_email_today || 0} sans courriel</span>
                  {(discoveryStatus?.error_today || 0) > 0 && (
                    <span className="text-red-700">{discoveryStatus?.error_today} erreur{(discoveryStatus?.error_today || 0) > 1 ? 's' : ''}</span>
                  )}
                  <span className="text-slate-500">{discoveryStatus?.duplicates_today || 0} doublons</span>
                </div>
                {!discoveryStatus?.provider_configured && (
                  <p className="text-[11px] text-amber-700 mt-2">Ajoutez une source de recherche pour commencer.</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Button
                label="Chercher maintenant"
                variant="secondary"
                size="sm"
                onClick={handleDiscoveryStep}
                isLoading={isDiscovering}
                isDisabled={!discoveryStatus?.provider_configured}
                icon={<Search className="w-3.5 h-3.5" />}
              />
              <Switch
                label="Recherche automatique de sociétés"
                isLabelHidden
                value={settings.discovery_active}
                onChange={() => void toggleEngine('discovery_active')}
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-slate-100 text-[#0B2240] flex items-center justify-center shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-heading font-medium text-sm text-[#0B2240]">Envoi automatique</h3>
                  <Badge
                    label={settings.is_active && settings.outreach_active ? statusFr(schedulerStatus?.state) : 'en pause'}
                    variant={settings.is_active && settings.outreach_active ? 'green' : 'gray'}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Envoie des courriels aux sociétés vérifiées pendant les heures suisses.
                </p>
                {!settings.is_active && (
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Sans effet — l’interrupteur principal est éteint.
                  </p>
                )}
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px]">
                  <span className="font-semibold text-[#0B2240]">{todaySentCount}/{settings.daily_limit} envoyés aujourd’hui</span>
                  <span className="text-emerald-700">{activeContractorsCount} prêtes</span>
                </div>
              </div>
            </div>
            <Switch
              label="Envoi automatique"
              isLabelHidden
              value={settings.outreach_active}
              onChange={() => void toggleEngine('outreach_active')}
            />
          </div>
        </div>
      </section>

      {/* 4-COLUMN VIVID KPI STRIP */}
      <section
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        data-tour="pipeline-stats"
      >
        <div
          onClick={() => onNavigateToTargets()}
          className="bg-white rounded-xl p-5 border border-slate-200/90 hover:border-[#0B2240]/30 shadow-2xs hover:shadow-sm transition-[border-color,box-shadow] cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Sociétés cibles</span>
              <div className="w-9 h-9 rounded-lg bg-slate-100 text-[#0B2240] border border-slate-200 flex items-center justify-center">
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
          className="bg-white rounded-xl p-5 border border-slate-200/90 hover:border-[#0B2240]/30 shadow-2xs hover:shadow-sm transition-[border-color,box-shadow] cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Courriels envoyés par Jimy</span>
              <div className="w-9 h-9 rounded-lg bg-slate-100 text-[#0B2240] border border-slate-200 flex items-center justify-center">
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
          className="bg-[#FFF8F3] rounded-xl p-5 border border-orange-200 hover:border-[#FF6B00] shadow-2xs hover:shadow-sm transition-[border-color,box-shadow] cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#C94F00]">Machines proposées</span>
              <div className="w-9 h-9 rounded-lg bg-orange-100/80 text-[#FF6B00] border border-orange-200/80 flex items-center justify-center">
                <Flame className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 font-heading font-bold text-2xl sm:text-3xl text-[#FF6B00] tabular-nums">
              {leads.length}
            </div>
            <span className="text-xs text-slate-600 mt-1 block">
              {leads.length} réponses reçues — {leads.length - newLeadsCount} dossier{leads.length - newLeadsCount === 1 ? '' : 's'} actif{leads.length - newLeadsCount === 1 ? '' : 's'}, {newLeadsCount} à vérifier
            </span>
          </div>
          <div className="mt-4 pt-3 border-t border-orange-100 flex items-center justify-between text-[#FF6B00] font-semibold text-xs group-hover:text-[#E05E00]">
            <span>Voir les dossiers machines</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Valeur totale des offres</span>
              <div className="w-9 h-9 rounded-lg bg-slate-100 text-[#0B2240] border border-slate-200 flex items-center justify-center">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 font-heading font-bold text-2xl sm:text-3xl text-[#0B2240] tabular-nums">
              {formattedPipelineChf}
            </div>
            <span className="text-xs text-emerald-600 font-medium mt-1 block">
              {offersNote || 'Convertie en CHF'}
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
            <div className="bg-white rounded-xl p-6 border border-orange-200/90 shadow-2xs space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-orange-100/80 text-[#C94F00] font-medium text-xs border border-orange-200 flex items-center gap-1.5">
                    <Flame className="w-3 h-3 fill-[#FF6B00]" />
                    <span>Dernière offre du vendeur</span>
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-mono font-medium text-xs">
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

              <div className="p-4 rounded-lg bg-[#FFF8F3] border border-orange-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-heading font-bold text-base sm:text-lg text-[#0B2240]">
                    {topLead.machinery_detected[0]?.make_model || 'Machine de chantier'}
                  </h3>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-slate-700">{topLead.company_name}</span>
                    {topLead.contact_name && topLead.contact_name !== topLead.company_name && (
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
                  <div className="px-3 py-1.5 rounded-lg bg-orange-50 border border-orange-200 text-[#C94F00] font-medium font-mono text-sm">
                    {topLead.machinery_detected[0]?.asking_price || 'Prix sur demande'}
                  </div>

                  {topLead.contact_phone && (
                    <a
                      href={`tel:${topLead.contact_phone.replace(/\s+/g, '')}`}
                      className="h-9 px-4 rounded-lg bg-[#0B2240] hover:bg-[#061529] text-white font-medium text-xs flex items-center justify-center gap-1.5 shrink-0 transition-colors cursor-pointer shadow-2xs"
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
            className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden"
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
                  onClick={() => onNavigateToTargets()}
                  className="h-8 px-3 rounded-lg bg-slate-100 hover:bg-slate-200/70 border border-slate-200 text-[#0B2240] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter une société</span>
                </button>
              </div>
            </div>

            {logs.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="Jimy n’a encore envoyé aucun courriel"
                  description={
                    canDispatchNow
                      ? 'Activez Jimy pour commencer les envois, ou cliquez sur « Envoyer 1 maintenant ».'
                      : !settings.is_active
                        ? 'Activez Jimy pour commencer les envois.'
                        : !settings.outreach_active
                          ? 'Activez l’envoi automatique pour commencer les envois.'
                          : schedulerStatus?.next_send_at
                            ? `L’envoi reprend ${new Date(schedulerStatus.next_send_at).toLocaleString('fr-CH', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}.`
                            : 'L’envoi reprend à 08:30.'
                  }
                />
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {logs.slice(0, 10).map((log) => {
                  const comp = log.company_id ? companyById.get(log.company_id) : undefined;
                  const sentDate = new Date(log.sent_at);
                  const formattedTime = sentDate.toLocaleTimeString('fr-CH', {
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
                            {log.company_name || comp?.name || 'Société'}
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
                          : log.delivery_status === 'delivered'
                            ? 'Remis'
                            : log.delivery_status === 'simulated'
                              ? 'Simulé'
                              : log.delivery_status === 'failed'
                                ? 'Échec'
                                : log.delivery_status === 'bounced'
                                  ? 'Rejeté'
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
          <div className="bg-white rounded-xl p-6 border border-slate-200/90 shadow-2xs space-y-4">
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
                onClick={() => onNavigateToTargets()}
                className="h-8 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#0B2240] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
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
                    onClick={() => onNavigateToTargets(canton)}
                    className="p-2.5 rounded-lg bg-slate-50/90 hover:bg-orange-50/50 border border-slate-200/80 hover:border-orange-300 text-left transition-colors cursor-pointer group"
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

          <div className="bg-white rounded-xl p-6 border border-slate-200/90 shadow-2xs space-y-4">
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
                  alt="Photo du profil Jimy Export"
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
