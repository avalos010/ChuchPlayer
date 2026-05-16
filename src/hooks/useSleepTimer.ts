import { useState, useCallback, useEffect, useRef } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { showSuccess } from '../utils/toast';

export const useSleepTimer = () => {
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRemainingSeconds(0);
  }, []);

  const setTimer = useCallback(
    (minutes: number) => {
      clearTimer();
      if (minutes <= 0) return;
      setRemainingSeconds(minutes * 60);
      intervalRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            intervalRef.current = null;
            setIsPlaying(false);
            showSuccess('Sleep timer ended. Playback stopped.');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [clearTimer, setIsPlaying]
  );

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const remainingMinutes = Math.ceil(remainingSeconds / 60);
  const isActive = remainingSeconds > 0;

  const label = isActive
    ? remainingSeconds < 60
      ? `${remainingSeconds}s`
      : `${remainingMinutes}m`
    : null;

  return { remainingSeconds, remainingMinutes, isActive, label, setTimer, clearTimer };
};
