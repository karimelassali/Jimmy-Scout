import React, { useState } from 'react';
import { AgentSettings, Company, ToneType } from '@/packages/types/src/database.ts';
import { generateFrTemplate } from '@/apps/worker/src/templates/fr.template.ts';
import { generateDeTemplate } from '@/apps/worker/src/templates/de.template.ts';
import { generateItTemplate } from '@/apps/worker/src/templates/it.template.ts';
import {
  Send,
  Mail,
  Check,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';

interface PersonaScreenProps {
  settings: AgentSettings;
  companies: Company[];
  onUpdateSettings: (patch: Partial<AgentSettings>) => Promise<void>;
}

export const PersonaScreen: React.FC<PersonaScreenProps> = ({
  settings,
  companies,
  onUpdateSettings,
}) => {
  const [activeLang, setActiveLang] = useState<'fr' | 'de' | 'it'>('fr');
  const [showTestModal, setShowTestModal] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [toast, setToast] = useState<{ msg: string; isError?: boolean } | null>(null);

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
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(`SMTP Error: ${data.error || 'Failed to send email'}`, true);
      } else {
        showToast(`Dispatched live preview email to ${data.recipient}`);
        setShowTestModal(false);
      }
    } catch (err: any) {
      showToast(`SMTP Error: ${err?.message || 'Network error'}`, true);
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
    recipientName: previewCompanyName,
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
            Email Persona &amp; Multilingual Preview
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Customize your buyer identity, commercial tone, and acquisition terms across French, German, and Italian.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowTestModal(true)}
          className="self-start sm:self-auto h-11 px-5 rounded-full bg-[#FF6B00] hover:bg-[#E05E00] text-white font-heading font-semibold text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
        >
          <Send className="w-4 h-4" />
          <span>Send Live SMTP Test Email</span>
        </button>
      </div>

      {/* 2-COLUMN WORKSPACE: Left Settings + Right Live Email Composer Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 5 Columns: Persona Calibration */}
        <div className="lg:col-span-5 space-y-6">
          {/* Sender Identity & Equipment Focus */}
          <section className="bg-white rounded-3xl p-6 border border-slate-200/90 space-y-4">
            <h2 className="font-heading font-bold text-base text-[#0B2240]">
              1. Buyer Identity &amp; Equipment Focus
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold text-slate-600 block mb-1.5">
                  Sender Name
                </label>
                <input
                  type="text"
                  value={settings.sender_name}
                  onChange={(e) => onUpdateSettings({ sender_name: e.target.value })}
                  className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 font-medium text-[#0B2240] focus:outline-none focus:border-[#0B2240]"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-1.5">
                  Direct Phone
                </label>
                <input
                  type="text"
                  value={settings.sender_phone}
                  onChange={(e) => onUpdateSettings({ sender_phone: e.target.value })}
                  className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 font-mono text-[#0B2240] focus:outline-none focus:border-[#0B2240]"
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="font-semibold text-slate-600 block mb-1.5">
                Sender Email Address (SMTP Reply-To)
              </label>
              <input
                type="email"
                value={settings.sender_email}
                onChange={(e) => onUpdateSettings({ sender_email: e.target.value })}
                className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 font-mono text-[#0B2240] focus:outline-none focus:border-[#0B2240]"
              />
            </div>

            <div className="text-xs">
              <label className="font-semibold text-slate-600 block mb-1.5">
                Target Machinery Sought (Inserted into emails)
              </label>
              <textarea
                rows={2}
                value={settings.equipment_focus}
                onChange={(e) => onUpdateSettings({ equipment_focus: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 font-medium text-[#0B2240] leading-relaxed focus:outline-none focus:border-[#0B2240]"
              />
            </div>
          </section>

          {/* Commercial Tone Selector */}
          <section className="bg-white rounded-3xl p-6 border border-slate-200/90 space-y-4">
            <h2 className="font-heading font-bold text-base text-[#0B2240]">
              2. Commercial Tone
            </h2>

            <div className="space-y-2.5">
              {[
                {
                  id: 'swiss_formal' as ToneType,
                  title: 'Swiss Formal (Recommended)',
                  desc: 'Polite, executive B2B inquiry suited for Swiss German & Romandie directors.',
                },
                {
                  id: 'approachable_trade' as ToneType,
                  title: 'Approachable Trade',
                  desc: 'Direct, peer-to-peer yard manager style focused on technical specs.',
                },
                {
                  id: 'fast_cash' as ToneType,
                  title: 'Fast Cash Settlement',
                  desc: 'Emphasizes immediate wire payment and rapid fleet liquidation.',
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
          <section className="bg-white rounded-3xl p-6 border border-slate-200/90 space-y-4">
            <h2 className="font-heading font-bold text-base text-[#0B2240]">
              3. Value Proposition Hooks
            </h2>

            <div className="space-y-2.5">
              {[
                {
                  key: 'cash_settlement' as const,
                  title: 'Paiement comptant / Immediate Wire',
                  desc: 'Guaranteed full payment prior to machine loading',
                },
                {
                  key: 'transport_covered' as const,
                  title: 'Transport pris en charge / Lowbed Covered',
                  desc: 'We organize and pay for heavy transport from the seller yard',
                },
                {
                  key: 'as_is' as const,
                  title: "Rachat en l'état / Purchased As-Is",
                  desc: 'No post-sale warranty required from the contractor',
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
        </div>

        {/* Right 7 Columns: Live Trilingual Email Preview */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 space-y-6 lg:sticky lg:top-24">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <Mail className="w-5 h-5 text-[#FF6B00]" />
              <div>
                <h2 className="font-heading font-bold text-lg text-[#0B2240]">
                  Exact Production Email Template
                </h2>
                <p className="text-xs text-slate-500">
                  Rendered live by the worker template engine ({settings.sender_email})
                </p>
              </div>
            </div>

            {/* Segmented Language Switcher */}
            <div className="inline-flex items-center p-1 bg-slate-100 rounded-full self-start sm:self-auto">
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

          {/* Envelope Metadata */}
          <div className="space-y-2 text-xs border-b border-slate-100 pb-4">
            <div className="flex items-baseline gap-3">
              <span className="text-slate-400 w-16 shrink-0">To</span>
              <span className="font-mono text-[#0B2240]">{previewRecipientLine}</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-slate-400 w-16 shrink-0">From</span>
              <span className="font-mono text-slate-600">
                {settings.sender_name} &lt;{settings.sender_email}&gt;
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-slate-400 w-16 shrink-0">Subject</span>
              <span className="font-semibold text-[#0B2240]">{renderedTemplate.subject}</span>
            </div>
          </div>

          {/* Exact Rendered Email Body */}
          <div className="bg-slate-50/70 rounded-2xl p-5 text-sm text-[#0B2240] leading-relaxed font-body whitespace-pre-wrap border border-slate-100">
            {renderedTemplate.body}
          </div>
        </div>
      </div>

      {/* TEST EMAIL MODAL */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-heading font-bold text-lg text-[#0B2240]">
                Send Live SMTP Test Email
              </h3>
              <button
                onClick={() => setShowTestModal(false)}
                className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Dispatches the current <strong>{activeLang.toUpperCase()}</strong> acquisition template via your configured SMTP server.
            </p>

            <form onSubmit={handleSendTestEmail} className="space-y-4">
              <div className="space-y-1.5 text-xs">
                <label className="font-semibold text-slate-600 block">
                  Recipient Email Address
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
                <span>{isSendingTest ? 'Sending via SMTP...' : 'Send Live Email Now'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
