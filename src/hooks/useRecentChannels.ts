import { useState, useCallback, useEffect } from 'react';
import { getRecentChannels, saveRecentChannels } from '../utils/storage';
import { Channel } from '../types';

const MAX_RECENTS = 20;

export const useRecentChannels = (allChannels: Channel[]) => {
  const [recentIds, setRecentIds] = useState<string[]>([]);

  useEffect(() => {
    getRecentChannels().then(setRecentIds);
  }, []);

  const addRecent = useCallback(async (channelId: string) => {
    setRecentIds((prev) => {
      const filtered = prev.filter((id) => id !== channelId);
      const next = [channelId, ...filtered].slice(0, MAX_RECENTS);
      saveRecentChannels(next);
      return next;
    });
  }, []);

  const recentChannels: Channel[] = recentIds
    .map((id) => allChannels.find((ch) => ch.id === id))
    .filter((ch): ch is Channel => ch !== undefined);

  return { recentIds, recentChannels, addRecent };
};
