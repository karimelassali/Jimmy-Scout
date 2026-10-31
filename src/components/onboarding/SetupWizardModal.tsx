import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AgentSettings, ToneType, PersonaHooks } from '@/packages/types/src/database.ts';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Check,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Truck,
  MessageSquare,
  Zap,
  ShieldCheck,
  Play,
  Plus,
  X,
} from 'lucide-react';

export interface SetupWizardModalProps {
  isOpen: boolean;
  settings: AgentSettings;
  onSaveAndComplete: (patch: Partial<AgentSettings>) => Promise<void>;
  onClose?: () => void;
}

interface CantonOption {
  code: string;
  name: string;
  langLabel: string;
  regionGroup: 'fr' | 'de' | 'it';
  desc: string;
}

const SWISS_CANTON_OPTIONS: CantonOption[] = [
  { code: 'VD', name: 'Vaud', langLabel: 'Français', regionGroup: 'fr', desc: 'Lausanne & Région' },
  { code: 'GE', name: 'Genève', langLabel: 'Français', regionGroup: 'fr', desc: 'Bassin genevois' },
  { code: 'VS', name: 'Valais', langLabel: 'Français', regionGroup: 'fr', desc: 'Sion, Martigny & Alpes' },
  { code: 'FR', name: 'Fribourg', langLabel: 'Français', regionGroup: 'fr', desc: 'Bulle & Romandie' },
  { code: 'NE', name: 'Neuchâtel', langLabel: 'Français', regionGroup: 'fr', desc: 'Arc jurassien' },
  { code: 'BE', name: 'Berne', langLabel: 'Allemand / FR', regionGroup: 'de', desc: 'Berne, Bienne & Mittelland' },
  { code: 'ZH', name: 'Zurich', langLabel: 'Allemand', regionGroup: 'de', desc: 'Grand Zurich & Winterthour' },
  { code: 'AG', name: 'Argovie', langLabel: 'Allemand', regionGroup: 'de', desc: 'Aarau & Baden' },
  { code: 'SG', name: 'Saint-Gall', langLabel: 'Allemand', regionGroup: 'de', desc: 'Suisse orientale' },
  { code: 'LU', name: 'Lucerne', langLabel: 'Allemand', regionGroup: 'de', desc: 'Suisse centrale' },
  { code: 'ZG', name: 'Zoug', langLabel: 'Allemand', regionGroup: 'de', desc: 'Zoug & environs' },
  { code: 'TI', name: 'Tessin', langLabel: 'Italien', regionGroup: 'it', desc: 'Lugano & Bellinzone' },
];

const QUICK_MACHINES = [
  'Pelles sur chenilles 15–30t',
  'Camions benne 4 essieux',
  'Chargeuses sur pneus',
  'Concasseurs mobiles',
  'Mini-pelles 2–8t',
  'Bulldozers & Niveleuses',
  'Tombereaux articulés',
];

export const SetupWizardModal: React.FC<SetupWizardModalProps> = ({
  isOpen,
  settings,
  onSaveAndComplete,
  onClose,
}) => {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  // Form states initialized from current settings
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
  const [draftHooks, setDraftHooks] = useState<PersonaHooks>(
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

  // Sync when settings load from server
  useEffect(() => {
    if (isOpen) {
      setDraftName(settings.sender_name || '');
      setDraftEmail(settings.sender_email || '');
      setDraftPhone(settings.sender_phone || '+41 ');
      if (settings.equipment_focus) setDraftFocus(settings.equipment_focus);
      if (settings.selected_cantons?.length > 0) setDraftCantons(settings.selected_cantons);
      if (settings.tone) setDraftTone(settings.tone);
      if (settings.hooks) setDraftHooks(settings.hooks);
      if (settings.daily_limit) setDraftLimit(settings.daily_limit);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const displayName = draftName.trim() || 'Cher partenaire';
  const hasCustomName = draftName.trim().length > 0;

  const totalSteps = 5;

  const goNext = () => {
    if (step < totalSteps - 1) {
      setDirection(1);
      setStep((s) => s + 1);
    }
  };

  const goPrev = () => {
    if (step > 0) {
      setDirection(-1);
      setStep((s) => s - 1);
    }
  };

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
    setDraftCantons((prev) => Array.from(new Set([...prev, ...codes])));
  };

  const toggleQuickMachine = (item: string) => {
    const currentLower = draftFocus.toLowerCase();
    if (currentLower.includes(item.toLowerCase())) {
      // Remove item cleanly
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

  // Dynamic conversational message from Jimy following the user at every step
  const getJimySpeech = (): { title: string; message: string } => {
    switch (step) {
      case 0:
        if (!hasCustomName) {
          return {
            title: 'Bonjour ! Moi c’est Jimy 👋',
            message:
              'Je suis votre assistant personnel en Suisse. Je vais chercher des machines de chantier pour vous tous les jours. Comment vous appelez-vous ?',
          };
        }
        return {
          title: `Enchanté ${displayName} ! 🤝`,
          message: `C’est un plaisir de faire équipe avec vous, ${displayName}. Tous les messages que j’enverrai aux entreprises suisses seront signés à votre nom.`,
        };
      case 1:
        return {
          title: `Parfait ${displayName}, parlons de vos machines 🚜`,
          message: `Sur quel numéro les vendeurs peuvent-ils vous appeler directement, et quels engins souhaitez-vous acheter en priorité ?`,
        };
      case 2:
        return {
          title: `Où cherchons-nous en Suisse, ${displayName} ? 🇨🇭`,
          message:
            draftCantons.length > 0
              ? `Super ! J’ai noté ${draftCantons.length} canton${
                  draftCantons.length > 1 ? 's' : ''
                } (${draftCantons.join(', ')}). Je leur écrirai tout seul en français, en allemand ou en italien selon la ville !`
              : `Touchez les cantons suisses où vous voulez trouver des machines, ${displayName}.`,
        };
      case 3:
        return {
          title: `Votre style et votre rythme, ${displayName} ⚡`,
          message: `J’enverrai jusqu’à ${draftLimit} messages par jour pour vous. Choisissez comment vous préférez que je m’adresse aux patrons d’entreprises.`,
        };
      case 4:
      default:
        return {
          title: `Tout est prêt pour vous, ${displayName} ! 🎉`,
          message: `J’ai bien enregistré toutes vos préférences. Dès que vous ouvrez votre espace, je reste à vos côtés pour suivre chaque réponse de vendeur.`,
        };
    }
  };

  const jimySpeech = getJimySpeech();

  const stepLabels = [
    '1. Votre nom',
    '2. Vos machines',
    '3. Vos régions',
    '4. Votre rythme',
    '5. C’est prêt !',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/65 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200/90 overflow-hidden my-auto flex flex-col max-h-[94vh]"
      >
        {/* Top Progress Header */}
        <div className="px-6 pt-5 pb-3 bg-white border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2.5">
              <img
                src="/assets/jimiscout-logo.png"
                alt="JimiScout"
                className="h-8 w-auto object-contain"
              />
              <span className="h-4 w-px bg-slate-200" />
              <span className="text-xs font-bold text-[#FF6B00] bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-200/70">
                Configuration personnalisée
              </span>
            </div>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                title="Fermer"
              >
                <span>Passer</span>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Step Pills & Animated Progress Bar */}
          <div className="grid grid-cols-5 gap-1.5">
            {stepLabels.map((label, idx) => {
              const isCompleted = idx < step;
              const isCurrent = idx === step;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setDirection(idx > step ? 1 : -1);
                    setStep(idx);
                  }}
                  className="text-left group cursor-pointer focus:outline-none"
                >
                  <div className="h-1.5 w-full rounded-full overflow-hidden bg-slate-100 mb-1.5">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isCompleted
                          ? 'w-full bg-emerald-500'
                          : isCurrent
                          ? 'w-full bg-[#FF6B00]'
                          : 'w-0 bg-transparent'
                      }`}
                    />
                  </div>
                  <span
                    className={`hidden sm:block text-[11px] truncate transition-colors ${
                      isCurrent
                        ? 'font-bold text-[#0B2240]'
                        : isCompleted
                        ? 'font-semibold text-emerald-600'
                        : 'font-medium text-slate-400 group-hover:text-slate-600'
                    }`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Animated "Jimy Companion" Speech Banner */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#0B2240] via-[#122E54] to-[#0B2240] text-white shrink-0 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-[#FF6B00]/15 blur-2xl pointer-events-none" />
          <div className="flex items-center gap-4 relative z-10">
            {/* Jimy Animated Avatar */}
            <div className="relative shrink-0">
              <div className="w-14 h-14 rounded-2xl bg-white p-1.5 shadow-md flex items-center justify-center border-2 border-[#FF6B00]">
                <img
                  src="/assets/illustrations/Working%20late.gif"
                  alt="Jimy votre assistant"
                  className="w-full h-full object-contain"
                />
              </div>
              <span
                className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#0B2240] flex items-center justify-center"
                title="Jimy est en ligne avec vous"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              </span>
            </div>

            {/* Live Reactive Speech Bubble */}
            <motion.div
              key={`${step}-${hasCustomName}-${draftCantons.length}-${draftLimit}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-1 min-w-0"
            >
              <div className="flex items-center gap-2">
                <span className="font-heading font-bold text-sm sm:text-base text-white">
                  {jimySpeech.title}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed mt-0.5">
                {jimySpeech.message}
              </p>
            </motion.div>
          </div>
        </div>

        {/* Animated Step Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-7 bg-[#F8FAFC]">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              initial={{ opacity: 0, x: direction > 0 ? 28 : -28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction > 0 ? -28 : 28 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="space-y-5"
            >
              {/* STEP 0: NAME & EMAIL */}
              {step === 0 && (
                <div className="space-y-5">
                  <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-4">
                    <div>
                      <label className="block font-heading font-bold text-sm text-[#0B2240] mb-1.5">
                        1. Comment vous appelez-vous ?
                      </label>
                      <p className="text-xs text-slate-500 mb-3">
                        Jimy utilisera votre prénom ou votre nom pour signer chaque message envoyé aux vendeurs.
                      </p>
                      <div className="relative flex items-center">
                        <User className="w-4 h-4 text-[#FF6B00] absolute left-3.5 pointer-events-none" />
                        <input
                          type="text"
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          placeholder="Votre prénom ou nom (ex: Jamal, Karim...)"
                          autoFocus
                          className="w-full h-12 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-[#0B2240] focus:bg-white focus:outline-none focus:border-[#FF6B00] transition-colors"
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <label className="block font-heading font-bold text-sm text-[#0B2240] mb-1.5">
                        2. Votre adresse e-mail professionnelle
                      </label>
                      <p className="text-xs text-slate-500 mb-3">
                        L’adresse où les entreprises suisses vous enverront leurs photos et leurs offres de machines.
                      </p>
                      <div className="relative flex items-center">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                        <input
                          type="email"
                          value={draftEmail}
                          onChange={(e) => setDraftEmail(e.target.value)}
                          placeholder="Ex: info@jimyexport.ch"
                          className="w-full h-12 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-[#0B2240] focus:bg-white focus:outline-none focus:border-[#0B2240] transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Live Signature Preview */}
                  <div className="bg-orange-50/70 rounded-2xl p-4 border border-orange-200/80 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <img
                        src="/assets/jimy-export-avatar.jpg"
                        alt="Avatar"
                        className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-xs shrink-0"
                      />
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-[#FF6B00]">
                          Signature de vos messages
                        </div>
                        <div className="font-heading font-bold text-sm text-[#0B2240]">
                          {displayName} · Achat &amp; Négoce Machines
                        </div>
                        <div className="text-xs text-slate-600">
                          {draftEmail || 'info@jimyexport.ch'}
                        </div>
                      </div>
                    </div>
                    <Sparkles className="w-5 h-5 text-[#FF6B00] shrink-0 hidden sm:block" />
                  </div>
                </div>
              )}

              {/* STEP 1: PHONE & MACHINERY */}
              {step === 1 && (
                <div className="space-y-5">
                  <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-4">
                    <div>
                      <label className="block font-heading font-bold text-sm text-[#0B2240] mb-1">
                        1. Votre numéro de téléphone direct
                      </label>
                      <p className="text-xs text-slate-500 mb-3">
                        Les chefs de chantier et vendeurs pourront vous appeler ou vous écrire sur WhatsApp à ce numéro.
                      </p>
                      <div className="relative flex items-center">
                        <Phone className="w-4 h-4 text-[#FF6B00] absolute left-3.5 pointer-events-none" />
                        <input
                          type="tel"
                          value={draftPhone}
                          onChange={(e) => setDraftPhone(e.target.value)}
                          placeholder="+41 79 123 45 67"
                          className="w-full h-12 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-[#0B2240] focus:bg-white focus:outline-none focus:border-[#FF6B00] transition-colors"
                        />
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100">
                      <label className="block font-heading font-bold text-sm text-[#0B2240] mb-1">
                        2. Quelles machines cherchez-vous à acheter ?
                      </label>
                      <p className="text-xs text-slate-500 mb-3">
                        Touchez les boutons ci-dessous pour ajouter ou retirer des machines, ou écrivez directement votre liste :
                      </p>

                      {/* Quick Select Machine Chips */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {QUICK_MACHINES.map((item) => {
                          const isSelected = draftFocus
                            .toLowerCase()
                            .includes(item.toLowerCase());
                          return (
                            <button
                              key={item}
                              type="button"
                              onClick={() => toggleQuickMachine(item)}
                              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                                isSelected
                                  ? 'bg-[#FF6B00] text-white border-[#FF6B00] shadow-2xs'
                                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              {isSelected ? (
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              ) : (
                                <Plus className="w-3.5 h-3.5 text-slate-400" />
                              )}
                              <span>{item}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="relative">
                        <textarea
                          rows={2}
                          value={draftFocus}
                          onChange={(e) => setDraftFocus(e.target.value)}
                          placeholder="Ex: Pelles sur chenilles 15–30t, camions benne 4 essieux, chargeuses..."
                          className="w-full p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-[#0B2240] focus:bg-white focus:outline-none focus:border-[#0B2240] transition-colors leading-relaxed"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: SWISS CANTONS */}
              {step === 2 && (
                <div className="space-y-4">
                  {/* Quick Region Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-3 rounded-2xl border border-slate-200/80">
                    <span className="text-xs font-bold text-[#0B2240] px-1">
                      Sélection rapide :
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => selectRegionGroup('all')}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#0B2240] text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Toute la Suisse (12)
                      </button>
                      <button
                        type="button"
                        onClick={() => selectRegionGroup('fr')}
                        className="px-2.5 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-[#FF6B00] text-xs font-semibold transition-colors cursor-pointer"
                      >
                        + Suisse Romande (FR)
                      </button>
                      <button
                        type="button"
                        onClick={() => selectRegionGroup('de')}
                        className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#1A73E8] text-xs font-semibold transition-colors cursor-pointer"
                      >
                        + Suisse Alémanique (DE)
                      </button>
                      <button
                        type="button"
                        onClick={() => setDraftCantons([])}
                        className="px-2.5 py-1 rounded-lg text-slate-500 hover:bg-slate-100 text-xs font-medium transition-colors cursor-pointer"
                      >
                        Tout décocher
                      </button>
                    </div>
                  </div>

                  {/* Canton Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {SWISS_CANTON_OPTIONS.map((canton) => {
                      const isSelected = draftCantons.includes(canton.code);
                      return (
                        <button
                          key={canton.code}
                          type="button"
                          onClick={() => toggleCanton(canton.code)}
                          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start justify-between gap-2 ${
                            isSelected
                              ? 'bg-white border-2 border-[#FF6B00] shadow-xs'
                              : 'bg-white/70 border-slate-200/80 hover:bg-white hover:border-slate-300 opacity-75'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-heading font-extrabold text-sm text-[#0B2240]">
                                {canton.name}
                              </span>
                              <span className="text-[11px] font-mono font-bold text-[#FF6B00]">
                                {canton.code}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 truncate mt-0.5">
                              {canton.desc}
                            </div>
                            <span className="inline-block mt-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium text-[10px]">
                              {canton.langLabel}
                            </span>
                          </div>

                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                              isSelected
                                ? 'bg-[#FF6B00] text-white'
                                : 'border border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 3: TONE, GUARANTEES & DAILY SPEED */}
              {step === 3 && (
                <div className="space-y-4">
                  {/* Tone Choice */}
                  <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-3">
                    <label className="block font-heading font-bold text-sm text-[#0B2240]">
                      1. Comment voulez-vous que Jimy parle aux vendeurs ?
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {(
                        [
                          {
                            id: 'swiss_formal',
                            title: 'Sérieux & Formel',
                            badge: 'Conseillé',
                            desc: 'Poli, respectueux et très professionnel.',
                          },
                          {
                            id: 'approachable_trade',
                            title: 'Direct & Terrain',
                            badge: 'Simple',
                            desc: 'Chaleureux, d’acheteur à entrepreneur.',
                          },
                          {
                            id: 'fast_cash',
                            title: 'Achat Rapide',
                            badge: 'Cash',
                            desc: 'Court : insiste sur le paiement immédiat.',
                          },
                        ] as const
                      ).map((t) => {
                        const active = draftTone === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setDraftTone(t.id)}
                            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                              active
                                ? 'border-2 border-[#0B2240] bg-slate-50/70'
                                : 'border-slate-200 hover:border-slate-300 bg-white'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className="font-heading font-bold text-xs text-[#0B2240]">
                                  {t.title}
                                </span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                    active
                                      ? 'bg-[#FF6B00] text-white'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {t.badge}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 leading-snug">
                                {t.desc}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Buyer Guarantees */}
                  <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-2.5">
                    <label className="block font-heading font-bold text-sm text-[#0B2240]">
                      2. Vos arguments rassurants dans chaque message
                    </label>
                    {(
                      [
                        {
                          key: 'cash_settlement',
                          label: 'Paiement comptant / virement garanti avant enlèvement',
                        },
                        {
                          key: 'transport_covered',
                          label: 'Vous prenez en charge tout le transport et le camion',
                        },
                        {
                          key: 'as_is',
                          label: 'Achat ferme en l’état, sans garantie demandée au vendeur',
                        },
                      ] as const
                    ).map((item) => {
                      const checked = draftHooks[item.key];
                      return (
                        <div
                          key={item.key}
                          onClick={() =>
                            setDraftHooks((prev) => ({
                              ...prev,
                              [item.key]: !prev[item.key],
                            }))
                          }
                          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/70 cursor-pointer transition-colors"
                        >
                          <span className="text-xs font-medium text-[#0B2240]">
                            {item.label}
                          </span>
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                              checked
                                ? 'bg-[#FF6B00] text-white'
                                : 'bg-white border border-slate-300'
                            }`}
                          >
                            {checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Daily Speed Limit */}
                  <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="font-heading font-bold text-sm text-[#0B2240]">
                        3. Combien d’entreprises contacter par jour ?
                      </label>
                      <span className="px-3 py-1 rounded-full bg-orange-50 text-[#FF6B00] font-mono font-bold text-xs border border-orange-200">
                        {draftLimit} entreprises / jour
                      </span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={50}
                      step={5}
                      value={draftLimit}
                      onChange={(e) => setDraftLimit(Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#FF6B00]"
                    />
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>10 / jour (Doux)</span>
                      <span>25 / jour (Conseillé)</span>
                      <span>50 / jour (Rapide)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: SUMMARY & LAUNCH */}
              {step === 4 && (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                          Configuration prête
                        </span>
                        <h3 className="font-heading font-bold text-lg text-[#0B2240]">
                          Résumé pour {displayName}
                        </h3>
                      </div>
                      <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 space-y-1">
                        <span className="text-slate-400 font-medium">Votre identité</span>
                        <div className="font-heading font-bold text-sm text-[#0B2240]">
                          {displayName}
                        </div>
                        <div className="text-slate-600">{draftPhone}</div>
                        <div className="text-slate-500 truncate">{draftEmail}</div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 space-y-1">
                        <span className="text-slate-400 font-medium">Rythme &amp; Régions</span>
                        <div className="font-heading font-bold text-sm text-[#FF6B00]">
                          {draftLimit} entreprises / jour
                        </div>
                        <div className="text-slate-600">
                          {draftCantons.length} cantons : {draftCantons.join(', ')}
                        </div>
                      </div>

                      <div className="sm:col-span-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 space-y-1">
                        <span className="text-slate-400 font-medium">
                          Machines que Jimy demande pour vous
                        </span>
                        <div className="font-medium text-[#0B2240] leading-relaxed">
                          {draftFocus}
                        </div>
                      </div>
                    </div>

                    {/* Start Jimy Toggle */}
                    <div
                      onClick={() => setDraftStartActive(!draftStartActive)}
                      className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-4 ${
                        draftStartActive
                          ? 'bg-emerald-50/60 border-emerald-500'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            draftStartActive
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          <Play className="w-4 h-4 fill-current" />
                        </div>
                        <div>
                          <div className="font-heading font-bold text-sm text-[#0B2240]">
                            Activer Jimy dès maintenant
                          </div>
                          <div className="text-xs text-slate-600">
                            Jimy travaille du lundi au vendredi (8h30 – 17h00) et vous prévient dès qu’un vendeur répond.
                          </div>
                        </div>
                      </div>

                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                          draftStartActive
                            ? 'bg-emerald-500 text-white'
                            : 'border-2 border-slate-300 bg-white'
                        }`}
                      >
                        {draftStartActive && <Check className="w-4 h-4 stroke-[3]" />}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Navigation Buttons (Previous / Next) */}
        <div className="px-6 py-4 bg-white border-t border-slate-200/90 flex items-center justify-between gap-3 shrink-0">
          {step > 0 ? (
            <button
              type="button"
              onClick={goPrev}
              className="h-11 px-5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-[#0B2240] font-heading font-semibold text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Retour</span>
            </button>
          ) : (
            <div className="text-xs text-slate-400 font-medium">
              Étape 1 sur {totalSteps}
            </div>
          )}

          {step < totalSteps - 1 ? (
            <button
              type="button"
              onClick={goNext}
              className="h-11 px-6 rounded-xl bg-[#FF6B00] hover:bg-[#E05E00] text-white font-heading font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md shadow-orange-500/20 cursor-pointer"
            >
              <span>Continuer avec Jimy</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              disabled={isSaving}
              className="h-12 px-7 rounded-xl bg-[#FF6B00] hover:bg-[#E05E00] text-white font-heading font-bold text-sm flex items-center gap-2.5 transition-all shadow-lg shadow-orange-500/25 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {isSaving
                  ? 'Préparation de votre espace...'
                  : `Ouvrir l’espace de ${displayName}`}
              </span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
