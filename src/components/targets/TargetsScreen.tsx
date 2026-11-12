import React, { useState, useEffect } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { AgentSettings, Company, SuppressionEntry } from '@/packages/types/src/database.ts';
import { ALL_SWISS_CANTONS } from '@/packages/types/src/swiss.ts';
import { POOL_SAMPLE } from '@/src/data/pool-sample.ts';
import {
  filterCompanies,
  filterPool,
  getCompanyStatus,
  type StatusFilter,
} from './targets-helpers.ts';
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
  ChevronDown,
  Mail,
  Phone,
  Globe,
  Wrench,
  Settings,
} from 'lucide-react';

interface TargetsScreenProps {
  settings: AgentSettings;
  companies: Company[];
  onUpdateSettings: (patch: Partial<AgentSettings>) => Promise<void>;
  onRefreshCompanies: () => Promise<void>;
  onNavigateToScanner?: () => void;
}

type ScreenView = 'ready' | 'pool';

const DEV_MODE_KEY = 'jimyscout-dev-mode';

export const TargetsScreen: React.FC<TargetsScreenProps> = ({
  settings,
  companies,
  onUpdateSettings,
  onRefreshCompanies,
  onNavigateToScanner,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [cantonFilter, setCantonFilter] = useState('all');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dailyPace, setDailyPace] = useState(settings.daily_limit);
  const [toast, setToast] = useState<{ msg: string; isError?: boolean } | null>(null);

  // Developer mode: OFF by default, persisted locally. Only ever shows the
  // raw harvest pool; normal users never see it.
  const [devMode, setDevMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DEV_MODE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [view, setView] = useState<ScreenView>('ready');
  const [poolSearch, setPoolSearch] = useState('');

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

  const handleToggleDevMode = () => {
    const next = !devMode;
    setDevMode(next);
    try {
      if (next) {
        localStorage.setItem(DEV_MODE_KEY, '1');
      } else {
        localStorage.removeItem(DEV_MODE_KEY);
      }
    } catch {
      // localStorage unavailable: dev mode stays in-memory only.
    }
    if (!next) setView('ready');
    showToast(next ? 'Mode développeur activé — visible uniquement pour vous' : 'Mode développeur désactivé');
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

  const isPoolView = devMode && view === 'pool';

  const activeContractorsTotal = companies.filter(
    (c) =>
      settings.selected_cantons.includes(c.canton) &&
      !c.unsubscribed &&
      c.email &&
      c.verified_email !== false
  ).length;

  const readyCount = companies.filter((c) => getCompanyStatus(c) === 'ready').length;
  const toVerifyCount = companies.filter((c) => getCompanyStatus(c) === 'to_verify').length;
  const noEmailCount = companies.filter((c) => getCompanyStatus(c) === 'no_email').length;

  const filteredCompanies = filterCompanies(
    companies,
    searchTerm,
    cantonFilter,
    languageFilter,
    statusFilter
  );

  const cantonsPresent = Array.from(
    new Set(companies.map((c) => c.canton.toUpperCase()))
  ).sort();

  const filteredPool = filterPool(POOL_SAMPLE, poolSearch);

  const openAddModal = () => {
    setNewCompCanton(settings.selected_cantons[0] || 'ZH');
    setShowAddModal(true);
  };

  const statusChips: { id: StatusFilter; label: string; count: number }[] = [
    { id: 'all', label: 'Toutes', count: companies.length },
    { id: 'ready', label: 'Prêtes', count: readyCount },
    { id: 'to_verify', label: 'À vérifier', count: toVerifyCount },
    { id: 'no_email', label: 'Sans e-mail', count: noEmailCount },
  ];

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

      {/* Page heading */}
      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
            <StatusDot variant="warning" label="Cantons actifs" />
            <span>{settings.selected_cantons.length} cantons actifs · {activeContractorsTotal} sociétés prêtes</span>
          </div>
          <h1 className="font-heading text-3xl font-medium leading-tight text-[#0B2240] sm:text-4xl">
            {isPoolView ? (
              <>
                Pool (récolte){' '}
                <span className="ml-1 inline-flex items-center rounded-full bg-[#0B2240] px-3 py-1 align-middle text-sm font-bold text-white">
                  {POOL_SAMPLE.length}
                </span>
              </>
            ) : (
              <>
                Entreprises prêtes{' '}
                <span className="ml-1 inline-flex items-center rounded-full bg-[#0B2240] px-3 py-1 align-middle text-sm font-bold text-white">
                  {companies.length}
                </span>
              </>
            )}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
            {isPoolView
              ? 'Liste brute récoltée, sans e-mail pour l’instant. Jimmy vérifie chaque entreprise avant qu’elle apparaisse dans « Entreprises prêtes ».'
              : 'Les sociétés vérifiées, avec leur ville et leur canton — prêtes à être contactées.'}
          </p>
          {!isPoolView && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-slate-400">
              <MapPin className="w-3.5 h-3.5" />
              <span>La ville de chaque entreprise vient du registre des entreprises (LINDAS / Zefix).</span>
            </p>
          )}
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {/* Developer toggle — OFF by default, local only. */}
          <div className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
            <Wrench className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-medium text-slate-600">Développeur</span>
            <button
              type="button"
              role="switch"
              aria-checked={devMode}
              aria-label="Mode développeur"
              onClick={handleToggleDevMode}
              className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                devMode ? 'bg-[#FF6B00]' : 'bg-slate-300'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  devMode ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          {!isPoolView && (
            <>
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
                onClick={openAddModal}
                icon={<Plus className="w-4 h-4" />}
              />
            </>
          )}
        </div>
      </section>

      {/* Developer banner + view switch — only visible in dev mode. */}
      {devMode && (
        <section className="space-y-3">
          <div className="rounded-xl bg-[#FF6B00] px-4 py-2.5 text-sm font-medium text-white">
            Mode développeur activé — visible uniquement pour vous
          </div>
          <SegmentedControl
            label="Vue développeur"
            size="sm"
            value={view}
            onChange={(val) => setView(val as ScreenView)}
          >
            <SegmentedControlItem value="ready" label="Entreprises prêtes" />
            <SegmentedControlItem value="pool" label={`Pool (récolte) · ${POOL_SAMPLE.length}`} />
          </SegmentedControl>
        </section>
      )}

      {isPoolView ? (
        <>
          {/* POOL VIEW — raw harvest, developer only */}
          <section className="rounded-xl border border-amber-200 bg-[#FFF4E8] p-4 text-sm leading-6 text-slate-700">
            <strong className="text-[#0B2240]">Échantillon LINDAS — {POOL_SAMPLE.length} sociétés.</strong>{' '}
            Liste brute récoltée (LINDAS) — sans e-mail pour l’instant. Jimmy vérifie chaque
            entreprise avant qu’elle apparaisse dans « Entreprises prêtes ».
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="relative flex h-11 max-w-md items-center rounded-lg border border-slate-200 bg-white px-3 focus-within:border-[#0B2240]">
              <Search className="w-4 h-4 text-slate-400 mr-3 shrink-0" />
              <input
                type="text"
                value={poolSearch}
                onChange={(e) => setPoolSearch(e.target.value)}
                placeholder="Rechercher dans le pool (nom, ville, UID)…"
                className="w-full bg-transparent text-sm text-[#0B2240] placeholder:text-slate-400 focus:outline-none"
                aria-label="Rechercher dans le pool"
              />
              {poolSearch && (
                <button
                  type="button"
                  onClick={() => setPoolSearch('')}
                  className="text-slate-400 hover:text-[#0B2240] p-1 cursor-pointer"
                  aria-label="Effacer la recherche"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="mt-3 text-[13px] text-slate-400">
              {filteredPool.length} entreprise{filteredPool.length === 1 ? '' : 's'} affichée{filteredPool.length === 1 ? '' : 's'} sur {POOL_SAMPLE.length}
            </p>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            {filteredPool.length === 0 ? (
              <div className="p-11 text-center">
                <p className="text-sm font-medium text-[#0B2240]">Aucune entreprise ne correspond à cette recherche.</p>
                <p className="mt-1 text-xs text-slate-500">Essayez un autre mot, ou effacez la recherche.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filteredPool.map((entry) => (
                  <li key={entry.uid} className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-bold text-[#0B2240]">{entry.name}</div>
                      <div className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">{entry.purpose}</div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                      <span className="font-mono text-xs text-slate-400">{entry.uid}</span>
                      <span className="flex items-center gap-1 text-sm text-slate-500">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {entry.city}
                        <span className="rounded-md bg-[#EAF0F8] px-2 py-0.5 text-xs font-bold text-[#0B2240]">
                          {entry.canton}
                        </span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <>
          {/* FILTERS CARD */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <h2 className="font-heading text-base font-medium text-[#0B2240]">Recherche et filtres</h2>
            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="relative flex h-11 flex-1 items-center rounded-lg border border-slate-200 bg-white px-3 focus-within:border-[#0B2240]">
                <Search className="w-4 h-4 text-slate-400 mr-3 shrink-0" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Rechercher une entreprise…"
                  className="w-full bg-transparent text-sm text-[#0B2240] placeholder:text-slate-400 focus:outline-none"
                  aria-label="Rechercher une entreprise ou une ville"
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

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Canton</label>
                <select
                  value={cantonFilter}
                  onChange={(e) => setCantonFilter(e.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-[#0B2240] focus:border-[#FF6B00] focus:outline-none lg:w-44"
                  aria-label="Filtrer par canton"
                >
                  <option value="all">Tous les cantons</option>
                  {cantonsPresent.map((code) => (
                    <option key={code} value={code}>
                      Canton {code}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Langue</label>
                <select
                  value={languageFilter}
                  onChange={(e) => setLanguageFilter(e.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-[#0B2240] focus:border-[#FF6B00] focus:outline-none lg:w-44"
                  aria-label="Filtrer par langue"
                >
                  <option value="all">Toutes les langues</option>
                  <option value="de">Allemand (DE)</option>
                  <option value="fr">Français (FR)</option>
                  <option value="it">Italien (IT)</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {statusChips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setStatusFilter(chip.id)}
                  aria-pressed={statusFilter === chip.id}
                  className={`flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-colors ${
                    statusFilter === chip.id
                      ? 'bg-[#0B2240] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {chip.label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
                      statusFilter === chip.id ? 'bg-white/20 text-white' : 'bg-white text-slate-500'
                    }`}
                  >
                    {chip.count}
                  </span>
                </button>
              ))}
            </div>

            <p className="mt-3 text-[13px] text-slate-400">
              {filteredCompanies.length} entreprise{filteredCompanies.length === 1 ? '' : 's'} affichée{filteredCompanies.length === 1 ? '' : 's'} sur {companies.length}
            </p>
          </section>

          {/* READY COMPANIES LIST */}
          <section
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            data-tour="company-database"
          >
            {filteredCompanies.length === 0 ? (
              <div className="p-11 text-center">
                <Building2 className="w-6 h-6 text-slate-400 mx-auto" />
                {statusFilter === 'to_verify' || statusFilter === 'no_email' ? (
                  <>
                    <p className="mt-2 text-sm font-medium text-[#0B2240]">Rien à vérifier pour le moment.</p>
                    <p className="mt-1 text-xs text-slate-500">Toutes les entreprises prêtes sont dans la liste ci-dessus.</p>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-sm font-medium text-[#0B2240]">Aucune entreprise ne correspond à ces critères.</p>
                    <p className="mt-1 text-xs text-slate-500">Essayez un autre mot, ou effacez les filtres.</p>
                  </>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filteredCompanies.map((comp) => {
                  const status = getCompanyStatus(comp);
                  const hasVerifiedEmail = Boolean(comp.email && comp.verified_email !== false);
                  const isExpanded = expandedCompanyId === comp.id;
                  return (
                    <li key={comp.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        onClick={() => setExpandedCompanyId(isExpanded ? null : comp.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setExpandedCompanyId(isExpanded ? null : comp.id);
                          }
                        }}
                        className="flex w-full cursor-pointer flex-col gap-3 px-4 py-4 text-left transition-colors hover:bg-[#EAF0F8] sm:flex-row sm:items-center sm:justify-between sm:px-5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-base font-bold text-[#0B2240]">{comp.name}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              {comp.city || 'Ville inconnue'}
                            </span>
                            <span className="rounded-md bg-[#EAF0F8] px-2 py-0.5 text-xs font-bold text-[#0B2240]">
                              {comp.canton}
                            </span>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
                            <Mail className="w-4 h-4 text-slate-400" />
                            <span className="max-w-56 truncate font-mono text-[13px]">
                              {comp.email || 'Pas de courriel, téléphone seulement'}
                            </span>
                          </span>
                          {hasVerifiedEmail && (
                            <span className="text-xs font-bold text-[#178A5B]">✓ vérifié</span>
                          )}
                          <span className="rounded-md bg-[#EEF2F7] px-2 py-0.5 text-[11px] font-bold uppercase text-slate-600">
                            {comp.language || 'de'}
                          </span>
                          {status === 'ready' && (
                            <span className="rounded-full bg-[#E6F5EE] px-2.5 py-1 text-xs font-bold text-[#178A5B]">
                              ● Prête
                            </span>
                          )}
                          {status === 'to_verify' && (
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                              Courriel à vérifier
                            </span>
                          )}
                          {status === 'no_email' && (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                              Sans e-mail
                            </span>
                          )}
                          {status === 'refused' && (
                            <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                              Refus (STOP)
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCompany({ ...comp });
                            }}
                            title="Modifier la société"
                            aria-label={`Modifier ${comp.name}`}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-[#0B2240]"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCompanyToDelete(comp);
                            }}
                            aria-label={`Retirer ${comp.name}`}
                            title="Supprimer la société"
                            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <ChevronDown
                            className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          />
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mx-4 mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:mx-5">
                          <div className="flex flex-col gap-3 text-sm sm:flex-row sm:gap-8">
                            <div>
                              <div className="text-[11px] font-medium text-slate-400">Téléphone</div>
                              <div className="mt-0.5 flex items-center gap-1.5 font-medium text-[#0B2240]">
                                <Phone className="w-3.5 h-3.5 text-[#FF6B00]" />
                                {comp.phone || '—'}
                              </div>
                            </div>
                            <div>
                              <div className="text-[11px] font-medium text-slate-400">Site web</div>
                              <div className="mt-0.5 flex items-center gap-1.5 font-medium">
                                <Globe className="w-3.5 h-3.5 text-[#FF6B00]" />
                                {comp.website ? (
                                  <a
                                    href={comp.website.startsWith('http') ? comp.website : `https://${comp.website}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-[#0B2240] hover:underline"
                                  >
                                    {comp.website}
                                  </a>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </div>
                            </div>
                            {comp.contact_person && (
                              <div>
                                <div className="text-[11px] font-medium text-slate-400">Contact</div>
                                <div className="mt-0.5 font-medium text-[#0B2240]">{comp.contact_person}</div>
                              </div>
                            )}
                          </div>
                          {!comp.phone && !comp.website && (
                            <p className="mt-3 text-xs text-slate-400">
                              Pas de téléphone ni de site web dans le registre.
                            </p>
                          )}
                          {comp.stock_status === 'no_stock_temporarily' && (
                            <span className="mt-3 inline-block rounded bg-slate-200/70 px-1.5 py-0.5 text-[11px] text-slate-600">
                              Pas de stock, pause de 30 jours
                            </span>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* COLLAPSED SEARCH SETTINGS */}
          <section
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            data-tour="canton-selection"
          >
            <button
              type="button"
              onClick={() => setSettingsOpen(!settingsOpen)}
              aria-expanded={settingsOpen}
              className="flex min-h-13 w-full items-center gap-3 px-5 py-4 text-left"
            >
              <Settings className="w-5 h-5 shrink-0 text-slate-400" />
              <span className="font-heading text-base font-bold text-[#0B2240]">
                Réglages de la recherche
              </span>
              <span className="ml-auto hidden text-[13px] text-slate-400 sm:block">
                Cantons actifs et rythme quotidien
              </span>
              <ChevronDown
                className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${
                  settingsOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {settingsOpen && (
              <div className="border-t border-slate-100 px-5 pb-5 pt-4">
                <h3 className="text-sm font-bold text-slate-600">Cantons où Jimmy cherche</h3>
                <p className="mt-1 text-[13px] text-slate-400">
                  Touchez un canton pour l’activer ou le désactiver. Les cantons en bleu sont actifs.
                </p>
                <button
                  type="button"
                  onClick={handleSelectAllCantons}
                  className="mt-3 h-9 rounded-lg border border-orange-200 bg-orange-50 px-3 text-xs font-medium text-[#C44F00] transition-colors hover:bg-orange-100"
                >
                  Activer les 26 cantons
                </button>
                <div className="mt-3 flex flex-wrap gap-2">
                  {ALL_SWISS_CANTONS.map((canton) => {
                    const isActive = settings.selected_cantons.includes(canton.code);
                    return (
                      <button
                        key={canton.code}
                        type="button"
                        onClick={() => void handleToggleCanton(canton.code)}
                        aria-pressed={isActive}
                        title={`${canton.name} (${canton.code})`}
                        className={`min-w-12 rounded-lg border px-3 py-1.5 text-[13px] font-bold transition-colors ${
                          isActive
                            ? 'border-[#0B2240] bg-[#0B2240] text-white'
                            : 'border-slate-200 bg-white text-slate-400 hover:border-[#0B2240] hover:text-[#0B2240]'
                        }`}
                      >
                        {canton.code}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 max-w-md">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-medium text-[#0B2240]">
                      <Sliders className="w-4 h-4 text-slate-400" />
                      Rythme quotidien
                    </span>
                    <span className="text-sm text-slate-500">
                      <b className="text-lg text-[#FF6B00]">{dailyPace}</b> e-mails / jour
                    </span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="5"
                    value={dailyPace}
                    onChange={(e) => void handlePaceChange(Number(e.target.value))}
                    className="mt-3 w-full cursor-pointer accent-[#FF6B00]"
                    aria-label="Rythme quotidien d’envoi"
                  />
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                    <span>5 / jour (doux)</span>
                    <span>25 / jour (conseillé)</span>
                    <span>50 / jour (rapide)</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Envoi automatique du lundi au vendredi, de 08 h 30 à 17 h 00, heure de Zurich
                  </p>
                </div>
              </div>
            )}
          </section>
        </>
      )}

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
                    Ville
                  </label>
                  <input
                    type="text"
                    value={editingCompany.city || ''}
                    onChange={(e) =>
                      setEditingCompany({ ...editingCompany, city: e.target.value })
                    }
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-[#0B2240]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    Code postal
                  </label>
                  <input
                    type="text"
                    value={editingCompany.postal_code || ''}
                    onChange={(e) =>
                      setEditingCompany({ ...editingCompany, postal_code: e.target.value })
                    }
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 font-mono text-sm text-[#0B2240]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
