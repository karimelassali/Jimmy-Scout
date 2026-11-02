import React, { useState, useEffect } from 'react';
import { Compass, Sparkles, ShieldCheck, Zap } from 'lucide-react';

export const SplashScreen: React.FC = () => {
  const steps = [
    'Jimy vérifie les cantons actifs (ZH · BE · VD · GE · TI · VS)…',
    'Mise à jour des sociétés vérifiées…',
    'Préparation du rythme et des courriels…',
    'Connexion au réseau suisse des sociétés…',
  ];

  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStepIndex((prev) => (prev + 1) % steps.length);
    }, 1800);
    return () => clearInterval(timer);
  }, [steps.length]);

  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center p-4 relative selection:bg-[#FF6B00]/20">
      {/* Soft Ambient Radial Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
        <div className="w-[450px] h-[450px] rounded-full bg-gradient-to-tr from-orange-400/10 via-[#0B2240]/5 to-transparent blur-3xl animate-pulse" />
      </div>

      {/* Main Glassmorphic Splash Card */}
      <div className="relative bg-white/95 backdrop-blur-md rounded-3xl p-8 sm:p-10 border border-slate-200 shadow-xl shadow-slate-900/5 flex flex-col items-center max-w-sm w-full text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
        {/* Animated Radar Beacon & Transparent Logo */}
        <div className="relative flex items-center justify-center py-2">
          {/* Concentric Radar Ping Rings */}
          <div className="absolute w-28 h-28 rounded-full bg-orange-500/10 animate-ping opacity-60 pointer-events-none" />
          <div className="absolute w-36 h-36 rounded-full border border-orange-500/20 animate-pulse pointer-events-none" />

          <img
            src="/assets/jimiscout-logo.png"
            alt="JimiScout"
            className="w-48 h-auto object-contain relative z-10 drop-shadow-xs"
          />
        </div>

        {/* Brand Badges */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-orange-50 text-[#FF6B00] border border-orange-200/80 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#FF6B00] animate-pulse" />
            <span>🇨🇭 Assistant suisse pour les machines</span>
          </div>

          <h2 className="font-heading font-extrabold text-xl sm:text-2xl text-[#0B2240] tracking-tight">
            Jimy se prépare
          </h2>
        </div>

        {/* Smooth Shimmer Progress Bar */}
        <div className="w-full max-w-[220px] space-y-2">
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden relative">
            <div className="h-full bg-gradient-to-r from-[#FF6B00] via-[#FF8C33] to-[#FF6B00] rounded-full animate-[progress_1.6s_ease-in-out_infinite] w-2/3" />
          </div>
        </div>

        {/* Dynamic Activity Status Text */}
        <div className="min-h-[40px] flex items-center justify-center">
          <p className="text-xs text-slate-600 font-medium leading-relaxed transition-all duration-300 animate-in fade-in">
            {steps[currentStepIndex]}
          </p>
        </div>

        {/* Trust & Protocol Micro-Footer */}
        <div className="pt-4 border-t border-slate-100 w-full flex items-center justify-center gap-3 text-[11px] text-slate-400 font-medium">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Assistant suisse pour entreprises</span>
          </span>
          <span>·</span>
          <span>Bern · Zürich · Genève</span>
        </div>
      </div>
    </div>
  );
};
