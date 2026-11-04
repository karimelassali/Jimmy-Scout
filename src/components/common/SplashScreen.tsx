import React from 'react';

interface SplashScreenProps {
  isLeaving?: boolean;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ isLeaving = false }) => {
  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-white transition-[opacity,filter] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${
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
    </div>
  );
};
