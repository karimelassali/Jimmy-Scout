import React, { useState } from 'react';
import { Bot, Send, Sparkles, X } from 'lucide-react';
import { TabId } from '../navigation/BottomBar.tsx';

type Message = { role: 'user' | 'jimmy'; text: string };
export function JimmyChatModal({ open, onClose, onNavigate }: { open: boolean; onClose: () => void; onNavigate: (tab: TabId) => void }) {
  const [messages, setMessages] = useState<Message[]>([{ role: 'jimmy', text: 'Bonsoir, je suis Jimmy. Je peux analyser votre activité, retrouver une réponse, ouvrir une page ou préparer une action pour vous.' }]);
  const [text, setText] = useState(''); const [loading, setLoading] = useState(false);
  if (!open) return null;
  const send = async (e: React.FormEvent) => { e.preventDefault(); const input = text.trim(); if (!input || loading) return; setText(''); setMessages(p => [...p, { role: 'user', text: input }]); setLoading(true);
    try { const r = await fetch('/api/jimmy/chat', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ message: input }) }); const d = await r.json(); if (d.navigate) onNavigate(d.navigate); setMessages(p => [...p, { role:'jimmy', text:d.reply || d.error || 'Je n’ai pas pu terminer cette action.' }]); }
    catch { setMessages(p => [...p, { role:'jimmy', text:'Je ne peux pas joindre mon poste de contrôle pour le moment.' }]); } finally { setLoading(false); } };
  return <div className="fixed inset-0 z-[60] flex justify-end bg-slate-950/35 backdrop-blur-sm" onMouseDown={onClose}><section onMouseDown={e=>e.stopPropagation()} className="w-full max-w-lg h-full bg-[#f8fafc] shadow-2xl flex flex-col">
    <header className="p-5 bg-[#0B2240] text-white flex items-center gap-3"><div className="w-11 h-11 rounded-2xl bg-[#FF6B00] flex items-center justify-center"><Sparkles className="w-5 h-5"/></div><div className="flex-1"><h2 className="font-bold">Parler avec Jimmy</h2><p className="text-xs text-slate-300">Votre copilote d’achat suisse</p></div><button onClick={onClose}><X/></button></header>
    <div className="flex-1 overflow-y-auto p-5 space-y-4">{messages.map((m,i)=><div key={i} className={`flex ${m.role==='user'?'justify-end':'justify-start'}`}><div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${m.role==='user'?'bg-[#0B2240] text-white rounded-br-md':'bg-white border border-slate-200 text-slate-700 shadow-sm rounded-bl-md'}`}>{m.role==='jimmy'&&<Bot className="inline w-4 h-4 text-[#FF6B00] mr-2"/>}{m.text}</div></div>)}{loading&&<div className="text-sm text-slate-500 animate-pulse">Jimmy réfléchit…</div>}</div>
    <form onSubmit={send} className="p-4 bg-white border-t flex gap-2"><input value={text} onChange={e=>setText(e.target.value)} placeholder="Ex. montre-moi les nouvelles réponses" className="flex-1 h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#FF6B00]"/><button className="w-11 h-11 rounded-xl bg-[#FF6B00] text-white flex items-center justify-center"><Send className="w-4 h-4"/></button></form>
  </section></div>;
}
