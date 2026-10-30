import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall.ts';
import { Download, Share2, X, Smartphone, Monitor, CheckCircle2 } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        setShowModal(true);
      }
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        title="Install JimiScout as an App on your phone or computer"
        className="h-9 px-3 rounded-lg border border-slate-200/90 bg-white hover:bg-orange-50/50 hover:border-orange-200 text-[#0B2240] text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-2xs"
      >
        <Download className="w-3.5 h-3.5 text-[#FF6B00]" />
        <span className="hidden sm:inline">Install App</span>
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-200 text-[#0B2240] space-y-5">
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3.5">
                <img
                  src="/assets/jimiscout-logo.png"
                  alt="JimiScout App Icon"
                  className="w-14 h-14 rounded-2xl object-contain bg-slate-50 border border-slate-200 p-1.5 shrink-0"
                />
                <div>
                  <h3 className="font-heading font-bold text-lg text-[#0B2240]">
                    Install JimiScout App
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Add JimiScout to your home screen or desktop for instant 1-tap access.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isInstallable ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-orange-50/60 border border-orange-200/80 text-xs text-slate-700 space-y-1.5">
                  <div className="font-bold text-[#0B2240] flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#FF6B00]" />
                    <span>Ready for 1-Click Installation</span>
                  </div>
                  <p>
                    Click the button below to install JimiScout with its official app icon and splash screen.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await install();
                    setShowModal(false);
                  }}
                  className="w-full h-11 rounded-full bg-[#FF6B00] hover:bg-[#E05E00] text-white font-heading font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Install JimiScout Now</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                {isIOS ? (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                    <div className="font-bold text-sm text-[#0B2240] flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-[#FF6B00]" />
                      <span>Install on iPhone / iPad (Safari)</span>
                    </div>
                    <ol className="space-y-2 text-slate-600 list-decimal pl-4">
                      <li>
                        Tap the <Share2 className="w-3.5 h-3.5 inline text-[#FF6B00] mx-0.5" /> <strong>Share</strong> button at the bottom of Safari.
                      </li>
                      <li>
                        Scroll down and tap <strong>Add to Home Screen</strong>.
                      </li>
                      <li>
                        Tap <strong>Add</strong> in the top corner to install JimiScout with its app icon.
                      </li>
                    </ol>
                  </div>
                ) : (
                  <>
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <div className="font-bold text-sm text-[#0B2240] flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-[#FF6B00]" />
                        <span>On Computer (Chrome / Edge)</span>
                      </div>
                      <p className="text-slate-600 leading-relaxed">
                        Click the <strong>Install icon</strong> (computer with down arrow) on the right side of your browser&apos;s address bar, then click <strong>Install</strong>.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <div className="font-bold text-sm text-[#0B2240] flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-[#FF6B00]" />
                        <span>On Phone (Android / iPhone)</span>
                      </div>
                      <p className="text-slate-600 leading-relaxed">
                        Open your browser menu and tap <strong>Add to Home screen</strong> or <strong>Install app</strong>.
                      </p>
                    </div>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-full h-11 rounded-full bg-[#0B2240] hover:bg-[#173863] text-sm font-semibold text-white transition-colors cursor-pointer"
                >
                  Got it
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
