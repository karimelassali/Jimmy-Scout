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
      title: 'How Jimy Works',
      badge: 'Core Workflow',
      badgeColor: 'bg-blue-50 text-[#1A73E8] border-blue-200',
      icon: <Sparkles className="w-4 h-4 text-[#1A73E8]" />,
      headline: 'Autonomous Heavy Machinery Sourcing for Switzerland',
      description:
        'JimiScout acts as your private digital procurement agent. It automates contractor outreach across Swiss cantons, tracks replies, and parses used equipment offers so you never miss an excavator, loader, or truck.',
      screenshot: '/assets/guide/dashboard-overview.png',
      screenshotAlt: 'JimiScout Dashboard & Outreach Flow',
      features: [
        {
          title: '1. Autonomous Outreach Engine',
          description:
            'Jimy sends courteous, authentic inquiries to verified civil engineering and earthmoving firms during Swiss business hours (8:30 AM – 5:00 PM).',
        },
        {
          title: '2. Multi-Canton Intelligence',
          description:
            'Target German (DE), French (FR), and Italian (IT) cantons with native localized email templates.',
        },
        {
          title: '3. Instant Deal Extraction',
          description:
            'Contractor responses are analyzed in real time. Prices in CHF or EUR, machinery models, and seller phone numbers are extracted automatically.',
        },
      ],
      proTip:
        'Keep Jimy active Monday to Friday. Verified Swiss firms typically review park renewal inquiries early in the morning.',
    },
    {
      id: 'dashboard',
      title: 'Scouting Dashboard',
      badge: 'Live Operations',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: <Gauge className="w-4 h-4 text-emerald-600" />,
      headline: 'Live Agent Control & Outreach Statistics',
      description:
        'Monitor your daily dispatch numbers, review response rates, and toggle Jimy between active scouting and standby mode with a single tap.',
      screenshot: '/assets/guide/dashboard-overview.png',
      screenshotAlt: 'Dashboard Scouting Control',
      features: [
        {
          title: 'Active / Standby Status Toggle',
          description:
            'Flip the switch to start automated outreach or pause Jimy anytime. A clear status pill always indicates what Jimy is doing.',
        },
        {
          title: 'Send 1 Immediate Inquiry',
          description:
            'Need to test your configuration or dispatch an urgent inquiry right away? Use the "Send 1 Email Now" trigger.',
        },
        {
          title: 'Live Outbound Audit Trail',
          description:
            'Inspect delivered emails, delivery timestamps, recipient company names, and cantons in the live dispatch log.',
        },
      ],
      proTip:
        'The Total Offer Value metric accumulates asking prices from sellers in real time as deals arrive in your inbox.',
    },
    {
      id: 'emails',
      title: 'Sent Emails Center',
      badge: 'Audit & Analytics',
      badgeColor: 'bg-blue-50 text-[#1A73E8] border-blue-200',
      icon: <MailCheck className="w-4 h-4 text-[#1A73E8]" />,
      headline: 'Dedicated Google-Style Outbound Audit & Filters',
      description:
        'A dedicated audit table showing all emails sent by Jimy. Search across contractors, filter by Swiss language, delivery status, and canton, and inspect full email transcripts in Gmail view.',
      screenshot: '/assets/guide/dashboard-overview.png',
      screenshotAlt: 'Emails Sent by Jimy Table & Search Filters',
      features: [
        {
          title: 'Google-Style Live Search & Filters',
          description:
            'Search by recipient name, email, canton, or subject. Filter by Delivered, Simulated, or Bounced status, or isolate German, French, or Italian dispatches.',
        },
        {
          title: 'Full Gmail-Style Email Inspector',
          description:
            'Click any email record to inspect the exact trilingual inquiry Jimmy dispatched, including recipient details, delivery headers, and commercial purchase hooks.',
        },
        {
          title: 'CSV Export & Bulk Tools',
          description:
            'Download complete dispatch spreadsheets with one click or dispatch on-demand test inquiries directly from the action bar.',
        },
      ],
      proTip:
        'Click the "Emails Sent by Jimy" card directly on your Dashboard or tap the "Sent Emails" tab to jump straight into this audit center.',
    },
    {
      id: 'regions',
      title: 'Swiss Regions',
      badge: 'Targeting & Speed',
      badgeColor: 'bg-orange-50 text-[#FF6B00] border-orange-200',
      icon: <MapPin className="w-4 h-4 text-[#FF6B00]" />,
      headline: 'Target Cantons & Set Daily Speed Limits',
      description:
        'Configure which cantons Jimy contacts and control your email pacing to maintain high domain reputation and email deliverability.',
      screenshot: '/assets/guide/regions-overview.png',
      screenshotAlt: 'Swiss Regions and Cantons Selection',
      features: [
        {
          title: 'Daily Speed Limit Slider',
          description:
            'Adjust pace between 10 emails/day (Gentle), 25/day (Recommended safe volume), up to 50/day (High volume).',
        },
        {
          title: 'Canton Cards & Postal Codes',
          description:
            'Tap any Swiss canton (Zürich ZH, Bern BE, Vaud VD, Genève GE, Ticino TI, Valais VS) to activate or pause outreach in that territory.',
        },
        {
          title: 'Company Directory & Management',
          description:
            'Browse verified contractor lists for each canton, add new companies, or remove inactive companies.',
        },
      ],
      proTip:
        'For high-response campaigns in Romandie, combine Canton Vaud (VD) and Genève (GE) with a French-language persona.',
    },
    {
      id: 'deals',
      title: 'Deals Inbox',
      badge: 'Quotes & Offers',
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
      icon: <Inbox className="w-4 h-4 text-purple-600" />,
      headline: 'Extracted Contractor Quotes & Fast Buyouts',
      description:
        'Review incoming machinery offers parsed by Jimy. Each deal card shows equipment specifications, extracted CHF/EUR prices, and direct contact buttons.',
      screenshot: '/assets/guide/deals-mobile.png',
      screenshotAlt: 'Deals Inbox & Offer Cards',
      features: [
        {
          title: 'Automated Pricing & Machine Specs',
          description:
            'AI highlights asking prices (e.g., CHF 6,000 / EUR 8,027), equipment types (tracked excavators, dump trucks), and seller notes.',
        },
        {
          title: 'Quick Filter Tabs',
          description:
            'Quickly narrow down deals by Excavators, Loaders & Trucks, Unread Only, or your Bookmarked (Saved) machines.',
        },
        {
          title: 'Direct Call & Email Actions',
          description:
            'Tap the bright orange button to immediately contact the seller via direct phone or email from your mobile or desktop.',
        },
        {
          title: 'Manual "Paste Seller Reply"',
          description:
            'Received a quote via WhatsApp or personal email? Click "Paste Seller Reply" to let Jimy structure and translate it instantly.',
        },
      ],
      proTip:
        'Click the bookmark icon on any deal card to save high-margin machines to your Saved tab for quick follow-up.',
    },
    {
      id: 'scanner',
      title: 'Business Card Scanner',
      badge: 'Field OCR',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: <Camera className="w-4 h-4 text-emerald-600" />,
      headline: 'Digitize Job Site Business Cards in Seconds',
      description:
        'Meet contractors on Swiss job sites or trade fairs? Snap a photo of their physical card and Jimy will extract all details directly into your contact database.',
      screenshot: '/assets/guide/canton-grid.png',
      screenshotAlt: 'Business Card Scanner & Canton Directory',
      features: [
        {
          title: 'Live Camera or Photo Upload',
          description:
            'Take a live photo directly from your smartphone or upload existing business card photos from your library.',
        },
        {
          title: 'Swiss OCR Recognition',
          description:
            'Automatically detects company name, contact person, Swiss telephone numbers (+41...), emails, and postal codes.',
        },
        {
          title: 'Immediate Campaign Inclusion',
          description:
            'Once saved, the new company is automatically queued into Jimy’s next outreach round for that canton.',
        },
      ],
      proTip:
        'Ensure the business card is well-lit and laid flat on a clean surface for maximum OCR accuracy.',
    },
    {
      id: 'settings',
      title: 'Email Persona & Settings',
      badge: 'Reputation & Tone',
      badgeColor: 'bg-blue-50 text-[#0B2240] border-slate-300',
      icon: <SlidersHorizontal className="w-4 h-4 text-[#0B2240]" />,
      headline: 'Customize Your Buyer Profile & Trilingual Templates',
      description:
        'Configure your trading identity, phone number, and machinery wish list, and review the exact trilingual messages sent to Swiss contractors.',
      screenshot: '/assets/guide/email-persona.png',
      screenshotAlt: 'Email Persona & Google Style Message Preview',
      features: [
        {
          title: 'Trader Identity & Wishlist',
          description:
            'Specify your exact machinery interests (e.g. "Pelles sur chenilles 15–30t, camions benne 4 essieux, chargeuses").',
        },
        {
          title: 'Authentic Gmail Style Preview',
          description:
            'Review exact formatting, sender avatar, and wording in German (DE), French (FR), and Italian (IT) before emails go out.',
        },
        {
          title: 'Swiss Commercial Commitments',
          description:
            'Templates include key buyer assurances: guaranteed bank transfer before pickup, full logistical handling, and as-is purchase without warranty.',
        },
      ],
      proTip:
        'Use the "Swiss Formal" tone for high-reputation outreach to large civil engineering corporations like Implenia and Züblin.',
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
            title="Close Guide (Esc)"
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
                title="Click to view full size"
              >
                <img
                  src={currentSection.screenshot}
                  alt={currentSection.screenshotAlt}
                  className="w-full h-full object-cover sm:object-contain bg-slate-950/80 group-hover:scale-102 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-medium text-xs backdrop-blur-xs">
                  <ZoomIn className="w-4 h-4" />
                  <span>Click to view full screenshot</span>
                </div>
                <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md text-[11px] text-white/90 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Real App Interface</span>
                </div>
              </div>
              <p className="text-[11px] text-center text-slate-500">
                Click screenshot to open high-resolution zoom view
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
            <span>Previous</span>
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
                title={`Go to step ${idx + 1}`}
              />
            ))}
          </div>

          {activeIndex < sections.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              className="h-10 px-5 rounded-xl bg-[#0B2240] hover:bg-[#16365C] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <span>Next Guide</span>
              <ChevronRight className="w-4 h-4 text-[#FF6B00]" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-5 rounded-xl bg-[#FF6B00] hover:bg-[#E05E00] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <span>Done · Start Scouting</span>
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
              alt="Enlarged screenshot preview"
              className="w-auto h-auto max-h-[85vh] object-contain rounded-2xl mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
};
