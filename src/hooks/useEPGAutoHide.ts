import { useEffect, useRef, useCallback } from 'react';
import { useUIStore } from '../store/useUIStore';

export const useEPGAutoHide = () => {
  const showEPG = useUIStore((state) => state.showEPG);
  const setShowEPG = useUIStore((state) => state.setShowEPG);
  const epgAutoHideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Function to reset the EPG auto-hide timer
  const resetEPGAutoHideTimer = useCallback(() => {
    if (!showEPG) return;

    // Clear existing timer
    if (epgAutoHideTimerRef.current) {
      clearTimeout(epgAutoHideTimerRef.current);
    }

    // Set new timer
    epgAutoHideTimerRef.current = setTimeout(() => {
      setShowEPG(false);
      epgAutoHideTimerRef.current = null;
    }, 5000);
  }, [showEPG, setShowEPG]);

  // Auto-hide EPG overlay after 5 seconds of inactivity
  useEffect(() => {
    if (!showEPG) {
      // Clear timer if EPG is hidden
      if (epgAutoHideTimerRef.current) {
        clearTimeout(epgAutoHideTimerRef.current);
        epgAutoHideTimerRef.current = null;
      }
      return;
    }

    // Start/reset timer when EPG is shown
    resetEPGAutoHideTimer();

    return () => {
      if (epgAutoHideTimerRef.current) {
        clearTimeout(epgAutoHideTimerRef.current);
        epgAutoHideTimerRef.current = null;
      }
    };
  }, [showEPG, resetEPGAutoHideTimer]);
};

