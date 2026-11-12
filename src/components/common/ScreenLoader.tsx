import React from 'react';

/** Calm loading state used as the Suspense fallback for lazy screens. */
export const ScreenLoader: React.FC = () => {
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3 py-16 text-slate-500"
      role="status"
      aria-label="Chargement de la page"
    >
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#FF6B00]"
        aria-hidden="true"
      />
      <p className="text-sm">Chargement…</p>
    </div>
  );
};
