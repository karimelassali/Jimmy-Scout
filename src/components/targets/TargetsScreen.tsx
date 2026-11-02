import React, { useState, useEffect } from 'react';
import { AgentSettings, Company, SuppressionEntry } from '@/packages/types/src/database.ts';
import { ALL_SWISS_CANTONS } from '@/packages/types/src/swiss.ts';
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
  Edit3,
  Upload,
  Download,
  ShieldAlert,
} from 'lucide-react';

interface TargetsScreenProps {
  settings: AgentSettings;
  companies: Company[];
  onUpdateSettings: (patch: Partial<AgentSettings>) => Promise<void>;
  onRefreshCompanies: () => Promise<void>;
  onNavigateToScanner?: () => void;
}

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
  const [newCompContactPerson, setNewCompContactPerson] = useState('');
  const [newCompCity, setNewCompCity] = useState('');
  const [newCompPostalCode, setNewCompPostalCode] = useState('');
  const [newCompCanton, setNewCompCanton] = useState('ZH');
  const [newCompIndustry, setNewCompIndustry] = useState('civil_engineering');
  const [newCompNotes, setNewCompNotes] = useState('');
  const [isSavingComp, setIsSavingComp] = useState(false);

  // Edit Contractor Modal State
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [isUpdatingComp, setIsUpdatingComp] = useState(false);

  // CSV Import Modal State
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [isImportingCsv, setIsImportingCsv] = useState(false);

  // Suppression Registry Modal State
  const [showSuppressionModal, setShowSuppressionModal] = useState(false);
  const [suppressions, setSuppressions] = useState<SuppressionEntry[]>([]);
  const [newSuppEmail, setNewSuppEmail] = useState('');
  const [newSuppDomain, setNewSuppDomain] = useState('');
  const [newSuppReason, setNewSuppReason] = useState('manual_opt_out');

  // Delete Company Confirmation State
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [isDeletingComp, setIsDeletingComp] = useState(false);

  useEffect(() => {
    setDailyPace(settings.daily_limit);
  }, [settings.daily_limit]);

  const showToast = (msg: string, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3500);
  };

  const loadSuppressions = async () => {
    try {
      const res = await fetch('/api/suppressions');
      if (res.ok) {
        const data = await res.json();
        setSuppressions(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    }
  };

  const handleToggleCanton = async (code: string) => {
    let next: string[];
    if (settings.selected_cantons.includes(code)) {
      if (settings.selected_cantons.length <= 1) {
        showToast('Au moins un canton doit rester actif.', true);
        return;
      }
      next = settings.selected_cantons.filter((c) => c !== code);
    } else {
      next = [...settings.selected_cantons, code];
    }
    try {
      await onUpdateSettings({ selected_cantons: next });
      showToast(`Region ${code} ${next.includes(code) ? 'turned on' : 'turned off'}`);
    } catch (err: any) {
      showToast(err?.message || 'Impossible de modifier les cantons', true);
    }
  };

  const handleSelectAllCantons = async () => {
    const allCodes = ALL_SWISS_CANTONS.map((c) => c.code);
    try {
      await onUpdateSettings({ selected_cantons: allCodes });
      showToast('Les 26 cantons suisses sont actifs');
    } catch (err: any) {
      showToast(err?.message || 'Impossible d’activer tous les cantons', true);
    }
  };

  const handlePaceChange = async (newVal: number) => {
    setDailyPace(newVal);
    try {
      await onUpdateSettings({ daily_limit: newVal });
    } catch (err: any) {
      showToast(err?.message || 'Impossible de changer la limite du jour', true);
    }
  };

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompName.trim()) {
      showToast('Le nom de la société est obligatoire.', true);
      return;
    }

    setIsSavingComp(true);
    try {
      const cleanEmail = newCompEmail.trim().toLowerCase();
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCompName.trim(),
          email: cleanEmail,
          verified_email: Boolean(cleanEmail && cleanEmail.includes('@')),
          phone: newCompPhone.trim() || null,
          contact_person: newCompContactPerson.trim() || null,
          city: newCompCity.trim() || null,
          postal_code: newCompPostalCode.trim() || null,
          canton: newCompCanton,
          industry: newCompIndustry,
          notes: newCompNotes.trim() || null,
          source: 'manual',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Impossible d’ajouter la société', true);
      } else {
        await onRefreshCompanies();
        setSelectedCantonCode(newCompCanton);
        setNewCompName('');
        setNewCompEmail('');
        setNewCompPhone('');
        setNewCompContactPerson('');
        setNewCompCity('');
        setNewCompPostalCode('');
        setNewCompNotes('');
        setShowAddModal(false);
        showToast(`${data.name} (${data.canton}) a été ajoutée`);
      }
    } catch (err: any) {
      showToast(`Erreur : ${err?.message}`, true);
    } finally {
      setIsSavingComp(false);
    }
  };

  const handleSaveEditedCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany) return;
    setIsUpdatingComp(true);
    try {
      const res = await fetch(`/api/companies/${editingCompany.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingCompany.name,
          email: editingCompany.email,
          verified_email: editingCompany.verified_email,
          canton: editingCompany.canton,
          language: editingCompany.language,
          phone: editingCompany.phone,
          contact_person: editingCompany.contact_person,
          city: editingCompany.city,
          postal_code: editingCompany.postal_code,
          address: editingCompany.address,
          notes: editingCompany.notes,
          unsubscribed: editingCompany.unsubscribed,
          stock_status: editingCompany.stock_status,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Impossible de modifier la société', true);
      } else {
        await onRefreshCompanies();
        setEditingCompany(null);
        showToast(`${data.name} a été modifiée`);
      }
    } catch (err: any) {
      showToast(`Erreur : ${err?.message}`, true);
    } finally {
      setIsUpdatingComp(false);
    }
  };

  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvText.trim()) {
      showToast('Collez un fichier CSV ou choisissez un fichier CSV.', true);
      return;
    }
    setIsImportingCsv(true);
    try {
      const res = await fetch('/api/companies/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'CSV import failed', true);
      } else {
        await onRefreshCompanies();
        setShowCsvModal(false);
        setCsvText('');
        showToast(
          `Import terminé : ${data.added} ajoutée(s), ${data.updated} mise(s) à jour, ${data.skipped} ignorée(s)`
        );
      }
    } catch (err: any) {
      showToast(`Erreur : ${err?.message}`, true);
    } finally {
      setIsImportingCsv(false);
    }
  };

  const handleAddSuppression = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSuppEmail.trim() && !newSuppDomain.trim()) {
      showToast('Entrez une adresse ou un domaine à bloquer.', true);
      return;
    }
    try {
      const res = await fetch('/api/suppressions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newSuppEmail.trim() || null,
          domain: newSuppDomain.trim() || null,
          reason: newSuppReason,
        }),
      });
      if (res.ok) {
        setNewSuppEmail('');
        setNewSuppDomain('');
        await loadSuppressions();
        await onRefreshCompanies();
      showToast('Ajouté à la liste de blocage permanente');
      }
    } catch {
      showToast('Impossible d’ajouter ce refus', true);
    }
  };

  const handleRemoveSuppression = async (id: string) => {
    try {
      await fetch(`/api/suppressions/${id}`, { method: 'DELETE' });
      await loadSuppressions();
      showToast('Retiré de la liste des refus');
    } catch {
      showToast('Impossible de retirer ce refus', true);
    }
  };

  const handleConfirmDeleteCompany = async () => {
    if (!companyToDelete) return;
    setIsDeletingComp(true);
    try {
      await fetch(`/api/companies/${companyToDelete.id}`, { method: 'DELETE' });
      await onRefreshCompanies();
      showToast(`${companyToDelete.name} a été retirée`);
      setCompanyToDelete(null);
    } catch {
      showToast('Impossible de supprimer la société', true);
    } finally {
      setIsDeletingComp(false);
    }
  };

  const selectedCantonMeta =
    ALL_SWISS_CANTONS.find((c) => c.code === selectedCantonCode) || ALL_SWISS_CANTONS[0];

  const contractorsInSelectedCanton = companies.filter(
    (c) => c.canton.toUpperCase() === selectedCantonMeta.code
  );

  const activeContractorsTotal = companies.filter(
    (c) =>
      settings.selected_cantons.includes(c.canton) &&
      !c.unsubscribed &&
      c.email &&
      c.verified_email !== false
  ).length;

  const filteredCantons = ALL_SWISS_CANTONS.filter((c) => {
    if (regionFilter !== 'all' && c.language !== regionFilter) return false;
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    const cantonCompanyMatch = companies.some(
      (comp) =>
        comp.canton === c.code &&
        (comp.name.toLowerCase().includes(q) ||
          (comp.email && comp.email.toLowerCase().includes(q)) ||
          (comp.city && comp.city.toLowerCase().includes(q)))
    );
    return (
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.plz.includes(q) ||
      c.primarySector.toLowerCase().includes(q) ||
      cantonCompanyMatch
    );
  });

  // Keep the dossier aligned with the visible canton grid. Without this, a
  // French/Italian filter could leave a German canton open in the side panel.
  const filteredCantonCodes = filteredCantons.map((canton) => canton.code).join(',');
  useEffect(() => {
    const visibleCodes = filteredCantonCodes ? filteredCantonCodes.split(',') : [];
    if (visibleCodes.length > 0 && !visibleCodes.includes(selectedCantonCode)) {
      setSelectedCantonCode(visibleCodes[0]);
    }
  }, [filteredCantonCodes, selectedCantonCode]);

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

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-[#0B2240] tracking-tight">
            Cantons suisses (26) et sociétés
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Choisissez les cantons, gérez les sociétés, importez un fichier CSV et respectez les refus.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 bg-white px-3.5 py-2 rounded-full border border-slate-200 text-xs font-medium shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#FF6B00]" />
            <strong className="text-[#0B2240]">
              {settings.selected_cantons.length}/26 cantons
            </strong>
            <span className="text-slate-300">·</span>
            <strong className="text-[#FF6B00]">{activeContractorsTotal} vérifiées et prêtes</strong>
          </div>

          <button
            type="button"
            onClick={() => {
              loadSuppressions();
              setShowSuppressionModal(true);
            }}
            className="h-10 px-3.5 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-heading font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
            <span>Refus</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCsvModal(true)}
            className="h-10 px-3.5 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-[#0B2240] font-heading font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
          >
            <Upload className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span>Importer / exporter CSV</span>
          </button>

          {onNavigateToScanner && (
            <button
              type="button"
              onClick={onNavigateToScanner}
              className="h-10 px-4 rounded-full bg-white hover:bg-slate-50 border border-slate-200 hover:border-[#0B2240] text-[#0B2240] font-heading font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-2xs"
            >
              <Camera className="w-4 h-4 text-[#FF6B00]" />
              <span>Scanner des cartes</span>
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
              <span>Ajouter une société</span>
          </button>
        </div>
      </div>

      {/* DAILY SPEED LIMIT BAR */}
      <section className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200/80 text-[#FF6B00] flex items-center justify-center shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading font-bold text-base text-[#0B2240]">
                  Limite d’envoi par jour
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-[#FF6B00] font-mono font-bold text-xs">
                  {dailyPace} courriels / jour
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Envoi automatique du lundi au vendredi, de 08 h 30 à 17 h 00, heure de Zurich
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
                <span>10 / jour (doux)</span>
                <span>25 / jour (conseillé)</span>
                <span>50 / jour (rapide)</span>
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
            placeholder="Chercher un canton ou une société…"
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

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={handleSelectAllCantons}
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-orange-50 text-[#FF6B00] border border-orange-200 hover:bg-orange-100 transition-colors cursor-pointer shrink-0"
          >
            Activer les 26 cantons
          </button>

          <div className="inline-flex items-center p-1 bg-white rounded-full border border-slate-200 shrink-0 min-w-max shadow-2xs">
            {(
              [
                { id: 'all', label: `Tous (${ALL_SWISS_CANTONS.length})` },
                {
                  id: 'de',
                  label: `DE (${ALL_SWISS_CANTONS.filter((c) => c.language === 'de').length})`,
                },
                {
                  id: 'fr',
                  label: `FR (${ALL_SWISS_CANTONS.filter((c) => c.language === 'fr').length})`,
                },
                {
                  id: 'it',
                  label: `IT (${ALL_SWISS_CANTONS.filter((c) => c.language === 'it').length})`,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setRegionFilter(tab.id);
                  const firstVisibleCanton = tab.id === 'all'
                    ? ALL_SWISS_CANTONS[0]
                    : ALL_SWISS_CANTONS.find((canton) => canton.language === tab.id);
                  if (firstVisibleCanton) setSelectedCantonCode(firstVisibleCanton.code);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
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

      {/* 2-COLUMN WORKSPACE: 26 Cantons Grid + Regional Contractor Dossier */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div
          className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5"
          data-tour="canton-selection"
        >
          {filteredCantons.map((canton) => {
            const isSelected = settings.selected_cantons.includes(canton.code);
            const isFocused = selectedCantonCode === canton.code;
            const cantonCompanies = companies.filter((c) => c.canton === canton.code);
            const cantonEligible = cantonCompanies.filter(
              (c) => !c.unsubscribed && c.email && c.verified_email !== false
            ).length;

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
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-bold text-base text-[#0B2240] leading-tight truncate">
                        {canton.name}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono font-bold text-[11px] shrink-0">
                        {canton.code}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                      <span className="font-semibold text-slate-600">
                        {canton.language.toUpperCase()}
                      </span>
                      <span>·</span>
                      <span className="tabular-nums">NPA {canton.plz}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-label={`Activer ou arrêter le canton ${canton.name}`}
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
                        <span>Arrêtée</span>
                    )}
                  </button>
                </div>

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
                      {cantonEligible} vérifiée(s) ({cantonCompanies.length} au total)
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right 4 Columns: Regional Contractor Dossier */}
        <div
          className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden sticky top-24"
          data-tour="company-database"
        >
          <div className="p-5 bg-gradient-to-br from-orange-50/50 via-white to-white border-b border-slate-100 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-medium text-slate-500">
                  <span>{selectedCantonMeta.region === 'Deutschschweiz (DE)' ? 'Suisse alémanique (DE)' : selectedCantonMeta.region === 'Ticino (IT)' ? 'Tessin (IT)' : selectedCantonMeta.region}</span>
                  <span className="mx-1.5">·</span>
                  <span>NPA {selectedCantonMeta.plz}</span>
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
                <span>Ajouter</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/70">
                <span className="text-[11px] text-slate-500 block">Sociétés dans la liste</span>
                <span className="font-heading font-bold text-xl text-[#0B2240] tabular-nums mt-0.5 block">
                  {contractorsInSelectedCanton.length}
                </span>
              </div>
              <div className="bg-orange-50/60 rounded-xl p-3 border border-orange-200/80">
                <span className="text-[11px] text-slate-600 font-medium block">
                  Vérifiées et prêtes
                </span>
                <span className="font-heading font-bold text-xl text-[#FF6B00] tabular-nums mt-0.5 block">
                  {
                    contractorsInSelectedCanton.filter(
                      (c) => !c.unsubscribed && c.email && c.verified_email !== false
                    ).length
                  }
                </span>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-3">
            <div className="text-xs font-semibold text-[#0B2240] flex items-center justify-between">
              <span>Sociétés dans le canton de {selectedCantonMeta.name}</span>
              <span className="font-mono text-[11px] text-slate-400">
                Langue : {selectedCantonMeta.language.toUpperCase()}
              </span>
            </div>

            {contractorsInSelectedCanton.length === 0 ? (
              <div className="bg-slate-50 rounded-2xl p-6 text-center space-y-2 border border-dashed border-slate-200">
                <Building2 className="w-6 h-6 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-600">
                  Aucune société enregistrée dans {selectedCantonMeta.name}.
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
                  <span>Ajouter une société dans {selectedCantonMeta.name}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {contractorsInSelectedCanton.map((comp) => {
                  const hasVerifiedEmail = Boolean(
                    comp.email && comp.verified_email !== false
                  );
                  return (
                    <div
                      key={comp.id}
                      className="p-3 rounded-xl bg-slate-50 hover:bg-orange-50/30 border border-slate-200/80 hover:border-orange-200 flex items-center justify-between gap-2 text-xs transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-[#0B2240] truncate">
                            {comp.name}
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-slate-200/70 text-[10px] font-mono uppercase text-slate-700">
                            {comp.language || selectedCantonMeta.language}
                          </span>
                        </div>
                        <div className="font-mono text-[11px] text-slate-500 truncate mt-0.5">
                          {comp.email || 'Pas de courriel, téléphone seulement'}
                        </div>
                        {comp.contact_person && (
                          <div className="text-[11px] text-slate-500 truncate">
                            {comp.contact_person} {comp.phone ? `· ${comp.phone}` : ''}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {comp.unsubscribed && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold">
                              Refus (STOP)
                            </span>
                          )}
                          {!hasVerifiedEmail && !comp.unsubscribed && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                              Courriel à vérifier
                            </span>
                          )}
                          {comp.stock_status === 'no_stock_temporarily' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                              Pas de stock, pause de 30 jours
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditingCompany({ ...comp })}
                          title="Modifier la société"
                          className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200/70 hover:text-[#0B2240] transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCompanyToDelete(comp)}
                          aria-label={`Retirer ${comp.name}`}
                          title="Supprimer la société"
                          className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
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
                    ? `Arrêter la région ${selectedCantonMeta.name} (${selectedCantonMeta.code})`
                    : `Activer la région ${selectedCantonMeta.name} (${selectedCantonMeta.code})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ADD CONTRACTOR MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-heading font-bold text-lg text-[#0B2240]">
                  Ajouter une société de chantier
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Leave email blank if you only have a phone number; Jimy will only email verified addresses.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCompany} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    Nom de la société *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCompName}
                    onChange={(e) => setNewCompName(e.target.value)}
                    placeholder="Ex. Kibag Bauleistungen AG"
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3.5 text-sm text-[#0B2240] focus:outline-none focus:border-[#FF6B00]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    Personne de contact
                  </label>
                  <input
                    type="text"
                    value={newCompContactPerson}
                    onChange={(e) => setNewCompContactPerson(e.target.value)}
                    placeholder="Ex. Thomas Müller, responsable du dépôt"
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3.5 text-sm text-[#0B2240] focus:outline-none focus:border-[#FF6B00]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    Courriel vérifié
                  </label>
                  <input
                    type="email"
                    value={newCompEmail}
                    onChange={(e) => setNewCompEmail(e.target.value)}
                    placeholder="werkstatt@contractor.ch"
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3.5 font-mono text-sm text-[#0B2240] focus:outline-none focus:border-[#FF6B00]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    Téléphone
                  </label>
                  <input
                    type="text"
                    value={newCompPhone}
                    onChange={(e) => setNewCompPhone(e.target.value)}
                    placeholder="+41 44 123 45 67"
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3.5 font-mono text-sm text-[#0B2240] focus:outline-none focus:border-[#FF6B00]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    Swiss Canton *
                  </label>
                  <select
                    value={newCompCanton}
                    onChange={(e) => setNewCompCanton(e.target.value)}
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-2.5 text-sm font-medium text-[#0B2240] focus:outline-none focus:border-[#FF6B00]"
                  >
                    {ALL_SWISS_CANTONS.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} — {c.name} ({c.language.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    Code postal
                  </label>
                  <input
                    type="text"
                    value={newCompPostalCode}
                    onChange={(e) => setNewCompPostalCode(e.target.value)}
                    placeholder="8000"
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 font-mono text-sm text-[#0B2240] focus:outline-none focus:border-[#FF6B00]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    Ville
                  </label>
                  <input
                    type="text"
                    value={newCompCity}
                    onChange={(e) => setNewCompCity(e.target.value)}
                    placeholder="Zürich"
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-[#0B2240] focus:outline-none focus:border-[#FF6B00]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    Type de travail
                  </label>
                  <select
                    value={newCompIndustry}
                    onChange={(e) => setNewCompIndustry(e.target.value)}
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-medium text-[#0B2240] focus:outline-none focus:border-[#FF6B00]"
                  >
                    <option value="civil_engineering">Génie civil</option>
                    <option value="tiefbau">Terrassement</option>
                    <option value="demolition">Démolition et recyclage</option>
                    <option value="quarry">Gravière ou carrière</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={newCompNotes}
                    onChange={(e) => setNewCompNotes(e.target.value)}
                    placeholder="Taille du parc, machines utilisées…"
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-[#0B2240] focus:outline-none focus:border-[#FF6B00]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingComp}
                className="w-full h-11 rounded-full bg-[#FF6B00] hover:bg-[#E05E00] text-white font-heading font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>{isSavingComp ? 'Enregistrement...' : 'Enregistrer la société'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CONTRACTOR MODAL */}
      {editingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-heading font-bold text-lg text-[#0B2240]">
                  Modifier la société
                </h3>
                <p className="text-xs text-slate-500">
                  Update contractor details, language override, or stock status.
                </p>
              </div>
              <button
                onClick={() => setEditingCompany(null)}
                className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedCompany} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    Nom de la société *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingCompany.name}
                    onChange={(e) =>
                      setEditingCompany({ ...editingCompany, name: e.target.value })
                    }
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3.5 text-sm text-[#0B2240]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    Personne de contact
                  </label>
                  <input
                    type="text"
                    value={editingCompany.contact_person || ''}
                    onChange={(e) =>
                      setEditingCompany({
                        ...editingCompany,
                        contact_person: e.target.value,
                      })
                    }
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3.5 text-sm text-[#0B2240]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    Adresse courriel
                  </label>
                  <input
                    type="email"
                    value={editingCompany.email || ''}
                    onChange={(e) =>
                      setEditingCompany({
                        ...editingCompany,
                        email: e.target.value,
                        verified_email: Boolean(
                          e.target.value && e.target.value.includes('@')
                        ),
                      })
                    }
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3.5 font-mono text-sm text-[#0B2240]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    Téléphone
                  </label>
                  <input
                    type="text"
                    value={editingCompany.phone || ''}
                    onChange={(e) =>
                      setEditingCompany({ ...editingCompany, phone: e.target.value })
                    }
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3.5 font-mono text-sm text-[#0B2240]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    Canton
                  </label>
                  <select
                    value={editingCompany.canton}
                    onChange={(e) =>
                      setEditingCompany({ ...editingCompany, canton: e.target.value })
                    }
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-2.5 text-sm font-medium text-[#0B2240]"
                  >
                    {ALL_SWISS_CANTONS.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    Langue du courriel
                  </label>
                  <select
                    value={editingCompany.language || 'de'}
                    onChange={(e) =>
                      setEditingCompany({
                        ...editingCompany,
                        language: e.target.value as 'de' | 'fr' | 'it',
                      })
                    }
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-2.5 text-sm font-medium text-[#0B2240]"
                  >
                    <option value="de">German (DE)</option>
                    <option value="fr">French (FR)</option>
                    <option value="it">Italian (IT)</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    État du stock
                  </label>
                  <select
                    value={editingCompany.stock_status || 'unknown'}
                    onChange={(e) =>
                      setEditingCompany({
                        ...editingCompany,
                        stock_status: e.target.value as any,
                      })
                    }
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-2.5 text-sm font-medium text-[#0B2240]"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="has_stock">Has Stock</option>
                    <option value="no_stock_temporarily">No Stock Temporarily</option>
                    <option value="opted_out">Opted Out</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingCompany.verified_email !== false}
                    onChange={(e) =>
                      setEditingCompany({
                        ...editingCompany,
                        verified_email: e.target.checked,
                      })
                    }
                    className="rounded border-slate-300 text-[#FF6B00]"
                  />
                  <span className="font-medium text-slate-700">
                    Courriel vérifié pour les envois automatiques
                  </span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editingCompany.unsubscribed)}
                    onChange={(e) =>
                      setEditingCompany({
                        ...editingCompany,
                        unsubscribed: e.target.checked,
                      })
                    }
                    className="rounded border-slate-300 text-red-600"
                  />
                  <span className="font-medium text-red-700">Unsubscribed (STOP)</span>
                </label>
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={editingCompany.notes || ''}
                  onChange={(e) =>
                    setEditingCompany({ ...editingCompany, notes: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-[#0B2240]"
                />
              </div>

              <button
                type="submit"
                disabled={isUpdatingComp}
                className="w-full h-11 rounded-full bg-[#0B2240] hover:bg-[#16365C] text-white font-heading font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{isUpdatingComp ? 'Enregistrement...' : 'Enregistrer les changements'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CSV IMPORT / EXPORT MODAL */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-heading font-bold text-lg text-[#0B2240]">
                  Importer ou exporter les sociétés vérifiées
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Importez les sociétés avec un fichier CSV ou téléchargez votre liste. Les refus et pauses de 30 jours sont conservés.
                </p>
              </div>
              <button
                onClick={() => setShowCsvModal(false)}
                className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs">
              <div>
                <strong className="text-[#0B2240] block">Export Current Directory</strong>
                <span className="text-slate-500">
                  Formula-safe CSV with {companies.length} contractor records
                </span>
              </div>
              <a
                href="/api/companies/export-csv"
                download
                className="h-9 px-4 rounded-full bg-[#0B2240] hover:bg-[#16365C] text-white font-heading font-semibold text-xs inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
              <span>Télécharger CSV</span>
              </a>
            </div>

            <form onSubmit={handleImportCsv} className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-600">
                  Paste CSV Rows or Upload .csv File
                </label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => setCsvText(String(reader.result || ''));
                    reader.readAsText(file);
                  }}
                  className="text-xs text-slate-500"
                />
              </div>

              <textarea
                rows={6}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={
                  'name,email,canton,phone,contact_person,city,language\nKibag AG,werkstatt@kibag.ch,ZH,+41 44 987 65 43,Hans Meier,Zürich,de'
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 font-mono text-xs text-[#0B2240] focus:outline-none focus:border-[#FF6B00]"
              />

              <button
                type="submit"
                disabled={isImportingCsv}
                className="w-full h-11 rounded-full bg-[#FF6B00] hover:bg-[#E05E00] text-white font-heading font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                <span>{isImportingCsv ? 'Importation…' : 'Importer les sociétés'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SUPPRESSION & OPT-OUT REGISTRY MODAL */}
      {showSuppressionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-heading font-bold text-lg text-[#0B2240]">
                  Permanent Suppression &amp; Opt-Out Registry
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Les adresses et domaines de cette liste ne seront jamais contactés, même après un nouvel import.
                </p>
              </div>
              <button
                onClick={() => setShowSuppressionModal(false)}
                className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleAddSuppression}
              className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs"
            >
              <input
                type="email"
                value={newSuppEmail}
                onChange={(e) => setNewSuppEmail(e.target.value)}
                placeholder="email@contractor.ch"
                className="h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 font-mono text-xs text-[#0B2240]"
              />
              <input
                type="text"
                value={newSuppDomain}
                onChange={(e) => setNewSuppDomain(e.target.value)}
                placeholder="ou domaine.ch"
                className="h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 font-mono text-xs text-[#0B2240]"
              />
              <button
                type="submit"
                className="h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white font-heading font-semibold text-xs cursor-pointer"
              >
                Bloquer une adresse ou un domaine
              </button>
            </form>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {suppressions.filter((s) => s.unsubscribed).length === 0 ? (
                <div className="text-xs text-slate-500 text-center py-6 bg-slate-50 rounded-2xl">
                  Aucun refus actif.
                </div>
              ) : (
                suppressions
                  .filter((s) => s.unsubscribed)
                  .map((s) => (
                    <div
                      key={s.id}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono font-semibold text-[#0B2240]">
                          {s.email || `@${s.domain}`}
                        </span>
                        <span className="ml-2 px-2 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-semibold">
                          {s.reason}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSuppression(s.id)}
                        className="text-slate-400 hover:text-red-600 cursor-pointer"
                        title="Retirer ce refus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
              )}
            </div>
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
                    Retirer cette société ?
                  </h3>
                  <p className="text-xs text-slate-500">
                    Prior contact cooldowns and opt-out suppressions are preserved in the registry.
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
                {companyToDelete.email || 'Téléphone seulement'} · Canton {companyToDelete.canton}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setCompanyToDelete(null)}
                disabled={isDeletingComp}
                className="flex-1 h-11 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-[#0B2240] font-heading font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCompany}
                disabled={isDeletingComp}
                className="flex-1 h-11 rounded-full bg-red-600 hover:bg-red-700 text-white font-heading font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeletingComp ? 'Suppression…' : 'Oui, retirer'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
