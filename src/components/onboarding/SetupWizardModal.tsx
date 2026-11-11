import React, { useState, useEffect } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Switch } from '@astryxdesign/core/Switch';
import { TextInput } from '@astryxdesign/core/TextInput';
import { AgentSettings, ToneType, PersonaHooks } from '@/packages/types/src/database.ts';
import { Check, ChevronRight, ChevronLeft } from 'lucide-react';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

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
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && onClose) onClose();
      }}
      width={520}
      padding={0}
    >
      <div className="bg-white flex flex-col overflow-hidden">
        <div className="px-6 pt-4">
          <ProgressBar
            label="Progression de la configuration"
            value={step === 0 ? 50 : 100}
            max={100}
            variant="accent"
            isLabelHidden
          />
        </div>

        <div className="px-6 pt-3">
          <DialogHeader
            title={step === 0 ? 'Votre profil et les machines' : 'Cantons et rythme des envois'}
            subtitle={`Étape ${step + 1} sur 2 · Configuration JimiScout`}
            onOpenChange={(open) => {
              if (!open && onClose) onClose();
            }}
          />
        </div>

        {/* Body */}
        <div className="px-6 py-3 space-y-4 overflow-y-auto max-h-[70vh]">
          {step === 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TextInput
                  label="Sender name"
                  value={draftName}
                  onChange={setDraftName}
                  placeholder="Ex. Jamal"
                  hasAutoFocus
                />

                <TextInput
                  label="Direct phone / WhatsApp"
                  type="tel"
                  value={draftPhone}
                  onChange={setDraftPhone}
                  placeholder="+41 79 123 45 67"
                />
              </div>

              <TextInput
                label="Adresse courriel de réponse"
                type="email"
                value={draftEmail}
                onChange={setDraftEmail}
                placeholder="info@jimyexport.ch"
              />

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
                    Cantons suisses actifs ({draftCantons.length})
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
                    Limite de courriels par jour
                  </label>
                  <SegmentedControl
                    label="Limite de courriels par jour"
                    size="sm"
                    value={String(draftLimit)}
                    onChange={(val) => setDraftLimit(Number(val))}
                  >
                    {[15, 25, 35, 50].map((val) => (
                      <SegmentedControlItem
                        key={val}
                        value={String(val)}
                        label={`${val}/j`}
                      />
                    ))}
                  </SegmentedControl>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#3C4043] mb-1.5">
                    Ton des courriels
                  </label>
                  <SegmentedControl
                    label="Ton des courriels"
                    size="sm"
                    value={draftTone}
                    onChange={(val) => setDraftTone(val as ToneType)}
                  >
                    <SegmentedControlItem value="swiss_formal" label="Formel" />
                    <SegmentedControlItem value="approachable_trade" label="Direct" />
                    <SegmentedControlItem value="fast_cash" label="Rapide" />
                  </SegmentedControl>
                </div>
              </div>

              {/* Clean Auto-Dispatch Toggle */}
              <div className="pt-3 border-t border-[#F1F3F4]">
                <div className="flex items-center justify-between gap-3 py-1">
                  <div>
                    <div className="text-xs font-medium text-[#202124]">
                      Activer l’envoi automatique
                    </div>
                    <div className="text-[11px] text-[#5F6368]">
                      Envoie du lundi au vendredi pendant les heures suisses (08:30–17:00)
                    </div>
                  </div>
                  <Switch
                    label="Activer l’envoi automatique"
                    isLabelHidden
                    value={draftStartActive}
                    onChange={setDraftStartActive}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Clean Dialog Footer */}
        <div className="px-6 py-3.5 border-t border-[#F1F3F4] bg-white flex items-center justify-between gap-3">
          {step === 0 ? (
            <Button
              label="Passer pour l’instant"
              variant="ghost"
              size="sm"
              onClick={onClose}
            />
          ) : (
            <Button
              label="Retour"
              variant="ghost"
              size="sm"
              icon={<ChevronLeft className="w-3.5 h-3.5" />}
              onClick={() => setStep(0)}
            />
          )}

          {step === 0 ? (
            <Button
              label="Suivant"
              variant="primary"
              size="sm"
              onClick={() => setStep(1)}
            />
          ) : (
            <Button
              label="Enregistrer la configuration"
              variant="primary"
              size="sm"
              isLoading={isSaving}
              onClick={() => void handleFinish()}
            />
          )}
        </div>
      </div>
    </Dialog>
  );
};
