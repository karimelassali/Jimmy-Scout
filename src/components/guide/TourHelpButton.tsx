import React, { useState, useRef, useEffect } from 'react';
import { useTour } from './TourContext';
import {
  Compass,
  Plane,
  ChevronDown,
  Sparkles,
  BookOpen,
  RotateCcw,
  Check,
} from 'lucide-react';

export const TourHelpButton: React.FC = () => {
  const {
    startTour,
    openCheatSheet,
    activeTab,
    autoLaunchOnVisit,
    setAutoLaunchOnVisit,
    resetTourHistory,
  } = useTour();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getScreenName = () => {
    switch (activeTab) {
      case 'control':
        return 'Mission Control';
      case 'leads':
        return 'Incoming Deals';
      case 'targets':
        return 'Swiss Cantons';
      case 'persona':
        return 'Email Persona & Settings';
      default:
        return 'Current Screen';
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-9 px-3 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-200/90"
        title="App Guide & Interactive Tour"
      >
        <BookOpen className="w-3.5 h-3.5 text-slate-500" />
        <span className="hidden sm:inline">Guide</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-[#0B2240]">
          <div className="px-4 py-2 border-b border-slate-100">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Guidance & Navigation
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Learn how agent Jimy works and what every button does.
            </p>
          </div>

          <div className="p-1">
            <button
              onClick={() => {
                setIsOpen(false);
                startTour('full');
              }}
              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-50 flex items-start gap-2.5 transition-colors cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-orange-100 text-[#FF6B00] flex items-center justify-center shrink-0 mt-0.5">
                <Compass className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#0B2240]">
                  Full App Interactive Tour
                </div>
                <div className="text-[11px] text-slate-500">
                  Walk through all 4 screens and core buttons step-by-step
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                startTour('screen', activeTab);
              }}
              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-50 flex items-start gap-2.5 transition-colors cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#0B2240]">
                  Tour {getScreenName()}
                </div>
                <div className="text-[11px] text-slate-500">
                  Quick walkthrough of only this active screen
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                openCheatSheet();
              }}
              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-50 flex items-start gap-2.5 transition-colors cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                <Plane className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#0B2240]">
                  Airplane Cockpit Handbook
                </div>
                <div className="text-[11px] text-slate-500">
                  Plain-English cheat sheet of all buttons & stages
                </div>
              </div>
            </button>
          </div>

          <div className="pt-2 mt-1 border-t border-slate-100 px-3 pb-1">
            <label className="flex items-center justify-between text-xs text-slate-600 hover:text-slate-900 cursor-pointer py-1">
              <span>Show tour automatically on launch</span>
              <input
                type="checkbox"
                checked={autoLaunchOnVisit}
                onChange={(e) => setAutoLaunchOnVisit(e.target.checked)}
                className="w-4 h-4 rounded text-[#FF6B00] focus:ring-[#FF6B00] border-slate-300"
              />
            </label>

            <button
              onClick={() => {
                resetTourHistory();
                setIsOpen(false);
                startTour('full');
              }}
              className="w-full text-left text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1.5 py-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3 text-slate-400" />
              <span>Reset tour memory & restart</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
