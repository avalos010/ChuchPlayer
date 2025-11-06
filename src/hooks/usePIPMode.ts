import { useRef, useEffect, useCallback } from 'react';
import { Animated } from 'react-native';
import { usePlayerStore } from '../store/usePlayerStore';
import { useUIStore } from '../store/useUIStore';

export const usePIPMode = () => {
  const pipAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const pipScale = useRef(new Animated.Value(1)).current;
  const channels = usePlayerStore((state) => state.channels);
  const enterPIPStore = usePlayerStore((state) => state.enterPIP);
  const exitPIPStore = usePlayerStore((state) => state.exitPIP);
  
  // UI state
  const showEPGGrid = useUIStore((state) => state.showEPGGrid);

  const enterPIP = useCallback(() => {
    enterPIPStore(pipAnim, pipScale);
  }, [enterPIPStore, pipAnim, pipScale]);

  const exitPIP = useCallback(() => {
    exitPIPStore(pipAnim, pipScale);
  }, [exitPIPStore, pipAnim, pipScale]);

  // Enter PIP mode when EPG grid is shown - minimize video to top-right corner (TiviMate style)
  useEffect(() => {
    if (showEPGGrid && channels.length > 0) {
      enterPIP();
    } else if (!showEPGGrid) {
      exitPIP();
    }
  }, [showEPGGrid, channels.length, enterPIP, exitPIP]);

  return {
    pipAnim,
    pipScale,
    enterPIP,
    exitPIP,
  };
};

