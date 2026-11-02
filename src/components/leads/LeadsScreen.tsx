import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';

interface LeadsScreenProps {
  leads: InboundLead[];
  companies: Company[];
  initialLeadId?: string | null;
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
    setCrmNextActionDue(lead.next_action_due_at ? lead.next_action_due_at.slice(0, 10) : '');
    setCrmInspectionDate(lead.inspection_date ? lead.inspection_date.slice(0, 10) : '');
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
      showToast(exists ? 'Removed from Saved Deals' : 'Deal saved to your Saved list');
      return next;
    });
  };

  const handleSaveCrmDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedModalLead) return;
    setIsSavingCrm(true);
    try {
      const res = await fetch(`/api/leads/${selectedModalLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          next_action: crmNextAction.trim() || null,
          next_action_due_at: crmNextActionDue || null,
          inspection_date: crmInspectionDate || null,
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
        showToast(updated.error || 'Failed to save CRM notes', true);
      } else {
        setSelectedModalLead(updated);
        await onRefreshLeads();
        showToast('Saved follow-up, inspection & valuation details');
      }
    } catch (err: any) {
      showToast(`Error: ${err?.message}`, true);
    } finally {
      setIsSavingCrm(false);
    }
  };

  const handleAddCallLog = async () => {
    if (!selectedModalLead || !callNotes.trim()) {
      showToast('Enter a brief call note before logging.', true);
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
        showToast('Logged phone call to deal timeline');
      }
    } catch {
      showToast('Failed to log call', true);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedModalLead) return;
    if (!replySubject.trim() || !replyBody.trim()) {
      showToast('Subject and reply message are required.', true);
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
        showToast(data.error || 'Could not send reply', true);
      } else {
        setSelectedModalLead(data.lead);
        await onRefreshLeads();
        showToast(`Reply sent to ${selectedModalLead.sender_email}`);
      }
    } catch (err: any) {
      showToast(`Reply error: ${err?.message}`, true);
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
      showToast('Deal deleted permanently');
      setLeadToDelete(null);
    } catch (err: any) {
      showToast(`Could not delete deal: ${err?.message || 'Error'}`, true);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyPitch = () => {
    if (!selectedModalLead) return;
    const machinery = selectedModalLead.machinery_detected[0];
    const text = `Jimy Deal Summary:\nCompany: ${selectedModalLead.company_name} (${selectedModalLead.canton})\nMachine: ${machinery?.make_model || 'Heavy Equipment'} (${machinery?.year || 'N/A'})\nAsking Price: ${machinery?.asking_price || 'Price on request'}\nContact: ${selectedModalLead.contact_name} (${selectedModalLead.contact_phone || selectedModalLead.sender_email})\nSummary: ${selectedModalLead.ai_summary}`;
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
        showToast(`Could not check inbox: ${data.error || 'Please try again'}`, true);
      } else {
        await onRefreshLeads();
        showToast(
          data.messagesProcessed > 0
            ? `Checked inbox: found ${data.messagesProcessed} new deal(s)!`
            : 'Inbox checked — you are completely up to date'
        );
      }
    } catch (err: any) {
      showToast(`Could not connect to your email inbox: ${err?.message}`, true);
    } finally {
      setIsPollingImap(false);
    }
  };

  const handleProcessInbound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inboundEmail.trim() || !inboundBody.trim()) {
      showToast('Sender email and email message are required.', true);
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
          rawSubject: inboundSubject.trim() || 'Inbound Contractor Reply',
          rawBody: inboundBody.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Could not read email', true);
      } else {
        setTriageResult(data);
        await onRefreshLeads();
        showToast(
          data.analysis?.intent === 'HOT_LEAD'
            ? 'Great deal found! Saved to your offers list and sent to your phone alert!'
            : `Email processed with intent: ${data.analysis?.intent}`
        );
      }
    } catch (err: any) {
      showToast(`Error: ${err?.message || 'Failed to read incoming email'}`, true);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const activeLeads = leads.filter(
    (l) => l.lead_status !== 'deleted' && !(l as any).is_deleted
  );

  const filteredLeads = activeLeads.filter((lead) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !q ||
      lead.company_name?.toLowerCase().includes(q) ||
      lead.canton?.toLowerCase().includes(q) ||
      lead.contact_name?.toLowerCase().includes(q) ||
      lead.machinery_detected.some(
        (m) => m.make_model.toLowerCase().includes(q) || m.type.toLowerCase().includes(q)
      );

    if (!matchesSearch) return false;

    if (selectedFilter === 'pelles') {
      return lead.machinery_detected.some(
        (m) =>
          m.type.toLowerCase().includes('pelle') ||
          m.type.toLowerCase().includes('bagger') ||
          m.type.toLowerCase().includes('escavatore') ||
          m.type.toLowerCase().includes('excavator')
      );
    }
    if (selectedFilter === 'camions') {
      return lead.machinery_detected.some(
        (m) =>
          m.type.toLowerCase().includes('chargeuse') ||
          m.type.toLowerCase().includes('camion') ||
          m.type.toLowerCase().includes('radlader') ||
          m.type.toLowerCase().includes('kipper') ||
          m.type.toLowerCase().includes('loader') ||
          m.type.toLowerCase().includes('truck')
      );
    }
    if (selectedFilter === 'new') {
      return lead.lead_status === 'new';
    }
    if (selectedFilter === 'review') {
      return lead.intent === 'NEEDS_REVIEW';
    }
    if (selectedFilter === 'saved') {
      return bookmarkedIds.includes(lead.id);
    }

    return true;
  });

  const savedCount = activeLeads.filter((l) => bookmarkedIds.includes(l.id)).length;

  const statusLabels: Record<DealStatus, string> = {
    new: 'New Offer',
    contacted: 'Seller Contacted',
    inspection_scheduled: 'Inspection Scheduled',
    inspecting: 'Inspecting Yard',
    inspected: 'Inspected',
    negotiating: 'Negotiating Price',
    purchased: 'Purchased (Won)',
    closed: 'Closed',
    passed: 'Passed',
    archived: 'Archived',
    deleted: 'Deleted',
  };

  return (
    <div className="space-y-6 pb-24 md:pb-12">
      {/* Snackbar Toast */}
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

      {/* Page Header & Live Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-[#0B2240] tracking-tight">
            Machines Offered to You (CRM)
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Contractor replies extracted by Jimy. Manage follow-ups, yard inspections, call logs, and direct replies.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={handlePollImap}
            disabled={isPollingImap}
            className="h-11 px-4 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-[#0B2240] font-heading font-semibold text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isPollingImap ? 'animate-spin' : ''}`} />
            <span>{isPollingImap ? 'Checking...' : 'Check for Replies'}</span>
          </button>

          <button
            type="button"
            data-tour="process-inbound-btn"
            onClick={() => setShowInboundModal(true)}
            className="h-11 px-5 rounded-full bg-[#0B2240] hover:bg-[#173863] text-white font-heading font-semibold text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Mail className="w-4 h-4 text-[#FF6B00]" />
            <span>Paste a Seller Reply</span>
          </button>
        </div>
      </div>

      {/* Search & Segmented Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-xl flex items-center bg-white rounded-full border border-slate-200 px-4 h-12 focus-within:border-[#0B2240] transition-colors">
          <Search className="w-4 h-4 text-slate-400 mr-3 shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by make/model, company, seller name, or canton..."
            className="w-full bg-transparent text-sm text-[#0B2240] placeholder:text-slate-400 focus:outline-none"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-slate-400 hover:text-[#0B2240] p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="w-full md:w-auto overflow-x-auto no-scrollbar py-0.5 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div
            data-tour="leads-status-tabs"
            className="inline-flex items-center p-1 bg-white rounded-full border border-slate-200 shadow-2xs shrink-0 min-w-max"
          >
            <button
              type="button"
              onClick={() => setSelectedFilter('all')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                selectedFilter === 'all'
                  ? 'bg-[#0B2240] text-white'
                  : 'text-slate-600 hover:text-[#0B2240]'
              }`}
            >
              All Deals ({activeLeads.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('pelles')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                selectedFilter === 'pelles'
                  ? 'bg-[#0B2240] text-white'
                  : 'text-slate-600 hover:text-[#0B2240]'
              }`}
            >
              Excavators
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('camions')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                selectedFilter === 'camions'
                  ? 'bg-[#0B2240] text-white'
                  : 'text-slate-600 hover:text-[#0B2240]'
              }`}
            >
              Loaders &amp; Trucks
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('new')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                selectedFilter === 'new'
                  ? 'bg-[#0B2240] text-white'
                  : 'text-slate-600 hover:text-[#0B2240]'
              }`}
            >
              New Only
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('saved')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                selectedFilter === 'saved'
                  ? 'bg-[#FF6B00] text-white'
                  : 'text-slate-600 hover:text-[#0B2240]'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5 fill-current" />
              <span>Saved ({savedCount})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Responsive 2-Column Deal Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filteredLeads.map((lead) => {
          const primaryMachine = lead.machinery_detected[0];
          const isBookmarked = bookmarkedIds.includes(lead.id);
          const rawPhone = lead.contact_phone || '';
          const telHref = rawPhone
            ? `tel:${rawPhone.replace(/\s+/g, '')}`
            : `mailto:${lead.sender_email}`;
          const minutesAgo = Math.max(
            1,
            Math.floor((Date.now() - new Date(lead.received_at).getTime()) / 60000)
          );

          const parsedPrice = parsePriceString(primaryMachine?.asking_price);
          const chfEquiv =
            primaryMachine?.asking_price_chf ??
            convertToChf(parsedPrice.amount, parsedPrice.currency);

          return (
            <article
              key={lead.id}
              className="bg-white rounded-3xl p-6 border border-slate-200/90 flex flex-col justify-between space-y-5 shadow-2xs"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-[#0B2240]">
                      {lead.company_name || lead.sender_email}
                    </span>
                    <span>·</span>
                    <span>Canton {lead.canton || 'CH'}</span>
                    <span>·</span>
                    <span className="tabular-nums">{minutesAgo}m ago</span>
                    {lead.intent === 'NEEDS_REVIEW' && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                        Needs Review
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleBookmark(lead.id)}
                      aria-label={isBookmarked ? 'Remove from saved deals' : 'Save deal'}
                      className={`h-8 px-2.5 rounded-full flex items-center justify-center gap-1 text-xs font-semibold transition-colors cursor-pointer border ${
                        isBookmarked
                          ? 'bg-[#FFF0E5] text-[#FF6B00] border-orange-200'
                          : 'text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-[#0B2240]'
                      }`}
                    >
                      <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
                      <span>{isBookmarked ? 'Saved' : 'Save'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLeadToDelete(lead)}
                      aria-label="Delete deal"
                      className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Primary Machine Make/Model & Asking Price */}
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                  <div>
                    <h2 className="font-heading font-bold text-xl text-[#0B2240]">
                      {primaryMachine?.make_model || 'Construction Machinery'}
                    </h2>
                    <div className="text-xs text-slate-500 mt-1">
                      <span>{primaryMachine?.type || 'Heavy Equipment'}</span>
                      {primaryMachine?.year && (
                        <>
                          <span className="mx-1.5">·</span>
                          <span className="tabular-nums">Year {primaryMachine.year}</span>
                        </>
                      )}
                      {primaryMachine?.hours && (
                        <>
                          <span className="mx-1.5">·</span>
                          <span className="tabular-nums">
                            {primaryMachine.hours.toLocaleString()} hrs
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono font-bold text-xl text-[#FF6B00] tabular-nums">
                      {primaryMachine?.asking_price || 'Price on request'}
                    </div>
                    {chfEquiv && parsedPrice.currency !== 'CHF' && (
                      <div className="text-[11px] font-mono text-slate-500">
                        ≈ CHF {chfEquiv.toLocaleString('de-CH')}
                      </div>
                    )}
                  </div>
                </div>

                {lead.machinery_detected.length > 1 && (
                  <div className="text-xs text-slate-600 pt-1">
                    <span className="font-semibold text-[#0B2240]">Also included: </span>
                    {lead.machinery_detected
                      .slice(1)
                      .map((m) => `${m.make_model} (${m.asking_price || 'Price on request'})`)
                      .join(' · ')}
                  </div>
                )}

                {/* AI French Executive Summary */}
                <div className="bg-slate-50 rounded-2xl p-4 space-y-1">
                  <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
                    <span>AI Deal Summary (French)</span>
                    <span className="font-mono">
                      Fit: {lead.match_score || 90}%
                    </span>
                  </div>
                  <p className="text-sm text-[#0B2240] leading-relaxed">
                    {lead.ai_summary || lead.raw_body}
                  </p>
                </div>

                {/* Active Follow-up / Inspection Banner if scheduled */}
                {(lead.next_action || lead.inspection_date) && (
                  <div className="flex flex-wrap items-center gap-2 text-xs bg-orange-50/70 border border-orange-200/80 rounded-xl px-3.5 py-2 text-[#0B2240]">
                    {lead.next_action && (
                      <span className="inline-flex items-center gap-1 font-medium">
                        <ClipboardList className="w-3.5 h-3.5 text-[#FF6B00]" />
                        Next: {lead.next_action}
                      </span>
                    )}
                    {lead.inspection_date && (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-600">
                        <Calendar className="w-3.5 h-3.5 text-[#FF6B00]" />
                        Inspection: {lead.inspection_date.slice(0, 10)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Footer: Seller Contact, Pipeline Stage & Actions */}
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <div className="text-slate-600 truncate">
                    <span className="text-slate-400">Seller: </span>
                    <span className="font-semibold text-[#0B2240]">
                      {lead.contact_name || lead.sender_email}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-slate-400">Stage:</span>
                    <select
                      value={lead.lead_status}
                      onChange={(e) =>
                        onUpdateLeadStatus(lead.id, e.target.value as DealStatus)
                      }
                      className="bg-slate-100 hover:bg-slate-200 rounded-full px-3 py-1.5 text-xs font-semibold text-[#0B2240] focus:outline-none cursor-pointer transition-colors"
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

                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={telHref}
                    className="flex-1 min-w-[160px] h-11 rounded-full bg-[#FF6B00] hover:bg-[#E05E00] text-white font-heading font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors shadow-xs"
                  >
                    <PhoneCall className="w-4 h-4" />
                    <span>
                      {rawPhone ? `Call (${rawPhone})` : `Contact Seller`}
                    </span>
                  </a>

                  <button
                    type="button"
                    onClick={() => openLeadModal(lead, 'crm')}
                    className="h-11 px-4 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-[#0B2240] font-heading font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Calendar className="w-3.5 h-3.5 text-[#FF6B00]" />
                    <span>Follow-Up / Inspect</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openLeadModal(lead, 'reply')}
                    className="h-11 px-4 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-[#0B2240] font-heading font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                    <span>Reply</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openLeadModal(lead, 'email')}
                    className="h-11 px-3.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-heading font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    title="View original email"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {filteredLeads.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center max-w-lg mx-auto space-y-4">
          <h3 className="font-heading font-bold text-lg text-[#0B2240]">
            {leads.length === 0 ? 'No incoming machinery deals yet' : 'No deals match your filter'}
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            {leads.length === 0
              ? 'Poll your live IMAP inbox or paste a contractor reply to extract machinery offers and trigger a Telegram notification.'
              : 'Try clearing your search query or switching back to All Deals.'}
          </p>
        </div>
      )}

      {/* UNIFIED DEAL SHEET, CRM FOLLOW-UP & REPLY COMPOSER MODAL */}
      {selectedModalLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="text-xs text-slate-500">
                  <span>{selectedModalLead.company_name}</span>
                  <span className="mx-1.5">·</span>
                  <span>Canton {selectedModalLead.canton}</span>
                </div>
                <h3 className="font-heading font-bold text-lg text-[#0B2240] mt-1">
                  {selectedModalLead.machinery_detected[0]?.make_model ||
                    selectedModalLead.raw_subject ||
                    'Contractor Offer'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedModalLead(null)}
                className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="inline-flex items-center p-1 bg-slate-100 rounded-full text-xs font-semibold">
              <button
                type="button"
                onClick={() => setModalTab('email')}
                className={`px-4 py-1.5 rounded-full cursor-pointer transition-colors ${
                  modalTab === 'email'
                    ? 'bg-[#0B2240] text-white'
                    : 'text-slate-600 hover:text-[#0B2240]'
                }`}
              >
                Original Email
              </button>
              <button
                type="button"
                onClick={() => setModalTab('crm')}
                className={`px-4 py-1.5 rounded-full cursor-pointer transition-colors ${
                  modalTab === 'crm'
                    ? 'bg-[#0B2240] text-white'
                    : 'text-slate-600 hover:text-[#0B2240]'
                }`}
              >
                Follow-Up, Inspection &amp; Calls
              </button>
              <button
                type="button"
                onClick={() => setModalTab('reply')}
                className={`px-4 py-1.5 rounded-full cursor-pointer transition-colors ${
                  modalTab === 'reply'
                    ? 'bg-[#0B2240] text-white'
                    : 'text-slate-600 hover:text-[#0B2240]'
                }`}
              >
                Send Reply ({selectedModalLead.reply_history?.length || 0})
              </button>
            </div>

            {modalTab === 'email' && (
              <div className="space-y-4">
                <div className="text-xs text-slate-500">
                  From:{' '}
                  <span className="font-mono text-[#0B2240]">
                    {selectedModalLead.sender_email}
                  </span>
                </div>
                <div className="bg-slate-50 rounded-2xl p-4 text-sm text-[#0B2240] leading-relaxed whitespace-pre-wrap font-body">
                  {selectedModalLead.raw_body}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                  <button
                    onClick={handleCopyPitch}
                    className="flex-1 h-11 rounded-full bg-[#0B2240] hover:bg-[#173863] text-white font-heading font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    <span>{copiedId ? 'Copied Deal Sheet!' : 'Copy Deal Summary'}</span>
                  </button>

                  {selectedModalLead.contact_phone && (
                    <a
                      href={`tel:${selectedModalLead.contact_phone.replace(/\s+/g, '')}`}
                      className="h-11 px-6 rounded-full bg-[#FF6B00] hover:bg-[#E05E00] text-white font-heading font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
                    >
                      <PhoneCall className="w-4 h-4" />
                      <span>Call Seller</span>
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
                        Next Action
                      </label>
                      <input
                        type="text"
                        value={crmNextAction}
                        onChange={(e) => setCrmNextAction(e.target.value)}
                        placeholder="e.g. Request serial plate & hydraulic pump photos"
                        className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 text-[#0B2240]"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-600 block mb-1">
                        Next Action Due Date
                      </label>
                      <input
                        type="date"
                        value={crmNextActionDue}
                        onChange={(e) => setCrmNextActionDue(e.target.value)}
                        className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 text-[#0B2240]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-600 block mb-1">
                        Yard Inspection Date
                      </label>
                      <input
                        type="date"
                        value={crmInspectionDate}
                        onChange={(e) => setCrmInspectionDate(e.target.value)}
                        className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 text-[#0B2240]"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-600 block mb-1">
                        Inspection Location / Yard Address
                      </label>
                      <div className="relative">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={crmInspectionLocation}
                          onChange={(e) => setCrmInspectionLocation(e.target.value)}
                          placeholder="Depot Bern / Werkhof..."
                          className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 text-[#0B2240]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="font-semibold text-slate-600 block mb-1">
                        Target Buy (CHF)
                      </label>
                      <input
                        type="number"
                        value={crmEstBuyChf}
                        onChange={(e) => setCrmEstBuyChf(e.target.value)}
                        placeholder="38000"
                        className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 font-mono text-[#0B2240]"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-600 block mb-1">
                        Est. Export Value (CHF)
                      </label>
                      <input
                        type="number"
                        value={crmEstResaleChf}
                        onChange={(e) => setCrmEstResaleChf(e.target.value)}
                        placeholder="46000"
                        className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 font-mono text-[#0B2240]"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-600 block mb-1">
                        Actual Paid (CHF)
                      </label>
                      <input
                        type="number"
                        value={crmActualBuyChf}
                        onChange={(e) => setCrmActualBuyChf(e.target.value)}
                        placeholder="36500"
                        className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 font-mono text-[#0B2240]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">
                      Inspection &amp; Condition Notes (undercarriage, hours, leaks)
                    </label>
                    <textarea
                      rows={2}
                      value={crmInspectionNotes}
                      onChange={(e) => setCrmInspectionNotes(e.target.value)}
                      placeholder="Undercarriage 70%, dry engine, original CE certificate..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-[#0B2240]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingCrm}
                    className="h-10 px-5 rounded-full bg-[#0B2240] hover:bg-[#173863] text-white font-heading font-semibold text-xs flex items-center gap-2 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isSavingCrm ? 'Saving...' : 'Save Follow-Up & Valuation'}</span>
                  </button>
                </form>

                {/* Phone Call Log */}
                <div className="pt-4 border-t border-slate-200 space-y-3">
                  <h4 className="font-heading font-bold text-sm text-[#0B2240]">
                    Phone Call Log
                  </h4>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={callOutcome}
                      onChange={(e) => setCallOutcome(e.target.value as any)}
                      className="h-9 bg-slate-50 border border-slate-200 rounded-xl px-2.5 font-medium text-[#0B2240]"
                    >
                      <option value="answered">Answered</option>
                      <option value="voicemail">Left Voicemail</option>
                      <option value="no_answer">No Answer</option>
                      <option value="follow_up_needed">Follow-Up Needed</option>
                    </select>
                    <input
                      type="text"
                      value={callNotes}
                      onChange={(e) => setCallNotes(e.target.value)}
                      placeholder="Spoke with workshop manager, machine available next Tuesday..."
                      className="flex-1 h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 text-[#0B2240]"
                    />
                    <button
                      type="button"
                      onClick={handleAddCallLog}
                      className="h-9 px-4 rounded-xl bg-[#FF6B00] hover:bg-[#E05E00] text-white font-semibold cursor-pointer shrink-0"
                    >
                      Log Call
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
                      To Seller Email
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
                      Subject
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
                      Message (Reviewed before SMTP dispatch)
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
                    className="w-full h-11 rounded-full bg-[#FF6B00] hover:bg-[#E05E00] text-white font-heading font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>
                      {isSendingReply
                        ? 'Sending via SMTP...'
                        : `Send Reply to ${selectedModalLead.sender_email}`}
                    </span>
                  </button>
                </form>

                {selectedModalLead.reply_history && selectedModalLead.reply_history.length > 0 && (
                  <div className="pt-3 border-t border-slate-200 space-y-2">
                    <div className="font-semibold text-slate-600">Previous Replies Sent:</div>
                    {selectedModalLead.reply_history.map((rep) => (
                      <div
                        key={rep.id}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1"
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <strong className="text-[#0B2240]">{rep.subject}</strong>
                          <span>{new Date(rep.sent_at || rep.created_at || Date.now()).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-700 whitespace-pre-wrap">{rep.body}</p>
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
          <div className="w-full max-w-xl bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-heading font-bold text-lg text-[#0B2240]">
                  Paste a Seller&apos;s Email Reply
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Reads the seller&apos;s email, extracts machine names and prices, saves it to your offers list, and alerts your phone.
                </p>
              </div>
              <button
                onClick={closeInboundModal}
                className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {companies.length > 0 && (
              <div className="space-y-1.5 text-xs">
                <label className="font-semibold text-slate-600 block">
                  Choose a company from your list (Optional)
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
                  <option value="">-- Pick a company or type below --</option>
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
                    Sender Email *
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
                    Swiss Canton
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
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={inboundCompany}
                    onChange={(e) => setInboundCompany(e.target.value)}
                    placeholder="Company name"
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 font-medium text-[#0B2240] focus:outline-none focus:border-[#0B2240]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1.5">
                    Email Subject
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
                  Email Message from Seller (German, French, or Italian) *
                </label>
                <textarea
                  rows={5}
                  required
                  value={inboundBody}
                  onChange={(e) => setInboundBody(e.target.value)}
                  placeholder="Paste what the seller wrote back (machine model, price, phone number, etc.)..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 font-mono text-xs text-[#0B2240] leading-relaxed focus:outline-none focus:border-[#0B2240]"
                />
              </div>

              <button
                type="submit"
                disabled={isAnalyzing}
                className="w-full h-12 rounded-full bg-[#FF6B00] hover:bg-[#E05E00] text-white font-heading font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>
                  {isAnalyzing
                    ? 'Reading and saving message...'
                    : 'Read Message & Add to Deals'}
                </span>
              </button>
            </form>

            {triageResult && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between font-mono font-semibold text-[#059669]">
                  <span>Intent: {triageResult.analysis?.intent}</span>
                  <span className="tabular-nums">
                    Confidence: {((triageResult.analysis?.confidence || 0) * 100).toFixed(0)}% · Fit:{' '}
                    {triageResult.analysis?.equipment_fit_score ?? 90}%
                  </span>
                </div>
                <p className="text-sm text-[#0B2240] leading-relaxed">
                  <strong>Summary:</strong> {triageResult.analysis?.french_summary}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DELETE DEAL CONFIRMATION MODAL */}
      {leadToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-lg text-[#0B2240]">
                    Delete this deal offer?
                  </h3>
                  <p className="text-xs text-slate-500">
                    This action cannot be undone.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLeadToDelete(null)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1 text-xs">
              <div className="font-bold text-sm text-[#0B2240]">
                {leadToDelete.machinery_detected[0]?.make_model || 'Construction Machinery'}{' '}
                {leadToDelete.machinery_detected[0]?.asking_price && (
                  <span className="text-[#FF6B00] font-mono">
                    — {leadToDelete.machinery_detected[0]?.asking_price}
                  </span>
                )}
              </div>
              <div className="text-slate-600">
                Seller:{' '}
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
                className="flex-1 h-11 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-[#0B2240] font-heading font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 h-11 rounded-full bg-red-600 hover:bg-red-700 text-white font-heading font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'Deleting...' : 'Yes, Delete Deal'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
