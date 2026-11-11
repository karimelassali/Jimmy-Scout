import React, { useState, useEffect } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { StatusDot } from '@astryxdesign/core/StatusDot';
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
      showToast(`Canton ${code} ${next.includes(code) ? 'activé' : 'arrêté'}`);
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
        showToast(data.error || 'Import CSV impossible', true);
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
    <div className="space-y-8 pb-24 pt-2 md:pb-12">
      {/* Snackbar Toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 w-full max-w-xl -translate-x-1/2 px-4 md:bottom-6">
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

      {/* Page heading and territory tools */}
      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
            <StatusDot variant="warning" label="Cantons actifs" />
            <span>{settings.selected_cantons.length} cantons actifs · {activeContractorsTotal} sociétés prêtes</span>
          </div>
          <h1 className="font-heading text-3xl font-medium leading-tight text-[#0B2240] sm:text-4xl">
            Couverture des cantons
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
            Activez les régions où Jimy cherche, puis gardez les sociétés et leurs refus au même endroit.
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <Button
            label="Refus"
            variant="secondary"
            size="sm"
            onClick={() => {
              void loadSuppressions();
              setShowSuppressionModal(true);
            }}
            icon={<ShieldAlert className="w-3.5 h-3.5 text-slate-500" />}
          />

          <Button
            label="Importer / exporter CSV"
            variant="secondary"
            size="sm"
            onClick={() => setShowCsvModal(true)}
            icon={<Upload className="w-3.5 h-3.5 text-[#FF6B00]" />}
          />

          {onNavigateToScanner && (
            <Button
              label="Scanner des cartes"
              variant="secondary"
              size="sm"
              onClick={onNavigateToScanner}
              icon={<Camera className="w-4 h-4 text-[#FF6B00]" />}
            />
          )}

          <Button
            label="Ajouter une société"
            variant="primary"
            size="sm"
            onClick={() => {
              setNewCompCanton(selectedCantonCode);
              setShowAddModal(true);
            }}
            icon={<Plus className="w-4 h-4" />}
          />
        </div>
      </section>

      {/* DAILY SPEED LIMIT BAR */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[#0B2240]">
              <Sliders className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="font-heading text-base font-medium text-[#0B2240]">
                Rythme d’envoi
              </h2>
              <p className="mt-0.5 text-xs leading-5 text-slate-500">
                Envoi automatique du lundi au vendredi, de 08 h 30 à 17 h 00, heure de Zurich
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center lg:w-[52%]">
            <div className="flex-1 space-y-2">
              <input
                type="range"
                min="10"
                max="50"
                step="1"
                value={dailyPace}
                onChange={(e) => handlePaceChange(Number(e.target.value))}
                className="w-full accent-[#FF6B00] cursor-pointer h-2 bg-slate-200 rounded-full"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>10 / jour (doux)</span>
                <span>25 / jour (conseillé)</span>
                <span>50 / jour (rapide)</span>
              </div>
            </div>

            <div className="shrink-0 self-start sm:self-center">
              <SegmentedControl
                label="Rythme quotidien"
                size="sm"
                value={String(dailyPace)}
                onChange={(val) => void handlePaceChange(Number(val))}
              >
                {[15, 25, 35, 50].map((preset) => (
                  <SegmentedControlItem
                    key={preset}
                    value={String(preset)}
                    label={String(preset)}
                  />
                ))}
              </SegmentedControl>
            </div>
          </div>
        </div>
      </section>

      {/* Search and language filters */}
      <section className="space-y-4 border-b border-slate-200 pb-4">
        <div className="relative flex h-11 max-w-md items-center rounded-lg border border-slate-200 bg-white px-3 focus-within:border-[#0B2240]">
          <Search className="w-4 h-4 text-slate-400 mr-3 shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher un canton ou une société"
            className="w-full bg-transparent text-sm text-[#0B2240] placeholder:text-slate-400 focus:outline-none"
            aria-label="Rechercher dans les cantons et sociétés"
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

        <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <button
            type="button"
            onClick={handleSelectAllCantons}
            className="h-9 shrink-0 rounded-lg border border-orange-200 bg-orange-50 px-3 text-xs font-medium text-[#C44F00] transition-colors hover:bg-orange-100"
          >
            Activer les 26 cantons
          </button>

          <div className="inline-flex min-w-max items-center gap-1">
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
                aria-pressed={regionFilter === tab.id}
                className={`h-9 rounded-lg px-3 text-xs font-medium transition-colors whitespace-nowrap ${
                  regionFilter === tab.id
                    ? 'bg-[#0B2240] text-white'
                    : 'text-slate-600 hover:bg-white hover:text-[#0B2240]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 2-COLUMN WORKSPACE: 26 Cantons Grid + Regional Contractor Dossier */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:col-span-8"
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
              <article
                key={canton.code}
                onClick={() => setSelectedCantonCode(canton.code)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedCantonCode(canton.code);
                  }
                }}
                tabIndex={0}
                role="group"
                aria-label={`Canton ${canton.name}${isFocused ? ', dossier ouvert' : ''}`}
                className={`flex cursor-pointer flex-col justify-between space-y-4 rounded-xl border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/40 ${
                  isFocused
                    ? 'border-[#FF6B00] bg-white shadow-[inset_3px_0_0_#FF6B00]'
                    : isSelected
                    ? 'border-slate-200 bg-white hover:border-orange-200'
                    : 'border-slate-200/80 bg-slate-50/70 text-slate-600 hover:bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-heading text-base font-medium leading-tight text-[#0B2240]">
                        {canton.name}
                      </span>
                      <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
                        {canton.code}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                      <span className="font-medium text-slate-600">
                        {canton.language.toUpperCase()}
                      </span>
                      <span>·</span>
                      <span className="tabular-nums">NPA {canton.plz}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-label={`Activer ou arrêter le canton ${canton.name}`}
                    aria-pressed={isSelected}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleCanton(canton.code);
                    }}
                    className={`flex h-7 shrink-0 items-center gap-1 rounded-md px-2.5 text-[11px] font-medium transition-colors ${
                      isSelected
                        ? 'bg-[#0B2240] text-white'
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

                <div className="space-y-1.5 border-t border-slate-100 pt-3">
                  <div className="text-xs font-medium text-slate-700 truncate">
                    {canton.primarySector}
                  </div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-medium tabular-nums ${
                        cantonEligible > 0 ? 'text-[#C44F00]' : 'text-slate-400'
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
              </article>
            );
          })}
        </div>

        {/* Right 4 Columns: Regional Contractor Dossier */}
        <div
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] xl:sticky xl:top-24 xl:col-span-4"
          data-tour="company-database"
        >
          <div className="space-y-5 border-b border-slate-100 p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-medium text-slate-500">
                  <span>{selectedCantonMeta.region === 'Deutschschweiz (DE)' ? 'Suisse alémanique (DE)' : selectedCantonMeta.region === 'Ticino (IT)' ? 'Tessin (IT)' : selectedCantonMeta.region}</span>
                  <span className="mx-1.5">·</span>
                  <span>NPA {selectedCantonMeta.plz}</span>
                </div>
                <h3 className="mt-0.5 font-heading text-xl font-medium text-[#0B2240]">
                  Canton {selectedCantonMeta.name} ({selectedCantonMeta.code})
                </h3>
              </div>

              <button
                type="button"
                onClick={() => {
                  setNewCompCanton(selectedCantonMeta.code);
                  setShowAddModal(true);
                }}
                className="flex h-8 shrink-0 items-center gap-1 rounded-md bg-[#0B2240] px-3.5 text-xs font-medium text-white transition-colors hover:bg-[#173863]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ajouter</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <span className="text-[11px] text-slate-500 block">Sociétés dans la liste</span>
                <span className="mt-0.5 block font-heading text-xl font-medium tabular-nums text-[#0B2240]">
                  {contractorsInSelectedCanton.length}
                </span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <span className="block text-[11px] text-slate-500">
                  Vérifiées et prêtes
                </span>
                <span className="mt-0.5 block font-heading text-xl font-medium tabular-nums text-[#C44F00]">
                  {
                    contractorsInSelectedCanton.filter(
                      (c) => !c.unsubscribed && c.email && c.verified_email !== false
                    ).length
                  }
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3 p-5">
            <div className="flex items-center justify-between text-xs font-medium text-[#0B2240]">
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
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {contractorsInSelectedCanton.map((comp) => {
                  const hasVerifiedEmail = Boolean(
                    comp.email && comp.verified_email !== false
                  );
                  return (
                    <div
                      key={comp.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs transition-colors hover:bg-white"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-medium text-[#0B2240]">
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
                            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                              Refus (STOP)
                            </span>
                          )}
                          {!hasVerifiedEmail && !comp.unsubscribed && (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                              Courriel à vérifier
                            </span>
                          )}
                          {comp.stock_status === 'no_stock_temporarily' && (
                            <span className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[10px] text-slate-600">
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
                        className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-[#0B2240]"
                        aria-label={`Modifier ${comp.name}`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCompanyToDelete(comp)}
                          aria-label={`Retirer ${comp.name}`}
                          title="Supprimer la société"
                        className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
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
                aria-pressed={settings.selected_cantons.includes(selectedCantonMeta.code)}
                className={`flex h-10 w-full items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors ${
                  settings.selected_cantons.includes(selectedCantonMeta.code)
                    ? 'border border-slate-200 bg-white text-[#0B2240] hover:bg-slate-50'
                    : 'bg-[#0B2240] text-white hover:bg-[#173863]'
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
          <div className="max-h-[90vh] w-full max-w-lg space-y-5 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-heading text-lg font-medium text-[#0B2240]">
                  Ajouter une société de chantier
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Laissez le courriel vide si vous avez seulement un téléphone. Jimy écrit uniquement aux adresses vérifiées.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                aria-label="Fermer"
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
                    Canton suisse *
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
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0B2240] text-sm font-medium text-white transition-colors hover:bg-[#173863] disabled:opacity-50"
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
          <div className="max-h-[90vh] w-full max-w-lg space-y-5 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-heading text-lg font-medium text-[#0B2240]">
                  Modifier la société
                </h3>
                <p className="text-xs text-slate-500">
                  Mettez à jour les coordonnées, la langue et l’état du stock.
                </p>
              </div>
              <button
                onClick={() => setEditingCompany(null)}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                aria-label="Fermer"
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
                    <option value="de">Allemand (DE)</option>
                    <option value="fr">Français (FR)</option>
                    <option value="it">Italien (IT)</option>
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
                    <option value="unknown">Inconnu</option>
                    <option value="has_stock">Stock disponible</option>
                    <option value="no_stock_temporarily">Pas de stock pour le moment</option>
                    <option value="opted_out">Refus de contact</option>
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
                  <span className="font-medium text-red-700">Refus de contact (STOP)</span>
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
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0B2240] text-sm font-medium text-white transition-colors hover:bg-[#16365C]"
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
          <div className="w-full max-w-xl space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-heading text-lg font-medium text-[#0B2240]">
                  Importer ou exporter les sociétés vérifiées
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Importez les sociétés avec un fichier CSV ou téléchargez votre liste. Les refus et pauses de 30 jours sont conservés.
                </p>
              </div>
              <button
                onClick={() => setShowCsvModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
              <div>
                <strong className="block text-[#0B2240]">Exporter le répertoire actuel</strong>
                <span className="text-slate-500">
                  CSV protégé avec {companies.length} fiche{companies.length === 1 ? '' : 's'} société
                </span>
              </div>
              <a
                href="/api/companies/export-csv"
                download
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0B2240] px-4 text-xs font-medium text-white hover:bg-[#16365C]"
              >
                <Download className="w-3.5 h-3.5" />
              <span>Télécharger CSV</span>
              </a>
            </div>

            <form onSubmit={handleImportCsv} className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-600">
                  Coller les lignes CSV ou choisir un fichier .csv
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
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 font-mono text-xs text-[#0B2240] focus:border-[#FF6B00] focus:outline-none"
              />

              <button
                type="submit"
                disabled={isImportingCsv}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0B2240] text-sm font-medium text-white transition-colors hover:bg-[#173863] disabled:opacity-50"
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
          <div className="max-h-[90vh] w-full max-w-xl space-y-5 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-heading text-lg font-medium text-[#0B2240]">
                  Liste permanente des refus
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Les adresses et domaines de cette liste ne seront jamais contactés, même après un nouvel import.
                </p>
              </div>
              <button
                onClick={() => setShowSuppressionModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                aria-label="Fermer"
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
          <div className="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading text-lg font-medium text-[#0B2240]">
                    Retirer cette société ?
                  </h3>
                  <p className="text-xs text-slate-500">
                    Les pauses de contact et refus déjà enregistrés sont conservés.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCompanyToDelete(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
              <div className="text-sm font-medium text-[#0B2240]">
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
                className="h-11 flex-1 rounded-lg border border-slate-200 bg-white text-xs font-medium text-[#0B2240] transition-colors hover:bg-slate-50 sm:text-sm"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCompany}
                disabled={isDeletingComp}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50 sm:text-sm"
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
