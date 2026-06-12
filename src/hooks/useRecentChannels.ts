import { useState, useCallback, useEffect, useRef } from 'react';
import { getRecentChannels, saveRecentChannels } from '../utils/storage';
import { Channel } from '../types';

const MAX_RECENTS = 20;

export const useRecentChannels = (allChannels: Channel[]) => {
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<string[] | null>(null);

  useEffect(() => {
    getRecentChannels().then(setRecentIds);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (pendingSaveRef.current) saveRecentChannels(pendingSaveRef.current);
    };
  }, []);

  const addRecent = useCallback((channelId: string) => {
    setRecentIds((prev) => {
      if (prev[0] === channelId) return prev;
      const filtered = prev.filter((id) => id !== channelId);
      const next = [channelId, ...filtered].slice(0, MAX_RECENTS);
      pendingSaveRef.current = next;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveRecentChannels(next);
        pendingSaveRef.current = null;
        saveTimerRef.current = null;
      }, 400);
      return next;
    });
  }, []);

  const recentChannels: Channel[] = recentIds
    .map((id) => allChannels.find((ch) => ch.id === id))
    .filter((ch): ch is Channel => ch !== undefined);

  return { recentIds, recentChannels, addRecent };
};
