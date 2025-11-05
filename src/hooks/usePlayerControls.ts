import { useState, useRef, useCallback, useEffect } from 'react';

interface UsePlayerControlsReturn {
  showControls: boolean;
  setShowControls: (show: boolean) => void;
  showFloatingButtons: boolean;
  setShowFloatingButtons: (show: boolean) => void;
  handleScreenPress: () => void;
  handleTogglePlayback: (isPlaying: boolean, setIsPlaying: (playing: boolean) => void) => void;
}

export const usePlayerControls = (
  isPlaying: boolean,
  showEPG: boolean
): UsePlayerControlsReturn => {
  const [showControls, setShowControls] = useState(true);
  const [showFloatingButtons, setShowFloatingButtons] = useState(false);
  const controlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScreenPress = useCallback(() => {
    setShowFloatingButtons(true);
    setShowControls(true);

    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current);
    }

    controlsTimeout.current = setTimeout(() => {
      setShowFloatingButtons(false);
      setShowControls(false);
    }, 5000);
  }, []);

  const handleTogglePlayback = useCallback(
    (currentIsPlaying: boolean, setIsPlaying: (playing: boolean) => void) => {
      setIsPlaying(!currentIsPlaying);
      setShowControls(true);
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
      controlsTimeout.current = setTimeout(() => {
        setShowControls(false);
      }, 5000);
    },
    []
  );

  useEffect(() => {
    if (showControls && isPlaying && !showEPG) {
      const timeout = setTimeout(() => setShowControls(false), 5000);
      controlsTimeout.current = timeout;
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [showControls, isPlaying, showEPG]);

  useEffect(() => {
    return () => {
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
    };
  }, []);

  return {
    showControls,
    setShowControls,
    showFloatingButtons,
    setShowFloatingButtons,
    handleScreenPress,
    handleTogglePlayback,
  };
};
