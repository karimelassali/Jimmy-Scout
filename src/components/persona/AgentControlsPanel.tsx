import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AgentFeatureControls, AgentSettings, AutomationMode, WatchlistRule } from '@/packages/types/src/database.ts';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { IconButton } from '@astryxdesign/core/IconButton';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { TextInput } from '@astryxdesign/core/TextInput';
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

/**
 * Optimistic local copy of one server setting (QA #3).
 *
 * The visible control updates the instant the user clicks it. The `settings`
 * prop is adopted only when it agrees with the latest local choice, or when
 * it changed for a reason other than one of our own saves. A PATCH response
 * that arrives late — after a newer click already changed the value — must
 * never flip the control back, so saves are tracked by request id: only the
 * newest save's settlement may reconcile the local value, and an older
 * response landing afterwards is ignored.
 * (Same helper is duplicated in PersonaScreen.tsx for its own controls.)
 */
function useOptimisticSetting<T>(
  serverValue: T,
  isEqual: (a: T, b: T) => boolean
) {
  const [localValue, setLocalValue] = useState<T>(serverValue);
  const intentRef = useRef<T>(serverValue);
  const previousIntentRef = useRef<T>(serverValue);
  const inFlightRef = useRef(0);
  const latestReqRef = useRef(0);
  const lastSettledReqRef = useRef(0);
  const isEqualRef = useRef(isEqual);
  isEqualRef.current = isEqual;

  useEffect(() => {
    // A save is still running: the prop may still reflect an older PATCH.
    if (inFlightRef.current > 0) return;
    if (isEqualRef.current(serverValue, intentRef.current)) {
      // Server agrees with the latest choice (or nothing changed locally).
      lastSettledReqRef.current = latestReqRef.current;
      setLocalValue(serverValue);
      return;
    }
    if (lastSettledReqRef.current === latestReqRef.current) {
      // Every save settled in order, yet the server disagrees: the change
      // came from elsewhere (another screen, a refetch) — adopt it.
      intentRef.current = serverValue;
      previousIntentRef.current = serverValue;
      setLocalValue(serverValue);
    }
    // Otherwise an older PATCH response landed after a newer one: ignore it.
  }, [serverValue]);

  // Record a user change: show it immediately, return the request id and
  // the resolved value to save. Accepts an updater so two clicks in a row
  // always build on the latest choice, not on a stale render.
  const beginChange = useCallback(
    (next: T | ((prev: T) => T)): { reqId: number; value: T } => {
      const value =
        typeof next === 'function'
          ? (next as (prev: T) => T)(intentRef.current)
          : next;
      previousIntentRef.current = intentRef.current;
      intentRef.current = value;
      setLocalValue(value);
      latestReqRef.current += 1;
      inFlightRef.current += 1;
      return { reqId: latestReqRef.current, value };
    },
    []
  );

  // Record that the save for `reqId` settled. A failed newest save rolls
  // the visible value back; a stale (out-of-order) settlement changes nothing.
  const settleChange = useCallback((reqId: number, ok: boolean) => {
    inFlightRef.current = Math.max(0, inFlightRef.current - 1);
    lastSettledReqRef.current = reqId;
    if (!ok && reqId === latestReqRef.current) {
      intentRef.current = previousIntentRef.current;
      setLocalValue(previousIntentRef.current);
    }
  }, []);

  return { value: localValue, beginChange, settleChange };
}

const FEATURE_KEYS: Array<keyof AgentFeatureControls> = [
  'deal_scoring',
  'follow_ups',
  'qualification',
  'price_comparison',
  'watchlists',
  'daily_briefing',
  'negotiation',
  'seller_intelligence',
];

function sameFeatureControls(
  a: AgentFeatureControls,
  b: AgentFeatureControls
): boolean {
  return FEATURE_KEYS.every((key) => a[key] === b[key]);
}

export const AgentControlsPanel: React.FC<Props> = ({ settings, onUpdateSettings }) => {
  const [watchlists, setWatchlists] = useState<WatchlistRule[]>([]);
  const [name, setName] = useState('Bonne pelle');
  const [keywords, setKeywords] = useState('pelle, excavatrice, bagger');
  const [saving, setSaving] = useState(false);

  // Optimistic copy of the feature modes (QA #3): the segmented controls
  // read this, so they move instantly and a late PATCH response for an
  // older click cannot flip them back.
  const controlsSetting = useOptimisticSetting(
    settings.feature_controls,
    sameFeatureControls
  );

  const loadWatchlists = async () => {
    const res = await fetch('/api/watchlists');
    if (res.ok) setWatchlists(await res.json());
  };

  useEffect(() => { void loadWatchlists(); }, []);

  const changeMode = async (key: keyof AgentFeatureControls, mode: AutomationMode) => {
    if (controlsSetting.value[key] === mode) return;
    const { reqId, value: next } = controlsSetting.beginChange((prev) => ({
      ...prev,
      [key]: mode,
    }));
    try {
      await onUpdateSettings({ feature_controls: next });
      controlsSetting.settleChange(reqId, true);
    } catch {
      controlsSetting.settleChange(reqId, false);
    }
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
    <Card>
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-50 text-[#FF6B00] flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-[#0B2240]">Ce que Jimy peut faire seul</h2>
            <p className="text-xs text-slate-600 mt-1">
              Le bouton principal arrête tout. Ici, vous choisissez le niveau de liberté pour chaque travail.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {features.map((feature) => {
            const availableModes = modes.filter((mode) => feature.canAsk || mode.id !== 'approval');
            return (
              <div key={feature.key} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div>
                  <div className="font-semibold text-sm text-[#0B2240]">{feature.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{feature.text}</div>
                </div>
                <SegmentedControl
                  label={`Mode pour ${feature.name}`}
                  size="sm"
                  layout="fill"
                  value={controlsSetting.value[feature.key]}
                  onChange={(val) => void changeMode(feature.key, val as AutomationMode)}
                >
                  {availableModes.map((mode) => (
                    <SegmentedControlItem
                      key={mode.id}
                      value={mode.id}
                      label={mode.label}
                    />
                  ))}
                </SegmentedControl>
              </div>
            );
          })}
        </div>

        <div className="border-t border-slate-200 pt-4 space-y-3">
          <div>
            <h3 className="font-bold text-sm text-[#0B2240]">Mes listes de recherche</h3>
            <p className="text-xs text-slate-500">Exemple : pelle CAT, camion Volvo ou concasseur.</p>
          </div>
          {watchlists.map((rule) => (
            <div key={rule.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-emerald-900 truncate">{rule.name}</div>
                <div className="text-[11px] text-emerald-700 truncate">{rule.keywords.join(', ')}</div>
              </div>
              <IconButton
                label={`Supprimer ${rule.name}`}
                variant="ghost"
                size="sm"
                icon={<Trash2 className="w-4 h-4 text-slate-500" />}
                onClick={() => void removeWatchlist(rule.id)}
              />
            </div>
          ))}
          <div className="grid grid-cols-1 gap-2.5">
            <TextInput
              label="Nom de la liste"
              isLabelHidden
              value={name}
              onChange={setName}
              placeholder="Nom de la liste"
            />
            <TextInput
              label="Mots-clés"
              isLabelHidden
              value={keywords}
              onChange={setKeywords}
              placeholder="Mots séparés par une virgule"
            />
            <Button
              label="Ajouter la liste"
              variant="primary"
              size="md"
              isLoading={saving}
              icon={<Plus className="w-4 h-4" />}
              onClick={() => void createWatchlist()}
              width="100%"
            />
          </div>
        </div>
      </div>
    </Card>
  );
};
