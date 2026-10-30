import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall.ts';
import { Download, Share2, X, Smartphone } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="h-10 px-4 rounded-full bg-[#0B2240] hover:bg-[#173863] text-white text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="h-10 px-4 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-[#0B2240] text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Smartphone className="w-3.5 h-3.5 text-[#FF6B00]" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl border border-slate-200 text-[#0B2240]">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="font-heading font-bold text-lg text-[#0B2240]">
                  Install on iPhone
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p className="leading-relaxed">
                  1. Tap the <Share2 className="w-4 h-4 inline text-[#1A73E8] mx-0.5" /> <strong>Share</strong> button in Safari.
                </p>
                <p className="leading-relaxed">
                  2. Scroll down and select <strong>Add to Home Screen</strong>.
                </p>
                <p className="leading-relaxed">
                  3. Tap <strong>Add</strong> to launch JimiScout in full screen.
                </p>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full h-11 rounded-full bg-[#0B2240] text-sm font-semibold text-white hover:bg-[#173863] transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
