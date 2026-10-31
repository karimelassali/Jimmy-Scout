import React, { useState } from 'react';
import { AgentSettings, Company, ToneType } from '@/packages/types/src/database.ts';
import { generateFrTemplate } from '@/apps/worker/src/templates/fr.template.ts';
import { generateDeTemplate } from '@/apps/worker/src/templates/de.template.ts';
import { generateItTemplate } from '@/apps/worker/src/templates/it.template.ts';
import { GoogleAppGuideModal } from '../guide/GoogleAppGuideModal.tsx';
import {
  Send,
  Mail,
  Check,
  CheckCircle2,
  AlertCircle,
  X,
  Compass,
  ArrowRight,
} from 'lucide-react';

interface PersonaScreenProps {
  settings: AgentSettings;
  companies: Company[];
  onUpdateSettings: (patch: Partial<AgentSettings>) => Promise<void>;
  onOpenGuide?: () => void;
}

export const PersonaScreen: React.FC<PersonaScreenProps> = ({
  settings,
  companies,
  onUpdateSettings,
  onOpenGuide,
}) => {
  const [activeLang, setActiveLang] = useState<'fr' | 'de' | 'it'>('fr');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [draftName, setDraftName] = useState(settings.sender_name);
  const [draftPhone, setDraftPhone] = useState(settings.sender_phone);
  const [draftEmail, setDraftEmail] = useState(settings.sender_email);
  const [draftFocus, setDraftFocus] = useState(settings.equipment_focus);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [toast, setToast] = useState<{ msg: string; isError?: boolean } | null>(null);
  const [isGuideOpenLocal, setIsGuideOpenLocal] = useState(false);

  const handleOpenGuide = () => {
    if (onOpenGuide) {
      onOpenGuide();
    } else {
      setIsGuideOpenLocal(true);
    }
  };

  const showToast = (msg: string, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 4000);
  };

  const handleToneChange = async (tone: ToneType) => {
    await onUpdateSettings({ tone });
    showToast(
      `Tone updated to ${
        tone === 'swiss_formal'
          ? 'Swiss Formal'
          : tone === 'approachable_trade'
          ? 'Approachable Trade'
          : 'Fast Cash Buyout'
      }`
    );
  };

  const handleToggleHook = async (
    key: 'cash_settlement' | 'transport_covered' | 'as_is'
  ) => {
    const nextHooks = {
      ...settings.hooks,
      [key]: !settings.hooks[key],
    };
    await onUpdateSettings({ hooks: nextHooks });
    showToast('Email value proposition updated');
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingTest(true);
    try {
      const res = await fetch('/api/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetEmail: testEmail.trim() || settings.sender_email,
          language: activeLang,
          customSubject: renderedTemplate.subject,
          customBody: renderedTemplate.body,
          customHtml: renderedTemplate.html,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(`Could not send email: ${data.error || 'Please check your settings'}`, true);
      } else {
        showToast(`Sent preview email to ${data.recipient}`);
        setShowTestModal(false);
      }
    } catch (err: any) {
      showToast(`Error sending email: ${err?.message || 'Network error'}`, true);
    } finally {
      setIsSendingTest(false);
    }
  };

  // Pick a real contractor from the user's Supabase directory for this language if one exists
  const matchingContractor = companies.find((c) => c.language === activeLang);
  const previewCompanyName = matchingContractor?.name || '{{company_name}}';
  const previewCanton =
    matchingContractor?.canton ||
    (activeLang === 'de' ? 'ZH' : activeLang === 'it' ? 'TI' : 'VD');
  const previewRecipientLine = matchingContractor
    ? `${matchingContractor.name} (${matchingContractor.canton}) <${matchingContractor.email}>`
    : `{{company_name}} (${previewCanton}) <{{contractor_email}}>`;

  const templateParams = {
    companyName: previewCompanyName,
    recipientName: undefined,
    canton: previewCanton,
    senderName: settings.sender_name,
    senderEmail: settings.sender_email,
    senderPhone: settings.sender_phone,
    tone: settings.tone,
    hooks: settings.hooks,
    equipmentFocus: settings.equipment_focus,
  };

  const renderedTemplate =
    activeLang === 'de'
      ? generateDeTemplate(templateParams)
      : activeLang === 'it'
      ? generateItTemplate(templateParams)
      : generateFrTemplate(templateParams);

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

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-[#0B2240] tracking-tight">
            Jimy's Persona &amp; Email Preview
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Configure the identity, speaking tone, and machinery preferences agent Jimy uses when reaching out to Swiss contractors.
          </p>
        </div>

        <button
          type="button"
          data-tour="persona-test-email"
          onClick={() => setShowTestModal(true)}
          className="self-start sm:self-auto h-11 px-5 rounded-full bg-[#FF6B00] hover:bg-[#E05E00] text-white font-heading font-semibold text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
        >
          <Send className="w-4 h-4" />
          <span>See What Jimy Writes (Test Email)</span>
        </button>
      </div>

      {/* 2-COLUMN WORKSPACE: Left Settings + Right Live Email Composer Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 5 Columns: Persona Calibration */}
        <div className="lg:col-span-5 space-y-6">
          {/* Sender Identity & Equipment Focus (Minimized by default) */}
          <section className="bg-white rounded-3xl p-5 border border-slate-200/90 space-y-3" data-tour="persona-identity">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-heading font-bold text-sm text-[#0B2240]">
                1. Your Profile &amp; Machinery
              </h2>
              <button
                type="button"
                onClick={() => {
                  if (!isEditingProfile) {
                    setDraftName(settings.sender_name);
                    setDraftPhone(settings.sender_phone);
                    setDraftEmail(settings.sender_email);
                    setDraftFocus(settings.equipment_focus);
                  }
                  setIsEditingProfile(!isEditingProfile);
                }}
                className="px-3 py-1 rounded-full text-xs font-semibold border border-slate-200 hover:bg-slate-50 text-[#0B2240] transition-colors cursor-pointer"
              >
                {isEditingProfile ? 'Cancel' : 'Edit'}
              </button>
            </div>

            {!isEditingProfile ? (
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                  <img
                    src="/assets/jimy-export-avatar.jpg"
                    alt="Jimy Export Profile"
                    className="w-10 h-10 rounded-full object-cover border border-slate-300 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[#202124] truncate">
                      {settings.sender_name} · JIMY EXPORT
                    </div>
                    <div className="text-[#5f6368] truncate">
                      {settings.sender_phone} · {settings.sender_email}
                    </div>
                  </div>
                </div>
                <div className="px-1 text-slate-600">
                  <span className="font-semibold text-[#0B2240]">Buying: </span>
                  <span className="line-clamp-2">{settings.equipment_focus}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-1 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">
                      Your Name
                    </label>
                    <input
                      type="text"
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 font-medium text-[#0B2240] focus:outline-none focus:border-[#0B2240]"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={draftPhone}
                      onChange={(e) => setDraftPhone(e.target.value)}
                      className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 font-mono text-[#0B2240] focus:outline-none focus:border-[#0B2240]"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={draftEmail}
                    onChange={(e) => setDraftEmail(e.target.value)}
                    className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 font-mono text-[#0B2240] focus:outline-none focus:border-[#0B2240]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    Machinery you want to buy
                  </label>
                  <textarea
                    rows={2}
                    value={draftFocus}
                    onChange={(e) => setDraftFocus(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium text-[#0B2240] leading-relaxed focus:outline-none focus:border-[#0B2240]"
                  />
                </div>

                <button
                  type="button"
                  disabled={isSavingProfile}
                  onClick={async () => {
                    setIsSavingProfile(true);
                    try {
                      await onUpdateSettings({
                        sender_name: draftName.trim() || settings.sender_name,
                        sender_phone: draftPhone.trim() || settings.sender_phone,
                        sender_email: draftEmail.trim() || settings.sender_email,
                        equipment_focus: draftFocus.trim() || settings.equipment_focus,
                      });
                      setIsEditingProfile(false);
                      showToast('Profile and machinery preferences saved');
                    } finally {
                      setIsSavingProfile(false);
                    }
                  }}
                  className="w-full h-9 rounded-xl bg-[#0B2240] hover:bg-[#16365C] text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5 text-[#FF6B00]" />
                  <span>{isSavingProfile ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            )}
          </section>

          {/* Commercial Tone Selector */}
          <section className="bg-white rounded-3xl p-6 border border-slate-200/90 space-y-4" data-tour="persona-tone">
            <h2 className="font-heading font-bold text-base text-[#0B2240]">
              2. Speaking Style
            </h2>

            <div className="space-y-2.5">
              {[
                {
                  id: 'swiss_formal' as ToneType,
                  title: 'Swiss Formal (Recommended)',
                  desc: 'Respectful, professional business style suited for Swiss company owners.',
                },
                {
                  id: 'approachable_trade' as ToneType,
                  title: 'Friendly Contractor Style',
                  desc: 'Direct and friendly, like talking to another contractor in the yard.',
                },
                {
                  id: 'fast_cash' as ToneType,
                  title: 'Fast Payment Deal',
                  desc: 'Highlights fast bank wire transfer and immediate fleet purchases.',
                },
              ].map((item) => {
                const isSelected = settings.tone === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleToneChange(item.id)}
                    className={`w-full p-4 rounded-2xl text-left border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                      isSelected
                        ? 'border-[#0B2240] bg-slate-50/80'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div>
                      <div className="font-heading font-bold text-sm text-[#0B2240]">
                        {item.title}
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected
                          ? 'bg-[#FF6B00] text-white'
                          : 'border border-slate-300'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Value Proposition Checkboxes */}
          <section className="bg-white rounded-3xl p-6 border border-slate-200/90 space-y-4" data-tour="persona-hooks">
            <h2 className="font-heading font-bold text-base text-[#0B2240]">
              3. Guarantees You Offer
            </h2>

            <div className="space-y-2.5">
              {[
                {
                  key: 'cash_settlement' as const,
                  title: 'Immediate Wire Payment (Comptant)',
                  desc: 'You pay 100% in full before the machine is loaded',
                },
                {
                  key: 'transport_covered' as const,
                  title: 'Transport Covered by You',
                  desc: 'You organize and pay for the transport truck yourself',
                },
                {
                  key: 'as_is' as const,
                  title: "Purchased As-Is (No Warranty)",
                  desc: 'No repairs or guarantees demanded from the seller after sale',
                },
              ].map((hook) => {
                const isChecked = settings.hooks[hook.key];
                return (
                  <div
                    key={hook.key}
                    onClick={() => handleToggleHook(hook.key)}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 cursor-pointer transition-colors"
                  >
                    <div className="pr-3">
                      <div className="font-heading font-semibold text-sm text-[#0B2240]">
                        {hook.title}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{hook.desc}</div>
                    </div>

                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        isChecked
                          ? 'bg-[#FF6B00] text-white'
                          : 'border-2 border-slate-300 bg-white text-transparent'
                      }`}
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Google Style Interactive App Guide Card */}
          <section className="bg-gradient-to-br from-white via-white to-blue-50/40 rounded-3xl p-6 border border-blue-200/80 shadow-2xs space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#1A73E8] text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                  <Compass className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#1A73E8]">
                      Interactive Manual
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Screenshots &amp; Workflows
                    </span>
                  </div>
                  <h2 className="font-heading font-bold text-base text-[#0B2240] leading-snug">
                    4. Visual App Guide
                  </h2>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Explore step-by-step instructions, high-resolution interface screenshots, Swiss canton strategies, and equipment extraction workflows.
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 pt-1">
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">Scouting &amp; Pacing</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">Cantons (DE/FR/IT)</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">Deals &amp; Extraction</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">Card OCR &amp; Emails</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenGuide}
              className="w-full h-11 px-5 rounded-2xl bg-[#1A73E8] hover:bg-[#1557B0] text-white font-heading font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-md cursor-pointer"
            >
              <Compass className="w-4 h-4 text-white" />
              <span>Open Visual App Guide with Screenshots</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </section>
        </div>

        {/* Right 7 Columns: Live Trilingual Email Preview */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 space-y-6 lg:sticky lg:top-24" data-tour="persona-test-email">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <Mail className="w-5 h-5 text-[#FF6B00]" />
              <div>
                <h2 className="font-heading font-bold text-lg text-[#0B2240]">
                  What Your Email Looks Like
                </h2>
                <p className="text-xs text-slate-500">
                  Exact text sent to sellers from {settings.sender_email}
                </p>
              </div>
            </div>

            {/* Segmented Language Switcher */}
            <div className="w-full sm:w-auto overflow-x-auto no-scrollbar py-0.5">
              <div className="inline-flex items-center p-1 bg-slate-100 rounded-full shrink-0 min-w-max">
                {(
                  [
                    { id: 'fr', label: 'FR · Romandie' },
                    { id: 'de', label: 'DE · Deutschschweiz' },
                    { id: 'it', label: 'IT · Ticino' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveLang(tab.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      activeLang === tab.id
                        ? 'bg-white text-[#0B2240] shadow-2xs'
                        : 'text-slate-600 hover:text-[#0B2240]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Authentic Google Gmail Message View */}
          <div className="bg-white rounded-xl border border-[#dadce0] overflow-hidden font-sans">
            {/* Gmail Subject Header */}
            <div className="px-6 pt-5 pb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-[18px] font-normal text-[#202124] leading-snug">
                  {renderedTemplate.subject}
                </h3>
                <span className="px-2 py-0.5 rounded bg-[#f1f3f4] text-[#5f6368] text-[11px] font-medium">
                  Inbox
                </span>
              </div>
            </div>

            {/* Gmail Sender Bar */}
            <div className="px-6 py-2 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src="/assets/jimy-export-avatar.jpg"
                  alt="Jimy Export"
                  className="w-10 h-10 rounded-full object-cover shrink-0 border border-[#dadce0]"
                />
                <div className="min-w-0">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="font-bold text-[14px] text-[#202124]">
                      {settings.sender_name} - JIMY EXPORT
                    </span>
                    <span className="text-[12px] text-[#5f6368] truncate">
                      &lt;{settings.sender_email}&gt;
                    </span>
                  </div>
                  <div className="text-[12px] text-[#5f6368] truncate">
                    to {previewCompanyName} ({previewCanton}) ▾
                  </div>
                </div>
              </div>
              <span className="text-[12px] text-[#5f6368] shrink-0 pt-0.5">
                09:14 (just now)
              </span>
            </div>

            {/* Gmail Message Body */}
            <div className="px-6 pt-4 pb-6 pl-[68px] text-[14px] text-[#202124] leading-[1.5] space-y-3.5">
              <p>
                {activeLang === 'de'
                  ? 'Guten Tag,'
                  : activeLang === 'it'
                  ? 'Buongiorno,'
                  : 'Bonjour,'}
              </p>

              <p>
                {activeLang === 'de'
                  ? 'wir kaufen laufend gebrauchte Baumaschinen und Lastwagen in der Schweiz für den Export und unsere Partnerbetriebe an.'
                  : activeLang === 'it'
                  ? "acquistiamo regolarmente macchine da cantiere e autocarri usati in Svizzera per l'esportazione e per i nostri cantieri partner."
                  : "Nous sommes acheteurs de machines de chantier et camions en Suisse pour l'export et nos chantiers partenaires."}
              </p>

              <div>
                <p className="mb-1">
                  {activeLang === 'de'
                    ? 'Aktuell suchen wir insbesondere:'
                    : activeLang === 'it'
                    ? 'Attualmente cerchiamo:'
                    : 'Nous recherchons actuellement :'}
                </p>
                <p className="text-[#202124]">{settings.equipment_focus}</p>
              </div>

              <p>
                {activeLang === 'de'
                  ? `Planen Sie in nächster Zeit in Ihrem Betrieb (${previewCanton}) den Verkauf oder Ersatz einzelner Maschinen?`
                  : activeLang === 'it'
                  ? `Avete in programma di vendere o sostituire alcuni mezzi del vostro parco macchine (${previewCanton}) prossimamente?`
                  : `Avez-vous prévu de vendre ou de renouveler certaines machines de votre parc (${previewCanton}) prochainement ?`}
              </p>

              {(settings.hooks.cash_settlement ||
                settings.hooks.transport_covered ||
                settings.hooks.as_is) && (
                <div>
                  <p className="mb-1">
                    {activeLang === 'de'
                      ? 'Unsere Konditionen:'
                      : activeLang === 'it'
                      ? 'Le nostre condizioni:'
                      : 'Nos conditions :'}
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-[#202124]">
                    {settings.hooks.cash_settlement && (
                      <li>
                        {activeLang === 'de'
                          ? 'Sofortige Banküberweisung oder Barzahlung vor Abholung'
                          : activeLang === 'it'
                          ? 'Pagamento immediato tramite bonifico bancario prima del ritiro'
                          : 'Paiement par virement bancaire avant enlèvement'}
                      </li>
                    )}
                    {settings.hooks.transport_covered && (
                      <li>
                        {activeLang === 'de'
                          ? 'Komplette Organisation und Übernahme des Transports ab Ihrem Werkhof'
                          : activeLang === 'it'
                          ? 'Trasporto e logistica interamente a nostro carico dal vostro piazzale'
                          : 'Transport et convoi exceptionnel pris en charge depuis votre dépôt'}
                      </li>
                    )}
                    {settings.hooks.as_is && (
                      <li>
                        {activeLang === 'de'
                          ? 'Kauf im Ist-Zustand ab Platz, ohne Garantieansprüche'
                          : activeLang === 'it'
                          ? 'Acquisto nello stato in cui si trova (visto e piaciuto), senza garanzia'
                          : "Achat en l'état, sans garantie demandée"}
                      </li>
                    )}
                  </ul>
                </div>
              )}

              <p>
                {activeLang === 'de' ? (
                  <>
                    Bei Interesse oder verfügbaren Maschinen erreichen Sie mich direkt per E-Mail oder telefonisch unter{' '}
                    <span className="text-[#1a73e8]">{settings.sender_phone}</span>.
                  </>
                ) : activeLang === 'it' ? (
                  <>
                    Se avete macchinari disponibili, potete rispondermi direttamente via e-mail o chiamarmi al{' '}
                    <span className="text-[#1a73e8]">{settings.sender_phone}</span>.
                  </>
                ) : (
                  <>
                    Si vous avez des machines disponibles, vous pouvez me répondre directement par e-mail ou m&apos;appeler au{' '}
                    <span className="text-[#1a73e8]">{settings.sender_phone}</span>.
                  </>
                )}
              </p>

              <p className="pt-1">
                {activeLang === 'de'
                  ? 'Freundliche Grüsse'
                  : activeLang === 'it'
                  ? 'Cordiali saluti,'
                  : 'Meilleures salutations,'}
              </p>

              {/* Standard Google Workspace / Gmail Signature */}
              <div className="pt-2 flex items-start gap-3">
                <img
                  src="/assets/jimy-export-avatar.jpg"
                  alt="Jimy Export"
                  className="w-12 h-12 rounded-full object-cover shrink-0"
                />
                <div className="border-l border-[#dadce0] pl-3 text-[13px] leading-[1.4]">
                  <div className="font-bold text-[#202124]">{settings.sender_name}</div>
                  <div className="text-[12px] text-[#5f6368]">
                    JIMY EXPORT · Lastwagen &amp; Baumaschine Händler
                  </div>
                  <div className="text-[12px] text-[#5f6368] mt-0.5">
                    <span className="text-[#1a73e8]">{settings.sender_phone}</span> ·{' '}
                    <span className="text-[#1a73e8]">{settings.sender_email}</span>
                  </div>
                </div>
              </div>

              {/* Subtle Plain Unsubscribe Line */}
              <p className="pt-4 text-[11px] text-[#70757a]">
                {activeLang === 'de'
                  ? 'Falls Sie keine weiteren Nachrichten wünschen, antworten Sie einfach mit STOP.'
                  : activeLang === 'it'
                  ? 'Se non desidera ricevere altri messaggi, risponda semplicemente STOP.'
                  : 'Si vous ne souhaitez plus recevoir nos messages, répondez simplement STOP.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* TEST EMAIL MODAL */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-heading font-bold text-lg text-[#0B2240]">
                Send a Test Email to Myself
              </h3>
              <button
                onClick={() => setShowTestModal(false)}
                className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Sends the current <strong>{activeLang.toUpperCase()}</strong> email to your mailbox so you can verify how it looks.
            </p>

            <form onSubmit={handleSendTestEmail} className="space-y-4">
              <div className="space-y-1.5 text-xs">
                <label className="font-semibold text-slate-600 block">
                  Send email to:
                </label>
                <input
                  type="email"
                  required
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder={settings.sender_email}
                  className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-3.5 text-sm text-[#0B2240] focus:outline-none focus:border-[#0B2240]"
                />
              </div>

              <button
                type="submit"
                disabled={isSendingTest}
                className="w-full h-11 rounded-full bg-[#FF6B00] hover:bg-[#E05E00] text-white font-heading font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{isSendingTest ? 'Sending...' : 'Send Test Email'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Google Style Interactive App Guide Modal */}
      <GoogleAppGuideModal
        isOpen={isGuideOpenLocal}
        onClose={() => setIsGuideOpenLocal(false)}
        initialTab="settings"
      />
    </div>
  );
};
