import React, { useEffect, useState } from 'react';
import { AgentFeatureControls, AgentSettings, AutomationMode, WatchlistRule } from '@/packages/types/src/database.ts';
import { Bot, CheckCircle2, Plus, Trash2 } from 'lucide-react';

interface Props {
  settings: AgentSettings;
  onUpdateSettings: (patch: Partial<AgentSettings>) => Promise<void>;
}

const features: Array<{ key: keyof AgentFeatureControls; name: string; text: string; canAsk?: boolean }> = [
  { key: 'deal_scoring', name: 'Score de l’affaire', text: 'Classe chaque dossier de 0 à 100.' },
  { key: 'follow_ups', name: 'Relances', text: 'Relance après 4 jours, puis une dernière après 9 jours.', canAsk: true },
  { key: 'qualification', name: 'Questions au vendeur', text: 'Demande les informations qui manquent.', canAsk: true },
  { key: 'price_comparison', name: 'Comparaison du prix', text: 'Estime une fourchette et la marge possible.' },
  { key: 'watchlists', name: 'Listes de recherche', text: 'Signale une machine qui respecte vos règles.' },
  { key: 'daily_briefing', name: 'Résumé Telegram', text: 'Envoie les meilleures affaires et les actions du jour.', canAsk: true },
  { key: 'negotiation', name: 'Aide à la négociation', text: 'Prépare un premier prix, un prix maximum et un message.', canAsk: true },
  { key: 'seller_intelligence', name: 'Qualité du vendeur', text: 'Montre son historique et un score de confiance.' },
];

const modes: Array<{ id: AutomationMode; label: string }> = [
  { id: 'off', label: 'Arrêt' },
  { id: 'approval', label: 'Me demander' },
  { id: 'auto', label: 'Auto' },
];

export const AgentControlsPanel: React.FC<Props> = ({ settings, onUpdateSettings }) => {
  const [watchlists, setWatchlists] = useState<WatchlistRule[]>([]);
  const [name, setName] = useState('Bonne pelle');
  const [keywords, setKeywords] = useState('pelle, excavatrice, bagger');
  const [saving, setSaving] = useState(false);

  const loadWatchlists = async () => {
    const res = await fetch('/api/watchlists');
    if (res.ok) setWatchlists(await res.json());
  };

  useEffect(() => { void loadWatchlists(); }, []);

  const changeMode = async (key: keyof AgentFeatureControls, mode: AutomationMode) => {
    await onUpdateSettings({ feature_controls: { ...settings.feature_controls, [key]: mode } });
  };

  const createWatchlist = async () => {
    const words = keywords.split(',').map((item) => item.trim()).filter(Boolean);
    if (!name.trim() || words.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch('/api/watchlists', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), keywords: words, enabled: true }),
      });
      if (res.ok) { setName(''); setKeywords(''); await loadWatchlists(); }
    } finally { setSaving(false); }
  };

  const removeWatchlist = async (id: string) => {
    await fetch(`/api/watchlists/${id}`, { method: 'DELETE' });
    await loadWatchlists();
  };

  return (
    <section className="bg-white rounded-3xl p-5 border border-slate-200/90 space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-orange-50 text-[#FF6B00] flex items-center justify-center shrink-0"><Bot className="w-5 h-5" /></div>
        <div>
          <h2 className="font-heading font-bold text-[#0B2240]">Ce que Jimy peut faire seul</h2>
          <p className="text-xs text-slate-600 mt-1">Le bouton principal arrête tout. Ici, vous choisissez le niveau de liberté pour chaque travail.</p>
        </div>
      </div>

      <div className="space-y-3">
        {features.map((feature) => (
          <div key={feature.key} className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="font-semibold text-sm text-[#0B2240]">{feature.name}</div>
            <div className="text-xs text-slate-500 mt-0.5">{feature.text}</div>
            <div className={`grid ${feature.canAsk ? 'grid-cols-3' : 'grid-cols-2'} gap-1.5 mt-3`} role="group" aria-label={`Mode pour ${feature.name}`}>
              {modes.filter((mode) => feature.canAsk || mode.id !== 'approval').map((mode) => {
                const active = settings.feature_controls[feature.key] === mode.id;
                return <button key={mode.id} type="button" onClick={() => void changeMode(feature.key, mode.id)} className={`h-8 rounded-lg text-[11px] font-semibold border transition-colors ${active ? 'bg-[#0B2240] text-white border-[#0B2240]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>{mode.label}</button>;
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-200 pt-4 space-y-3">
        <div>
          <h3 className="font-bold text-sm text-[#0B2240]">Mes listes de recherche</h3>
          <p className="text-xs text-slate-500">Exemple : pelle CAT, camion Volvo ou concasseur.</p>
        </div>
        {watchlists.map((rule) => (
          <div key={rule.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div className="min-w-0 flex-1"><div className="text-xs font-bold text-emerald-900 truncate">{rule.name}</div><div className="text-[11px] text-emerald-700 truncate">{rule.keywords.join(', ')}</div></div>
            <button type="button" aria-label={`Supprimer ${rule.name}`} onClick={() => void removeWatchlist(rule.id)} className="p-2 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        <div className="grid grid-cols-1 gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de la liste" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
          <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="Mots séparés par une virgule" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
          <button type="button" disabled={saving} onClick={() => void createWatchlist()} className="h-10 rounded-xl bg-[#FF6B00] text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"><Plus className="w-4 h-4" />{saving ? 'Ajout...' : 'Ajouter la liste'}</button>
        </div>
      </div>
    </section>
  );
};
