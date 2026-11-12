import React, { useState, useMemo, useEffect } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { OutboundLog, Company, AgentSettings } from '@/packages/types/src/database.ts';
import {
  Search,
  Mail,
  MailCheck,
  Send,
  Download,
  RefreshCw,
  X,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Eye,
  SlidersHorizontal,
  ChevronDown,
  Building2,
  Calendar,
  Globe,
  Filter,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Share2,
} from 'lucide-react';
import { generateDeTemplate } from '@/apps/worker/src/templates/de.template.ts';
import { generateFrTemplate } from '@/apps/worker/src/templates/fr.template.ts';
import { generateItTemplate } from '@/apps/worker/src/templates/it.template.ts';

interface OutboundEmailsScreenProps {
  logs: OutboundLog[];
  companies: Company[];
  settings: AgentSettings;
  todaySentCount: number;
  initialLogId?: string | null;
  onClearFocusedLog?: () => void;
  onRefreshLogs: () => Promise<void>;
  onNavigateToTargets?: (searchQuery?: string) => void;
  onNavigateToPersona?: () => void;
}

type SortField = 'date' | 'company' | 'canton' | 'status' | 'language';
type SortOrder = 'asc' | 'desc';
type StatusFilter = 'all' | 'delivered' | 'accepted' | 'simulated' | 'bounced' | 'failed';
type LanguageFilter = 'all' | 'de' | 'fr' | 'it';
type TimeFilter = 'all' | 'today' | '7days' | '30days';

export const OutboundEmailsScreen: React.FC<OutboundEmailsScreenProps> = ({
  logs,
  companies,
  settings,
  todaySentCount,
  initialLogId,
  onClearFocusedLog,
  onRefreshLogs,
  onNavigateToTargets,
  onNavigateToPersona,
}) => {
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [languageFilter, setLanguageFilter] = useState<LanguageFilter>('all');
  const [cantonFilter, setCantonFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Selection
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Modal / Drawer details
  const [activeModalLog, setActiveModalLog] = useState<OutboundLog | null>(null);
  // Closing the detail modal must also clear the focused log, otherwise the
  // auto-open effect (initialLogId -> setActiveModalLog) re-fires on the
  // next logs refresh and the modal pops back open by itself.
  const closeLogModal = () => {
    setActiveModalLog(null);
    if (onClearFocusedLog) onClearFocusedLog();
  };
  const [logToDelete, setLogToDelete] = useState<OutboundLog | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Quick Dispatch Trigger State
  const [isDispatching, setIsDispatching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; isError?: boolean } | null>(null);

  const showToast = (msg: string, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 4000);
  };

  const companyById = useMemo(() => {
    return new Map(companies.map((c) => [c.id, c]));
  }, [companies]);

  useEffect(() => {
    if (initialLogId && logs.length > 0) {
      const found = logs.find((l) => l.id === initialLogId);
      if (found) setActiveModalLog(found);
    }
  }, [initialLogId, logs]);

  // Available Cantons in logs for filter dropdown
  const availableCantons = useMemo(() => {
    const cantonsSet = new Set<string>();
    logs.forEach((log) => {
      const comp = companyById.get(log.company_id);
      const canton = log.canton || comp?.canton;
      if (canton) cantonsSet.add(canton);
    });
    return Array.from(cantonsSet).sort();
  }, [logs, companyById]);

  // Reconstruct full email text if not present in log
  const getFullEmailBody = (log: OutboundLog, company?: Company) => {
    if (log.full_body) return log.full_body;

    const compName = log.company_name || company?.name || 'Entreprise BTP Suisse';
    const canton = log.canton || company?.canton || 'BE';
    const lang = log.language || 'fr';

    const templateParams = {
      companyName: compName,
      recipientName: compName,
      canton: canton,
      senderName: settings.sender_name || 'Jamal',
      senderEmail: settings.sender_email || 'info@jimyexport.ch',
      senderPhone: settings.sender_phone || '+41 79 123 45 67',
      tone: settings.tone || 'swiss_formal',
      hooks: settings.hooks || { cash_settlement: true, transport_covered: true, as_is: true },
      equipmentFocus: settings.equipment_focus || 'Pelles sur chenilles, camions benne, chargeuses',
    };

    if (lang === 'fr') return generateFrTemplate(templateParams).body;
    if (lang === 'it') return generateItTemplate(templateParams).body;
    return generateDeTemplate(templateParams).body;
  };

  // Filtered & Sorted logs
  const filteredLogs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const now = new Date().getTime();

    return logs.filter((log) => {
      const comp = companyById.get(log.company_id);
      const compName = (log.company_name || comp?.name || '').toLowerCase();
      const compEmail = (log.recipient_email || comp?.email || '').toLowerCase();
      const canton = (log.canton || comp?.canton || '').toLowerCase();
      const subject = (log.subject || '').toLowerCase();
      const snippet = (log.body_snippet || '').toLowerCase();
      const fullText = (log.full_body || '').toLowerCase();

      // Search matching
      if (query) {
        const matchesQuery =
          compName.includes(query) ||
          compEmail.includes(query) ||
          canton.includes(query) ||
          subject.includes(query) ||
          snippet.includes(query) ||
          fullText.includes(query);

        if (!matchesQuery) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && log.delivery_status !== statusFilter) {
        return false;
      }

      // Language filter
      if (languageFilter !== 'all' && log.language !== languageFilter) {
        return false;
      }

      // Canton filter
      if (cantonFilter !== 'all') {
        const logCanton = (log.canton || comp?.canton || '').toUpperCase();
        if (logCanton !== cantonFilter.toUpperCase()) return false;
      }

      // Time filter
      if (timeFilter !== 'all') {
        const sentTime = new Date(log.sent_at).getTime();
        const diffHours = (now - sentTime) / (1000 * 60 * 60);

        if (timeFilter === 'today') {
          const sentDate = new Date(log.sent_at).toDateString();
          const todayDate = new Date().toDateString();
          if (sentDate !== todayDate) return false;
        } else if (timeFilter === '7days') {
          if (diffHours > 24 * 7) return false;
        } else if (timeFilter === '30days') {
          if (diffHours > 24 * 30) return false;
        }
      }

      return true;
    });
  }, [logs, companyById, searchQuery, statusFilter, languageFilter, cantonFilter, timeFilter]);

  // Sorted Logs
  const sortedLogs = useMemo(() => {
    return [...filteredLogs].sort((a, b) => {
      let comparison = 0;

      if (sortField === 'date') {
        comparison = new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime();
      } else if (sortField === 'company') {
        const nameA = (a.company_name || companyById.get(a.company_id)?.name || '').toLowerCase();
        const nameB = (b.company_name || companyById.get(b.company_id)?.name || '').toLowerCase();
        comparison = nameA.localeCompare(nameB);
      } else if (sortField === 'canton') {
        const cantonA = a.canton || companyById.get(a.company_id)?.canton || '';
        const cantonB = b.canton || companyById.get(b.company_id)?.canton || '';
        comparison = cantonA.localeCompare(cantonB);
      } else if (sortField === 'status') {
        comparison = a.delivery_status.localeCompare(b.delivery_status);
      } else if (sortField === 'language') {
        comparison = a.language.localeCompare(b.language);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredLogs, sortField, sortOrder, companyById]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(sortedLogs.length / pageSize));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedLogs.slice(start, start + pageSize);
  }, [sortedLogs, currentPage, pageSize]);

  // Column sort toggle
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Selection handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedLogIds(paginatedLogs.map((l) => l.id));
    } else {
      setSelectedLogIds([]);
    }
  };

  const toggleSelectLog = (id: string) => {
    setSelectedLogIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Copy helper
  const handleCopyText = (text: string, identifier: string, label = 'Copié') => {
    navigator.clipboard.writeText(text);
    setCopiedId(identifier);
    showToast(label);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Même règle que sur l’accueil : interrupteur principal + envoi auto +
  // heures ouvrées suisses (lun.–ven., 08:30–17:00, Europe/Zurich). Cet
  // écran ne reçoit pas le statut du planificateur, l’heure suisse est
  // donc calculée côté client.
  const isSwissBusinessHoursNow = () => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Zurich',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date());
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? '';
    const weekday = value('weekday');
    const minutes = Number(value('hour')) * 60 + Number(value('minute'));
    const isWeekday = weekday !== 'Sat' && weekday !== 'Sun';
    return isWeekday && minutes >= 8 * 60 + 30 && minutes < 17 * 60;
  };
  const canDispatchNow =
    settings.is_active && settings.outreach_active && isSwissBusinessHoursNow();
  const dispatchTitle =
    !settings.is_active || !settings.outreach_active
      ? 'Activez Jimy et l’envoi automatique pour envoyer un courriel.'
      : !isSwissBusinessHoursNow()
        ? 'Les envois sont disponibles du lundi au vendredi, de 08:30 à 17:00 (Zurich).'
        : 'Envoyer le prochain courriel de la file maintenant.';

  // Trigger manual dispatch
  const handleManualDispatch = async () => {
    if (!canDispatchNow) {
      showToast(dispatchTitle, true);
      return;
    }
    setIsDispatching(true);
    try {
      const res = await fetch('/api/worker/step', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || data.error || 'Impossible d’envoyer le courriel', true);
      } else {
        showToast(`Jimy a envoyé un courriel à ${data.company} (${data.email})`);
        await onRefreshLogs();
      }
    } catch (err: any) {
      showToast(err.message || 'Erreur pendant l’envoi', true);
    } finally {
      setIsDispatching(false);
    }
  };

  // Refresh logs
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshLogs();
      showToast('Liste des courriels mise à jour');
    } catch (err) {
      showToast('Impossible de mettre la liste à jour', true);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Delete single log
  const handleConfirmDelete = async () => {
    if (!logToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/logs/${logToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Courriel retiré de l’historique');
        if (activeModalLog?.id === logToDelete.id) {
          setActiveModalLog(null);
        }
        await onRefreshLogs();
      } else {
        showToast('Suppression impossible', true);
      }
    } catch (err) {
      showToast('Erreur de connexion pendant la suppression', true);
    } finally {
      setIsDeleting(false);
      setLogToDelete(null);
    }
  };

  // Export to CSV
  const handleExportCSV = (exportSelectedOnly = false) => {
    const listToExport = exportSelectedOnly
      ? logs.filter((l) => selectedLogIds.includes(l.id))
      : filteredLogs;

    if (listToExport.length === 0) {
      showToast('Aucun courriel à exporter', true);
      return;
    }

    const headers = [
      'ID',
      'Date UTC',
      'Date locale',
      'Société',
      'Adresse du destinataire',
      'Canton',
      'Langue',
      'Sujet',
      'Extrait du message',
      'État de l’envoi',
      'Nom de l’expéditeur',
      'Adresse de l’expéditeur',
    ];

    const safeCell = (val: unknown) => {
      const raw = val === null || val === undefined ? '' : String(val).replace(/\n/g, ' ');
      const neutralized = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
      return `"${neutralized.replace(/"/g, '""')}"`;
    };

    const rows = listToExport.map((log) => {
      const comp = log.company_id ? companyById.get(log.company_id) : undefined;
      const compName = log.company_name || comp?.name || 'Inconnu';
      const compEmail = log.recipient_email || comp?.email || '';
      const canton = log.canton || comp?.canton || '';
      const localTime = new Date(log.sent_at).toLocaleString();

      return [
        safeCell(log.id),
        safeCell(log.sent_at),
        safeCell(localTime),
        safeCell(compName),
        safeCell(compEmail),
        safeCell(canton),
        safeCell(log.language.toUpperCase()),
        safeCell(log.subject || ''),
        safeCell(log.body_snippet || ''),
        safeCell(log.delivery_status),
        safeCell(settings.sender_name),
        safeCell(settings.sender_email),
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `JimyScout-Sent-Emails-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`${listToExport.length} courriel(s) exporté(s)`);
  };

  // Reset all filters
  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setLanguageFilter('all');
    setCantonFilter('all');
    setTimeFilter('all');
    setCurrentPage(1);
    showToast('Filtres réinitialisés');
  };

  const hasActiveFilters =
    searchQuery !== '' ||
    statusFilter !== 'all' ||
    languageFilter !== 'all' ||
    cantonFilter !== 'all' ||
    timeFilter !== 'all';

  // Analytics aggregations
  const totalSentCount = logs.length;
  const deliveredCount = logs.filter(
    (l) => l.delivery_status === 'delivered' || l.delivery_status === 'accepted'
  ).length;
  const simulatedCount = logs.filter((l) => l.delivery_status === 'simulated').length;
  const bouncedCount = logs.filter(
    (l) => l.delivery_status === 'bounced' || l.delivery_status === 'failed'
  ).length;
  const successRate =
    totalSentCount > 0
      ? Math.round(((deliveredCount + simulatedCount) / totalSentCount) * 100)
      : null;

  // Language Breakdown
  const languageCounts = useMemo(() => {
    const counts = { de: 0, fr: 0, it: 0 };
    logs.forEach((l) => {
      if (l.language === 'de') counts.de++;
      if (l.language === 'fr') counts.fr++;
      if (l.language === 'it') counts.it++;
    });
    return counts;
  }, [logs]);

  // Cantons reached count
  const cantonsReachedCount = availableCantons.length;

  return (
    <div className="space-y-6 pb-24 md:pb-12 animate-in fade-in duration-300">
      {/* Astryx Banner Toast */}
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

      {/* Campaign header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <StatusDot variant="warning" label="Journal des envois" />
            <span>Journal des envois · suivi SMTP</span>
          </div>
          <h1 className="font-heading font-semibold text-2xl sm:text-3xl text-[#0B2240] tracking-tight mt-1">
            Campagne de courriels
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {logs.length} envois adressés aux sociétés suisses depuis {settings.sender_email}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Button
            label="Actualiser"
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            isLoading={isRefreshing}
            icon={<RefreshCw className="w-3.5 h-3.5 text-slate-500" />}
          />

          <Button
            label="Exporter"
            variant="secondary"
            size="sm"
            onClick={() => handleExportCSV(false)}
            icon={<Download className="w-3.5 h-3.5 text-slate-500" />}
          />

          <div title={dispatchTitle}>
            <Button
              label="Envoyer 1 courriel"
              variant="primary"
              size="sm"
              onClick={handleManualDispatch}
              isLoading={isDispatching}
              isDisabled={!canDispatchNow}
              icon={<Send className="w-3.5 h-3.5" />}
            />
          </div>
        </div>
      </div>

      {/* Campaign pulse */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Card 1: Total Dispatched */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500">
              Total envoyé
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-[#0B2240] border border-slate-200 flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 font-heading font-bold text-2xl text-[#0B2240] tabular-nums">
            {totalSentCount}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="text-emerald-600 font-semibold">{deliveredCount} remis</span>
            {simulatedCount > 0 && <span>· {simulatedCount} simulé(s)</span>}
          </div>
        </div>

        {/* Card 2: Today's Quota */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500">
              Limite du jour
            </span>
            <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#C94F00] border border-orange-200 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-heading font-bold text-2xl text-[#FF6B00] tabular-nums">
              {todaySentCount}
            </span>
            <span className="text-xs text-slate-400 font-medium">/ {settings.daily_limit} maximum</span>
          </div>
          <div className="mt-2 w-full">
            <ProgressBar
              label="Limite du jour"
              value={Math.min(100, Math.round((todaySentCount / Math.max(1, settings.daily_limit)) * 100))}
              max={100}
              variant="accent"
              isLabelHidden
            />
          </div>
        </div>

        {/* Card 3: Delivery Rate */}
        <div className="bg-[#F3FCF8] rounded-xl p-4 border border-emerald-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-600">
              Taux de remise
            </span>
            <div className="w-8 h-8 rounded-lg bg-white text-emerald-700 border border-emerald-200 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 font-heading font-bold text-2xl text-emerald-600 tabular-nums">
            {successRate === null ? '—' : `${successRate}%`}
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            {totalSentCount === 0
              ? 'Aucun courriel envoyé'
              : bouncedCount === 0
                ? 'Aucun courriel rejeté'
                : `${bouncedCount} rejeté(s)`}
          </div>
        </div>

        {/* Card 4: Swiss Cantons Reached */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500">
              Cantons contactés
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-[#0B2240] border border-slate-200 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 font-heading font-bold text-2xl text-[#0B2240] tabular-nums">
            {cantonsReachedCount}
          </div>
          <div className="mt-2 flex items-center gap-1 flex-wrap text-[10px]">
            {availableCantons.slice(0, 4).map((c) => (
              <span key={c} className="px-1.5 py-0.5 rounded bg-slate-100 font-semibold text-slate-600">
                {c}
              </span>
            ))}
            {availableCantons.length > 4 && (
              <span className="text-slate-400">+{availableCantons.length - 4}</span>
            )}
          </div>
        </div>

        {/* Card 5: Languages Dispatched */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500">
              Langues
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-[#0B2240] border border-slate-200 flex items-center justify-center">
              <Globe className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="text-xs">
              <span className="font-bold text-[#0B2240]">{languageCounts.fr}</span>{' '}
              <span className="text-slate-400">FR</span>
            </div>
            <span className="text-slate-300">·</span>
            <div className="text-xs">
              <span className="font-bold text-[#0B2240]">{languageCounts.de}</span>{' '}
              <span className="text-slate-400">DE</span>
            </div>
            <span className="text-slate-300">·</span>
            <div className="text-xs">
              <span className="font-bold text-[#0B2240]">{languageCounts.it}</span>{' '}
              <span className="text-slate-400">IT</span>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 truncate">
            Depuis {settings.sender_email}
          </div>
        </div>
      </section>

      {/* Search and filters */}
      <section className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Google Search Pill */}
          <div className="relative flex-1 min-w-0">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Chercher une société, une adresse, un canton, un sujet ou un message…"
              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-xs sm:text-sm text-slate-800 rounded-lg border border-slate-200 focus:border-[#0B2240] focus:ring-2 focus:ring-[#0B2240]/10 transition-colors outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Clear Filter Pill */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="h-9 px-3 rounded-lg bg-orange-50 hover:bg-orange-100 text-[#C94F00] border border-orange-200 font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 self-start lg:self-auto"
            >
              <X className="w-3.5 h-3.5" />
              <span>Effacer les filtres</span>
            </button>
          )}
        </div>

        {/* Filter Chips Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 text-xs">
          {/* Status Filter Chips */}
          <span className="text-slate-400 font-medium text-[11px] mr-1">État :</span>
          {(['all', 'delivered', 'simulated', 'bounced'] as StatusFilter[]).map((status) => {
            const isActive = statusFilter === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => {
                  setStatusFilter(status);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-[#0B2240] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                }`}
              >
                {status === 'delivered' && (
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : 'bg-emerald-500'}`} />
                )}
                {status === 'simulated' && (
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : 'bg-purple-500'}`} />
                )}
                {status === 'bounced' && (
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : 'bg-rose-500'}`} />
                )}
                <span>
                  {status === 'all'
                    ? 'Tous'
                    : status === 'delivered' ? 'Remis' : status === 'simulated' ? 'Simulé' : 'Rejeté'}
                </span>
              </button>
            );
          })}

          <span className="hidden sm:block text-slate-300 mx-1">|</span>

          {/* Language Filter Chips */}
          <span className="text-slate-400 font-medium text-[11px] mr-1">Langue :</span>
          {(['all', 'de', 'fr', 'it'] as LanguageFilter[]).map((lang) => {
            const isActive = languageFilter === lang;
            return (
              <button
                key={lang}
                type="button"
                onClick={() => {
                  setLanguageFilter(lang);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#0B2240] text-white shadow-2xs font-semibold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                }`}
              >
                {lang === 'all' ? 'Toutes' : lang.toUpperCase()}
              </button>
            );
          })}

          <span className="hidden sm:block text-slate-300 mx-1">|</span>

          {/* Canton Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium text-[11px]">Canton :</span>
            <select
              value={cantonFilter}
              onChange={(e) => {
                setCantonFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-7 px-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium border border-slate-200 outline-none cursor-pointer hover:bg-slate-200/70"
            >
              <option value="all">Tous les cantons</option>
              {availableCantons.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <span className="hidden sm:block text-slate-300 mx-1">|</span>

          {/* Time Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium text-[11px]">Date :</span>
            <select
              value={timeFilter}
              onChange={(e) => {
                setTimeFilter(e.target.value as TimeFilter);
                setCurrentPage(1);
              }}
              className="h-7 px-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium border border-slate-200 outline-none cursor-pointer hover:bg-slate-200/70"
            >
              <option value="all">Toute la période</option>
              <option value="today">Aujourd’hui</option>
              <option value="7days">7 derniers jours</option>
              <option value="30days">30 derniers jours</option>
            </select>
          </div>
        </div>
      </section>

      {/* FLOATING BULK SELECTION ACTION BAR */}
      {selectedLogIds.length > 0 && (
        <div className="bg-[#0B2240] text-white rounded-xl px-5 py-3 shadow-lg flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-[#FF6B00]" />
            <span className="font-semibold text-xs sm:text-sm">
              {selectedLogIds.length} {selectedLogIds.length === 1 ? 'courriel choisi' : 'courriels choisis'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleExportCSV(true)}
              className="h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exporter la sélection</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedLogIds([])}
              className="h-8 px-3 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
            >
              Tout désélectionner
            </button>
          </div>
        </div>
      )}

      {/* RICH TABLE SECTION */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* Table Top Bar */}
        <div className="p-4 sm:px-6 py-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <h2 className="font-heading font-medium text-sm sm:text-base text-[#0B2240]">
              Registre des demandes envoyées
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              ({sortedLogs.length} {sortedLogs.length === 1 ? 'ligne' : 'lignes'})
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>Afficher :</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="h-7 px-2 bg-white text-slate-700 rounded-lg text-xs font-medium border border-slate-200 outline-none cursor-pointer"
            >
              <option value={10}>10 par page</option>
              <option value={25}>25 par page</option>
              <option value={50}>50 par page</option>
              <option value={100}>100 par page</option>
            </select>
          </div>
        </div>

        {/* Table / Empty State */}
        {sortedLogs.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#1A73E8] mx-auto flex items-center justify-center">
              <MailCheck className="w-6 h-6" />
            </div>
            <h3 className="font-heading font-bold text-base text-[#0B2240]">
              {logs.length === 0
                ? 'Aucun courriel envoyé pour le moment'
                : 'Aucun courriel ne correspond aux filtres'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              {logs.length === 0
                ? 'Quand Jimy travaille, il envoie les demandes pendant les heures suisses, de 08 h 30 à 17 h 00.'
                : 'Changez la recherche ou effacez les filtres.'}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-2 h-9 px-4 rounded-lg bg-slate-100 text-[#0B2240] border border-slate-200 font-medium text-xs hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Effacer tous les filtres
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-100/60 text-slate-600 font-semibold select-none">
                  <th className="py-3 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        paginatedLogs.length > 0 &&
                        paginatedLogs.every((l) => selectedLogIds.includes(l.id))
                      }
                      onChange={handleSelectAll}
                      className="rounded border-slate-300 text-[#1A73E8] focus:ring-[#1A73E8] cursor-pointer"
                    />
                  </th>

                  <th
                    className="py-3 px-3 cursor-pointer hover:text-slate-900 transition-colors"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Date et heure</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  <th
                    className="py-3 px-3 cursor-pointer hover:text-slate-900 transition-colors"
                    onClick={() => handleSort('company')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Société destinataire</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  <th className="py-3 px-3">
                    <span>Adresse courriel</span>
                  </th>

                  <th
                    className="py-3 px-3 cursor-pointer hover:text-slate-900 transition-colors"
                    onClick={() => handleSort('canton')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Canton et langue</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  <th className="py-3 px-3 min-w-[220px]">
                    <span>Sujet et extrait</span>
                  </th>

                  <th
                    className="py-3 px-3 cursor-pointer hover:text-slate-900 transition-colors"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>État</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  <th className="py-3 px-4 text-right">
                    <span>Actions</span>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {paginatedLogs.map((log) => {
                  const comp = companyById.get(log.company_id);
                  const compName = log.company_name || comp?.name || 'Société suisse';
                  const compEmail = log.recipient_email || comp?.email || 'info@btp-suisse.ch';
                  const canton = log.canton || comp?.canton || 'BE';
                  const sentDate = new Date(log.sent_at);
                  const isSelected = selectedLogIds.includes(log.id);

                  // Formatting date nicely
                  const formattedDate = sentDate.toLocaleDateString('fr-CH', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  });
                  const formattedTime = sentDate.toLocaleTimeString('fr-CH', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  // Relative time helper
                  const diffMinutes = Math.round((Date.now() - sentDate.getTime()) / 60000);
                  let relativeTime = `il y a ${diffMinutes} min`;
                  if (diffMinutes < 1) relativeTime = 'À l’instant';
                  else if (diffMinutes >= 60 && diffMinutes < 1440) {
                    relativeTime = `il y a ${Math.floor(diffMinutes / 60)} h`;
                  } else if (diffMinutes >= 1440) {
                    relativeTime = `il y a ${Math.floor(diffMinutes / 1440)} j`;
                  }

                  return (
                    <tr
                      key={log.id}
                      className={`hover:bg-slate-50 transition-colors group ${
                        isSelected ? 'bg-orange-50/70' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectLog(log.id)}
                          className="rounded border-slate-300 text-[#1A73E8] focus:ring-[#1A73E8] cursor-pointer"
                        />
                      </td>

                      {/* Date & Time */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{formattedDate}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <span>{formattedTime}</span>
                          <span>·</span>
                          <span className="text-slate-500 font-medium">{relativeTime}</span>
                        </div>
                      </td>

                      {/* Recipient Contractor */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-[#0B2240] hover:text-[#1A73E8] transition-colors flex items-center gap-1.5">
                          <span>{compName}</span>
                          {comp?.phone && (
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({comp.phone})
                            </span>
                          )}
                        </div>
                        {comp?.industry && (
                          <div className="text-[11px] text-slate-400 capitalize">
                            {({ civil_engineering: 'Génie civil', tiefbau: 'Terrassement', demolition: 'Démolition', quarry: 'Carrière' } as Record<string, string>)[comp.industry] || comp.industry.replace(/_/g, ' ')}
                          </div>
                        )}
                      </td>

                      {/* Recipient Email */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <a
                            href={`mailto:${compEmail}`}
                            className="font-mono text-slate-700 hover:text-[#1A73E8] hover:underline"
                            title="Envoyer un courriel"
                          >
                            {compEmail}
                          </a>
                          <button
                            type="button"
                            onClick={() => handleCopyText(compEmail, `email-${log.id}`, 'Adresse copiée')}
                            className="p-1 rounded hover:bg-slate-200/70 text-slate-400 hover:text-slate-600 cursor-pointer"
                            title="Copier l’adresse"
                          >
                            {copiedId === `email-${log.id}` ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Canton & Language */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[#0B2240] font-mono font-bold text-[11px] border border-slate-200">
                            {canton}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              log.language === 'de'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200/70'
                                : log.language === 'fr'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200/70'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                            }`}
                          >
                            {log.language}
                          </span>
                        </div>
                      </td>

                      {/* Subject & Snippet */}
                      <td className="py-3 px-3">
                        <div
                          onClick={() => setActiveModalLog(log)}
                          className="font-semibold text-slate-800 hover:text-[#1A73E8] cursor-pointer line-clamp-1"
                          title="Voir le message complet"
                        >
                          {log.subject}
                        </div>
                        <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                          {log.body_snippet}
                        </div>
                      </td>

                      {/* Delivery Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {(log.delivery_status === 'delivered' ||
                          log.delivery_status === 'accepted') && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-[11px]">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>
                              {log.delivery_status === 'accepted'
                                ? 'Accepté par SMTP'
                                : 'Remis'}
                            </span>
                          </span>
                        )}
                        {log.delivery_status === 'simulated' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-semibold text-[11px]">
                            <Sparkles className="w-3 h-3 text-purple-600" />
                            <span>Simulé</span>
                          </span>
                        )}
                        {(log.delivery_status === 'bounced' ||
                          log.delivery_status === 'failed') && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-semibold text-[11px]">
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                            <span className="capitalize">{log.delivery_status}</span>
                          </span>
                        )}
                        {(log.delivery_status === 'deferred' ||
                          log.delivery_status === 'sending' ||
                          log.delivery_status === 'queued') && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold text-[11px] capitalize">
                            <span>{log.delivery_status}</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* View Full Email */}
                          <button
                            type="button"
                            onClick={() => setActiveModalLog(log)}
                            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#1A73E8] transition-colors cursor-pointer"
                            title="Voir le courriel complet"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Copy snippet */}
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyText(
                                getFullEmailBody(log, comp),
                                `body-${log.id}`,
                                'Texte du courriel copié'
                              )
                            }
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                            title="Copier le texte du courriel"
                          >
                            {copiedId === `body-${log.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Delete Log */}
                          <button
                            type="button"
                            onClick={() => setLogToDelete(log)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Supprimer cette ligne"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION CONTROLS */}
        {sortedLogs.length > 0 && (
          <div className="p-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Affichage de{' '}
              <span className="font-semibold text-slate-800">
                {(currentPage - 1) * pageSize + 1}
              </span>{' '}
              à{' '}
              <span className="font-semibold text-slate-800">
                {Math.min(currentPage * pageSize, sortedLogs.length)}
              </span>{' '}
              sur <span className="font-semibold text-slate-800">{sortedLogs.length}</span> courriels
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Précédent</span>
              </button>

              <div className="px-3 py-1 font-mono font-semibold text-slate-800">
                {currentPage} / {totalPages}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Suivant</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* GMAIL-STYLE EMAIL INSPECTION MODAL */}
      {activeModalLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div
            className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-[#1A73E8] flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Détail du courriel envoyé
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        activeModalLog.language === 'de'
                          ? 'bg-amber-100 text-amber-800'
                          : activeModalLog.language === 'fr'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {activeModalLog.language === 'de'
                        ? 'Allemand (DE)'
                        : activeModalLog.language === 'fr'
                        ? 'Français (FR)'
                        : 'Italien (IT)'}
                    </span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs text-slate-600 font-medium">
                      SMTP 250 · Courriel remis
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={closeLogModal}
                className="w-8 h-8 rounded-full hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Email Metadata Card (Gmail Style) */}
            <div className="px-6 py-4 border-b border-slate-100 bg-white space-y-3">
              <h3 className="font-heading font-bold text-lg sm:text-xl text-[#0B2240] leading-snug">
                {activeModalLog.subject}
              </h3>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/70 space-y-2 text-xs">
                {/* From line */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-medium w-12 shrink-0">De :</span>
                    <span className="font-semibold text-slate-800">
                      {settings.sender_name} - JIMY EXPORT
                    </span>
                    <span className="text-slate-500 font-mono text-[11px]">
                      &lt;{settings.sender_email}&gt;
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">
                    {new Date(activeModalLog.sent_at).toLocaleString()}
                  </span>
                </div>

                {/* To line */}
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-medium w-12 shrink-0">À :</span>
                  <span className="font-semibold text-[#0B2240]">
                    {activeModalLog.company_name ||
                      companyById.get(activeModalLog.company_id)?.name ||
                      'Société suisse'}
                  </span>
                  <span className="text-slate-600 font-mono text-[11px]">
                    &lt;
                    {activeModalLog.recipient_email ||
                      companyById.get(activeModalLog.company_id)?.email ||
                      ''}
                    &gt;
                  </span>
                  <span className="px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-mono text-[10px] font-bold">
                    {activeModalLog.canton ||
                      companyById.get(activeModalLog.company_id)?.canton ||
                      'CH'}
                  </span>
                </div>

                {/* Sender phone */}
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-medium w-12 shrink-0">Réponse :</span>
                  <span className="font-mono text-slate-600 text-[11px]">
                    {settings.sender_email} · Téléphone : {settings.sender_phone}
                  </span>
                </div>
              </div>
            </div>

            {/* Email Body Content */}
            <div className="px-6 py-5 overflow-y-auto flex-1 bg-white">
              <div className="text-xs sm:text-sm text-slate-700 leading-relaxed font-sans whitespace-pre-line bg-slate-50/60 p-5 rounded-2xl border border-slate-200/60">
                {getFullEmailBody(
                  activeModalLog,
                  companyById.get(activeModalLog.company_id)
                )}
              </div>

              {/* Value propositions highlighted */}
              <div className="mt-4 p-3.5 bg-orange-50/60 rounded-xl border border-orange-200/70 text-xs space-y-1.5">
                <div className="font-semibold text-[#FF6B00] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Conditions commerciales dans ce courriel :</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-700 pt-1">
                  {settings.hooks.cash_settlement && (
                    <span className="px-2 py-0.5 rounded-full bg-white border border-orange-200 font-medium">
                      ✓ Paiement immédiat
                    </span>
                  )}
                  {settings.hooks.transport_covered && (
                    <span className="px-2 py-0.5 rounded-full bg-white border border-orange-200 font-medium">
                      ✓ Transport organisé et payé
                    </span>
                  )}
                  {settings.hooks.as_is && (
                    <span className="px-2 py-0.5 rounded-full bg-white border border-orange-200 font-medium">
                      ✓ Achat en l’état, sans garantie
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const fullText = getFullEmailBody(
                      activeModalLog,
                      companyById.get(activeModalLog.company_id)
                    );
                    handleCopyText(fullText, 'modal-full-copy', 'Courriel complet copié');
                  }}
                  className="h-8 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copier le texte</span>
                </button>

                <a
                  href={`mailto:${
                    activeModalLog.recipient_email ||
                    companyById.get(activeModalLog.company_id)?.email ||
                    ''
                  }?subject=Re: ${encodeURIComponent(activeModalLog.subject)}`}
                  className="h-8 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Ouvrir dans la messagerie</span>
                </a>
              </div>

              <div className="flex items-center gap-2">
                {onNavigateToTargets && (
                  <button
                    type="button"
                    onClick={() => {
                      const comp = companyById.get(activeModalLog.company_id);
                      const name = activeModalLog.company_name || comp?.name || '';
                      setActiveModalLog(null);
                      onNavigateToTargets(name);
                    }}
                    className="h-8 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#1A73E8] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Voir la société</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={closeLogModal}
                  className="h-8 px-4 rounded-xl bg-[#0B2240] hover:bg-[#07172b] text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {logToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="font-heading font-bold text-lg text-[#0B2240]">
                Supprimer ce courriel de l’historique ?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Cette action supprimera l’envoi vers{' '}
                <span className="font-semibold text-slate-800">
                  {logToDelete.company_name ||
                    companyById.get(logToDelete.company_id)?.name ||
                    'cette société'}
                </span>{' '}
                de votre historique.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setLogToDelete(null)}
                className="flex-1 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 h-10 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
