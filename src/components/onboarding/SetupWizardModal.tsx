import React, { useState, useEffect } from 'react';
import { AgentSettings, ToneType, PersonaHooks } from '@/packages/types/src/database.ts';
import { Check, ChevronRight, ChevronLeft, X } from 'lucide-react';

export interface SetupWizardModalProps {
  isOpen: boolean;
  settings: AgentSettings;
  onSaveAndComplete: (patch: Partial<AgentSettings>) => Promise<void>;
  onClose?: () => void;
}

interface CantonOption {
  code: string;
  name: string;
  regionGroup: 'fr' | 'de' | 'it';
}

const SWISS_CANTON_OPTIONS: CantonOption[] = [
  { code: 'VD', name: 'Vaud', regionGroup: 'fr' },
  { code: 'GE', name: 'Genève', regionGroup: 'fr' },
  { code: 'VS', name: 'Valais', regionGroup: 'fr' },
  { code: 'FR', name: 'Fribourg', regionGroup: 'fr' },
  { code: 'NE', name: 'Neuchâtel', regionGroup: 'fr' },
  { code: 'BE', name: 'Bern', regionGroup: 'de' },
  { code: 'ZH', name: 'Zürich', regionGroup: 'de' },
  { code: 'AG', name: 'Aargau', regionGroup: 'de' },
  { code: 'SG', name: 'St. Gallen', regionGroup: 'de' },
  { code: 'LU', name: 'Luzern', regionGroup: 'de' },
  { code: 'ZG', name: 'Zug', regionGroup: 'de' },
  { code: 'TI', name: 'Ticino', regionGroup: 'it' },
];

const QUICK_MACHINES = [
  'Pelles 15–30t',
  'Camions 4 essieux',
  'Chargeuses sur pneus',
  'Concasseurs mobiles',
  'Mini-pelles 2–8t',
  'Bulldozers',
];

export const SetupWizardModal: React.FC<SetupWizardModalProps> = ({
  isOpen,
  settings,
  onSaveAndComplete,
  onClose,
}) => {
  const [step, setStep] = useState<0 | 1>(0);
  const [isSaving, setIsSaving] = useState(false);

  const [draftName, setDraftName] = useState(settings.sender_name || '');
  const [draftEmail, setDraftEmail] = useState(settings.sender_email || '');
  const [draftPhone, setDraftPhone] = useState(settings.sender_phone || '+41 ');
  const [draftFocus, setDraftFocus] = useState(
    settings.equipment_focus ||
      'Pelles sur chenilles 15–30t, camions benne 4 essieux, chargeuses sur pneus, concasseurs'
  );
  const [draftCantons, setDraftCantons] = useState<string[]>(
    settings.selected_cantons?.length > 0
      ? settings.selected_cantons
      : ['VD', 'GE', 'VS', 'BE', 'ZH', 'TI']
  );
  const [draftTone, setDraftTone] = useState<ToneType>(settings.tone || 'swiss_formal');
  const [draftHooks] = useState<PersonaHooks>(
    settings.hooks || {
      cash_settlement: true,
      transport_covered: true,
      as_is: true,
    }
  );
  const [draftLimit, setDraftLimit] = useState<number>(settings.daily_limit || 25);
  const [draftStartActive, setDraftStartActive] = useState<boolean>(
    settings.is_active ?? true
  );

  useEffect(() => {
    if (isOpen) {
      setStep(0);
      setDraftName(settings.sender_name || '');
      setDraftEmail(settings.sender_email || '');
      setDraftPhone(settings.sender_phone || '+41 ');
      if (settings.equipment_focus) setDraftFocus(settings.equipment_focus);
      if (settings.selected_cantons?.length > 0) setDraftCantons(settings.selected_cantons);
      if (settings.tone) setDraftTone(settings.tone);
      if (settings.daily_limit) setDraftLimit(settings.daily_limit);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const toggleCanton = (code: string) => {
    setDraftCantons((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const selectRegionGroup = (group: 'all' | 'fr' | 'de' | 'it') => {
    if (group === 'all') {
      setDraftCantons(SWISS_CANTON_OPTIONS.map((c) => c.code));
      return;
    }
    const codes = SWISS_CANTON_OPTIONS.filter((c) => c.regionGroup === group).map((c) => c.code);
    setDraftCantons(codes);
  };

  const toggleQuickMachine = (item: string) => {
    const currentLower = draftFocus.toLowerCase();
    if (currentLower.includes(item.toLowerCase())) {
      const parts = draftFocus
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p.toLowerCase() !== item.toLowerCase() && p.length > 0);
      setDraftFocus(parts.join(', '));
    } else {
      const cleaned = draftFocus.trim().replace(/,\s*$/, '');
      setDraftFocus(cleaned ? `${cleaned}, ${item}` : item);
    }
  };

  const handleFinish = async () => {
    setIsSaving(true);
    try {
      await onSaveAndComplete({
        sender_name: draftName.trim() || 'Jamal',
        sender_email: draftEmail.trim() || 'info@jimyexport.ch',
        sender_phone: draftPhone.trim() || '+41 79 123 45 67',
        equipment_focus:
          draftFocus.trim() ||
          'Pelles sur chenilles 15–30t, camions benne 4 essieux, chargeuses sur pneus',
        selected_cantons: draftCantons.length > 0 ? draftCantons : ['VD', 'GE', 'BE', 'ZH'],
        tone: draftTone,
        hooks: draftHooks,
        daily_limit: draftLimit,
        is_active: draftStartActive,
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem('jimiscout_setup_completed', 'true');
      }
      if (onClose) onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-[480px] shadow-xl border border-[#DADCE0] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top thin Google progress indicator */}
        <div className="h-1 w-full bg-[#F1F3F4]">
          <div
            className="h-full bg-[#1A73E8] transition-transform duration-200 origin-left"
            style={{ transform: `scaleX(${step === 0 ? 0.5 : 1})` }}
          />
        </div>

        {/* Clean Google Dialog Header */}
        <div className="px-6 pt-5 pb-3 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-medium text-[#5F6368]">
              Step {step + 1} of 2 · Workspace Setup
            </div>
            <h2 className="text-lg font-semibold text-[#202124] mt-0.5 tracking-tight">
              {step === 0 ? 'Buyer identity & equipment' : 'Target cantons & outreach pace'}
            </h2>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full text-[#5F6368] hover:text-[#202124] hover:bg-[#F1F3F4] flex items-center justify-center transition-colors cursor-pointer shrink-0 -mr-1"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-3 space-y-4 overflow-y-auto max-h-[70vh]">
          {step === 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#3C4043] mb-1">
                    Sender name
                  </label>
                  <input
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder="e.g. Jamal"
                    autoFocus
                    className="w-full h-10 px-3 rounded-lg bg-white border border-[#DADCE0] text-sm text-[#202124] placeholder:text-[#80868B] focus:outline-none focus:border-[#1A73E8] focus:ring-2 focus:ring-[#1A73E8]/15 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#3C4043] mb-1">
                    Direct phone / WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={draftPhone}
                    onChange={(e) => setDraftPhone(e.target.value)}
                    placeholder="+41 79 123 45 67"
                    className="w-full h-10 px-3 rounded-lg bg-white border border-[#DADCE0] text-sm text-[#202124] placeholder:text-[#80868B] focus:outline-none focus:border-[#1A73E8] focus:ring-2 focus:ring-[#1A73E8]/15 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#3C4043] mb-1">
                  Reply-to email address
                </label>
                <input
                  type="email"
                  value={draftEmail}
                  onChange={(e) => setDraftEmail(e.target.value)}
                  placeholder="info@jimyexport.ch"
                  className="w-full h-10 px-3 rounded-lg bg-white border border-[#DADCE0] text-sm text-[#202124] placeholder:text-[#80868B] focus:outline-none focus:border-[#1A73E8] focus:ring-2 focus:ring-[#1A73E8]/15 transition-colors"
                />
              </div>

              <div className="pt-2 border-t border-[#F1F3F4]">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-[#3C4043]">
                    Target machinery
                  </label>
                  <span className="text-[11px] text-[#5F6368]">Cliquer pour changer</span>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {QUICK_MACHINES.map((item) => {
                    const isSelected = draftFocus
                      .toLowerCase()
                      .includes(item.toLowerCase());
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleQuickMachine(item)}
                        className={`h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border whitespace-nowrap shrink-0 ${
                          isSelected
                            ? 'bg-[#E8F0FE] text-[#1A73E8] border-[#D2E3FC]'
                            : 'bg-white text-[#3C4043] border-[#DADCE0] hover:bg-[#F8F9FA]'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[2.5]" />}
                        <span>{item}</span>
                      </button>
                    );
                  })}
                </div>

                <textarea
                  rows={2}
                  value={draftFocus}
                  onChange={(e) => setDraftFocus(e.target.value)}
                  placeholder="Pelles sur chenilles 15–30t, camions benne 4 essieux..."
                  className="w-full p-2.5 rounded-lg bg-white border border-[#DADCE0] text-xs text-[#202124] placeholder:text-[#80868B] focus:outline-none focus:border-[#1A73E8] focus:ring-2 focus:ring-[#1A73E8]/15 transition-colors leading-relaxed resize-none"
                />
              </div>
            </>
          ) : (
            <>
              {/* Regions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-[#3C4043]">
                    Active Swiss cantons ({draftCantons.length})
                  </label>
                  <div className="flex items-center gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => selectRegionGroup('all')}
                      className="px-2 py-0.5 rounded text-[#1A73E8] hover:bg-[#E8F0FE] font-medium transition-colors cursor-pointer"
                    >
                      All
                    </button>
                    <span className="text-[#DADCE0]">·</span>
                    <button
                      type="button"
                      onClick={() => selectRegionGroup('fr')}
                      className="px-2 py-0.5 rounded text-[#5F6368] hover:text-[#202124] hover:bg-[#F1F3F4] font-medium transition-colors cursor-pointer"
                    >
                      Romandie
                    </button>
                    <span className="text-[#DADCE0]">·</span>
                    <button
                      type="button"
                      onClick={() => selectRegionGroup('de')}
                      className="px-2 py-0.5 rounded text-[#5F6368] hover:text-[#202124] hover:bg-[#F1F3F4] font-medium transition-colors cursor-pointer"
                    >
                      Deutschschweiz
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                  {SWISS_CANTON_OPTIONS.map((canton) => {
                    const isSelected = draftCantons.includes(canton.code);
                    return (
                      <button
                        key={canton.code}
                        type="button"
                        onClick={() => toggleCanton(canton.code)}
                        className={`h-9 px-2.5 rounded-lg border text-xs font-medium flex items-center justify-between transition-colors cursor-pointer whitespace-nowrap ${
                          isSelected
                            ? 'bg-[#E8F0FE] border-[#D2E3FC] text-[#1A73E8]'
                            : 'bg-white border-[#DADCE0] text-[#3C4043] hover:bg-[#F8F9FA]'
                        }`}
                      >
                        <span className="truncate">{canton.name}</span>
                        <span className="font-mono text-[10px] opacity-75 ml-1">
                          {canton.code}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Daily Limit & Tone */}
              <div className="pt-3 border-t border-[#F1F3F4] grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#3C4043] mb-1.5">
                    Daily email limit
                  </label>
                  <div className="grid grid-cols-4 gap-1 p-1 bg-[#F1F3F4] rounded-lg">
                    {[15, 25, 35, 50].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setDraftLimit(val)}
                        className={`h-7 rounded-md text-xs font-mono tabular-nums font-medium transition-colors cursor-pointer ${
                          draftLimit === val
                            ? 'bg-white text-[#202124] shadow-2xs'
                            : 'text-[#5F6368] hover:text-[#202124]'
                        }`}
                      >
                        {val}/d
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#3C4043] mb-1.5">
                    Outreach tone
                  </label>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-[#F1F3F4] rounded-lg">
                    {(
                      [
                        { id: 'swiss_formal', label: 'Formal' },
                        { id: 'approachable_trade', label: 'Direct' },
                        { id: 'fast_cash', label: 'Fast Cash' },
                      ] as const
                    ).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setDraftTone(t.id)}
                        className={`h-7 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                          draftTone === t.id
                            ? 'bg-white text-[#202124] shadow-2xs'
                            : 'text-[#5F6368] hover:text-[#202124]'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Clean Auto-Dispatch Toggle */}
              <div className="pt-3 border-t border-[#F1F3F4]">
                <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-[#202124]">
                      Enable automated schedule
                    </div>
                    <div className="text-[11px] text-[#5F6368]">
                      Sends inquiries Mon–Fri during Swiss business hours (08:30–17:00)
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={draftStartActive}
                    onClick={() => setDraftStartActive(!draftStartActive)}
                    className={`w-10 h-6 rounded-full transition-colors p-0.5 cursor-pointer shrink-0 ${
                      draftStartActive ? 'bg-[#1A73E8]' : 'bg-[#DADCE0]'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                        draftStartActive ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </label>
              </div>
            </>
          )}
        </div>

        {/* Clean Google Dialog Footer */}
        <div className="px-6 py-3.5 border-t border-[#F1F3F4] bg-white flex items-center justify-between gap-3">
          {step === 0 ? (
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-3 rounded-lg text-xs font-medium text-[#5F6368] hover:text-[#202124] hover:bg-[#F1F3F4] transition-colors cursor-pointer"
            >
              Skip for now
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep(0)}
              className="h-9 px-3 rounded-lg text-xs font-medium text-[#5F6368] hover:text-[#202124] hover:bg-[#F1F3F4] flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Retour</span>
            </button>
          )}

          {step === 0 ? (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="h-9 px-4 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Suivant</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              disabled={isSaving}
              className="h-9 px-5 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <span>{isSaving ? 'Enregistrement...' : 'Enregistrer la configuration'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
