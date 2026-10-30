import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTour } from './TourContext';
import {
  ChevronRight,
  ChevronLeft,
  X,
  Compass,
  Lightbulb,
  CheckCircle2,
  BookOpen,
  ArrowRight,
} from 'lucide-react';

interface ElementRect {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

export const GuidedTourOverlay: React.FC = () => {
  const {
    isTourOpen,
    activeStep,
    currentStepIndex,
    currentSteps,
    nextStep,
    prevStep,
    endTour,
    openCheatSheet,
    tourMode,
    startTour,
    activeTab,
  } = useTour();

  const [targetRect, setTargetRect] = useState<ElementRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{
    top: number;
    left: number;
    placement: 'top' | 'bottom' | 'left' | 'right' | 'center';
  }>({
    top: 0,
    left: 0,
    placement: 'center',
  });

  const updatePosition = useCallback(() => {
    if (!activeStep) return;

    const el = document.querySelector(activeStep.target);
    if (!el) {
      setTargetRect(null);
      setTooltipPos({
        top: window.innerHeight / 2,
        left: window.innerWidth / 2,
        placement: 'center',
      });
      return;
    }

    const rect = el.getBoundingClientRect();
    setTargetRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      bottom: rect.bottom,
      right: rect.right,
    });

    // Calculate best placement
    const padding = 16;
    const cardWidth = Math.min(420, window.innerWidth - 32);
    const cardHeight = 300; // estimated card height

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const spaceRight = window.innerWidth - rect.right;
    const spaceLeft = rect.left;

    let placement = activeStep.position || 'bottom';

    // Auto-adjust if preferred position overflows
    if (placement === 'bottom' && spaceBelow < cardHeight && spaceAbove > spaceBelow) {
      placement = 'top';
    } else if (placement === 'top' && spaceAbove < cardHeight && spaceBelow > spaceAbove) {
      placement = 'bottom';
    } else if (placement === 'right' && spaceRight < cardWidth && spaceLeft > cardWidth) {
      placement = 'left';
    }

    // Default to center on very small mobile screens if target takes up most of view
    if (window.innerWidth < 640 && (rect.width > window.innerWidth * 0.85 || spaceBelow < 220 && spaceAbove < 220)) {
      setTooltipPos({
        top: window.innerHeight / 2,
        left: window.innerWidth / 2,
        placement: 'center',
      });
      return;
    }

    let top = 0;
    let left = 0;

    if (placement === 'bottom') {
      top = rect.bottom + 12;
      left = Math.max(16, Math.min(window.innerWidth - cardWidth - 16, rect.left + rect.width / 2 - cardWidth / 2));
    } else if (placement === 'top') {
      top = Math.max(16, rect.top - cardHeight - 12);
      left = Math.max(16, Math.min(window.innerWidth - cardWidth - 16, rect.left + rect.width / 2 - cardWidth / 2));
    } else if (placement === 'right') {
      top = Math.max(16, Math.min(window.innerHeight - cardHeight - 16, rect.top));
      left = rect.right + 16;
    } else if (placement === 'left') {
      top = Math.max(16, Math.min(window.innerHeight - cardHeight - 16, rect.top));
      left = Math.max(16, rect.left - cardWidth - 16);
    } else {
      top = window.innerHeight / 2;
      left = window.innerWidth / 2;
    }

    setTooltipPos({ top, left, placement });
  }, [activeStep]);

  // Recalculate on step change or resize/scroll
  useEffect(() => {
    if (!isTourOpen || !activeStep) return;

    // Smooth scroll target into view
    const el = document.querySelector(activeStep.target);
    if (el) {
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
    }

    const timer = setTimeout(updatePosition, 120);
    const retryTimer = setTimeout(updatePosition, 350);

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      clearTimeout(timer);
      clearTimeout(retryTimer);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isTourOpen, activeStep, updatePosition]);

  if (!isTourOpen || !activeStep) return null;

  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === currentSteps.length - 1;
  const progressPercent = Math.round(((currentStepIndex + 1) / currentSteps.length) * 100);

  return (
    <div className="fixed inset-0 z-50 pointer-events-auto select-none overflow-hidden">
      {/* Dark backdrop with SVG cutout spotlight */}
      <svg className="w-full h-full absolute inset-0 pointer-events-none transition-all duration-300">
        <defs>
          <mask id="spotlight-mask">
            {/* Fill white everywhere (opaque) */}
            <rect width="100%" height="100%" fill="white" />
            {/* Cut out black hole where target is */}
            {targetRect && (
              <rect
                x={targetRect.left - 6}
                y={targetRect.top - 6}
                width={targetRect.width + 12}
                height={targetRect.height + 12}
                rx="14"
                fill="black"
              />
            )}
          </mask>
        </defs>
        {/* Dark overlay with mask */}
        <rect
          width="100%"
          height="100%"
          fill="rgba(11, 34, 64, 0.75)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Target spotlight glowing outline */}
      {targetRect && (
        <div
          className="absolute pointer-events-none rounded-2xl border-2 border-[#FF6B00] shadow-[0_0_25px_rgba(255,107,0,0.5)] transition-all duration-300 animate-pulse"
          style={{
            top: `${targetRect.top - 6}px`,
            left: `${targetRect.left - 6}px`,
            width: `${targetRect.width + 12}px`,
            height: `${targetRect.height + 12}px`,
          }}
        />
      )}

      {/* Click outside target to prevent accidental clicks */}
      <div
        className="absolute inset-0 cursor-default"
        onClick={(e) => {
          // If clicked outside tooltip, allow user to continue or dismiss
          e.stopPropagation();
        }}
      />

      {/* Floating Tooltip Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeStep.id}
          initial={{ opacity: 0, y: 15, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="absolute z-50 bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-[calc(100vw-32px)] sm:w-[420px] max-w-lg p-5 sm:p-6 text-[#0B2240]"
          style={
            tooltipPos.placement === 'center'
              ? {
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                }
              : {
                  top: `${tooltipPos.top}px`,
                  left: `${tooltipPos.left}px`,
                }
          }
        >
          {/* Card Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FF6B00]/10 text-[#FF6B00] text-xs font-semibold uppercase tracking-wider">
                <Compass className="w-3.5 h-3.5" />
                {tourMode === 'full' ? 'Full App Guide' : 'Screen Tour'}
              </span>
              <span className="text-xs font-mono text-slate-500 font-medium">
                {currentStepIndex + 1} of {currentSteps.length}
              </span>
            </div>

            <button
              onClick={endTour}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Close tour"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Step Title */}
          <div className="mt-3">
            <h3 className="text-lg sm:text-xl font-bold font-heading text-[#0B2240] flex items-center gap-2">
              {activeStep.title}
            </h3>
          </div>

          {/* Plain English Explanation */}
          <div className="mt-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100/80">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
              <span>In Plain English</span>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed font-normal">
              {activeStep.plainEnglish}
            </p>
          </div>

          {/* What Clicking Does */}
          <div className="mt-2.5 px-3 py-2 rounded-xl bg-amber-50/70 border border-amber-200/50 flex items-start gap-2">
            <ArrowRight className="w-4 h-4 text-[#FF6B00] shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-snug">
              <span className="font-semibold text-amber-950">Action: </span>
              {activeStep.whatItDoes}
            </div>
          </div>

          {/* Pro Tip */}
          {activeStep.tip && (
            <div className="mt-2.5 px-3 py-2 rounded-xl bg-emerald-50/70 border border-emerald-200/50 flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-900 leading-snug">
                <span className="font-semibold text-emerald-950">Pro Tip: </span>
                {activeStep.tip}
              </div>
            </div>
          )}

          {/* Progress Bar */}
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
            <div
              className="bg-[#FF6B00] h-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Bottom Action Controls */}
          <div className="mt-4 pt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={endTour}
                className="text-xs text-slate-500 hover:text-slate-800 font-medium px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Skip
              </button>

              <button
                onClick={() => {
                  endTour();
                  openCheatSheet();
                }}
                className="hidden sm:inline-flex items-center gap-1 text-xs text-[#0B2240] font-medium px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                title="Open Pilot Handbook"
              >
                <BookOpen className="w-3.5 h-3.5 text-[#FF6B00]" />
                <span>Pilot Guide</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {!isFirstStep && (
                <button
                  onClick={prevStep}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Back
                </button>
              )}

              <button
                onClick={nextStep}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#E05E00] text-white text-xs font-bold transition-all shadow-sm hover:shadow cursor-pointer active:scale-95"
              >
                {isLastStep ? (
                  <>
                    <span>Finish Tour</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
