import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { usePlayerStore } from '../store/usePlayerStore';
import { useRefreshStore } from '../store/useRefreshStore';
import { getSettings, savePlaylist } from '../utils/storage';
import { fetchM3UPlaylist } from '../utils/m3uParser';
import { fetchXtreamPlaylist } from '../utils/xtreamParser';
import { Playlist } from '../types';

const MIN_CHANNEL_REFRESH_MINUTES = 120;
const MIN_EPG_REFRESH_MINUTES = 120;

type PlayerState = ReturnType<typeof usePlayerStore.getState>;

const normalizeIntervalMinutes = (value: number | undefined, minimum: number) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return minimum;
  }
  return Math.max(numeric, minimum);
};

const minutesToMs = (minutes: number) => Math.max(minutes * 60 * 1000, 0);

export const useDataRefreshScheduler = () => {
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    let channelTimer: NodeJS.Timeout | null = null;
    let epgTimer: NodeJS.Timeout | null = null;
    const channelRefreshInFlight = { current: false };
    const epgRefreshInFlight = { current: false };

    const clearTimers = () => {
      if (channelTimer) {
        clearInterval(channelTimer);
        channelTimer = null;
      }
      if (epgTimer) {
        clearInterval(epgTimer);
        epgTimer = null;
      }
    };

    const refreshChannels = async () => {
      if (channelRefreshInFlight.current) {
        return;
      }

      try {
        channelRefreshInFlight.current = true;
        const state = usePlayerStore.getState();
        const playlist = state.playlist;
        if (!playlist) {
          channelRefreshInFlight.current = false;
          return;
        }

        if (playlist.sourceType === 'm3u') {
          const { channels, epgUrls } = await fetchM3UPlaylist(playlist.url);
          if (!channels.length) {
            return;
          }
          const updated: Playlist = {
            ...playlist,
            channels,
            epgUrls,
            updatedAt: new Date(),
          };
          state.setChannels(channels);
          state.setPlaylist(updated);
          await savePlaylist(updated);
        } else if (playlist.sourceType === 'xtream' && playlist.xtreamCredentials) {
          const { channels, epgUrls } = await fetchXtreamPlaylist(playlist.xtreamCredentials);
          if (!channels.length) {
            return;
          }
          const updated: Playlist = {
            ...playlist,
            channels,
            epgUrls,
            updatedAt: new Date(),
          };
          state.setChannels(channels);
          state.setPlaylist(updated);
          await savePlaylist(updated);
        }
      } catch (error) {
        console.warn('Channel refresh failed:', error);
      } finally {
        channelRefreshInFlight.current = false;
      }
    };

    const refreshEpg = async () => {
      if (epgRefreshInFlight.current) {
        return;
      }

      try {
        epgRefreshInFlight.current = true;
        const state = usePlayerStore.getState();
        const playlist = state.playlist;
        if (!playlist) {
          epgRefreshInFlight.current = false;
          return;
        }

        const updated: Playlist = {
          ...playlist,
          updatedAt: new Date(),
        };
        state.setPlaylist(updated);
        await savePlaylist(updated);
      } catch (error) {
        console.warn('EPG refresh scheduling failed:', error);
      } finally {
        epgRefreshInFlight.current = false;
      }
    };

    const refreshAll = async () => {
      await refreshChannels();
      await refreshEpg();
    };

    const schedule = async () => {
      const settings = await getSettings();
      const now = Date.now();

      clearTimers();

      if (!isMountedRef.current) {
        return;
      }

      const state = usePlayerStore.getState();
      if (!state.playlist) {
        return;
      }

      const channelIntervalMinutes = normalizeIntervalMinutes(
        settings.channelRefreshIntervalMinutes,
        MIN_CHANNEL_REFRESH_MINUTES
      );
      const epgIntervalMinutes = normalizeIntervalMinutes(
        settings.epgRefreshIntervalMinutes,
        MIN_EPG_REFRESH_MINUTES
      );

      const channelIntervalMs = minutesToMs(channelIntervalMinutes);
      const epgIntervalMs = minutesToMs(epgIntervalMinutes);

      channelTimer = setInterval(() => {
        void refreshChannels();
      }, channelIntervalMs);

      epgTimer = setInterval(() => {
        const playlist = usePlayerStore.getState().playlist;
        if (!playlist) {
          return;
        }

        const lastUpdated =
          playlist.updatedAt instanceof Date
            ? playlist.updatedAt.getTime()
            : new Date(playlist.updatedAt).getTime();

        if (now - lastUpdated >= epgIntervalMs) {
          void refreshEpg();
        } else {
          console.log('[EPG] Skipping auto refresh; within refresh interval');
        }
      }, epgIntervalMs);
    };

    schedule();

    const setTriggerRefresh = useRefreshStore.getState().setTriggerRefresh;
    const currentPlaylist = usePlayerStore.getState().playlist;
    if (currentPlaylist) {
      setTriggerRefresh(() => refreshAll());
    } else {
      setTriggerRefresh(null);
    }

    const unsubscribePlaylist = usePlayerStore.subscribe((state: PlayerState, prevState: PlayerState) => {
      if (!isMountedRef.current) {
        return;
      }

      const playlist = state.playlist;
      const prevPlaylist = prevState.playlist;

      if (playlist && playlist.id !== prevPlaylist?.id) {
        schedule();
        void refreshAll();
        setTriggerRefresh(() => refreshAll());
      } else if (!playlist && prevPlaylist) {
        clearTimers();
        setTriggerRefresh(null);
      }
    });

    const handleAppStateChange = (state: AppStateStatus) => {
      if (state === 'active') {
        schedule();
      } else {
        clearTimers();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      isMountedRef.current = false;
      clearTimers();
      subscription.remove();
      unsubscribePlaylist();
      setTriggerRefresh(null);
    };
  }, []);
};
