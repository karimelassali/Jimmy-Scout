import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTour } from './TourContext';
import {
  X,
  Compass,
  Plane,
  Power,
  Send,
  Download,
  Mail,
  MapPin,
  Inbox,
  SlidersHorizontal,
  PhoneCall,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

export const PilotCheatSheetModal: React.FC = () => {
  const { isCheatSheetOpen, closeCheatSheet, startTour, activeTab } = useTour();

  if (!isCheatSheetOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#0B2240] to-[#16365C] text-white p-6 sm:p-7 relative shrink-0">
            <button
              onClick={closeCheatSheet}
              className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Close Guide"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF6B00] text-white text-xs font-bold uppercase tracking-wider mb-2">
              <Plane className="w-3.5 h-3.5" />
              Agent Guide
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold font-heading">
              How Agent Jimy Works: Simple Guide
            </h2>
            <p className="text-slate-300 text-sm mt-1 max-w-xl">
              Here is the simple explanation of what every button does and how agent Jimy finds machinery deals for you without any friction.
            </p>
          </div>

          {/* Scrollable Content Body */}
          <div className="p-6 sm:p-8 space-y-8 overflow-y-auto flex-1 text-[#0B2240]">
            {/* 4-Step Flight Plan */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-[#FF6B00]" />
                <h3 className="font-heading font-bold text-lg text-[#0B2240]">
                  How Jimy Works (In 4 Simple Steps)
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3.5">
                  <div className="w-8 h-8 rounded-xl bg-orange-100 text-[#FF6B00] font-bold flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#0B2240] flex items-center gap-1.5">
                      <SlidersHorizontal className="w-4 h-4 text-slate-500" />
                      Set Your Name &amp; Details
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Go to <span className="font-semibold text-slate-800">Settings</span>. Set your name, email, phone, and what machinery you want Jimy to scout (e.g. excavators, wheel loaders, dump trucks).
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#0B2240] flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      Pick Your Swiss Areas
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Go to <span className="font-semibold text-slate-800">Regions</span>. Turn ON areas like Bern (BE), Zürich (ZH), or Vaud (VD). Jimy automatically writes in German, French, or Italian.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#0B2240] flex items-center gap-1.5">
                      <Power className="w-4 h-4 text-emerald-600" />
                      Put Jimy to Work
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      On <span className="font-semibold text-slate-800">Dashboard</span>, click <span className="font-semibold text-emerald-700">Put Jimy to Work</span>. Jimy sends 20-25 polite emails per business day to ask if companies want to sell machinery.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 font-bold flex items-center justify-center shrink-0">
                    4
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#0B2240] flex items-center gap-1.5">
                      <Inbox className="w-4 h-4 text-purple-600" />
                      Read Offers &amp; Call Sellers
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Replies arrive in <span className="font-semibold text-slate-800">Deals</span>. You can see the machine name, asking price, and tap <span className="font-semibold">Call Seller</span> right away!
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Cockpit Button Decoder */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Compass className="w-5 h-5 text-[#FF6B00]" />
                <h3 className="font-heading font-bold text-lg text-[#0B2240]">
                  What Every Button Does (In Plain English)
                </h3>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <Power className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#0B2240]">
                        "Put Jimy to Work" / "Pause Jimy" (Dashboard)
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Toggles Jimy between actively working and resting on standby. While working, Jimy slowly emails companies on your list between 08:30 and 17:00 Swiss time.
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 self-start sm:self-auto shrink-0">
                    Agent Automation
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#FF6B00] flex items-center justify-center shrink-0">
                      <Send className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#0B2240]">
                        "Ask Jimy to Send 1 Email" (Dashboard)
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Immediately asks Jimy to take the next company on the list and send them an introductory inquiry. Perfect when you want to send one right away.
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 self-start sm:self-auto shrink-0">
                    Instant Send
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      <Download className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#0B2240]">
                        "Ask Jimy to Check Replies" (Dashboard &amp; Deals)
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Asks Jimy to check your email right now to see if any company replied to you, without having to wait.
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 self-start sm:self-auto shrink-0">
                    Check Mail
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FFF0E5] text-[#FF6B00] flex items-center justify-center shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#0B2240]">
                        "Paste a Seller Reply" (Top Header &amp; Deals)
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        If a seller messages you, paste what they wrote here. The app automatically pulls out the machine model, price, and adds it to your offers list.
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#FF6B00]/10 text-[#FF6B00] self-start sm:self-auto shrink-0">
                    Smart Reader
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#0B2240]">
                        "Send Test Email to Myself" (Settings)
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Sends a sample email to your own address so you can see exactly how it looks before sending to real companies.
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 self-start sm:self-auto shrink-0">
                    Test Email
                  </span>
                </div>
              </div>
            </section>
          </div>

          {/* Footer Controls */}
          <div className="p-5 sm:p-6 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <button
              onClick={() => {
                closeCheatSheet();
                startTour('full');
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#0B2240] hover:bg-[#16365C] text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer"
            >
              <Compass className="w-4 h-4 text-[#FF6B00]" />
              Start Step-by-Step Tour
            </button>

            <button
              onClick={() => {
                closeCheatSheet();
                startTour('screen', activeTab);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
            >
              Guide for this tab
            </button>

            <button
              onClick={closeCheatSheet}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#FF6B00] hover:bg-[#E05E00] text-white text-xs sm:text-sm font-bold transition-all shadow-sm cursor-pointer ml-auto"
            >
              <span>Got it, I understand! 👍</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
