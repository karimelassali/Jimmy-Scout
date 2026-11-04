import React from 'react';
import { Building2, FolderKanban, Mail, ShieldCheck, Sparkles } from 'lucide-react';

const loadingItems = [
  { icon: Building2, label: 'Sociétés' },
  { icon: Mail, label: 'Courriels' },
  { icon: FolderKanban, label: 'Dossiers' },
];

export const SplashScreen: React.FC = () => {
  return (
    <section
      className="jimy-splash relative isolate min-h-[calc(100vh-10.5rem)] overflow-hidden rounded-[2rem] bg-[#081D37] text-white shadow-[0_24px_80px_-36px_rgba(8,29,55,0.65)]"
      aria-busy="true"
      aria-live="polite"
      aria-label="Chargement de votre espace JimyScout"
    >
      <div className="absolute inset-0 jimy-splash-grid opacity-40" aria-hidden="true" />
      <div
        className="absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-[#FF6B00]/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="absolute -right-20 -top-24 h-[28rem] w-[28rem] rounded-full bg-[#173D69]/80 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative z-10 grid min-h-[calc(100vh-10.5rem)] items-center gap-2 px-6 py-10 sm:px-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-16 lg:py-12">
        <div className="order-2 mx-auto w-full max-w-xl text-center lg:order-1 lg:mx-0 lg:text-left">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3.5 py-2 text-xs font-semibold text-white/85 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-[#FF8A33]" aria-hidden="true" />
            <span>Votre assistant d’achat suisse</span>
          </div>

          <h1 className="font-heading text-4xl font-extrabold leading-[1.04] tracking-[-0.04em] sm:text-5xl lg:text-6xl">
            Bonjour, je suis <span className="text-[#FF7A1A]">Jimy.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-lg text-base leading-7 text-slate-300 sm:text-lg lg:mx-0">
            Je prépare votre espace de travail et vos dernières informations.
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-2.5 lg:justify-start" aria-hidden="true">
            {loadingItems.map(({ icon: Icon, label }, index) => (
              <div
                key={label}
                className="jimy-splash-chip flex items-center gap-2 rounded-xl border border-white/10 bg-white/7 px-3.5 py-2.5 text-xs font-semibold text-slate-200 backdrop-blur-sm"
                style={{ animationDelay: `${index * 180}ms` }}
              >
                <Icon className="h-4 w-4 text-[#FF8A33]" />
                <span>{label}</span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </div>
            ))}
          </div>

          <div className="mx-auto mt-8 max-w-md lg:mx-0" role="status">
            <div className="mb-2.5 flex items-center justify-between gap-4 text-xs font-medium text-slate-300">
              <span>Chargement de votre espace…</span>
              <span className="text-white/55">Un instant</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="jimy-splash-progress h-full rounded-full bg-gradient-to-r from-[#FF6B00] via-[#FF9C55] to-[#FF6B00]" />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-[11px] font-medium text-white/55 lg:justify-start">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            <span>Vos actions restent sous votre contrôle.</span>
          </div>
        </div>

        <div className="order-1 flex min-h-[230px] items-center justify-center lg:order-2 lg:min-h-[520px]">
          <div className="relative flex h-[250px] w-[250px] items-center justify-center sm:h-[330px] sm:w-[330px] lg:h-[460px] lg:w-[460px]">
            <div
              className="absolute inset-[10%] rounded-full border border-white/10 bg-[radial-gradient(circle_at_50%_45%,rgba(255,107,0,0.22),rgba(255,255,255,0.04)_48%,transparent_70%)] shadow-[inset_0_0_80px_rgba(255,255,255,0.035)]"
              aria-hidden="true"
            />
            <div className="jimy-splash-orbit absolute inset-[4%] rounded-full border border-dashed border-white/12" aria-hidden="true">
              <span className="absolute left-[10%] top-[18%] h-2.5 w-2.5 rounded-full bg-[#FF7A1A] shadow-[0_0_18px_rgba(255,122,26,0.9)]" />
              <span className="absolute bottom-[16%] right-[8%] h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.8)]" />
            </div>

            <video
              className="jimy-splash-mascot relative z-10 h-[112%] w-[112%] object-contain motion-reduce:hidden"
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              aria-label="Jimy vous accueille"
            >
              <source src="/assets/illustrations/jimmymascut.webm" type="video/webm" />
            </video>

            <img
              src="/assets/jimiscout-logo.png"
              alt="JimyScout"
              className="relative z-10 hidden w-44 object-contain motion-reduce:block"
            />

            <div className="absolute bottom-[4%] z-20 flex items-center gap-2 rounded-full border border-white/15 bg-[#0B2240]/80 px-3.5 py-2 text-[11px] font-semibold text-white shadow-lg backdrop-blur-md sm:bottom-[7%]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 motion-reduce:animate-none" />
              Jimy se prépare
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
