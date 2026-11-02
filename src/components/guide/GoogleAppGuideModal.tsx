import React, { useState, useEffect } from 'react';
import {
  X,
  Compass,
  Gauge,
  MapPin,
  Inbox,
  Camera,
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  PhoneCall,
  Mail,
  MailCheck,
  ZoomIn,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export interface GoogleAppGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: string;
}

interface GuideSection {
  id: string;
  title: string;
  badge: string;
  badgeColor: string;
  icon: React.ReactNode;
  headline: string;
  description: string;
  screenshot: string;
  screenshotAlt: string;
  features: Array<{
    title: string;
    description: string;
  }>;
  proTip: string;
}

export const GoogleAppGuideModal: React.FC<GoogleAppGuideModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'overview',
}) => {
  const [activeTabId, setActiveTabId] = useState(initialTab);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTabId(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (enlargedImage) {
          setEnlargedImage(null);
        } else if (isOpen) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, enlargedImage, onClose]);

  const sections: GuideSection[] = [
    {
      id: 'overview',
      title: 'Comment Jimy travaille',
      badge: 'Fonctionnement',
      badgeColor: 'bg-blue-50 text-[#1A73E8] border-blue-200',
      icon: <Sparkles className="w-4 h-4 text-[#1A73E8]" />,
      headline: 'Recherche automatique de machines en Suisse',
      description:
        'Jimy cherche des sociétés suisses, envoie des demandes, suit les réponses et classe les offres de machines.',
      screenshot: '/assets/guide/dashboard-overview.png',
      screenshotAlt: 'Accueil et travail de JimyScout',
      features: [
        {
          title: '1. Envois automatiques',
          description:
            'Jimy écrit aux sociétés vérifiées pendant les heures de travail suisses, de 08 h 30 à 17 h 00.',
        },
        {
          title: '2. Plusieurs cantons',
          description:
            'Il utilise l’allemand, le français ou l’italien selon le canton.',
        },
        {
          title: '3. Lecture des offres',
          description:
            'Jimy trouve automatiquement les prix, les modèles et les téléphones dans les réponses.',
        },
      ],
      proTip:
        'Laissez Jimy actif du lundi au vendredi. Les sociétés lisent souvent leurs courriels le matin.',
    },
    {
      id: 'dashboard',
      title: 'Accueil',
      badge: 'En direct',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: <Gauge className="w-4 h-4 text-emerald-600" />,
      headline: 'Contrôler Jimy et suivre son travail',
      description:
        'Voyez les envois du jour et mettez Jimy au travail ou en pause.',
      screenshot: '/assets/guide/dashboard-overview.png',
      screenshotAlt: 'Accueil de JimyScout',
      features: [
        {
          title: 'Travail ou pause',
          description:
            'Le bouton principal démarre ou arrête le travail automatique.',
        },
        {
          title: 'Envoyer une demande',
          description:
            'Le bouton « Envoyer 1 courriel » envoie la prochaine demande pendant les heures autorisées.',
        },
        {
          title: 'Historique des envois',
          description:
            'Voyez les courriels remis, leur date, la société et le canton.',
        },
      ],
      proTip:
        'La valeur totale additionne les prix donnés par les vendeurs.',
    },
    {
      id: 'emails',
      title: 'Courriels envoyés',
      badge: 'Historique',
      badgeColor: 'bg-blue-50 text-[#1A73E8] border-blue-200',
      icon: <MailCheck className="w-4 h-4 text-[#1A73E8]" />,
      headline: 'Retrouver tous les courriels envoyés',
      description:
        'Cherchez les courriels par société, langue, état ou canton et ouvrez le message complet.',
      screenshot: '/assets/guide/dashboard-overview.png',
      screenshotAlt: 'Liste des courriels envoyés',
      features: [
        {
          title: 'Recherche et filtres',
          description:
            'Cherchez par nom, adresse, canton ou sujet. Filtrez aussi par langue ou état.',
        },
        {
          title: 'Voir le courriel complet',
          description:
            'Cliquez sur une ligne pour lire le message et voir le destinataire.',
        },
        {
          title: 'Export CSV',
          description:
            'Téléchargez l’historique dans un fichier CSV.',
        },
      ],
      proTip:
        'Ouvrez « Courriels » dans le menu pour voir cet historique.',
    },
    {
      id: 'regions',
      title: 'Régions suisses',
      badge: 'Cantons et rythme',
      badgeColor: 'bg-orange-50 text-[#FF6B00] border-orange-200',
      icon: <MapPin className="w-4 h-4 text-[#FF6B00]" />,
      headline: 'Choisir les cantons et la limite du jour',
      description:
        'Choisissez les cantons contactés et le nombre maximum de courriels par jour.',
      screenshot: '/assets/guide/regions-overview.png',
      screenshotAlt: 'Choix des cantons suisses',
      features: [
        {
          title: 'Limite du jour',
          description:
            'Choisissez entre 10 et 50 courriels par jour. Commencez doucement.',
        },
        {
          title: 'Cantons et codes postaux',
          description:
            'Touchez un canton pour activer ou arrêter les envois dans cette région.',
        },
        {
          title: 'Liste des sociétés',
          description:
            'Voyez, ajoutez, modifiez ou retirez les sociétés de chaque canton.',
        },
      ],
      proTip:
        'Pour la Suisse romande, choisissez Vaud et Genève avec des courriels en français.',
    },
    {
      id: 'deals',
      title: 'Dossiers',
      badge: 'Offres reçues',
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
      icon: <Inbox className="w-4 h-4 text-purple-600" />,
      headline: 'Voir les offres de machines',
      description:
        'Chaque dossier montre la machine, le prix et les coordonnées du vendeur.',
      screenshot: '/assets/guide/deals-mobile.png',
      screenshotAlt: 'Dossiers et offres reçues',
      features: [
        {
          title: 'Prix et informations',
          description:
            'Jimy trouve le prix, le type de machine et les notes du vendeur.',
        },
        {
          title: 'Filtres rapides',
          description:
            'Filtrez les pelles, chargeuses, camions, nouveaux dossiers ou favoris.',
        },
        {
          title: 'Appel et courriel',
          description:
            'Contactez le vendeur directement par téléphone ou par courriel.',
        },
        {
          title: 'Coller une réponse',
          description:
            'Collez une offre reçue ailleurs et Jimy créera le dossier.',
        },
      ],
      proTip:
        'Utilisez l’icône de favori pour garder les meilleurs dossiers.',
    },
    {
      id: 'scanner',
      title: 'Scanner de cartes',
      badge: 'Lecture de carte',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: <Camera className="w-4 h-4 text-emerald-600" />,
      headline: 'Lire une carte de visite en quelques secondes',
      description:
        'Prenez une photo de la carte. Jimy ajoute les informations dans votre liste de sociétés.',
      screenshot: '/assets/guide/canton-grid.png',
      screenshotAlt: 'Scanner de cartes de visite',
      features: [
        {
          title: 'Photo ou appareil photo',
          description:
            'Prenez une photo ou choisissez une image de votre téléphone.',
        },
        {
          title: 'Lecture automatique',
          description:
            'Jimy trouve le nom, la personne, le téléphone, l’adresse et le code postal.',
        },
        {
          title: 'Ajout immédiat',
          description:
            'Après l’enregistrement, la société entre dans la file de Jimy.',
        },
      ],
      proTip:
        'Posez la carte à plat avec une bonne lumière.',
    },
    {
      id: 'settings',
      title: 'Profil et réglages',
      badge: 'Profil et ton',
      badgeColor: 'bg-blue-50 text-[#0B2240] border-slate-300',
      icon: <SlidersHorizontal className="w-4 h-4 text-[#0B2240]" />,
      headline: 'Changer votre profil et vos courriels',
      description:
        'Changez votre nom, téléphone, machines recherchées et le ton des courriels.',
      screenshot: '/assets/guide/email-persona.png',
      screenshotAlt: 'Profil et aperçu du courriel',
      features: [
        {
          title: 'Votre profil et vos machines',
          description:
            'Écrivez les machines que vous cherchez.',
        },
        {
          title: 'Aperçu du courriel',
          description:
            'Lisez le courriel en allemand, français ou italien avant l’envoi.',
        },
        {
          title: 'Vos conditions d’achat',
          description:
            'Choisissez le paiement immédiat, le transport payé et l’achat sans garantie.',
        },
      ],
      proTip:
        'Le ton « Formel suisse » convient aux grandes sociétés.',
    },
  ];

  if (!isOpen) return null;

  const activeIndex = sections.findIndex((s) => s.id === activeTabId);
  const currentSection = sections[activeIndex] || sections[0];

  const handleNext = () => {
    if (activeIndex < sections.length - 1) {
      setActiveTabId(sections[activeIndex + 1].id);
    }
  };

  const handlePrev = () => {
    if (activeIndex > 0) {
      setActiveTabId(sections[activeIndex - 1].id);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Google Style Header */}
        <div className="px-6 py-4 bg-white border-b border-slate-200/90 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-200/80 flex items-center justify-center shrink-0">
              <Compass className="w-5 h-5 text-[#FF6B00]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading font-bold text-lg text-[#0B2240] leading-tight">
                  JimiScout User Guide
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-[#1A73E8] border border-blue-200">
                  <ShieldCheck className="w-3 h-3" />
                  Official Manual
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Visual interactive guide with real screenshots and workflows
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Fermer le guide"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Google Segmented Category Pills (Horizontally scrollable on mobile) */}
        <div className="px-6 py-2.5 bg-slate-50/80 border-b border-slate-200/70 overflow-x-auto no-scrollbar shrink-0">
          <div className="inline-flex items-center gap-1.5 p-1 bg-white rounded-2xl border border-slate-200 shadow-2xs shrink-0 min-w-max">
            {sections.map((section, idx) => {
              const isActive = section.id === currentSection.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveTabId(section.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-[#0B2240] text-white shadow-xs'
                      : 'text-slate-600 hover:text-[#0B2240] hover:bg-slate-100'
                  }`}
                >
                  <span className={isActive ? 'text-[#FF6B00]' : 'text-slate-400'}>
                    {section.icon}
                  </span>
                  <span>{section.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
          {/* Section Banner Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${currentSection.badgeColor}`}
                >
                  {currentSection.badge}
                </span>
                <span className="text-xs font-medium text-slate-400">
                  Step {activeIndex + 1} of {sections.length}
                </span>
              </div>
              <h3 className="font-heading font-bold text-xl sm:text-2xl text-[#0B2240]">
                {currentSection.headline}
              </h3>
            </div>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
            {currentSection.description}
          </p>

          {/* 2-Column Responsive Layout: Feature Steps + High-Res Screenshot */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 6 Columns: Feature Checklist */}
            <div className="lg:col-span-6 space-y-4">
              <div className="space-y-3">
                {currentSection.features.map((feature, fIndex) => (
                  <div
                    key={fIndex}
                    className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all flex gap-3.5 items-start"
                  >
                    <div className="w-6 h-6 rounded-full bg-orange-100/80 text-[#FF6B00] font-heading font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      {fIndex + 1}
                    </div>
                    <div>
                      <h4 className="font-heading font-semibold text-sm text-[#0B2240]">
                        {feature.title}
                      </h4>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Google Style Pro Tip Card */}
              <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80 text-[#1A73E8] flex items-start gap-3">
                <Zap className="w-5 h-5 text-[#1A73E8] shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-xs uppercase tracking-wider text-[#1A73E8]">
                    Google Pro Tip
                  </div>
                  <p className="text-xs text-slate-700 mt-0.5 leading-relaxed font-normal">
                    {currentSection.proTip}
                  </p>
                </div>
              </div>
            </div>

            {/* Right 6 Columns: Interactive Screenshot Preview with Lightbox Zoom */}
            <div className="lg:col-span-6 space-y-2">
              <div
                className="group relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 shadow-md cursor-pointer aspect-video sm:aspect-4/3 flex items-center justify-center"
                onClick={() => setEnlargedImage(currentSection.screenshot)}
                title="Voir l’image en grand"
              >
                <img
                  src={currentSection.screenshot}
                  alt={currentSection.screenshotAlt}
                  className="w-full h-full object-cover sm:object-contain bg-slate-950/80 group-hover:scale-102 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-medium text-xs backdrop-blur-xs">
                  <ZoomIn className="w-4 h-4" />
                  <span>Voir l’image complète</span>
                </div>
                <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md text-[11px] text-white/90 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Vraie interface de l’application</span>
                </div>
              </div>
              <p className="text-[11px] text-center text-slate-500">
                Cliquez sur l’image pour l’agrandir
              </p>
            </div>
          </div>
        </div>

        {/* Google Style Bottom Navigation Bar */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200/90 flex items-center justify-between gap-4 shrink-0">
          <button
            type="button"
            onClick={handlePrev}
            disabled={activeIndex === 0}
            className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Précédent</span>
          </button>

          {/* Step Dots */}
          <div className="hidden sm:flex items-center gap-1.5">
            {sections.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveTabId(sections[idx].id)}
                className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                  idx === activeIndex
                    ? 'w-6 bg-[#FF6B00]'
                    : 'bg-slate-300 hover:bg-slate-400'
                }`}
                title={`Aller à l’étape ${idx + 1}`}
              />
            ))}
          </div>

          {activeIndex < sections.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              className="h-10 px-5 rounded-xl bg-[#0B2240] hover:bg-[#16365C] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <span>Suivant</span>
              <ChevronRight className="w-4 h-4 text-[#FF6B00]" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-5 rounded-xl bg-[#FF6B00] hover:bg-[#E05E00] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <span>Terminé · Mettre Jimy au travail</span>
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* High-Resolution Screenshot Lightbox Modal */}
      {enlargedImage && (
        <div
          className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200"
          onClick={() => setEnlargedImage(null)}
        >
          <div
            className="relative max-w-5xl max-h-[90vh] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setEnlargedImage(null)}
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={enlargedImage}
              alt="Aperçu agrandi"
              className="w-auto h-auto max-h-[85vh] object-contain rounded-2xl mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
};
