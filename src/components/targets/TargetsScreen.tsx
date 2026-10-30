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
} from 'lucide-react';

interface TargetsScreenProps {
  settings: AgentSettings;
  companies: Company[];
  onUpdateSettings: (patch: Partial<AgentSettings>) => Promise<void>;
  onRefreshCompanies: () => Promise<void>;
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
      `Canton ${code} ${next.includes(code) ? 'added to outreach pool' : 'removed'}`
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
        showToast(data.error || 'Failed to add contractor', true);
      } else {
        await onRefreshCompanies();
        setSelectedCantonCode(newCompCanton);
        setNewCompName('');
        setNewCompEmail('');
        setNewCompPhone('');
        setShowAddModal(false);
        showToast(`Saved ${data.name} (${data.canton}) to Supabase directory`);
      }
    } catch (err: any) {
      showToast(`Error: ${err?.message}`, true);
    } finally {
      setIsSavingComp(false);
    }
  };

  const handleDeleteCompany = async (id: string, name: string) => {
    try {
      await fetch(`/api/companies/${id}`, { method: 'DELETE' });
      await onRefreshCompanies();
      showToast(`Removed ${name} from directory`);
    } catch {
      showToast('Failed to delete contractor', true);
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
            Swiss Cantons &amp; Contractor Directory
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage your verified Swiss contractors in Supabase, select target cantons, and set your daily outreach pace.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          <div className="text-xs font-medium text-slate-600 bg-white px-4 py-2.5 rounded-full border border-slate-200 tabular-nums">
            <strong className="text-[#0B2240]">{settings.selected_cantons.length} cantons</strong>
            <span className="mx-2">·</span>
            <strong className="text-[#FF6B00]">{activeContractorsTotal} active contractors</strong>
          </div>

          <button
            type="button"
            onClick={() => {
              setNewCompCanton(selectedCantonCode);
              setShowAddModal(true);
            }}
            className="h-10 px-4 rounded-full bg-[#FF6B00] hover:bg-[#E05E00] text-white font-heading font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Contractor</span>
          </button>
        </div>
      </div>

      {/* DAILY VOLUME SLIDER CARD */}
      <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-[#FF6B00]" />
            <div>
              <h2 className="font-heading font-bold text-lg text-[#0B2240]">
                Daily Outreach Volume
              </h2>
              <p className="text-xs text-slate-500">
                Maximum acquisition emails dispatched per day (Monday–Friday, 08:30–17:00 CET)
              </p>
            </div>
          </div>

          <div className="font-mono font-bold text-2xl text-[#FF6B00] tabular-nums">
            {dailyPace} <span className="text-sm font-normal text-slate-500">emails / day</span>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <input
            type="range"
            min="10"
            max="50"
            step="1"
            value={dailyPace}
            onChange={(e) => handlePaceChange(Number(e.target.value))}
            className="w-full accent-[#FF6B00] cursor-pointer h-2.5 bg-slate-100 rounded-full"
          />
          <div className="flex items-center justify-between text-xs text-slate-500 font-mono tabular-nums">
            <span>10 / day (Conservative)</span>
            <span>25 / day (Recommended)</span>
            <span>50 / day (Maximum)</span>
          </div>
        </div>
      </section>

      {/* Search & Language Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md flex items-center bg-white rounded-full border border-slate-200 px-4 h-12 focus-within:border-[#0B2240] transition-colors">
          <Search className="w-4 h-4 text-slate-400 mr-3 shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter by canton (ZH, VD, BE, TI) or postal code..."
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

        {/* Language Region Filter Tabs */}
        <div className="inline-flex items-center p-1 bg-white rounded-full border border-slate-200 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setRegionFilter('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
              regionFilter === 'all'
                ? 'bg-[#0B2240] text-white'
                : 'text-slate-600 hover:text-[#0B2240]'
            }`}
          >
            All Regions
          </button>
          <button
            type="button"
            onClick={() => setRegionFilter('de')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
              regionFilter === 'de'
                ? 'bg-[#0B2240] text-white'
                : 'text-slate-600 hover:text-[#0B2240]'
            }`}
          >
            German (DE)
          </button>
          <button
            type="button"
            onClick={() => setRegionFilter('fr')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
              regionFilter === 'fr'
                ? 'bg-[#0B2240] text-white'
                : 'text-slate-600 hover:text-[#0B2240]'
            }`}
          >
            French (FR)
          </button>
          <button
            type="button"
            onClick={() => setRegionFilter('it')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
              regionFilter === 'it'
                ? 'bg-[#0B2240] text-white'
                : 'text-slate-600 hover:text-[#0B2240]'
            }`}
          >
            Italian (IT)
          </button>
        </div>
      </div>

      {/* 2-COLUMN WORKSPACE: Cantons Grid + Regional Contractor Dossier */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 Columns: Cantons Grid */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {filteredCantons.map((canton) => {
            const isSelected = settings.selected_cantons.includes(canton.code);
            const isFocused = selectedCantonCode === canton.code;
            const cantonCompanies = companies.filter((c) => c.canton === canton.code);
            const cantonEligible = cantonCompanies.filter((c) => !c.unsubscribed).length;

            return (
              <div
                key={canton.code}
                onClick={() => setSelectedCantonCode(canton.code)}
                className={`rounded-3xl bg-white p-5 transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
                  isFocused
                    ? 'border-2 border-[#0B2240]'
                    : 'border border-slate-200/90 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-bold text-lg text-[#0B2240]">
                        {canton.name}
                      </span>
                      <span className="font-mono text-xs font-semibold text-slate-400">
                        {canton.code}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      <span>{canton.language.toUpperCase()}</span>
                      <span className="mx-1.5">·</span>
                      <span className="tabular-nums">PLZ {canton.plz}</span>
                    </div>
                  </div>

                  {/* 44x44px Touch Target Checkbox Button */}
                  <button
                    type="button"
                    aria-label={`Toggle Canton ${canton.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleCanton(canton.code);
                    }}
                    className="min-w-[44px] min-h-[44px] -m-2 flex items-center justify-center cursor-pointer"
                  >
                    <span
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-[#FF6B00] text-white'
                          : 'border-2 border-slate-300 bg-white text-transparent'
                      }`}
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                    </span>
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-1">
                  <div className="text-xs font-medium text-[#0B2240] truncate">
                    {canton.primarySector}
                  </div>
                  <div className="text-xs text-slate-500 tabular-nums">
                    {cantonCompanies.length} contractor{cantonCompanies.length === 1 ? '' : 's'} ({cantonEligible} eligible)
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right 4 Columns: Focused Canton Dossier & Live Contractors List */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-200/90 space-y-5 sticky top-24">
          <div className="pb-4 border-b border-slate-100 flex items-start justify-between gap-2">
            <div>
              <div className="text-xs text-slate-500">
                <span>{selectedCantonMeta.region}</span>
                <span className="mx-1.5">·</span>
                <span>PLZ {selectedCantonMeta.plz}</span>
              </div>
              <h3 className="font-heading font-bold text-xl text-[#0B2240] mt-1">
                Canton {selectedCantonMeta.name} ({selectedCantonMeta.code})
              </h3>
            </div>

            <button
              type="button"
              onClick={() => {
                setNewCompCanton(selectedCantonMeta.code);
                setShowAddModal(true);
              }}
              className="h-9 px-3 rounded-full bg-slate-100 hover:bg-slate-200 text-[#0B2240] text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-2xl p-4">
              <span className="text-xs text-slate-500 block">In Directory</span>
              <span className="font-heading font-bold text-2xl text-[#0B2240] tabular-nums mt-1 block">
                {contractorsInSelectedCanton.length}
              </span>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4">
              <span className="text-xs text-slate-500 block">Eligible to Email</span>
              <span className="font-heading font-bold text-2xl text-[#FF6B00] tabular-nums mt-1 block">
                {contractorsInSelectedCanton.filter((c) => !c.unsubscribed).length}
              </span>
            </div>
          </div>

          {/* Live Contractors List for this Canton */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <div className="text-xs font-semibold text-[#0B2240] flex items-center justify-between">
              <span>Contractors in {selectedCantonMeta.name}</span>
              <span className="font-mono text-slate-400">
                {selectedCantonMeta.language.toUpperCase()} template
              </span>
            </div>

            {contractorsInSelectedCanton.length === 0 ? (
              <div className="bg-slate-50 rounded-2xl p-4 text-center space-y-2">
                <Building2 className="w-5 h-5 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-600">
                  No contractors saved in Canton {selectedCantonMeta.code} yet.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setNewCompCanton(selectedCantonMeta.code);
                    setShowAddModal(true);
                  }}
                  className="text-xs font-semibold text-[#FF6B00] hover:underline cursor-pointer"
                >
                  + Add Contractor in {selectedCantonMeta.code}
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {contractorsInSelectedCanton.map((comp) => (
                  <div
                    key={comp.id}
                    className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-[#0B2240] truncate">
                        {comp.name}
                      </div>
                      <div className="font-mono text-slate-500 truncate">{comp.email}</div>
                      {comp.unsubscribed && (
                        <span className="text-[10px] text-red-600 font-semibold">
                          Opted Out (STOP)
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteCompany(comp.id, comp.name)}
                      aria-label={`Remove ${comp.name}`}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleToggleCanton(selectedCantonMeta.code)}
            className={`w-full h-11 rounded-full font-heading font-semibold text-xs sm:text-sm transition-colors cursor-pointer ${
              settings.selected_cantons.includes(selectedCantonMeta.code)
                ? 'bg-slate-100 hover:bg-slate-200 text-[#0B2240]'
                : 'bg-[#FF6B00] hover:bg-[#E05E00] text-white'
            }`}
          >
            {settings.selected_cantons.includes(selectedCantonMeta.code)
              ? `Remove Canton ${selectedCantonMeta.code} from Pool`
              : `Enable Outreach in Canton ${selectedCantonMeta.code}`}
          </button>
        </div>
      </div>

      {/* ADD CONTRACTOR MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-heading font-bold text-lg text-[#0B2240]">
                  Add Contractor to Supabase
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Language is automatically assigned from the Swiss canton.
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
                  className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3.5 text-sm text-[#0B2240] focus:outline-none focus:border-[#0B2240]"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1.5">
                  Contractor Email *
                </label>
                <input
                  type="email"
                  required
                  value={newCompEmail}
                  onChange={(e) => setNewCompEmail(e.target.value)}
                  placeholder="werkstatt@contractor.ch"
                  className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3.5 font-mono text-sm text-[#0B2240] focus:outline-none focus:border-[#0B2240]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1.5">
                    Swiss Canton *
                  </label>
                  <select
                    value={newCompCanton}
                    onChange={(e) => setNewCompCanton(e.target.value)}
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-medium text-[#0B2240] focus:outline-none focus:border-[#0B2240]"
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
                    Direct Phone
                  </label>
                  <input
                    type="text"
                    value={newCompPhone}
                    onChange={(e) => setNewCompPhone(e.target.value)}
                    placeholder="+41 44 123 45 67"
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 font-mono text-sm text-[#0B2240] focus:outline-none focus:border-[#0B2240]"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1.5">
                  Primary Sector
                </label>
                <select
                  value={newCompIndustry}
                  onChange={(e) => setNewCompIndustry(e.target.value)}
                  className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-medium text-[#0B2240] focus:outline-none focus:border-[#0B2240]"
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
                <span>{isSavingComp ? 'Saving to Supabase...' : 'Save Contractor'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
