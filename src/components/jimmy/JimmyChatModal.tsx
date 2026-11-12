import React, { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import {
  ChatComposer,
  ChatLayout,
  ChatMessage,
  ChatMessageBubble,
  ChatMessageList,
} from '@astryxdesign/core/Chat';
import { Drawer, DrawerHeader } from '@astryxdesign/core/Drawer';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { TabId } from '../navigation/BottomBar.tsx';
import {
  JIMMY_MASCOT_SRC,
  JIMMY_MASCOT_ALT,
  type JimmyMascotState,
} from './jimmy-mascot.ts';

type Message = { role: 'user' | 'jimmy'; text: string };

export function JimmyChatModal({
  open,
  onClose,
  onNavigate,
  mascotState = 'waiting',
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: TabId) => void;
  mascotState?: JimmyMascotState;
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'jimmy',
      text: 'Bonsoir, je suis Jimmy. Je peux analyser votre activité, retrouver une réponse, ouvrir une page ou préparer une action pour vous.',
    },
  ]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const submitMessage = async (rawInput: string) => {
    const input = rawInput.trim();
    if (!input || loading) return;
    setText('');
    setMessages((p) => [...p, { role: 'user', text: input }]);
    setLoading(true);
    try {
      const r = await fetch('/api/jimmy/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });
      const d = await r.json();
      if (d.navigate) onNavigate(d.navigate);
      setMessages((p) => [
        ...p,
        { role: 'jimmy', text: d.reply || d.error || 'Je n’ai pas pu terminer cette action.' },
      ]);
    } catch {
      setMessages((p) => [
        ...p,
        { role: 'jimmy', text: 'Je ne peux pas joindre mon poste de contrôle pour le moment.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const prompts = [
    'Montre les nouvelles réponses',
    'Quel est le statut des envois ?',
    'Ouvre les sociétés prêtes',
    'Aide-moi à préparer demain',
  ];

  return (
    <Drawer
      isOpen={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      side="end"
      width={520}
      padding={0}
      label="Assistant Jimmy"
    >
      <div className="flex flex-col h-full bg-[#FFFCFA]">
        <div className="px-6 pt-4 pb-2 bg-white border-b border-orange-100">
          <DrawerHeader
            title="Jimmy"
            subtitle="Votre éclaireur machines en Suisse"
            onOpenChange={(isOpen) => {
              if (!isOpen) onClose();
            }}
            endContent={
              <div className="inline-flex items-center gap-1.5">
                <StatusDot variant="success" isPulsing label="En ligne" />
                <Badge label="En ligne et prêt" variant="orange" />
              </div>
            }
          />
        </div>

        <div className="px-6 pt-3 pb-2 bg-white border-b border-orange-100 flex items-center gap-3">
          <div className="h-14 w-14 shrink-0">
            <img
              src={JIMMY_MASCOT_SRC[mascotState]}
              alt={JIMMY_MASCOT_ALT[mascotState]}
              aria-label="Mascotte Jimmy"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="text-xs text-slate-600">
            Posez une question à Jimmy sur vos dossiers machines, vos envois du jour ou vos cantons actifs.
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          <ChatLayout
            composer={
              <ChatComposer
                value={text}
                onChange={setText}
                onSubmit={(val) => void submitMessage(val)}
                placeholder="Écrivez à Jimmy…"
                isDisabled={loading}
                isStopShown={loading}
              />
            }
          >
            <ChatMessageList>
              <div className="p-4 space-y-4">
                {messages.length === 1 && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-2.5">
                      Que voulez-vous faire ?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {prompts.map((p) => (
                        <Button
                          key={p}
                          label={p}
                          variant="secondary"
                          size="sm"
                          icon={<ArrowUpRight className="w-3.5 h-3.5 text-[#FF6B00]" />}
                          onClick={() => void submitMessage(p)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m, i) => (
                  <ChatMessage
                    key={i}
                    sender={m.role === 'user' ? 'user' : 'assistant'}
                    name={m.role === 'user' ? 'Vous' : 'Jimmy'}
                  >
                    <ChatMessageBubble>{m.text}</ChatMessageBubble>
                  </ChatMessage>
                ))}

                {loading && (
                  <ChatMessage sender="assistant" name="Jimmy">
                    <ChatMessageBubble>Jimmy vérifie le terrain…</ChatMessageBubble>
                  </ChatMessage>
                )}
              </div>
            </ChatMessageList>
          </ChatLayout>
        </div>
      </div>
    </Drawer>
  );
}
