import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { TabId } from '../navigation/BottomBar';
import { FULL_APP_TOUR_STEPS, SCREEN_SPECIFIC_TOURS, TourStep } from './tourSteps';

const STORAGE_KEY_SEEN = 'jimiscout_tour_seen_v1';
const STORAGE_KEY_SETTINGS_SEEN = 'jimiscout_tour_settings_seen_v1';
const STORAGE_KEY_AUTO_LAUNCH = 'jimiscout_auto_tour_launch';

interface TourContextType {
  isTourOpen: boolean;
  tourMode: 'full' | 'screen';
  currentStepIndex: number;
  currentSteps: TourStep[];
  activeStep: TourStep | null;
  startTour: (mode?: 'full' | 'screen', specificTab?: TabId) => void;
  endTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;
  isCheatSheetOpen: boolean;
  openCheatSheet: () => void;
  closeCheatSheet: () => void;
  autoLaunchOnVisit: boolean;
  setAutoLaunchOnVisit: (val: boolean) => void;
  resetTourHistory: () => void;
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

interface TourProviderProps {
  children: React.ReactNode;
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
}

export const TourProvider: React.FC<TourProviderProps> = ({
  children,
  activeTab,
  onSelectTab,
}) => {
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [tourMode, setTourMode] = useState<'full' | 'screen'>('full');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentSteps, setCurrentSteps] = useState<TourStep[]>(FULL_APP_TOUR_STEPS);
  const [isCheatSheetOpen, setIsCheatSheetOpen] = useState(false);

  const [autoLaunchOnVisit, setAutoLaunchOnVisitState] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_AUTO_LAUNCH);
      return stored ? JSON.parse(stored) : false;
    } catch {
      return false;
    }
  });

  const setAutoLaunchOnVisit = (val: boolean) => {
    setAutoLaunchOnVisitState(val);
    try {
      localStorage.setItem(STORAGE_KEY_AUTO_LAUNCH, JSON.stringify(val));
    } catch (e) {
      console.warn('Could not store auto tour setting', e);
    }
  };

  const startTour = useCallback(
    (mode: 'full' | 'screen' = 'full', specificTab?: TabId) => {
      setTourMode(mode);
      if (mode === 'screen') {
        const tabToTour = specificTab || activeTab;
        const steps = SCREEN_SPECIFIC_TOURS[tabToTour] || SCREEN_SPECIFIC_TOURS.control;
        setCurrentSteps(steps);
        setCurrentStepIndex(0);
        setIsTourOpen(true);
      } else {
        setCurrentSteps(FULL_APP_TOUR_STEPS);
        setCurrentStepIndex(0);
        const firstStep = FULL_APP_TOUR_STEPS[0];
        if (firstStep && firstStep.tab !== activeTab) {
          onSelectTab(firstStep.tab);
        }
        setIsTourOpen(true);
      }
    },
    [activeTab, onSelectTab]
  );

  const endTour = useCallback(() => {
    setIsTourOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY_SEEN, 'true');
      if (activeTab === 'persona') {
        localStorage.setItem(STORAGE_KEY_SETTINGS_SEEN, 'true');
      }
    } catch (e) {
      console.warn(e);
    }
  }, [activeTab]);

  const goToStep = useCallback(
    (index: number) => {
      if (index >= 0 && index < currentSteps.length) {
        const nextStepItem = currentSteps[index];
        if (nextStepItem && nextStepItem.tab !== activeTab) {
          onSelectTab(nextStepItem.tab);
        }
        setCurrentStepIndex(index);
      }
    },
    [currentSteps, activeTab, onSelectTab]
  );

  const nextStep = useCallback(() => {
    if (currentStepIndex < currentSteps.length - 1) {
      goToStep(currentStepIndex + 1);
    } else {
      endTour();
    }
  }, [currentStepIndex, currentSteps.length, goToStep, endTour]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      goToStep(currentStepIndex - 1);
    }
  }, [currentStepIndex, goToStep]);

  const openCheatSheet = useCallback(() => setIsCheatSheetOpen(true), []);
  const closeCheatSheet = useCallback(() => setIsCheatSheetOpen(false), []);

  const resetTourHistory = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY_SEEN);
      localStorage.removeItem(STORAGE_KEY_SETTINGS_SEEN);
      localStorage.removeItem(STORAGE_KEY_AUTO_LAUNCH);
      setAutoLaunchOnVisitState(false);
    } catch (e) {
      console.warn(e);
    }
  }, []);

  // Check first visit / auto tour triggers
  useEffect(() => {
    try {
      const hasSeenTour = localStorage.getItem(STORAGE_KEY_SEEN);
      const shouldAutoLaunch = localStorage.getItem(STORAGE_KEY_AUTO_LAUNCH) === 'true';

      // First time visiting the app -> automatically launch tour after brief mount delay
      if (!hasSeenTour || shouldAutoLaunch) {
        const timer = setTimeout(() => {
          startTour('full');
        }, 800);
        return () => clearTimeout(timer);
      }
    } catch (e) {
      console.warn(e);
    }
  }, [startTour]);

  // Check first visit to Settings (persona tab)
  useEffect(() => {
    if (activeTab === 'persona' && !isTourOpen) {
      try {
        const hasSeenSettings = localStorage.getItem(STORAGE_KEY_SETTINGS_SEEN);
        if (!hasSeenSettings) {
          // Launch screen tour for settings
          const timer = setTimeout(() => {
            startTour('screen', 'persona');
            localStorage.setItem(STORAGE_KEY_SETTINGS_SEEN, 'true');
          }, 400);
          return () => clearTimeout(timer);
        }
      } catch (e) {
        console.warn(e);
      }
    }
  }, [activeTab, isTourOpen, startTour]);

  const activeStep = currentSteps[currentStepIndex] || null;

  return (
    <TourContext.Provider
      value={{
        isTourOpen,
        tourMode,
        currentStepIndex,
        currentSteps,
        activeStep,
        startTour,
        endTour,
        nextStep,
        prevStep,
        goToStep,
        isCheatSheetOpen,
        openCheatSheet,
        closeCheatSheet,
        autoLaunchOnVisit,
        setAutoLaunchOnVisit,
        resetTourHistory,
        activeTab,
        setActiveTab: onSelectTab,
      }}
    >
      {children}
    </TourContext.Provider>
  );
};

export const useTour = () => {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
};
