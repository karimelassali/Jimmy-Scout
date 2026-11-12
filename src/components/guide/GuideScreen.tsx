import React, { useState } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import type { TabId } from '../navigation/BottomBar.tsx';
import {
  ArrowRight,
  Bell,
  Bot,
  Camera,
  CheckCircle2,
  FileText,
  Gauge,
  HelpCircle,
  Inbox,
  ListChecks,
  MailCheck,
  MapPin,
  Pause,
  Play,
  Settings2,
  ShieldCheck,
  Sparkles,
  X,
  ZoomIn,
} from 'lucide-react';

type AppTab = Exclude<TabId, 'guide'>;

interface GuideScreenProps {
  onNavigate: (tab: AppTab) => void;
}

interface ScreenshotProps {
  src: string;
  alt: string;
  onOpen: (src: string) => void;
  caption?: string;
}

const Screenshot: React.FC<ScreenshotProps> = ({ src, alt, onOpen, caption }) => (
  <button
    type="button"
    onClick={() => onOpen(src)}
    className="group relative w-full overflow-hidden rounded-3xl border border-slate-200 bg-white text-left shadow-sm"
    aria-label={`Agrandir : ${alt}`}
  >
    <img src={src} alt={alt} loading="lazy" className="block w-full h-auto" />
    <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-[#0B2240]/90 px-3 py-1.5 text-xs font-semibold text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
      <ZoomIn className="h-3.5 w-3.5" /> Agrandir
    </span>
    {caption && (
      <span className="block px-4 py-2 text-xs text-slate-500">{caption}</span>
    )}
  </button>
);

const StepNumber: React.FC<{ number: number }> = ({ number }) => (
  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FF6B00] font-mono text-sm font-bold text-white">
    {number}
  </span>
);

const SimplePoint: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4">
    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
    <div>
      <div className="font-bold text-[#0B2240]">{title}</div>
      <div className="mt-1 text-sm leading-6 text-slate-600">{children}</div>
    </div>
  </div>
);

export const GuideScreen: React.FC<GuideScreenProps> = ({ onNavigate }) => {
  const [largeImage, setLargeImage] = useState<string | null>(null);

  const jumpTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="pb-24 md:pb-12">
      <section className="relative overflow-hidden rounded-[32px] bg-[#0B2240] px-5 py-9 text-white [--color-text-primary:#FFFFFF] sm:px-10 sm:py-12">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#FF6B00]/20 blur-3xl" />
        <div className="relative max-w-3xl">
          <div className="inline-flex items-center gap-2">
            <Badge label="Cours rapide · 10 minutes" variant="orange" />
          </div>
          <h1 className="mt-5 font-heading text-3xl font-bold tracking-tight text-white sm:text-5xl">
            Comprendre Jimy, simplement
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">
            Les captures ci-dessous sont des exemples : les chiffres, les noms et les dates peuvent différer de votre écran actuel. Lisez de haut en bas. À la fin, vous saurez quoi régler, quoi regarder et quand valider une action.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button
              label="Commencer le cours"
              variant="primary"
              size="lg"
              onClick={() => jumpTo('commencer')}
            />
            <button
              type="button"
              onClick={() => onNavigate('control')}
              className="h-10 px-5 rounded-full border border-white/30 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              Aller à l’accueil
            </button>
          </div>
        </div>
      </section>

      <nav aria-label="Parties du guide" className="sticky top-20 z-20 mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur-md">
        <div className="flex min-w-max gap-1">
          {[
            ['commencer', 'Le principe'],
            ['accueil', 'Accueil'],
            ['dossiers', 'Dossiers'],
            ['envoyes', 'Envoyés'],
            ['regions', 'Régions'],
            ['scanner', 'Scanner'],
            ['reglages', 'Réglages'],
            ['routine', 'Routine simple'],
          ].map(([id, label]) => (
            <button key={id} type="button" onClick={() => jumpTo(id)} className="rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-[#0B2240]">
              {label}
            </button>
          ))}
        </div>
      </nav>

      <section id="commencer" className="scroll-mt-36 py-12">
        <div className="max-w-3xl">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#FF6B00]">Le principe</div>
          <h2 className="mt-2 font-heading text-2xl font-bold text-[#0B2240] sm:text-3xl">Jimy fait cinq choses</h2>
          <p className="mt-3 text-slate-600">Vous gardez toujours le contrôle. Jimy prépare le travail, et vos réglages disent ce qu’il peut faire seul.</p>
        </div>
        <div className="mt-7 grid gap-3 md:grid-cols-5">
          {[
            ['Cherche', 'Il trouve des sociétés suisses.'],
            ['Écrit', 'Il envoie une demande simple.'],
            ['Écoute', 'Il vérifie les réponses.'],
            ['Classe', 'Il crée un dossier et un score.'],
            ['Aide', 'Il prépare la suite et la négociation.'],
          ].map(([title, text], index) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-white p-4">
              <StepNumber number={index + 1} />
              <div className="mt-4 font-bold text-[#0B2240]">{title}</div>
              <div className="mt-1 text-sm leading-5 text-slate-600">{text}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4"><Pause className="h-5 w-5 text-red-600" /><div className="mt-2 font-bold text-red-900">Arrêt</div><p className="mt-1 text-sm text-red-800">Jimy ne fait pas cette action.</p></div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><HelpCircle className="h-5 w-5 text-amber-700" /><div className="mt-2 font-bold text-amber-950">Me demander</div><p className="mt-1 text-sm text-amber-900">Jimy prépare. Vous cliquez sur « Valider ».</p></div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><Play className="h-5 w-5 text-emerald-700" /><div className="mt-2 font-bold text-emerald-950">Auto</div><p className="mt-1 text-sm text-emerald-900">Jimy fait l’action selon vos règles.</p></div>
        </div>
        <div className="mt-4 flex gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <p><strong>Le grand bouton de l’accueil arrête tout.</strong> Même si une fonction est en « Auto », elle ne travaille pas quand Jimy est en pause.</p>
        </div>
      </section>

      <section id="accueil" className="scroll-mt-36 border-t border-slate-200 py-12">
        <div className="grid items-start gap-8 lg:grid-cols-[0.9fr_1.4fr]">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#FF6B00]"><Gauge className="h-4 w-4" /> Écran 1</div>
            <h2 className="mt-3 font-heading text-3xl font-bold text-[#0B2240]">Accueil : commander Jimy</h2>
            <p className="mt-3 leading-7 text-slate-600">C’est votre tableau de bord. Commencez toujours ici.</p>
            <div className="mt-6 space-y-3">
              <SimplePoint title="Mettre Jimy au travail">Démarre la recherche, les envois et les actions automatiques que vous avez autorisées.</SimplePoint>
              <SimplePoint title="Chercher maintenant">Lance une seule recherche de sociétés, même si Jimy est en pause.</SimplePoint>
              <SimplePoint title="Envoyer 1 maintenant">Envoie la prochaine demande pendant les heures de travail suisses.</SimplePoint>
              <SimplePoint title="Vérifier les réponses">Regarde tout de suite la boîte mail. Jimy la vérifie aussi automatiquement.</SimplePoint>
            </div>
            <button type="button" onClick={() => onNavigate('control')} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#FF6B00]">Ouvrir l’accueil <ArrowRight className="h-4 w-4" /></button>
          </div>
          <Screenshot src="/assets/guide/live/accueil.png" alt="Exemple d'écran Accueil de JimyScout" caption="Exemple d'écran — les chiffres et les noms peuvent différer de votre écran actuel." onOpen={setLargeImage} />
        </div>
        <div className="mt-7 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-slate-100 p-4"><Bell className="h-5 w-5 text-[#0B2240]" /><div className="mt-2 font-bold text-[#0B2240]">Cloche</div><p className="mt-1 text-sm text-slate-600">Ouvre les alertes et l’activité récente.</p></div>
          <div className="rounded-2xl bg-slate-100 p-4"><HelpCircle className="h-5 w-5 text-[#0B2240]" /><div className="mt-2 font-bold text-[#0B2240]">Aide</div><p className="mt-1 text-sm text-slate-600">Revient sur cette page.</p></div>
          <div className="rounded-2xl bg-slate-100 p-4"><FileText className="h-5 w-5 text-[#0B2240]" /><div className="mt-2 font-bold text-[#0B2240]">Installer</div><p className="mt-1 text-sm text-slate-600">Ajoute Jimy comme une application.</p></div>
          <div className="rounded-2xl bg-slate-100 p-4"><Inbox className="h-5 w-5 text-[#0B2240]" /><div className="mt-2 font-bold text-[#0B2240]">Coller une réponse</div><p className="mt-1 text-sm text-slate-600">Crée un dossier depuis un texte reçu ailleurs.</p></div>
        </div>
      </section>

      <section id="dossiers" className="scroll-mt-36 border-t border-slate-200 py-12">
        <div className="grid items-start gap-8 lg:grid-cols-[1.35fr_0.9fr]">
          <Screenshot src="/assets/guide/live/dossiers.png" alt="Exemple d'écran Dossiers de JimyScout" caption="Exemple d'écran — les chiffres et les noms peuvent différer de votre écran actuel." onOpen={setLargeImage} />
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-purple-700"><Inbox className="h-4 w-4" /> Écran 2</div>
            <h2 className="mt-3 font-heading text-3xl font-bold text-[#0B2240]">Dossiers : étudier les offres</h2>
            <p className="mt-3 leading-7 text-slate-600">Une réponse utile devient un dossier. Jimy place les informations importantes au même endroit.</p>
            <div className="mt-6 space-y-3">
              <SimplePoint title="Score de l’affaire">De 0 à 100. Un score élevé veut dire : informations utiles, prix intéressant et bon vendeur.</SimplePoint>
              <SimplePoint title="Prix estimé">Une fourchette prudente basée sur les dossiers comparables et l’âge de la machine.</SimplePoint>
              <SimplePoint title="Premier prix et prix maximum">Une aide pour négocier. Ce n’est pas un ordre d’achat.</SimplePoint>
              <SimplePoint title="À demander">La liste des informations manquantes : année, heures, série, état ou téléphone.</SimplePoint>
              <SimplePoint title="Étape">Changez le dossier : nouveau, visite, négociation, acheté, refusé ou fermé.</SimplePoint>
            </div>
            <button type="button" onClick={() => onNavigate('leads')} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#FF6B00]">Voir les dossiers <ArrowRight className="h-4 w-4" /></button>
          </div>
        </div>
      </section>

      <section id="envoyes" className="scroll-mt-36 border-t border-slate-200 py-12">
        <div className="grid items-start gap-8 lg:grid-cols-[0.9fr_1.35fr]">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-700"><MailCheck className="h-4 w-4" /> Écran 3</div>
            <h2 className="mt-3 font-heading text-3xl font-bold text-[#0B2240]">Envoyés : vérifier les courriels</h2>
            <p className="mt-3 leading-7 text-slate-600">Cet écran garde la preuve de chaque message envoyé.</p>
            <div className="mt-6 space-y-3">
              <SimplePoint title="Accepté">Le serveur de messagerie a accepté le courriel.</SimplePoint>
              <SimplePoint title="Échec ou rebond">L’adresse ne fonctionne pas. Jimy arrête les relances vers cette adresse.</SimplePoint>
              <SimplePoint title="Ouvrir un message">Cliquez sur une ligne pour lire le sujet, le texte, la société et la date.</SimplePoint>
              <SimplePoint title="Chercher et exporter">Utilisez les filtres ou téléchargez un fichier CSV.</SimplePoint>
            </div>
            <button type="button" onClick={() => onNavigate('emails')} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#FF6B00]">Voir les courriels <ArrowRight className="h-4 w-4" /></button>
          </div>
          <Screenshot src="/assets/guide/live/envoyes.png" alt="Exemple d'écran des courriels envoyés" caption="Exemple d'écran — les chiffres et les noms peuvent différer de votre écran actuel." onOpen={setLargeImage} />
        </div>
      </section>

      <section id="regions" className="scroll-mt-36 border-t border-slate-200 py-12">
        <div className="grid items-start gap-8 lg:grid-cols-[1.35fr_0.9fr]">
          <Screenshot src="/assets/guide/live/regions.png" alt="Exemple d'écran Régions de JimyScout" caption="Exemple d'écran — les chiffres et les noms peuvent différer de votre écran actuel." onOpen={setLargeImage} />
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700"><MapPin className="h-4 w-4" /> Écran 4</div>
            <h2 className="mt-3 font-heading text-3xl font-bold text-[#0B2240]">Régions : choisir qui contacter</h2>
            <p className="mt-3 leading-7 text-slate-600">Jimy ne contacte que les sociétés dans les cantons actifs.</p>
            <div className="mt-6 space-y-3">
              <SimplePoint title="Cantons actifs">Cliquez sur un canton pour l’ajouter ou le retirer.</SimplePoint>
              <SimplePoint title="Limite du jour">Le maximum total de courriels, relances comprises.</SimplePoint>
              <SimplePoint title="Sociétés prêtes">Adresse vérifiée, pas bloquée et pas contactée récemment.</SimplePoint>
              <SimplePoint title="Ajouter ou importer">Ajoutez une société à la main ou importez un fichier CSV.</SimplePoint>
            </div>
            <button type="button" onClick={() => onNavigate('targets')} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#FF6B00]">Gérer les régions <ArrowRight className="h-4 w-4" /></button>
          </div>
        </div>
      </section>

      <section id="scanner" className="scroll-mt-36 border-t border-slate-200 py-12">
        <div className="grid items-start gap-8 lg:grid-cols-[0.9fr_1.35fr]">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-700"><Camera className="h-4 w-4" /> Écran 5</div>
            <h2 className="mt-3 font-heading text-3xl font-bold text-[#0B2240]">Scanner : ajouter une carte</h2>
            <p className="mt-3 leading-7 text-slate-600">Utilisez une photo de carte de visite pour préparer une nouvelle société.</p>
            <div className="mt-6 space-y-3">
              <SimplePoint title="Prendre ou choisir une photo">Le texte de la carte est lu automatiquement.</SimplePoint>
              <SimplePoint title="Toujours vérifier">Corrigez le nom, le courriel, le téléphone et le canton avant d’enregistrer.</SimplePoint>
              <SimplePoint title="Pas de courriel inventé">Si la carte ne montre pas d’adresse, laissez le champ vide.</SimplePoint>
            </div>
            <button type="button" onClick={() => onNavigate('scanner')} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#FF6B00]">Ouvrir le scanner <ArrowRight className="h-4 w-4" /></button>
          </div>
          <Screenshot src="/assets/guide/live/scanner.png" alt="Exemple d'écran Scanner de JimyScout" caption="Exemple d'écran — les chiffres et les noms peuvent différer de votre écran actuel." onOpen={setLargeImage} />
        </div>
      </section>

      <section id="reglages" className="scroll-mt-36 border-t border-slate-200 py-12">
        <div className="grid items-start gap-8 lg:grid-cols-[1.35fr_0.9fr]">
          <Screenshot src="/assets/guide/live/reglages.png" alt="Exemple d'écran Réglages de JimyScout" caption="Exemple d'écran — les chiffres et les noms peuvent différer de votre écran actuel." onOpen={setLargeImage} />
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#FF6B00]"><Settings2 className="h-4 w-4" /> Écran 6</div>
            <h2 className="mt-3 font-heading text-3xl font-bold text-[#0B2240]">Réglages : décider ce que Jimy peut faire</h2>
            <p className="mt-3 leading-7 text-slate-600">C’est ici que vous donnez les règles à Jimy.</p>
            <div className="mt-6 space-y-3">
              <SimplePoint title="Votre profil">Le nom, le téléphone et l’adresse utilisés dans les courriels.</SimplePoint>
              <SimplePoint title="Machines recherchées">Les machines que vous voulez acheter.</SimplePoint>
              <SimplePoint title="Liberté de Jimy">Choisissez Arrêt, Me demander ou Auto pour chaque travail.</SimplePoint>
              <SimplePoint title="Listes de recherche">Ajoutez des mots comme « CAT 320 » ou « camion Volvo ».</SimplePoint>
              <SimplePoint title="Ton et garanties">Choisissez le style du courriel et les conditions annoncées au vendeur.</SimplePoint>
              <SimplePoint title="Aperçu du courriel">Lisez le vrai texte en français, allemand et italien avant l’envoi.</SimplePoint>
            </div>
            <button type="button" onClick={() => onNavigate('persona')} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#FF6B00]">Ouvrir les réglages <ArrowRight className="h-4 w-4" /></button>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 py-12">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700"><ShieldCheck className="h-4 w-4" /> Règles de sécurité</div>
          <h2 className="mt-3 font-heading text-3xl font-bold text-[#0B2240]">Ce que Jimy ne doit jamais oublier</h2>
        </div>
        <div className="mt-7 grid gap-3 md:grid-cols-2">
          <SimplePoint title="Heures suisses">Les courriels partent du lundi au vendredi, entre 08 h 30 et 17 h 00, heure de Zurich.</SimplePoint>
          <SimplePoint title="STOP">Si une personne demande l’arrêt, son adresse est bloquée.</SimplePoint>
          <SimplePoint title="Réponse reçue">Une vraie réponse annule toutes les relances encore prévues.</SimplePoint>
          <SimplePoint title="Rebond">Une adresse qui ne fonctionne pas n’est plus utilisée.</SimplePoint>
          <SimplePoint title="Pas de doublon rapide">Jimy respecte le délai avant de recontacter une société.</SimplePoint>
          <SimplePoint title="Limite quotidienne">Les premiers messages et les relances partagent la même limite.</SimplePoint>
        </div>
      </section>

      <section id="routine" className="scroll-mt-36 border-t border-slate-200 py-12">
        <div className="rounded-[30px] border border-orange-200 bg-orange-50 p-6 sm:p-9">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#C94F00]"><ListChecks className="h-4 w-4" /> Votre routine</div>
          <h2 className="mt-3 font-heading text-3xl font-bold text-[#0B2240]">Que faire chaque jour ?</h2>
          <div className="mt-7 grid gap-3 md:grid-cols-2">
            {[
              ['1', 'Ouvrez Accueil', 'Regardez si Jimy est actif ou en pause.'],
              ['2', 'Ouvrez Dossiers', 'Commencez par les meilleurs scores.'],
              ['3', 'Appelez le vendeur', 'Confirmez l’état, les heures, le prix et les documents.'],
              ['4', 'Changez l’étape', 'Notez visite, négociation, achat ou refus.'],
              ['5', 'Laissez une note', 'Écrivez la prochaine action et sa date.'],
            ].map(([number, title, text]) => (
              <div key={number} className="flex gap-3 rounded-2xl bg-white p-4 shadow-sm">
                <StepNumber number={Number(number)} />
                <div><div className="font-bold text-[#0B2240]">{title}</div><p className="mt-1 text-sm text-slate-600">{text}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 py-12">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-700"><HelpCircle className="h-4 w-4" /> Questions simples</div>
          <h2 className="mt-3 font-heading text-3xl font-bold text-[#0B2240]">Questions fréquentes</h2>
        </div>
        <div className="mt-6 space-y-3">
          {[
            ['Est-ce que Jimy peut envoyer sans moi ?', 'Oui, seulement si Jimy travaille et si la fonction est sur « Auto ». En mode « Me demander », vous devez valider.'],
            ['Que veut dire « accepté » ?', 'Le serveur du destinataire a accepté le courriel. Cela ne veut pas encore dire que la personne l’a lu.'],
            ['Le prix estimé est-il garanti ?', 'Non. C’est une aide prudente. Vérifiez toujours la machine, les documents et le marché avant un achat.'],
            ['Pourquoi aucun courriel ne part ?', 'Jimy peut être en pause, hors des heures suisses, à la limite du jour, ou sans société prête.'],
            ['Comment arrêter immédiatement ?', 'Sur Accueil, cliquez sur le grand bouton pour mettre Jimy en pause.'],
          ].map(([question, answer]) => (
            <details key={question} className="group rounded-2xl border border-slate-200 bg-white p-4">
              <summary className="cursor-pointer list-none font-bold text-[#0B2240]">{question}</summary>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="rounded-[30px] bg-[#0B2240] p-7 text-white [--color-text-primary:#FFFFFF] sm:p-10">
        <Bot className="h-8 w-8 text-orange-300" />
        <h2 className="mt-4 font-heading text-3xl font-bold text-white">Vous êtes prêt</h2>
        <p className="mt-3 max-w-2xl leading-7 text-slate-200">Commencez avec « Me demander » pour les courriels importants. Quand vous connaissez bien le travail de Jimy, passez seulement les fonctions simples en « Auto ».</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            label="Aller à l’accueil"
            variant="primary"
            size="lg"
            onClick={() => onNavigate('control')}
          />
          <button
            type="button"
            onClick={() => onNavigate('persona')}
            className="h-10 rounded-full border border-white/30 bg-white/10 hover:bg-white/20 px-5 text-sm font-semibold text-white transition-colors cursor-pointer"
          >
            Vérifier mes réglages
          </button>
        </div>
      </section>

      <Dialog
        isOpen={Boolean(largeImage)}
        onOpenChange={(open) => {
          if (!open) setLargeImage(null);
        }}
        width={1100}
      >
        <DialogHeader
          title="Capture agrandie de l’application"
          onOpenChange={(open) => {
            if (!open) setLargeImage(null);
          }}
        />
        <div className="p-4 bg-slate-950 flex items-center justify-center">
          {largeImage && (
            <img
              src={largeImage}
              alt="Capture agrandie de l’application"
              className="max-h-[80vh] max-w-full rounded-xl object-contain"
            />
          )}
        </div>
      </Dialog>
    </div>
  );
};
