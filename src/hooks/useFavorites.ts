import { useState, useCallback, useEffect } from 'react';
import { getFavorites, addToFavorites, removeFromFavorites } from '../utils/storage';
import { Channel } from '../types';

export const useFavorites = (allChannels: Channel[]) => {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    getFavorites().then((favs) => {
      setFavoriteIds(new Set(favs.map((c) => c.id)));
    });
  }, []);

  const toggleFavorite = useCallback(
    async (channel: Channel) => {
      const isFav = favoriteIds.has(channel.id);
      if (isFav) {
        await removeFromFavorites(channel.id);
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          next.delete(channel.id);
          return next;
        });
      } else {
        await addToFavorites(channel);
        setFavoriteIds((prev) => new Set(prev).add(channel.id));
      }
    },
    [favoriteIds]
  );

  const isFavorite = useCallback(
    (channelId: string) => favoriteIds.has(channelId),
    [favoriteIds]
  );

  const favoriteChannels = allChannels.filter((ch) => favoriteIds.has(ch.id));

  return { favoriteIds, favoriteChannels, toggleFavorite, isFavorite };
};
