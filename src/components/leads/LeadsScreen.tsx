import React, { useState, useEffect } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { InboundLead, CallLogEntry } from '@/packages/types/src/lead.ts';
import { Company, DealStatus } from '@/packages/types/src/database.ts';
import { parsePriceString, convertToChf } from '@/packages/types/src/swiss.ts';
import {
  Search,
  PhoneCall,
  FileText,
  Bookmark,
  CheckCircle2,
  AlertCircle,
  X,
  Send,
  Copy,
  Mail,
  RefreshCw,
  Trash2,
  Calendar,
  MapPin,
  MessageSquare,
  Check,
  ClipboardList,
  Inbox,
} from 'lucide-react';

const DEAL_STAGE_ORDER: DealStatus[] = [
  'new',
  'contacted',
  'inspection_scheduled',
  'inspecting',
  'inspected',
  'negotiating',
  'purchased',
];

const getDealProgress = (status: DealStatus) => {
  if (status === 'closed' || status === 'purchased') return 100;
  if (status === 'passed' || status === 'archived' || status === 'deleted') return 0;
  const index = DEAL_STAGE_ORDER.indexOf(status);
  return index < 0 ? 0 : Math.max(4, Math.round((index / (DEAL_STAGE_ORDER.length - 1)) * 100));
};

/** French relative time, e.g. "à l'instant", "il y a 5 min", "il y a 2 h", "il y a 3 jours". */
const formatRelativeTimeFr = (iso?: string | null): string => {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diffMs = Date.now() - then;
  if (diffMs < 60_000) return "à l'instant";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `il y a ${days} jour${days === 1 ? '' : 's'}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `il y a ${months} mois`;
  const years = Math.floor(months / 12);
  return `il y a ${years} an${years === 1 ? '' : 's'}`;
};

/**
 * Clean a quoted email body for display: strip "[image: ...]" placeholders,
 * decode percent-encoded parts (e.g. "<+41%2079%20123%2045%2067>" becomes
 * "+41 79 123 45 67") and unwrap angle-bracketed phone numbers / emails.
 * Display-only: the stored text is never changed.
 */
const cleanQuotedEmailBody = (text?: string | null): string => {
  if (!text) return '';
  let out = String(text).replace(/\[image:[^\]\n]*\]/gi, '');
  out = out.replace(/((?:%[0-9A-Fa-f]{2})+)/g, (match) => {
    try {
      return decodeURIComponent(match);
    } catch {
      return match;
    }
  });
  out = out.replace(/mailto:([^\s<>]+)/gi, '$1');
  out = out.replace(/<(\+?\d[\d\s().-]*|[^\s<>]+@[^\s<>]+)>/g, '$1');
  return out.replace(/\n{3,}/g, '\n\n').trim();
};

/** "2026-11-12" -> "12/11/2026" for French date inputs. */
const isoToFrDate = (iso?: string | null): string => {
  if (!iso) return '';
  const m = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
};

/** "12/11/2026" -> "2026-11-12"; null when the text is not a real calendar date. */
const frDateToIso = (value: string): string | null => {
  const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

interface LeadsScreenProps {
  leads: InboundLead[];
  companies: Company[];
  initialLeadId?: string | null;
  onClearFocusedLead?: () => void;
  onUpdateLeadStatus: (leadId: string, status: DealStatus) => Promise<void>;
  onDeleteLead: (leadId: string) => Promise<void>;
  onRefreshLeads: () => Promise<void>;
  openInboundModalInitially?: boolean;
  onInboundModalClose?: () => void;
}

export const LeadsScreen: React.FC<LeadsScreenProps> = ({
  leads,
  companies,
  initialLeadId,
  onClearFocusedLead,
  onUpdateLeadStatus,
  onDeleteLead,
  onRefreshLeads,
  openInboundModalInitially = false,
  onInboundModalClose,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<
    'all' | 'pelles' | 'camions' | 'new' | 'review' | 'saved'
  >('all');
  const [selectedModalLead, setSelectedModalLead] = useState<InboundLead | null>(null);
  const [modalTab, setModalTab] = useState<'email' | 'crm' | 'reply'>('email');

  // CRM Follow-up & Inspection Form State inside modal
  const [crmNextAction, setCrmNextAction] = useState('');
  const [crmNextActionDue, setCrmNextActionDue] = useState('');
  const [crmInspectionDate, setCrmInspectionDate] = useState('');
  const [crmInspectionLocation, setCrmInspectionLocation] = useState('');
  const [crmInspectionNotes, setCrmInspectionNotes] = useState('');
  const [crmPassReason, setCrmPassReason] = useState('');
  const [crmEstBuyChf, setCrmEstBuyChf] = useState('');
  const [crmEstResaleChf, setCrmEstResaleChf] = useState('');
  const [crmActualBuyChf, setCrmActualBuyChf] = useState('');
  const [callOutcome, setCallOutcome] = useState<CallLogEntry['outcome']>('answered');
  const [callNotes, setCallNotes] = useState('');
  const [isSavingCrm, setIsSavingCrm] = useState(false);

  // Explicit Reply Composer State
  const [replySubject, setReplySubject] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);

  const [leadToDelete, setLeadToDelete] = useState<InboundLead | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('jimy_saved_deals_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isPollingImap, setIsPollingImap] = useState(false);
  const [toast, setToast] = useState<{ msg: string; isError?: boolean } | null>(null);

  // Live Inbound Email Webhook / Parser Modal State
  const [showInboundModal, setShowInboundModal] = useState(openInboundModalInitially);
  const [inboundCompany, setInboundCompany] = useState('');
  const [inboundCanton, setInboundCanton] = useState('BE');
  const [inboundEmail, setInboundEmail] = useState('');
  const [inboundSubject, setInboundSubject] = useState('');
  const [inboundBody, setInboundBody] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [triageResult, setTriageResult] = useState<any>(null);

  useEffect(() => {
    if (openInboundModalInitially) {
      setShowInboundModal(true);
    }
  }, [openInboundModalInitially]);

  // Open deep-linked lead automatically
  useEffect(() => {
    if (initialLeadId && leads.length > 0) {
      const found = leads.find((l) => l.id === initialLeadId);
      if (found) {
        openLeadModal(found, 'email');
      }
    }
  }, [initialLeadId, leads]);

  const openLeadModal = (lead: InboundLead, tab: 'email' | 'crm' | 'reply' = 'email') => {
    setSelectedModalLead(lead);
    setModalTab(tab);
    setCrmNextAction(lead.next_action || '');
    setCrmNextActionDue(isoToFrDate(lead.next_action_due_at));
    setCrmInspectionDate(isoToFrDate(lead.inspection_date));
    setCrmInspectionLocation(lead.inspection_location || '');
    setCrmInspectionNotes(lead.inspection_notes || '');
    setCrmPassReason(lead.pass_reason || '');
    setCrmEstBuyChf(
      lead.estimated_purchase_value_chf != null ? String(lead.estimated_purchase_value_chf) : ''
    );
    setCrmEstResaleChf(
      lead.estimated_resale_value_chf != null ? String(lead.estimated_resale_value_chf) : ''
    );
    setCrmActualBuyChf(
      lead.actual_purchase_value_chf != null ? String(lead.actual_purchase_value_chf) : ''
    );
    setReplySubject(
      lead.raw_subject?.toLowerCase().startsWith('re:')
        ? lead.raw_subject
        : `Re: ${lead.raw_subject || 'Offre de machines de chantier'}`
    );
    setReplyBody(
      `Bonjour ${lead.contact_name || ''},\n\nMerci pour votre retour concernant ${
        lead.machinery_detected[0]?.make_model || 'vos machines'
      }.\nPouvez-vous nous confirmer la disponibilité pour une courte visite sur votre parc cette semaine ?\n\nCordialement,\nJIMY EXPORT`
    );
  };

  const closeInboundModal = () => {
    setShowInboundModal(false);
    if (onInboundModalClose) onInboundModalClose();
  };

  // Closing the dossier modal also clears the deep-linked lead id (state +
  // URL param in App) so the auto-open effect cannot pop it open again
  // when the leads list refreshes.
  const closeLeadModal = () => {
    setSelectedModalLead(null);
    onClearFocusedLead?.();
  };

  const showToast = (msg: string, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 4000);
  };

  const toggleBookmark = (id: string) => {
    setBookmarkedIds((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((item) => item !== id) : [...prev, id];
      try {
        localStorage.setItem('jimy_saved_deals_v1', JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      showToast(exists ? 'Dossier retiré des favoris' : 'Dossier ajouté aux favoris');
      return next;
    });
  };

  const handleSaveCrmDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedModalLead) return;
    // French date inputs hold jj/mm/aaaa; convert back to ISO for the API.
    const nextActionDueIso = crmNextActionDue.trim()
      ? frDateToIso(crmNextActionDue)
      : '';
    const inspectionDateIso = crmInspectionDate.trim()
      ? frDateToIso(crmInspectionDate)
      : '';
    if (
      (crmNextActionDue.trim() && !nextActionDueIso) ||
      (crmInspectionDate.trim() && !inspectionDateIso)
    ) {
      showToast('Date invalide : utilisez le format jj/mm/aaaa.', true);
      return;
    }
    setIsSavingCrm(true);
    try {
      const res = await fetch(`/api/leads/${selectedModalLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          next_action: crmNextAction.trim() || null,
          next_action_due_at: nextActionDueIso || null,
          inspection_date: inspectionDateIso || null,
          inspection_location: crmInspectionLocation.trim() || null,
          inspection_notes: crmInspectionNotes.trim() || null,
          pass_reason: crmPassReason.trim() || null,
          estimated_purchase_value_chf: crmEstBuyChf !== '' ? Number(crmEstBuyChf) : null,
          estimated_resale_value_chf: crmEstResaleChf !== '' ? Number(crmEstResaleChf) : null,
          actual_purchase_value_chf: crmActualBuyChf !== '' ? Number(crmActualBuyChf) : null,
        }),
      });
      const updated = await res.json();
      if (!res.ok) {
        showToast(updated.error || 'Impossible d’enregistrer les notes', true);
      } else {
        setSelectedModalLead(updated);
        await onRefreshLeads();
        showToast('Suivi, visite et prix enregistrés');
      }
    } catch (err: any) {
      showToast(`Error: ${err?.message}`, true);
    } finally {
      setIsSavingCrm(false);
    }
  };

  const handleAddCallLog = async () => {
    if (!selectedModalLead || !callNotes.trim()) {
      showToast('Ajoutez une petite note sur l’appel.', true);
      return;
    }
    const existingCalls = Array.isArray(selectedModalLead.call_history)
      ? selectedModalLead.call_history
      : [];
    const newEntry: CallLogEntry = {
      id: `call-${Date.now()}`,
      called_at: new Date().toISOString(),
      outcome: callOutcome,
      notes: callNotes.trim(),
    };
    try {
      const res = await fetch(`/api/leads/${selectedModalLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_history: [newEntry, ...existingCalls],
          lead_status:
            selectedModalLead.lead_status === 'new'
              ? 'contacted'
              : selectedModalLead.lead_status,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedModalLead(updated);
        setCallNotes('');
        await onRefreshLeads();
        showToast('Appel ajouté au dossier');
      }
    } catch {
      showToast('Impossible d’ajouter l’appel', true);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedModalLead) return;
    if (!replySubject.trim() || !replyBody.trim()) {
      showToast('Le sujet et le message sont obligatoires.', true);
      return;
    }
    setIsSendingReply(true);
    try {
      const res = await fetch(`/api/leads/${selectedModalLead.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: replySubject.trim(),
          body: replyBody.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Impossible d’envoyer la réponse', true);
      } else {
        setSelectedModalLead(data.lead);
        await onRefreshLeads();
        showToast(`Reply sent to ${selectedModalLead.sender_email}`);
      }
    } catch (err: any) {
      showToast(`Erreur de réponse : ${err?.message}`, true);
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!leadToDelete) return;
    setIsDeleting(true);
    try {
      await onDeleteLead(leadToDelete.id);
      setBookmarkedIds((prev) => {
        const next = prev.filter((id) => id !== leadToDelete.id);
        try {
          localStorage.setItem('jimy_saved_deals_v1', JSON.stringify(next));
        } catch {}
        return next;
      });
      showToast('Dossier supprimé');
      setLeadToDelete(null);
    } catch (err: any) {
      showToast(`Suppression impossible : ${err?.message || 'erreur'}`, true);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyPitch = () => {
    if (!selectedModalLead) return;
    const machinery = selectedModalLead.machinery_detected[0];
    const text = `Résumé du dossier Jimy :\nSociété : ${selectedModalLead.company_name} (${selectedModalLead.canton})\nMachine : ${machinery?.make_model || 'Machine de chantier'} (${machinery?.year || 'Non indiqué'})\nPrix demandé : ${machinery?.asking_price || 'Prix sur demande'}\nContact : ${selectedModalLead.contact_name} (${selectedModalLead.contact_phone || selectedModalLead.sender_email})\nRésumé : ${selectedModalLead.ai_summary}`;
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handlePollImap = async () => {
    setIsPollingImap(true);
    try {
      const res = await fetch('/api/imap/poll', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(`Boîte mail inaccessible : ${data.error || 'réessayez'}`, true);
      } else {
        await onRefreshLeads();
        showToast(
          data.messagesProcessed > 0
            ? `${data.messagesProcessed} nouveau${data.messagesProcessed === 1 ? '' : 'x'} dossier${data.messagesProcessed === 1 ? '' : 's'} créé${data.messagesProcessed === 1 ? '' : 's'}`
            : 'Boîte mail vérifiée : tout est à jour'
        );
      }
    } catch (err: any) {
      showToast(`Impossible de joindre votre boîte mail : ${err?.message}`, true);
    } finally {
      setIsPollingImap(false);
    }
  };

  const handleProcessInbound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inboundEmail.trim() || !inboundBody.trim()) {
      showToast('L’adresse du vendeur et son message sont obligatoires.', true);
      return;
    }

    setIsAnalyzing(true);
    setTriageResult(null);
    try {
      const res = await fetch('/api/simulate-inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderEmail: inboundEmail.trim(),
          companyName: inboundCompany.trim() || undefined,
          canton: inboundCanton.trim() || 'CH',
          rawSubject: inboundSubject.trim() || 'Réponse d’une société',
          rawBody: inboundBody.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Impossible de lire le courriel', true);
      } else {
        setTriageResult(data);
        await onRefreshLeads();
        showToast(
          data.analysis?.intent === 'HOT_LEAD'
            ? 'Bonne offre trouvée. Elle est enregistrée et une alerte a été envoyée.'
            : `Courriel traité : ${data.analysis?.intent}`
        );
      }
    } catch (err: any) {
      showToast(`Erreur : ${err?.message || 'impossible de lire le courriel'}`, true);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const activeLeads = leads.filter(
    (l) => l.lead_status !== 'deleted' && !(l as any).is_deleted
  );

  // Older fallback analyses did not have the inbox flag. Treat every
  // machine-less "needs review" reply the same way so historic test replies
  // disappear from the deal pipeline immediately.
  const isReviewInbox = (lead: InboundLead) =>
    Boolean((lead as any).is_review_inbox) ||
    (lead.intent === 'NEEDS_REVIEW' && lead.machinery_detected.length === 0);
  const reviewLeads = activeLeads.filter(isReviewInbox);
  const dealLeads = activeLeads.filter((lead) => !isReviewInbox(lead));

  // One list for dossiers AND replies to verify (issues 7/16/17): the search
  // and the category filters cover both, so "Tous les dossiers (8)" really
  // lists all 8 items. Searching covers seller name, company, machine and
  // snippet/message text.
  const searchableText = (lead: InboundLead): string =>
    [
      lead.company_name,
      lead.canton,
      lead.contact_name,
      lead.sender_email,
      lead.raw_subject,
      lead.latest_reply_text,
      lead.raw_body,
      lead.ai_summary,
      ...lead.machinery_detected.flatMap((m) => [m.make_model, m.type, m.asking_price]),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

  const matchesCategory = (lead: InboundLead, keywords: string[]): boolean => {
    const haystack = `${lead.machinery_detected
      .map((m) => `${m.type} ${m.make_model}`)
      .join(' ')} ${searchableText(lead)}`.toLowerCase();
    return keywords.some((keyword) => haystack.includes(keyword));
  };

  const filteredItems = activeLeads
    .map((lead) => ({
      lead,
      kind: (isReviewInbox(lead) ? 'reply' : 'dossier') as 'reply' | 'dossier',
    }))
    .filter(({ lead, kind }) => {
      const q = searchTerm.trim().toLowerCase();
      if (q && !searchableText(lead).includes(q)) return false;

      if (selectedFilter === 'pelles') {
        return matchesCategory(lead, ['pelle', 'bagger', 'escavatore', 'excavator']);
      }
      if (selectedFilter === 'camions') {
        return matchesCategory(lead, [
          'chargeuse',
          'camion',
          'radlader',
          'kipper',
          'loader',
          'truck',
        ]);
      }
      if (selectedFilter === 'new') {
        return lead.lead_status === 'new';
      }
      if (selectedFilter === 'review') return kind === 'reply';
      if (selectedFilter === 'saved') {
        return bookmarkedIds.includes(lead.id);
      }

      return true;
    });

  const savedCount = activeLeads.filter((l) => bookmarkedIds.includes(l.id)).length;

  const moveToDossiers = async (lead: InboundLead) => {
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_review_inbox: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Impossible de créer le dossier');
      await onRefreshLeads();
      showToast('Réponse déplacée vers les dossiers.');
    } catch (err: any) {
      showToast(err?.message || 'Impossible de créer le dossier', true);
    }
  };

  const statusLabels: Record<DealStatus, string> = {
    new: 'Nouvelle offre',
    contacted: 'Vendeur contacté',
    inspection_scheduled: 'Visite prévue',
    inspecting: 'Visite en cours',
    inspected: 'Machine visitée',
    negotiating: 'Prix en discussion',
    purchased: 'Achetée',
    closed: 'Terminé',
    passed: 'Refusé',
    archived: 'Archivé',
    deleted: 'Supprimé',
  };

  return (
    <div className="space-y-8 pb-24 md:pb-12">
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

      {/* Page heading and actions */}
      <section className="flex flex-col gap-5 pt-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
            <StatusDot variant="warning" label="Dossiers" />
            <span>{activeLeads.length} réponses — {dealLeads.length} dossier{dealLeads.length === 1 ? '' : 's'} actif{dealLeads.length === 1 ? '' : 's'} · {reviewLeads.length} à vérifier</span>
          </div>
          <h1 className="font-heading text-3xl font-medium leading-tight text-[#0B2240] sm:text-4xl">
            Dossiers de machines
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
            Les réponses des vendeurs, les visites et les prix sont réunis ici, du premier contact à l’achat.
          </p>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
          <Button
            label="Vérifier les réponses"
            variant="secondary"
            size="md"
            onClick={handlePollImap}
            isLoading={isPollingImap}
            icon={<RefreshCw className="w-4 h-4" />}
          />

          <div data-tour="process-inbound-btn">
            <Button
              label="Coller une réponse"
              variant="primary"
              size="md"
              onClick={() => setShowInboundModal(true)}
              icon={<Mail className="w-4 h-4" />}
            />
          </div>
        </div>
      </section>

      {/* Search and dossier filters */}
      <section className="space-y-4 border-b border-slate-200 pb-4">
        <div className="relative flex h-11 max-w-xl items-center rounded-lg border border-slate-200 bg-white px-3 focus-within:border-[#0B2240]">
          <Search className="w-4 h-4 text-slate-400 mr-3 shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher une machine, une société, un vendeur ou un message"
            className="w-full bg-transparent text-sm text-[#0B2240] placeholder:text-slate-400 focus:outline-none"
            aria-label="Rechercher dans les dossiers"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="text-slate-400 hover:text-[#0B2240] p-1 cursor-pointer"
              aria-label="Effacer la recherche"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div data-tour="leads-status-tabs" className="min-w-max">
            <SegmentedControl
              label="Filtrer les dossiers"
              size="sm"
              value={selectedFilter}
              onChange={(val) =>
                setSelectedFilter(
                  val as 'all' | 'pelles' | 'camions' | 'new' | 'review' | 'saved'
                )
              }
            >
              <SegmentedControlItem
                value="all"
                label={`Tous les dossiers (${activeLeads.length})`}
              />
              <SegmentedControlItem value="pelles" label="Pelles" />
              <SegmentedControlItem value="camions" label="Chargeuses et camions" />
              <SegmentedControlItem value="new" label="Nouveaux" />
              <SegmentedControlItem
                value="review"
                label={`À vérifier (${reviewLeads.length})`}
              />
              <SegmentedControlItem
                value="saved"
                label={`Favoris (${savedCount})`}
              />
            </SegmentedControl>
          </div>
        </div>
      </section>

      {/* Responsive deal cards: dossiers and replies to verify in one list */}
      {selectedFilter === 'review' && (
        <div>
          <h2 className="font-heading text-xl font-medium text-[#0B2240]">Réponses à vérifier</h2>
          <p className="mt-1 text-sm text-slate-600">
            Jimy n’a pas identifié de machine précise dans ces messages. Elles n’affectent pas vos dossiers tant que vous ne les y placez pas.
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {filteredItems.map(({ lead, kind }) => {
          if (kind === 'reply') {
            return (
              <article key={lead.id} className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold text-[#0B2240]">{lead.company_name || lead.sender_email}</span>
                      <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">Réponse à vérifier</span>
                      <span className="text-xs text-slate-500 tabular-nums">{formatRelativeTimeFr(lead.received_at)}</span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-700">{lead.raw_subject || 'Réponse reçue'}</p>
                    <p className="mt-1 line-clamp-2 max-w-3xl text-sm leading-6 text-slate-600">
                      {cleanQuotedEmailBody(lead.latest_reply_text || lead.raw_body || lead.ai_summary) || 'Aperçu indisponible'}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button type="button" onClick={() => openLeadModal(lead, 'email')} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-[#0B2240] hover:bg-slate-50">Lire le message</button>
                    <button type="button" onClick={() => moveToDossiers(lead)} className="h-10 rounded-lg bg-[#0B2240] px-3 text-xs font-medium text-white hover:bg-[#173863]">Créer un dossier</button>
                  </div>
                </div>
              </article>
            );
          }
          const primaryMachine = lead.machinery_detected[0];
          const isBookmarked = bookmarkedIds.includes(lead.id);
          const rawPhone = lead.contact_phone || '';
          const telHref = rawPhone
            ? `tel:${rawPhone.replace(/\s+/g, '')}`
            : `mailto:${lead.sender_email}`;

          const parsedPrice = parsePriceString(primaryMachine?.asking_price);
          const chfEquiv =
            primaryMachine?.asking_price_chf ??
            convertToChf(parsedPrice.amount, parsedPrice.currency);
          const dealProgress = getDealProgress(lead.lead_status);

          return (
            <article
              key={lead.id}
              className="flex flex-col justify-between gap-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6"
            >
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3 text-xs text-slate-500">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium text-[#0B2240]">
                      {lead.company_name || lead.sender_email}
                    </span>
                    <span>Canton {lead.canton || 'CH'}</span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">Dossier</span>
                    <span className="tabular-nums">{formatRelativeTimeFr(lead.received_at)}</span>
                    {lead.intent === 'NEEDS_REVIEW' && (
                      <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                        À vérifier
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleBookmark(lead.id)}
                      aria-label={isBookmarked ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                      className={`flex h-8 items-center justify-center gap-1 rounded-md border px-2.5 text-xs font-medium transition-colors cursor-pointer ${
                        isBookmarked
                          ? 'border-orange-200 bg-orange-50 text-[#C44F00]'
                          : 'text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-[#0B2240]'
                      }`}
                    >
                      <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
                      <span>{isBookmarked ? 'Favori' : 'Garder'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLeadToDelete(lead)}
                      aria-label="Supprimer le dossier"
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Primary Machine Make/Model & Asking Price */}
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <h2 className="font-heading text-xl font-medium leading-7 text-[#0B2240]">
                      {primaryMachine?.make_model || 'Machine de chantier'}
                    </h2>
                    <div className="text-xs text-slate-500 mt-1">
                      <span>{primaryMachine?.type || 'Machine de chantier'}</span>
                      {primaryMachine?.year && (
                        <>
                          <span className="mx-1.5">·</span>
                          <span className="tabular-nums">Année {primaryMachine.year}</span>
                        </>
                      )}
                      {primaryMachine?.hours && (
                        <>
                          <span className="mx-1.5">·</span>
                          <span className="tabular-nums">
                            {primaryMachine.hours.toLocaleString()} heures
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-left sm:text-right">
                    <div className="font-mono text-xl font-medium tabular-nums text-[#C44F00]">
                      {primaryMachine?.asking_price || 'Prix sur demande'}
                    </div>
                    {chfEquiv > 0 && parsedPrice.currency !== 'CHF' && (
                      <div className="text-[11px] font-mono text-slate-500">
                        ≈ CHF {chfEquiv.toLocaleString('de-CH')}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2" aria-label={`Avancement du dossier : ${statusLabels[lead.lead_status]}`}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Avancement</span>
                    <span className="font-medium text-[#0B2240]">{statusLabels[lead.lead_status]}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#FF6B00]"
                      style={{ width: `${dealProgress}%` }}
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={dealProgress}
                    />
                  </div>
                  <div className="grid grid-cols-4 text-[10px] text-slate-400">
                    <span>Reçu</span>
                    <span className="text-center">Contact</span>
                    <span className="text-center">Visite</span>
                    <span className="text-right">Achat</span>
                  </div>
                </div>

                {lead.machinery_detected.length > 1 && (
                  <div className="border-l-2 border-slate-200 pl-3 text-xs text-slate-600">
                    <span className="font-medium text-[#0B2240]">Autres machines : </span>
                    {lead.machinery_detected
                      .slice(1)
                      .map((m) => `${m.make_model} (${m.asking_price || 'Prix sur demande'})`)
                      .join(' · ')}
                  </div>
                )}

                {/* Jimy's concise reading of the reply */}
                <div className="space-y-2 rounded-xl bg-slate-50 p-4">
                  <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
                    <span>Résumé de Jimy</span>
                    <span className="font-mono">
                      Intérêt : {lead.match_score || 90}%
                    </span>
                  </div>
                  <p className="text-sm text-[#0B2240] leading-relaxed">
                    {cleanQuotedEmailBody(lead.ai_summary || lead.raw_body)}
                  </p>
                </div>

                {typeof lead.deal_score === 'number' && (
                  <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div><div className="text-[11px] text-slate-500">Score de l’affaire</div><div className="text-2xl font-medium text-[#0B2240] tabular-nums">{lead.deal_score}/100</div></div>
                      {lead.market_price_low_chf && lead.market_price_high_chf ? <div className="text-right"><div className="text-[11px] text-slate-500">Prix estimé</div><div className="text-sm font-medium text-[#0B2240] tabular-nums">CHF {lead.market_price_low_chf.toLocaleString('fr-CH')} – {lead.market_price_high_chf.toLocaleString('fr-CH')}</div><div className="text-[10px] text-slate-500">Confiance {lead.market_price_confidence === 'high' ? 'forte' : lead.market_price_confidence === 'medium' ? 'moyenne' : 'faible'}</div></div> : null}
                    </div>
                    {lead.negotiation_opening_chf && lead.negotiation_max_chf ? <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-slate-50 p-3"><span className="text-slate-500">Premier prix</span><div className="font-medium text-[#0B2240]">CHF {(lead.negotiation_opening_chf || 0).toLocaleString('fr-CH')}</div></div>
                      <div className="rounded-lg bg-slate-50 p-3"><span className="text-slate-500">Prix maximum</span><div className="font-medium text-[#0B2240]">CHF {(lead.negotiation_max_chf || 0).toLocaleString('fr-CH')}</div></div>
                    </div> : null}
                    {typeof lead.seller_reliability_score === 'number' && <div className="text-[11px] text-slate-600">Vendeur : {lead.seller_reliability_score}/100 · {lead.seller_history_summary}</div>}
                    {!!lead.missing_information?.length && <div className="text-[11px] text-amber-800 bg-amber-50 rounded-lg px-2.5 py-2">À demander : {lead.missing_information.join(', ')}</div>}
                    {!!lead.watchlist_matches?.length && <div className="text-[11px] font-medium text-emerald-700">Trouvé pour : {lead.watchlist_matches.join(', ')}</div>}
                  </div>
                )}

                {/* Active Follow-up / Inspection Banner if scheduled */}
                {(lead.next_action || lead.inspection_date) && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border-l-2 border-[#FF6B00] bg-slate-50 px-3.5 py-2 text-xs text-[#0B2240]">
                    {lead.next_action && (
                      <span className="inline-flex items-center gap-1 font-medium">
                        <ClipboardList className="w-3.5 h-3.5 text-[#FF6B00]" />
                        Suite : {lead.next_action}
                      </span>
                    )}
                    {lead.inspection_date && (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-600">
                        <Calendar className="w-3.5 h-3.5 text-[#FF6B00]" />
                        Visite : {isoToFrDate(lead.inspection_date)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Footer: Seller Contact, Pipeline Stage & Actions */}
              <div className="space-y-4 border-t border-slate-100 pt-5">
                <div className="flex flex-col gap-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                  <div className="truncate text-slate-600">
                    <span className="text-slate-400">Vendeur : </span>
                    <span className="font-medium text-[#0B2240]">
                      {lead.contact_name || lead.sender_email}
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-slate-400">Étape :</span>
                    <select
                      value={lead.lead_status}
                      onChange={(e) =>
                        onUpdateLeadStatus(lead.id, e.target.value as DealStatus)
                      }
                      className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-[#0B2240] transition-colors hover:bg-slate-50 focus:outline-none"
                    >
                      {(Object.keys(statusLabels) as DealStatus[])
                        .filter((k) => k !== 'deleted')
                        .map((statusKey) => (
                          <option key={statusKey} value={statusKey}>
                            {statusLabels[statusKey]}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                  <a
                    href={telHref}
                    className="col-span-2 flex h-11 min-w-[160px] flex-1 items-center justify-center gap-2 rounded-lg bg-[#FF6B00] text-xs font-medium text-white transition-colors hover:bg-[#E05E00] sm:col-span-1 sm:text-sm"
                  >
                    <PhoneCall className="w-4 h-4" />
                    <span>
                      {rawPhone ? `Appeler (${rawPhone})` : `Contacter le vendeur`}
                    </span>
                  </a>

                  <button
                    type="button"
                    onClick={() => openLeadModal(lead, 'crm')}
                    className="flex h-11 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-xs font-medium text-[#0B2240] transition-colors hover:bg-slate-50"
                  >
                    <Calendar className="w-3.5 h-3.5 text-[#FF6B00]" />
                    <span>Suivi et visite</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openLeadModal(lead, 'reply')}
                    className="flex h-11 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-xs font-medium text-[#0B2240] transition-colors hover:bg-slate-50"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Répondre</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openLeadModal(lead, 'email')}
                    className="col-span-2 flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 sm:col-span-1 sm:h-11"
                    title="Voir le courriel reçu"
                    aria-label="Voir le courriel reçu"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {filteredItems.length === 0 && (
        <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-12 text-center sm:py-16">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0B2240] shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
            <Inbox className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <h3 className="font-heading text-xl font-medium text-[#0B2240]">
            {activeLeads.length === 0 ? 'Le premier dossier arrivera ici' : 'Aucun dossier ne correspond'}
          </h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
            {activeLeads.length === 0
              ? 'Quand un vendeur répond, Jimy rassemble la machine, le prix et le contact dans un dossier prêt à suivre.'
              : 'Modifiez la recherche ou revenez à tous les dossiers.'}
          </p>
          {activeLeads.length === 0 ? (
            <button
              type="button"
              onClick={() => setShowInboundModal(true)}
              className="mt-6 flex h-10 items-center gap-2 rounded-lg bg-[#0B2240] px-4 text-sm font-medium text-white transition-colors hover:bg-[#173863]"
            >
              <Mail className="h-4 w-4" />
              Coller une réponse
            </button>
          ) : null}
        </div>
      )}

      {/* UNIFIED DEAL SHEET, CRM FOLLOW-UP & REPLY COMPOSER MODAL */}
      {selectedModalLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="max-h-[90vh] w-full max-w-2xl space-y-5 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="text-xs text-slate-500">
                  <span>{selectedModalLead.company_name}</span>
                  <span className="mx-1.5">·</span>
                  <span>Canton {selectedModalLead.canton}</span>
                </div>
                <h3 className="mt-1 font-heading text-lg font-medium text-[#0B2240]">
                  {selectedModalLead.machinery_detected[0]?.make_model ||
                    selectedModalLead.raw_subject ||
                    'Offre d’une société'}
                </h3>
              </div>
              <button
                onClick={closeLeadModal}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="no-scrollbar flex overflow-x-auto rounded-lg bg-slate-100 p-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => setModalTab('email')}
                className={`whitespace-nowrap rounded-md px-4 py-2 transition-colors ${
                  modalTab === 'email'
                    ? 'bg-[#0B2240] text-white'
                    : 'text-slate-600 hover:text-[#0B2240]'
                }`}
              >
                Courriel reçu
              </button>
              <button
                type="button"
                onClick={() => setModalTab('crm')}
                className={`whitespace-nowrap rounded-md px-4 py-2 transition-colors ${
                  modalTab === 'crm'
                    ? 'bg-[#0B2240] text-white'
                    : 'text-slate-600 hover:text-[#0B2240]'
                }`}
              >
                Suivi, visite et appels
              </button>
              <button
                type="button"
                onClick={() => setModalTab('reply')}
                className={`whitespace-nowrap rounded-md px-4 py-2 transition-colors ${
                  modalTab === 'reply'
                    ? 'bg-[#0B2240] text-white'
                    : 'text-slate-600 hover:text-[#0B2240]'
                }`}
              >
                Répondre ({selectedModalLead.reply_history?.length || 0})
              </button>
            </div>

            {modalTab === 'email' && (
              <div className="space-y-4">
                <div className="text-xs text-slate-500">
                  De :{' '}
                  <span className="font-mono text-[#0B2240]">
                    {selectedModalLead.sender_email}
                  </span>
                </div>
                <div className="rounded-xl bg-slate-50 p-4 font-body text-sm leading-relaxed whitespace-pre-wrap text-[#0B2240]">
                  {cleanQuotedEmailBody(selectedModalLead.raw_body)}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                  <button
                    onClick={handleCopyPitch}
                    className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#0B2240] text-xs font-medium text-white transition-colors hover:bg-[#173863] sm:text-sm"
                  >
                    <Copy className="w-4 h-4" />
                    <span>{copiedId ? 'Résumé copié' : 'Copier le résumé'}</span>
                  </button>

                  {selectedModalLead.contact_phone && (
                    <a
                      href={`tel:${selectedModalLead.contact_phone.replace(/\s+/g, '')}`}
                      className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#FF6B00] px-6 text-xs font-medium text-white transition-colors hover:bg-[#E05E00] sm:text-sm"
                    >
                      <PhoneCall className="w-4 h-4" />
                      <span>Appeler le vendeur</span>
                    </a>
                  )}
                </div>
              </div>
            )}

            {modalTab === 'crm' && (
              <div className="space-y-5 text-xs">
                <form onSubmit={handleSaveCrmDetails} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-600 block mb-1">
                        Prochaine action
                      </label>
                      <input
                        type="text"
                        value={crmNextAction}
                        onChange={(e) => setCrmNextAction(e.target.value)}
                        placeholder="Ex. demander les photos de la plaque et de la pompe"
                        className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 text-[#0B2240]"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-600 block mb-1">
                        Date de la prochaine action
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={10}
                        value={crmNextActionDue}
                        onChange={(e) => setCrmNextActionDue(e.target.value)}
                        placeholder="jj/mm/aaaa"
                        className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 text-[#0B2240]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-600 block mb-1">
                        Date de la visite
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={10}
                        value={crmInspectionDate}
                        onChange={(e) => setCrmInspectionDate(e.target.value)}
                        placeholder="jj/mm/aaaa"
                        className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 text-[#0B2240]"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-600 block mb-1">
                        Lieu de la visite
                      </label>
                      <div className="relative">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={crmInspectionLocation}
                          onChange={(e) => setCrmInspectionLocation(e.target.value)}
                          placeholder="Dépôt de Berne…"
                          className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 text-[#0B2240]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="font-semibold text-slate-600 block mb-1">
                        Prix d’achat visé (CHF)
                      </label>
                      <input
                        type="number"
                        value={crmEstBuyChf}
                        onChange={(e) => setCrmEstBuyChf(e.target.value)}
                        className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 font-mono text-[#0B2240]"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-600 block mb-1">
                        Valeur de revente estimée (CHF)
                      </label>
                      <input
                        type="number"
                        value={crmEstResaleChf}
                        onChange={(e) => setCrmEstResaleChf(e.target.value)}
                        className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 font-mono text-[#0B2240]"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-600 block mb-1">
                        Prix payé (CHF)
                      </label>
                      <input
                        type="number"
                        value={crmActualBuyChf}
                        onChange={(e) => setCrmActualBuyChf(e.target.value)}
                        className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 font-mono text-[#0B2240]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">
                      Notes de visite et état de la machine
                    </label>
                    <textarea
                      rows={2}
                      value={crmInspectionNotes}
                      onChange={(e) => setCrmInspectionNotes(e.target.value)}
                      placeholder="Train de roulement 70 %, moteur sec, certificat CE…"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-[#0B2240]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingCrm}
                    className="flex h-10 items-center gap-2 rounded-lg bg-[#0B2240] px-5 text-xs font-medium text-white hover:bg-[#173863]"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isSavingCrm ? 'Enregistrement…' : 'Enregistrer le suivi et le prix'}</span>
                  </button>
                </form>

                {/* Phone Call Log */}
                <div className="pt-4 border-t border-slate-200 space-y-3">
                  <h4 className="font-heading text-sm font-medium text-[#0B2240]">
                    Historique des appels
                  </h4>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={callOutcome}
                      onChange={(e) => setCallOutcome(e.target.value as any)}
                      className="h-9 bg-slate-50 border border-slate-200 rounded-xl px-2.5 font-medium text-[#0B2240]"
                    >
                      <option value="answered">A répondu</option>
                      <option value="voicemail">Message vocal laissé</option>
                      <option value="no_answer">Pas de réponse</option>
                      <option value="follow_up_needed">À rappeler</option>
                    </select>
                    <input
                      type="text"
                      value={callNotes}
                      onChange={(e) => setCallNotes(e.target.value)}
                      placeholder="Le responsable dit que la machine sera libre mardi…"
                      className="flex-1 h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 text-[#0B2240]"
                    />
                    <button
                      type="button"
                      onClick={handleAddCallLog}
                      className="h-9 px-4 rounded-xl bg-[#FF6B00] hover:bg-[#E05E00] text-white font-semibold cursor-pointer shrink-0"
                    >
                      Ajouter l’appel
                    </button>
                  </div>

                  {selectedModalLead.call_history && selectedModalLead.call_history.length > 0 && (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {selectedModalLead.call_history.map((c) => (
                        <div
                          key={c.id}
                          className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                        >
                          <div>
                            <span className="font-semibold text-[#0B2240] capitalize">
                              {c.outcome.replace(/_/g, ' ')}:
                            </span>{' '}
                            <span className="text-slate-700">{c.notes}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            {new Date(c.called_at || c.timestamp || Date.now()).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {modalTab === 'reply' && (
              <div className="space-y-4 text-xs">
                <form onSubmit={handleSendReply} className="space-y-3">
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">
                      Adresse du vendeur
                    </label>
                    <input
                      type="text"
                      disabled
                      value={selectedModalLead.sender_email}
                      className="w-full h-9 bg-slate-100 border border-slate-200 rounded-xl px-3 font-mono text-slate-600"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">
                      Sujet
                    </label>
                    <input
                      type="text"
                      required
                      value={replySubject}
                      onChange={(e) => setReplySubject(e.target.value)}
                      className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 font-medium text-[#0B2240]"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">
                      Message à envoyer
                    </label>
                    <textarea
                      rows={5}
                      required
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-sm text-[#0B2240] leading-relaxed"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSendingReply}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#FF6B00] text-sm font-medium text-white hover:bg-[#E05E00] disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>
                      {isSendingReply
                        ? 'Envoi…'
                        : `Envoyer à ${selectedModalLead.sender_email}`}
                    </span>
                  </button>
                </form>

                {selectedModalLead.reply_history && selectedModalLead.reply_history.length > 0 && (
                  <div className="pt-3 border-t border-slate-200 space-y-2">
                    <div className="font-semibold text-slate-600">Réponses déjà envoyées :</div>
                    {selectedModalLead.reply_history.map((rep) => (
                      <div
                        key={rep.id}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1"
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <strong className="text-[#0B2240]">{rep.subject}</strong>
                          <span>{new Date(rep.sent_at || rep.created_at || Date.now()).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-700 whitespace-pre-wrap">{cleanQuotedEmailBody(rep.body)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* LIVE INBOUND EMAIL WEBHOOK & GEMINI TRIAGE MODAL */}
      {showInboundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="max-h-[90vh] w-full max-w-xl space-y-5 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-heading text-lg font-medium text-[#0B2240]">
                  Coller la réponse d’un vendeur
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Jimy lit le message, trouve les machines et les prix, crée un dossier et envoie une alerte.
                </p>
              </div>
              <button
                onClick={closeInboundModal}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {companies.length > 0 && (
              <div className="space-y-1.5 text-xs">
                <label className="font-semibold text-slate-600 block">
                  Choisir une société de la liste (facultatif)
                </label>
                <select
                  onChange={(e) => {
                    const comp = companies.find((c) => c.id === e.target.value);
                    if (comp) {
                      setInboundCompany(comp.name);
                      setInboundCanton(comp.canton);
                      setInboundEmail(comp.email);
                    }
                  }}
                  defaultValue=""
                  className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 font-medium text-[#0B2240] focus:outline-none focus:border-[#0B2240]"
                >
                  <option value="">— Choisir une société ou écrire les informations —</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.canton}) — {c.email}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <form onSubmit={handleProcessInbound} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="font-semibold text-slate-600 block mb-1.5">
                    Adresse du vendeur *
                  </label>
                  <input
                    type="email"
                    required
                    value={inboundEmail}
                    onChange={(e) => setInboundEmail(e.target.value)}
                    placeholder="seller@contractor.ch"
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 font-mono text-[#0B2240] focus:outline-none focus:border-[#0B2240]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1.5">
                    Canton suisse
                  </label>
                  <input
                    type="text"
                    value={inboundCanton}
                    onChange={(e) => setInboundCanton(e.target.value)}
                    placeholder="BE, ZH, VD, TI"
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 font-medium text-[#0B2240] uppercase focus:outline-none focus:border-[#0B2240]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1.5">
                    Nom de la société
                  </label>
                  <input
                    type="text"
                    value={inboundCompany}
                    onChange={(e) => setInboundCompany(e.target.value)}
                    placeholder="Nom de la société"
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 font-medium text-[#0B2240] focus:outline-none focus:border-[#0B2240]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1.5">
                    Sujet du courriel
                  </label>
                  <input
                    type="text"
                    value={inboundSubject}
                    onChange={(e) => setInboundSubject(e.target.value)}
                    placeholder="Re: Baumaschinen"
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 font-medium text-[#0B2240] focus:outline-none focus:border-[#0B2240]"
                  />
                </div>
              </div>

              <div className="text-xs">
                <label className="font-semibold text-slate-600 block mb-1.5">
                  Message du vendeur (allemand, français ou italien) *
                </label>
                <textarea
                  rows={5}
                  required
                  value={inboundBody}
                  onChange={(e) => setInboundBody(e.target.value)}
                  placeholder="Collez la réponse du vendeur : machine, prix, téléphone…"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 font-mono text-xs text-[#0B2240] leading-relaxed focus:outline-none focus:border-[#0B2240]"
                />
              </div>

              <button
                type="submit"
                disabled={isAnalyzing}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#FF6B00] text-sm font-medium text-white transition-colors hover:bg-[#E05E00] disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>
                  {isAnalyzing
                    ? 'Lecture et enregistrement…'
                    : 'Lire le message et créer le dossier'}
                </span>
              </button>
            </form>

            {triageResult && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between font-mono font-semibold text-[#059669]">
                  <span>Type : {triageResult.analysis?.intent}</span>
                  <span className="tabular-nums">
                    Confiance : {((triageResult.analysis?.confidence || 0) * 100).toFixed(0)}% · Intérêt :{' '}
                    {triageResult.analysis?.equipment_fit_score ?? 90}%
                  </span>
                </div>
                <p className="text-sm text-[#0B2240] leading-relaxed">
                  <strong>Résumé :</strong> {triageResult.analysis?.french_summary}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DELETE DEAL CONFIRMATION MODAL */}
      {leadToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading text-lg font-medium text-[#0B2240]">
                    Supprimer ce dossier ?
                  </h3>
                  <p className="text-xs text-slate-500">
                    Cette action est définitive.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLeadToDelete(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
              <div className="text-sm font-medium text-[#0B2240]">
                {leadToDelete.machinery_detected[0]?.make_model || 'Machine de chantier'}{' '}
                {leadToDelete.machinery_detected[0]?.asking_price && (
                  <span className="text-[#FF6B00] font-mono">
                    — {leadToDelete.machinery_detected[0]?.asking_price}
                  </span>
                )}
              </div>
              <div className="text-slate-600">
                Vendeur :{' '}
                <span className="font-semibold text-[#0B2240]">
                  {leadToDelete.company_name ||
                    leadToDelete.contact_name ||
                    leadToDelete.sender_email}
                </span>{' '}
                (Canton {leadToDelete.canton || 'CH'})
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setLeadToDelete(null)}
                disabled={isDeleting}
                className="h-11 flex-1 rounded-lg border border-slate-200 bg-white text-xs font-medium text-[#0B2240] transition-colors hover:bg-slate-50 sm:text-sm"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50 sm:text-sm"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'Suppression…' : 'Oui, supprimer'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
