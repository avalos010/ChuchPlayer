import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';
import { EPGProgram } from '../types';
import { usePlayerStore } from '../store/usePlayerStore';
import {
  queryProgramsForChannels,
  ensureEpgDatabase,
  getPlaylistMetadata,
  pruneOldPrograms,
  debugDatabaseContents,
  clearQueryCache,
} from '../database/epgDatabase';
import {
  isNativeIngestionAvailable,
  startNativeEpgIngestion,
  IngestionEventListener,
  IngestionProgress,
} from '../services/nativeEpgIngestion';
import { instrumentFunction } from './usePerformanceMonitor';

type ProgramsByChannel = Record<string, EPGProgram[]>;

const INITIAL_PREFETCH_COUNT = 12;
const PRUNE_LOWER_BOUND_HOURS = 12;
const DEFAULT_REFRESH_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours

const buildXtreamXmltvUrl = (
  serverUrl: string,
  username: string,
  password: string
): string => {
  const baseUrl = serverUrl.replace(/\/$/, '');
  return `${baseUrl}/xmltv.php?username=${encodeURIComponent(
    username
  )}&password=${encodeURIComponent(password)}`;
};

export const useEPGManagement = () => {
  const channels = usePlayerStore((state) => state.channels);
  const playlist = usePlayerStore((state) => state.playlist);

  const [programsByChannel, setProgramsByChannel] = useState<ProgramsByChannel>({});
  const [epgStatus, setEpgStatus] = useState<{ loading: boolean; error: string | null }>({
    loading: false,
    error: null,
  });
  const [epgLastUpdated, setEpgLastUpdated] = useState<number>(0);
  const loadedSignatureRef = useRef<string | null>(null);
  const loadedChannelsRef = useRef<Set<string>>(new Set());
  const pendingChannelLoadsRef = useRef<Set<string>>(new Set());

  const channelsSignature = useMemo(
    () => channels.map((channel) => channel.id).join('|'),
    [channels]
  );

  const channelIdSet = useMemo(() => new Set(channels.map((channel) => channel.id)), [channels]);

  const activeEpgUrls = useMemo(() => {
    if (!playlist) return [];
    const explicit = playlist.epgUrls && playlist.epgUrls.length > 0 ? playlist.epgUrls : [];
    if (explicit.length > 0) {
      return Array.from(new Set(explicit.map((url) => url.trim()).filter(Boolean)));
    }

    if (playlist.sourceType === 'xtream' && playlist.xtreamCredentials) {
      const { serverUrl, username, password } = playlist.xtreamCredentials;
      return [
        buildXtreamXmltvUrl(
          serverUrl,
          username,
          password
        ),
      ];
    }

    return [];
  }, [playlist]);

  const datasetSignature = useMemo(() => {
    if (!playlist) return null;
    const updatedAt =
      playlist.updatedAt instanceof Date
        ? playlist.updatedAt.getTime()
        : new Date(playlist.updatedAt).getTime();

    return `${playlist.id}:${updatedAt}:${channelsSignature}:${activeEpgUrls.join('|')}`;
  }, [playlist, channelsSignature, activeEpgUrls]);

  const loadProgramsForChannels = useCallback(
    async (channelIds: string[], options?: { force?: boolean }): Promise<boolean> => {
      if (!playlist || channelIds.length === 0) {
        return false;
      }

      const uniqueIds = Array.from(new Set(channelIds)).filter((id) =>
        channelIdSet.has(id)
      );

      const targetIds = uniqueIds.filter(
        (id) => options?.force || !loadedChannelsRef.current.has(id)
      );

      const fetchIds = targetIds.filter((id) => !pendingChannelLoadsRef.current.has(id));
      
      if (fetchIds.length === 0) {
        return false;
      }

      fetchIds.forEach((id) => pendingChannelLoadsRef.current.add(id));

      try {
        // Limit to 12 hours window (6 hours before and 6 hours after now) for faster loading
        const now = new Date();
        const startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000); // 6 hours ago
        const endTime = new Date(now.getTime() + 6 * 60 * 60 * 1000); // 6 hours ahead
        
        const result = await queryProgramsForChannels(playlist.id, fetchIds, {
          startTime,
          endTime,
          maxProgramsPerChannel: 30, // Limit to 30 programs per channel (12 hour window = ~30 programs)
        });
        
        let foundAny = false;
        // Check if any programs were found (without logging each one)
        Object.values(result).forEach((programs) => {
          if (programs.length > 0 && !foundAny) {
            foundAny = true;
          }
        });

        setProgramsByChannel((prev) => {
          const next: ProgramsByChannel = { ...prev };
          fetchIds.forEach((id) => {
            const programs = result[id] ?? [];
            next[id] = programs;
            if (__DEV__) {
              console.log(`[EPG] setProgramsByChannel: Channel ${id} now has ${programs.length} programs`);
              if (programs.length > 0) {
                console.log(`[EPG] First program: "${programs[0].title}" from ${programs[0].start} to ${programs[0].end}`);
              }
            }
          });
          if (__DEV__) {
            const totalPrograms = Object.values(next).reduce((sum, progs) => sum + progs.length, 0);
            console.log(`[EPG] Total programs in programsByChannel: ${totalPrograms} across ${Object.keys(next).length} channels`);
          }
          return next;
        });

        fetchIds.forEach((id) => loadedChannelsRef.current.add(id));

        return foundAny;
      } catch (error) {
        // Only log errors, not warnings for normal flow
        if (__DEV__) {
          console.error('[EPG] Failed to load programs for channels', fetchIds, error);
        }
        fetchIds.forEach((id) => loadedChannelsRef.current.delete(id));
        return false;
      } finally {
        fetchIds.forEach((id) => pendingChannelLoadsRef.current.delete(id));
      }
    },
    [playlist, channelIdSet, channels]
  );

  // Track last fetch time to prevent too frequent requests
  const lastFetchTimeRef = useRef<number>(0);
  const forceRefreshRef = useRef<boolean>(false);
  const MIN_TIME_BETWEEN_FETCHES_MS = 5 * 60 * 1000; // 5 minutes minimum between fetches

  // Expose force refresh function
  const forceRefreshEpg = useCallback(() => {
    forceRefreshRef.current = true;
    loadedSignatureRef.current = null;
    lastFetchTimeRef.current = 0;
    setProgramsByChannel({});
    loadedChannelsRef.current.clear();
    pendingChannelLoadsRef.current.clear();
    // Clear caches to ensure fresh data
    if (playlist?.id) {
      clearQueryCache(playlist.id);
    }
    currentProgramCache.current.clear();
    // Force a re-render by updating state - this will trigger the useEffect
    setEpgLastUpdated(Date.now());
    setEpgStatus({ loading: true, error: null });
  }, [playlist?.id]);

  useEffect(() => {
    if (!datasetSignature) {
      loadedSignatureRef.current = null;
      setProgramsByChannel({});
      setEpgStatus({ loading: false, error: null });
      setEpgLastUpdated(Date.now());
      return;
    }

    // If force refresh is requested, bypass all checks
    const isForceRefresh = forceRefreshRef.current;
    if (isForceRefresh) {
      forceRefreshRef.current = false; // Reset flag after reading
      // Clear the loaded signature to force reload
      loadedSignatureRef.current = null;
      lastFetchTimeRef.current = 0;
    } else {
      // Prevent re-fetching if we already loaded this signature
      if (loadedSignatureRef.current === datasetSignature) {
        return;
      }

      // Rate limiting: Don't fetch if we fetched recently (within 5 minutes)
      const now = Date.now();
      if (now - lastFetchTimeRef.current < MIN_TIME_BETWEEN_FETCHES_MS) {
        // Mark as loaded to prevent re-triggering
        loadedSignatureRef.current = datasetSignature;
        return;
      }
    }

    if (channels.length === 0) {
      return;
    }

    if (activeEpgUrls.length === 0) {
      loadedSignatureRef.current = datasetSignature;
      setProgramsByChannel({});
      setEpgStatus({ loading: false, error: 'No EPG source configured for this playlist' });
      setEpgLastUpdated(Date.now());
      return;
    }

    if (!playlist) {
      return;
    }

    const playlistId = playlist.id;
    let cancelled = false;
    loadedChannelsRef.current.clear();
    pendingChannelLoadsRef.current.clear();
    setProgramsByChannel({});
    setEpgStatus({ loading: true, error: null });

    // Add timeout to prevent infinite loading (30 seconds max)
    const loadingTimeout = setTimeout(() => {
      if (!cancelled) {
        setEpgStatus({ loading: false, error: 'EPG loading timed out. Please try refreshing.' });
      }
    }, 30000);

    const loadEpg = async () => {
      // Update last fetch time immediately to prevent concurrent fetches
      lastFetchTimeRef.current = Date.now();
      
      const errors: string[] = [];

      try {
        await ensureEpgDatabase();

        const existingMetadata = await getPlaylistMetadata(playlistId);

        // Only debug in verbose mode (disabled for performance)
        // await debugDatabaseContents(playlistId);

        if (
          existingMetadata?.sourceSignature === datasetSignature &&
          existingMetadata?.lastUpdated
        ) {
          const initialChannelIds = channels
            .slice(0, INITIAL_PREFETCH_COUNT)
            .map((channel) => channel.id);

          await loadProgramsForChannels(initialChannelIds, { force: true });

          if (cancelled) {
            return;
          }

          loadedSignatureRef.current = datasetSignature;
          setEpgLastUpdated(existingMetadata.lastUpdated);
          setEpgStatus({ loading: false, error: null });
          // Respect refresh interval: skip re-ingest if data is recent
          const now = Date.now();
          const timeSinceLastUpdate = now - existingMetadata.lastUpdated;
          if (timeSinceLastUpdate < DEFAULT_REFRESH_INTERVAL_MS) {
            // Mark as loaded to prevent re-triggering
            loadedSignatureRef.current = datasetSignature;
            return;
          }
        }

        const cutoff = Date.now() - PRUNE_LOWER_BOUND_HOURS * 60 * 60 * 1000;
        await pruneOldPrograms(playlistId, cutoff);
        
        // Check if native ingestion is available
        if (!isNativeIngestionAvailable()) {
          setEpgStatus({ loading: false, error: 'Native EPG ingestion not available on this platform' });
          return;
        }

        // Native ingestion runs in Kotlin background thread
        // Process URLs sequentially with delay to avoid rate limiting
        for (let i = 0; i < activeEpgUrls.length; i++) {
          const epgUrl = activeEpgUrls[i];
          
          // Add delay between requests to avoid rate limiting (except for first one)
          if (i > 0) {
            await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay between URLs
          }
          
          try {
            const onEvent: IngestionEventListener = (type, data) => {
              // Only log errors, not progress (too verbose and slow)
              if (type === 'error') {
                const error = data as { error: string; epgUrl?: string };
                if (__DEV__) {
                  console.error(`[EPG] Ingestion error: ${error.error}`);
                }
              }
            };

            await startNativeEpgIngestion(epgUrl, playlistId, channels, datasetSignature, onEvent);
          } catch (error) {
            if (__DEV__) {
              console.error(`[EPG] Native ingestion failed:`, error);
            }
            const message = error instanceof Error ? error.message : 'Unknown error';
            errors.push(`${epgUrl} - ${message}`);
          }
        }

        if (cancelled) {
          return;
        }

        const timestamp = Date.now();
        
        // Metadata is updated by Kotlin module during native ingestion

        if (cancelled) {
          return;
        }

        const initialChannelIds = channels
          .slice(0, INITIAL_PREFETCH_COUNT)
          .map((channel) => channel.id);

        await loadProgramsForChannels(initialChannelIds, { force: true });
        const postIngestChannelIds = channels
          .slice(0, INITIAL_PREFETCH_COUNT)
          .map((channel) => channel.id);

        await loadProgramsForChannels(postIngestChannelIds, { force: true });

        if (cancelled) {
          return;
        }

        loadedSignatureRef.current = datasetSignature;
        setEpgLastUpdated(timestamp);

        const errorMessage =
          errors.length > 0 && errors.length === activeEpgUrls.length
            ? errors.join('\n')
            : null;

        setEpgStatus({ loading: false, error: errorMessage });
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Unknown error';
        setEpgStatus({ loading: false, error: message });
      } finally {
        // Always clear timeout
        clearTimeout(loadingTimeout);
      }
    };

    let interactionHandle: ReturnType<typeof InteractionManager.runAfterInteractions> | null = null;
    const timeoutId = setTimeout(() => {
      interactionHandle = InteractionManager.runAfterInteractions(() => {
        loadEpg();
      });
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      clearTimeout(loadingTimeout);
      interactionHandle?.cancel();
    };
    // Only depend on datasetSignature, activeEpgUrls, and epgLastUpdated - not channels array reference
    // This prevents re-fetching when just switching channels
    // epgLastUpdated is included to trigger refresh when forceRefreshEpg is called
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetSignature, activeEpgUrls, epgLastUpdated]);

  const getProgramsForChannel = useCallback(
    instrumentFunction(
      (channelId: string): EPGProgram[] => {
        if (
          channelId &&
          !loadedChannelsRef.current.has(channelId) &&
          !pendingChannelLoadsRef.current.has(channelId)
        ) {
          // Defer loading to avoid blocking render
          if (__DEV__) {
            console.log(`[EPG] Requesting programs for channel ${channelId}`);
          }
          InteractionManager.runAfterInteractions(() => {
            loadProgramsForChannels([channelId]);
          });
        }
        const programs = programsByChannel[channelId] ?? [];
        if (__DEV__ && programs.length > 0) {
          console.log(`[EPG] getProgramsForChannel(${channelId}): returning ${programs.length} programs`);
        } else if (__DEV__ && channelId) {
          console.log(`[EPG] getProgramsForChannel(${channelId}): no programs found in programsByChannel`);
        }
        return programs;
      },
      'getProgramsForChannel'
    ),
    [programsByChannel, loadProgramsForChannels]
  );

  // Cache current program lookups to avoid repeated array searches
  const currentProgramCache = useRef<Map<string, { program: EPGProgram | null; timestamp: number }>>(new Map());
  const CACHE_TTL_MS = 60000; // 1 minute cache
  
  // Shared current time reference - updated every minute to avoid creating new Date objects
  const currentTimeRef = useRef<Date>(new Date());
  useEffect(() => {
    const interval = setInterval(() => {
      currentTimeRef.current = new Date();
      // Clear cache when time updates to ensure fresh lookups
      currentProgramCache.current.clear();
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const getCurrentProgram = useCallback(
    instrumentFunction(
      (channelId: string): EPGProgram | null => {
        if (!channelId) return null;
        
        // Check cache first
        const cached = currentProgramCache.current.get(channelId);
        const now = Date.now();
        if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
          return cached.program;
        }

        const programs = getProgramsForChannel(channelId);
        // Use shared time reference instead of creating new Date
        const currentTime = currentTimeRef.current;
        
        // Find current program (optimized: stop at first match)
        let currentProgram: EPGProgram | null = null;
        for (let i = 0; i < programs.length; i++) {
          const program = programs[i];
          if (program.start <= currentTime && program.end > currentTime) {
            currentProgram = program;
            break;
          }
        }
        
        // Fallback to first program if no current program found
        if (!currentProgram && programs.length > 0) {
          currentProgram = programs[0];
        }

        // Cache the result
        currentProgramCache.current.set(channelId, {
          program: currentProgram,
          timestamp: now,
        });

        return currentProgram;
      },
      'getCurrentProgram'
    ),
    [getProgramsForChannel]
  );

  return {
    getProgramsForChannel,
    getCurrentProgram,
    epgLoading: epgStatus.loading,
    epgError: epgStatus.error,
    epgLastUpdated,
    prefetchProgramsForChannels: loadProgramsForChannels,
    forceRefreshEpg,
  };
};


