import React from 'react';

interface SplashScreenProps {
  isLeaving?: boolean;
  statusText?: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  isLeaving = false,
  statusText = 'Chargement de vos données…',
}) => {
  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-5 bg-white transition-[opacity,filter] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${
        isLeaving ? 'pointer-events-none opacity-0 blur-[2px]' : 'opacity-100 blur-0'
      }`}
      role="status"
      aria-label="Ouverture de JimyScout"
    >
      <img
        src="/assets/jimiscout-logo.png"
        alt="JimyScout"
        className="h-auto w-44 select-none sm:w-52"
        draggable={false}
      />
      <div
        className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-[#FF6B00]"
        aria-hidden="true"
      />
      <p className="text-sm text-slate-500">{statusText}</p>
    </div>
  );
};
