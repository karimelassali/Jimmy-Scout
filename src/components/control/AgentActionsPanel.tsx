import React, { useEffect, useState } from 'react';
import { AgentAction } from '@/packages/types/src/database.ts';
import { Check, Clock3, X } from 'lucide-react';

export const AgentActionsPanel: React.FC = () => {
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch('/api/agent-actions');
    if (res.ok) setActions(await res.json());
  };
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const update = async (id: string, status: 'scheduled' | 'cancelled') => {
    setBusyId(id);
    try {
      await fetch(`/api/agent-actions/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      });
      await load();
    } finally { setBusyId(null); }
  };

  const visible = actions.filter((item) => item.status === 'pending_approval' || item.status === 'scheduled').slice(0, 6);
  if (visible.length === 0) return null;

  return (
    <section className="bg-white rounded-3xl border border-slate-200 p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div><h2 className="font-heading font-bold text-[#0B2240]">Actions de Jimy</h2><p className="text-xs text-slate-500">Vous pouvez valider ou annuler chaque action.</p></div>
        <span className="px-2.5 py-1 rounded-full bg-orange-50 text-[#C94F00] text-xs font-bold">{visible.length}</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        {visible.map((action) => (
          <div key={action.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="flex items-start gap-2"><Clock3 className="w-4 h-4 text-[#FF6B00] mt-0.5 shrink-0" /><div className="min-w-0 flex-1"><div className="text-sm font-bold text-[#0B2240]">{action.title}</div><div className="text-xs text-slate-600 mt-1">{action.reason}</div><div className="text-[11px] text-slate-500 mt-1">Règle : {action.rule}</div><div className="text-[11px] font-medium text-[#0B2240] mt-1">Prévu : {new Date(action.scheduled_for).toLocaleString('fr-CH')}</div></div></div>
            <div className="flex gap-2 mt-3">
              {action.status === 'pending_approval' && <button type="button" disabled={busyId === action.id} onClick={() => void update(action.id, 'scheduled')} className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"><Check className="w-3.5 h-3.5" />Valider</button>}
              <button type="button" disabled={busyId === action.id} onClick={() => void update(action.id, 'cancelled')} className="h-8 px-3 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"><X className="w-3.5 h-3.5" />Annuler</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
