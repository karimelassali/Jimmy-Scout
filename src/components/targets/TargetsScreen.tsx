import React, { useState } from 'react';
import { AgentSettings, Company } from '@/packages/types/src/database.ts';
import {
  Search,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Check,
  X,
  Plus,
  Trash2,
  Building2,
  Camera,
  MapPin,
} from 'lucide-react';

interface TargetsScreenProps {
  settings: AgentSettings;
  companies: Company[];
  onUpdateSettings: (patch: Partial<AgentSettings>) => Promise<void>;
  onRefreshCompanies: () => Promise<void>;
  onNavigateToScanner?: () => void;
}

interface CantonMeta {
  code: string;
  name: string;
  region: 'Romandie (FR)' | 'Deutschschweiz (DE)' | 'Ticino (IT)';
  language: 'fr' | 'de' | 'it';
  plz: string;
  primarySector: string;
}

const SWISS_CANTONS: CantonMeta[] = [
  {
    code: 'ZH',
    name: 'Zürich',
    region: 'Deutschschweiz (DE)',
    language: 'de',
    plz: '8000',
    primarySector: 'Tiefbau & Heavy Earthworks',
  },
  {
    code: 'VD',
    name: 'Vaud',
    region: 'Romandie (FR)',
    language: 'fr',
    plz: '1000',
    primarySector: 'Demolition & Mobile Crushing',
  },
  {
    code: 'BE',
    name: 'Bern',
    region: 'Deutschschweiz (DE)',
    language: 'de',
    plz: '3000',
    primarySector: 'Kieswerk & Mineral Quarries',
  },
  {
    code: 'GE',
    name: 'Genève',
    region: 'Romandie (FR)',
    language: 'fr',
    plz: '1200',
    primarySector: 'Urban Civil Engineering',
  },
  {
    code: 'TI',
    name: 'Ticino',
    region: 'Ticino (IT)',
    language: 'it',
    plz: '6900',
    primarySector: 'Genio Civile & Stone Quarries',
  },
  {
    code: 'VS',
    name: 'Valais',
    region: 'Romandie (FR)',
    language: 'fr',
    plz: '1950',
    primarySector: 'Alpine Earthworks & Tunneling',
  },
  {
    code: 'AG',
    name: 'Aargau',
    region: 'Deutschschweiz (DE)',
    language: 'de',
    plz: '5000',
    primarySector: 'Kieswerk & Highway Grading',
  },
  {
    code: 'SG',
    name: 'St. Gallen',
    region: 'Deutschschweiz (DE)',
    language: 'de',
    plz: '9000',
    primarySector: 'Tiefbau Rheintal',
  },
  {
    code: 'LU',
    name: 'Luzern',
    region: 'Deutschschweiz (DE)',
    language: 'de',
    plz: '6000',
    primarySector: 'Road Construction & Civil Works',
  },
  {
    code: 'FR',
    name: 'Fribourg',
    region: 'Romandie (FR)',
    language: 'fr',
    plz: '1700',
    primarySector: 'Civil Engineering & Gravel Pits',
  },
  {
    code: 'NE',
    name: 'Neuchâtel',
    region: 'Romandie (FR)',
    language: 'fr',
    plz: '2000',
    primarySector: 'Jura Earthmoving & Trenching',
  },
  {
    code: 'ZG',
    name: 'Zug',
    region: 'Deutschschweiz (DE)',
    language: 'de',
    plz: '6300',
    primarySector: 'Commercial Infrastructure',
  },
];

export const TargetsScreen: React.FC<TargetsScreenProps> = ({
  settings,
  companies,
  onUpdateSettings,
  onRefreshCompanies,
  onNavigateToScanner,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [regionFilter, setRegionFilter] = useState<'all' | 'de' | 'fr' | 'it'>('all');
  const [selectedCantonCode, setSelectedCantonCode] = useState('ZH');
  const [dailyPace, setDailyPace] = useState(settings.daily_limit);
  const [toast, setToast] = useState<{ msg: string; isError?: boolean } | null>(null);

  // Add Contractor Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCompName, setNewCompName] = useState('');
  const [newCompEmail, setNewCompEmail] = useState('');
  const [newCompPhone, setNewCompPhone] = useState('');
  const [newCompCanton, setNewCompCanton] = useState('ZH');
  const [newCompIndustry, setNewCompIndustry] = useState('civil_engineering');
  const [isSavingComp, setIsSavingComp] = useState(false);

  // Delete Company Confirmation State
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [isDeletingComp, setIsDeletingComp] = useState(false);

  const showToast = (msg: string, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3500);
  };

  const handleToggleCanton = async (code: string) => {
    let next: string[];
    if (settings.selected_cantons.includes(code)) {
      if (settings.selected_cantons.length <= 1) {
        showToast('At least one canton must remain active.', true);
        return;
      }
      next = settings.selected_cantons.filter((c) => c !== code);
    } else {
      next = [...settings.selected_cantons, code];
    }
    await onUpdateSettings({ selected_cantons: next });
    showToast(
      `Region ${code} ${next.includes(code) ? 'turned on' : 'turned off'}`
    );
  };

  const handlePaceChange = async (newVal: number) => {
    setDailyPace(newVal);
    await onUpdateSettings({ daily_limit: newVal });
  };

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompName.trim() || !newCompEmail.trim()) {
      showToast('Company name and email are required.', true);
      return;
    }

    setIsSavingComp(true);
    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCompName.trim(),
          email: newCompEmail.trim(),
          phone: newCompPhone.trim() || null,
          canton: newCompCanton,
          industry: newCompIndustry,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to add company', true);
      } else {
        await onRefreshCompanies();
        setSelectedCantonCode(newCompCanton);
        setNewCompName('');
        setNewCompEmail('');
        setNewCompPhone('');
        setShowAddModal(false);
        showToast(`Saved ${data.name} (${data.canton}) to your company list`);
      }
    } catch (err: any) {
      showToast(`Error: ${err?.message}`, true);
    } finally {
      setIsSavingComp(false);
    }
  };

  const handleConfirmDeleteCompany = async () => {
    if (!companyToDelete) return;
    setIsDeletingComp(true);
    try {
      await fetch(`/api/companies/${companyToDelete.id}`, { method: 'DELETE' });
      await onRefreshCompanies();
      showToast(`Removed ${companyToDelete.name} from company list`);
      setCompanyToDelete(null);
    } catch {
      showToast('Failed to delete company', true);
    } finally {
      setIsDeletingComp(false);
    }
  };

  const selectedCantonMeta =
    SWISS_CANTONS.find((c) => c.code === selectedCantonCode) || SWISS_CANTONS[0];

  const contractorsInSelectedCanton = companies.filter(
    (c) => c.canton.toUpperCase() === selectedCantonMeta.code
  );

  const activeContractorsTotal = companies.filter(
    (c) => settings.selected_cantons.includes(c.canton) && !c.unsubscribed
  ).length;

  const filteredCantons = SWISS_CANTONS.filter((c) => {
    if (regionFilter !== 'all' && c.language !== regionFilter) return false;
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.plz.includes(q) ||
      c.primarySector.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5 pb-24 md:pb-12 pt-2">
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

      {/* Clean Single-Row Orange-Themed Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-[#0B2240] tracking-tight">
            Swiss Regions &amp; Company List
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Select active cantons, manage construction companies, and adjust your daily email speed.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center gap-2 bg-white px-3.5 py-2 rounded-full border border-slate-200 text-xs font-medium shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#FF6B00]" />
            <strong className="text-[#0B2240]">{settings.selected_cantons.length} regions active</strong>
            <span className="text-slate-300">·</span>
            <strong className="text-[#FF6B00]">{activeContractorsTotal} companies ready</strong>
          </div>

          {onNavigateToScanner && (
            <button
              type="button"
              onClick={onNavigateToScanner}
              className="h-10 px-4 rounded-full bg-white hover:bg-slate-50 border border-slate-200 hover:border-[#0B2240] text-[#0B2240] font-heading font-semibold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-2xs"
            >
              <Camera className="w-4 h-4 text-[#FF6B00]" />
              <span>Scan Business Cards</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setNewCompCanton(selectedCantonCode);
              setShowAddModal(true);
            }}
            className="h-10 px-5 rounded-full bg-[#FF6B00] hover:bg-[#E05E00] text-white font-heading font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Company</span>
          </button>
        </div>
      </div>

      {/* COMPACT ORANGE-THEMED DAILY SPEED LIMIT BAR */}
      <section className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200/80 text-[#FF6B00] flex items-center justify-center shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading font-bold text-base text-[#0B2240]">
                  Daily Speed Limit
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-[#FF6B00] font-mono font-bold text-xs">
                  {dailyPace} emails / day
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Sent automatically Monday–Friday (8:30 AM – 5:00 PM Swiss time)
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1 max-w-xl">
            <div className="flex-1 space-y-1.5">
              <input
                type="range"
                min="10"
                max="50"
                step="1"
                value={dailyPace}
                onChange={(e) => handlePaceChange(Number(e.target.value))}
                className="w-full accent-[#FF6B00] cursor-pointer h-2 bg-slate-200 rounded-full"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>10 / day (Gentle)</span>
                <span>25 / day (Recommended)</span>
                <span>50 / day (Fast)</span>
              </div>
            </div>

            <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 self-start sm:self-center">
              {[15, 25, 35, 50].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePaceChange(preset)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    dailyPace === preset
                      ? 'bg-[#FF6B00] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-[#0B2240]'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Search & Language Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md flex items-center bg-white rounded-full border border-slate-200 px-4 h-11 focus-within:border-[#FF6B00] transition-all">
          <Search className="w-4 h-4 text-slate-400 mr-3 shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search canton (Zürich, Vaud, Bern, TI) or postal code..."
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

        {/* Clean Language Filter Pills */}
        <div className="w-full md:w-auto overflow-x-auto no-scrollbar py-0.5 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="inline-flex items-center p-1 bg-white rounded-full border border-slate-200 shrink-0 min-w-max shadow-2xs">
            {(
              [
                { id: 'all', label: `All Regions (${SWISS_CANTONS.length})` },
                { id: 'de', label: 'German (DE)' },
                { id: 'fr', label: 'French (FR)' },
                { id: 'it', label: 'Italian (IT)' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setRegionFilter(tab.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  regionFilter === tab.id
                    ? 'bg-[#0B2240] text-white'
                    : 'text-slate-600 hover:text-[#0B2240]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2-COLUMN WORKSPACE: Cantons Grid + Regional Contractor Dossier */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 Columns: Clean Orange-Themed Canton Cards (No fake avatar circles) */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5" data-tour="canton-selection">
          {filteredCantons.map((canton) => {
            const isSelected = settings.selected_cantons.includes(canton.code);
            const isFocused = selectedCantonCode === canton.code;
            const cantonCompanies = companies.filter((c) => c.canton === canton.code);
            const cantonEligible = cantonCompanies.filter((c) => !c.unsubscribed).length;

            return (
              <div
                key={canton.code}
                onClick={() => setSelectedCantonCode(canton.code)}
                className={`rounded-2xl p-4 transition-all cursor-pointer flex flex-col justify-between space-y-3.5 ${
                  isFocused
                    ? 'bg-white border-2 border-[#FF6B00] ring-3 ring-[#FF6B00]/15 shadow-sm'
                    : isSelected
                    ? 'bg-white border border-slate-200 hover:border-orange-300 shadow-2xs'
                    : 'bg-slate-50/70 border border-slate-200/70 opacity-75 hover:opacity-100 hover:bg-white'
                }`}
              >
                {/* Top Row: Full Canton Name + Code Pill + Orange Active Checkbox */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-bold text-lg text-[#0B2240] leading-tight">
                        {canton.name}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono font-bold text-[11px]">
                        {canton.code}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                      <span className="font-semibold text-slate-600">
                        {canton.language.toUpperCase()}
                      </span>
                      <span>·</span>
                      <span className="tabular-nums">PLZ {canton.plz}</span>
                    </div>
                  </div>

                  {/* Orange Toggle Pill */}
                  <button
                    type="button"
                    aria-label={`Toggle Canton ${canton.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleCanton(canton.code);
                    }}
                    className={`h-7 px-2.5 rounded-full text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                      isSelected
                        ? 'bg-[#FF6B00] text-white shadow-2xs'
                        : 'bg-white text-slate-500 border border-slate-200 hover:border-[#0B2240] hover:text-[#0B2240]'
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>Active</span>
                      </>
                    ) : (
                      <span>Off</span>
                    )}
                  </button>
                </div>

                {/* Bottom Row: Sector & Company Count Badge */}
                <div className="pt-2.5 border-t border-slate-100 space-y-1.5">
                  <div className="text-xs font-medium text-slate-700 truncate">
                    {canton.primarySector}
                  </div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold tabular-nums ${
                        cantonEligible > 0 ? 'text-[#FF6B00]' : 'text-slate-400'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          cantonEligible > 0 ? 'bg-[#FF6B00]' : 'bg-slate-300'
                        }`}
                      />
                      {cantonEligible} {cantonEligible === 1 ? 'company ready' : 'companies ready'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right 4 Columns: Clean Orange-Themed Canton Dossier & Companies List */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden sticky top-24" data-tour="company-database">
          {/* Regional Header */}
          <div className="p-5 bg-gradient-to-br from-orange-50/50 via-white to-white border-b border-slate-100 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-medium text-slate-500">
                  <span>{selectedCantonMeta.region}</span>
                  <span className="mx-1.5">·</span>
                  <span>PLZ {selectedCantonMeta.plz}</span>
                </div>
                <h3 className="font-heading font-bold text-xl text-[#0B2240] mt-0.5">
                  Canton {selectedCantonMeta.name} ({selectedCantonMeta.code})
                </h3>
              </div>

              <button
                type="button"
                onClick={() => {
                  setNewCompCanton(selectedCantonMeta.code);
                  setShowAddModal(true);
                }}
                className="h-8 px-3.5 rounded-full bg-[#FF6B00] hover:bg-[#E05E00] text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>

            {/* Stat Mini-Cards */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/70">
                <span className="text-[11px] text-slate-500 block">Companies on List</span>
                <span className="font-heading font-bold text-xl text-[#0B2240] tabular-nums mt-0.5 block">
                  {contractorsInSelectedCanton.length}
                </span>
              </div>
              <div className="bg-orange-50/60 rounded-xl p-3 border border-orange-200/80">
                <span className="text-[11px] text-slate-600 font-medium block">Ready to Email</span>
                <span className="font-heading font-bold text-xl text-[#FF6B00] tabular-nums mt-0.5 block">
                  {contractorsInSelectedCanton.filter((c) => !c.unsubscribed).length}
                </span>
              </div>
            </div>
          </div>

          {/* Live Contractors List for this Canton */}
          <div className="p-5 space-y-3">
            <div className="text-xs font-semibold text-[#0B2240] flex items-center justify-between">
              <span>Companies in {selectedCantonMeta.name}</span>
              <span className="font-mono text-[11px] text-slate-400">
                {selectedCantonMeta.language.toUpperCase()} language
              </span>
            </div>

            {contractorsInSelectedCanton.length === 0 ? (
              <div className="bg-slate-50 rounded-2xl p-6 text-center space-y-2 border border-dashed border-slate-200">
                <Building2 className="w-6 h-6 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-600">
                  No companies saved in {selectedCantonMeta.name} yet.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setNewCompCanton(selectedCantonMeta.code);
                    setShowAddModal(true);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#FF6B00] hover:underline cursor-pointer pt-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Company in {selectedCantonMeta.name}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {contractorsInSelectedCanton.map((comp) => (
                  <div
                    key={comp.id}
                    className="p-3 rounded-xl bg-slate-50 hover:bg-orange-50/30 border border-slate-200/80 hover:border-orange-200 flex items-center justify-between gap-2.5 text-xs transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-[#0B2240] truncate">
                        {comp.name}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 truncate mt-0.5">
                        {comp.email}
                      </div>
                      {comp.unsubscribed && (
                        <span className="text-[10px] text-red-600 font-semibold">
                          Unsubscribed (STOP)
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setCompanyToDelete(comp)}
                      aria-label={`Remove ${comp.name}`}
                      title="Delete company"
                      className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleToggleCanton(selectedCantonMeta.code)}
                className={`w-full h-10 rounded-full font-heading font-semibold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  settings.selected_cantons.includes(selectedCantonMeta.code)
                    ? 'bg-slate-100 hover:bg-slate-200 text-[#0B2240]'
                    : 'bg-[#FF6B00] hover:bg-[#E05E00] text-white shadow-xs'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>
                  {settings.selected_cantons.includes(selectedCantonMeta.code)
                    ? `Turn Off Region ${selectedCantonMeta.name} (${selectedCantonMeta.code})`
                    : `Turn On Region ${selectedCantonMeta.name} (${selectedCantonMeta.code})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ADD CONTRACTOR MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-heading font-bold text-lg text-[#0B2240]">
                  Add a New Company
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Language (German, French, or Italian) will match the region automatically.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCompany} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-600 block mb-1.5">
                  Company Name *
                </label>
                <input
                  type="text"
                  required
                  value={newCompName}
                  onChange={(e) => setNewCompName(e.target.value)}
                  placeholder="e.g. Kibag Bauleistungen AG"
                  className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3.5 text-sm text-[#0B2240] focus:outline-none focus:border-[#FF6B00]"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1.5">
                  Company Email *
                </label>
                <input
                  type="email"
                  required
                  value={newCompEmail}
                  onChange={(e) => setNewCompEmail(e.target.value)}
                  placeholder="werkstatt@contractor.ch"
                  className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3.5 font-mono text-sm text-[#0B2240] focus:outline-none focus:border-[#FF6B00]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1.5">
                    Swiss Region / Canton *
                  </label>
                  <select
                    value={newCompCanton}
                    onChange={(e) => setNewCompCanton(e.target.value)}
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-medium text-[#0B2240] focus:outline-none focus:border-[#FF6B00]"
                  >
                    {SWISS_CANTONS.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} — {c.name} ({c.language.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-600 block mb-1.5">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={newCompPhone}
                    onChange={(e) => setNewCompPhone(e.target.value)}
                    placeholder="+41 44 123 45 67"
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 font-mono text-sm text-[#0B2240] focus:outline-none focus:border-[#FF6B00]"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1.5">
                  Type of Work
                </label>
                <select
                  value={newCompIndustry}
                  onChange={(e) => setNewCompIndustry(e.target.value)}
                  className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-medium text-[#0B2240] focus:outline-none focus:border-[#FF6B00]"
                >
                  <option value="civil_engineering">Civil Engineering / Génie Civil</option>
                  <option value="tiefbau">Tiefbau &amp; Earthworks</option>
                  <option value="demolition">Demolition &amp; Recycling</option>
                  <option value="quarry">Kieswerk / Quarry</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSavingComp}
                className="w-full h-11 rounded-full bg-[#FF6B00] hover:bg-[#E05E00] text-white font-heading font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>{isSavingComp ? 'Saving...' : 'Save Company'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DELETE COMPANY CONFIRMATION MODAL */}
      {companyToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-lg text-[#0B2240]">
                    Remove this company?
                  </h3>
                  <p className="text-xs text-slate-500">
                    This company will be removed from your outreach list.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCompanyToDelete(null)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
              <div className="font-bold text-sm text-[#0B2240]">
                {companyToDelete.name}
              </div>
              <div className="text-slate-600 font-mono">
                {companyToDelete.email} · Canton {companyToDelete.canton}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setCompanyToDelete(null)}
                disabled={isDeletingComp}
                className="flex-1 h-11 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-[#0B2240] font-heading font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCompany}
                disabled={isDeletingComp}
                className="flex-1 h-11 rounded-full bg-red-600 hover:bg-red-700 text-white font-heading font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeletingComp ? 'Removing...' : 'Yes, Remove'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
