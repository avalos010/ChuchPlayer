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
} from '../database/epgDatabase';
import {
  isNativeIngestionAvailable,
  startNativeEpgIngestion,
  IngestionEventListener,
  IngestionProgress,
} from '../services/nativeEpgIngestion';

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
      if (fetchIds.length > 0) {
        console.log('[EPG] Loading programs for channels:', fetchIds);
      }

      if (fetchIds.length === 0) {
        return false;
      }

      fetchIds.forEach((id) => pendingChannelLoadsRef.current.add(id));

      try {
        const channelNames = fetchIds.map(id => {
          const ch = Array.from(channelIdSet).find(cid => {
            // Find channel by matching the ID
            const channel = channels.find(channel => channel.id === cid);
            return channel?.id === id;
          });
          const channel = channels.find(channel => channel.id === id);
          return channel ? `${channel.name} (tvgId: ${channel.tvgId || 'none'})` : id;
        });
        console.log(`[EPG] Loading programs for channels: ${channelNames.join(', ')}`);
        
        // Limit to 24 hours window (12 hours before and after now) and max 50 programs per channel
        const now = new Date();
        const startTime = new Date(now.getTime() - 12 * 60 * 60 * 1000); // 12 hours ago
        const endTime = new Date(now.getTime() + 12 * 60 * 60 * 1000); // 12 hours ahead
        
        const result = await queryProgramsForChannels(playlist.id, fetchIds, {
          startTime,
          endTime,
          maxProgramsPerChannel: 50, // Limit to 50 programs per channel for faster loading
        });
        console.log('[EPG] Loaded programs for channels:', Object.keys(result));
        let foundAny = false;

        // Debug: log what we found
        fetchIds.forEach((id) => {
          const programs = result[id] ?? [];
          const channel = channels.find(c => c.id === id);
          console.log(`[EPG] Found ${programs.length} programs for channel ${channel?.name || id} (id: ${id}, tvgId: ${channel?.tvgId || 'none'})`);
          if (programs.length > 0 && !foundAny) {
            foundAny = true;
          }
        });

        setProgramsByChannel((prev) => {
          const next: ProgramsByChannel = { ...prev };
          fetchIds.forEach((id) => {
            const programs = result[id] ?? [];
            next[id] = programs;
          });
          return next;
        });

        fetchIds.forEach((id) => loadedChannelsRef.current.add(id));

        return foundAny;
      } catch (error) {
        console.warn('[EPG] Failed to load programs for channels', fetchIds, error);
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
    console.log('[EPG] Force refresh requested');
    forceRefreshRef.current = true;
    loadedSignatureRef.current = null;
    lastFetchTimeRef.current = 0;
    setProgramsByChannel({});
    loadedChannelsRef.current.clear();
    pendingChannelLoadsRef.current.clear();
    // Force a re-render by updating state - this will trigger the useEffect
    setEpgLastUpdated(Date.now());
    setEpgStatus({ loading: true, error: null });
  }, []);

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
      console.log('[EPG] Force refresh active - bypassing all checks');
      forceRefreshRef.current = false; // Reset flag after reading
      // Clear the loaded signature to force reload
      loadedSignatureRef.current = null;
      lastFetchTimeRef.current = 0;
    } else {
      // Prevent re-fetching if we already loaded this signature
      if (loadedSignatureRef.current === datasetSignature) {
        console.log('[EPG] Already loaded this signature, skipping');
        return;
      }

      // Rate limiting: Don't fetch if we fetched recently (within 5 minutes)
      const now = Date.now();
      if (now - lastFetchTimeRef.current < MIN_TIME_BETWEEN_FETCHES_MS) {
        console.log('[EPG] Rate limiting: Skipping fetch, last fetch was', 
          Math.round((now - lastFetchTimeRef.current) / 1000), 'seconds ago');
        // Mark as loaded to prevent re-triggering
        loadedSignatureRef.current = datasetSignature;
        return;
      }
    }

    if (channels.length === 0) {
      return;
    }

    if (activeEpgUrls.length === 0) {
      console.warn('[EPG] No active EPG URLs found. Playlist info:', {
        id: playlist?.id,
        name: playlist?.name,
        sourceType: playlist?.sourceType,
        hasEpgUrls: !!playlist?.epgUrls?.length,
        epgUrls: playlist?.epgUrls,
        hasXtreamCreds: !!playlist?.xtreamCredentials,
        xtreamServer: playlist?.xtreamCredentials?.serverUrl
      });
      loadedSignatureRef.current = datasetSignature;
      setProgramsByChannel({});
      setEpgStatus({ loading: false, error: 'No EPG source configured for this playlist' });
      setEpgLastUpdated(Date.now());
      return;
    }
    
    console.log('[EPG] Using EPG source URLs:', activeEpgUrls);

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
        console.warn('[EPG] Loading timeout - clearing loading state');
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

        // Debug: check database state before processing
        console.log('[EPG] Checking database state before processing...');
        await debugDatabaseContents(playlistId);

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
          console.log('[EPG] Using cached programs for playlist', playlistId);
          // Respect refresh interval: skip re-ingest if data is recent
          const now = Date.now();
          const timeSinceLastUpdate = now - existingMetadata.lastUpdated;
          if (timeSinceLastUpdate < DEFAULT_REFRESH_INTERVAL_MS) {
            console.log('[EPG] Cached data is still fresh (updated', 
              Math.round(timeSinceLastUpdate / 1000 / 60), 'minutes ago), skipping ingestion');
            // Mark as loaded to prevent re-triggering
            loadedSignatureRef.current = datasetSignature;
            return;
          }
          console.log('[EPG] Cached data expired (updated', 
            Math.round(timeSinceLastUpdate / 1000 / 60), 'minutes ago), continuing with ingestion');
        }

        const cutoff = Date.now() - PRUNE_LOWER_BOUND_HOURS * 60 * 60 * 1000;
        await pruneOldPrograms(playlistId, cutoff);
        console.log('[EPG] active URLs', activeEpgUrls);

        console.log('[EPG] Active EPG URLs:', activeEpgUrls);
        console.log('[EPG] Channels to match:', channels.length, 'channels');
        console.log('[EPG] Sample channels:', channels.slice(0, 3).map(ch => ({
          id: ch.id,
          name: ch.name,
          tvgId: ch.tvgId || 'none'
        })));
        
        // Check if native ingestion is available
        if (!isNativeIngestionAvailable()) {
          console.warn('[EPG] Native ingestion not available - EPG loading skipped');
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
          
          console.log('[EPG] Starting native ingestion for', epgUrl);
          try {
            const onEvent: IngestionEventListener = (type, data) => {
              const getUrlShort = (url?: string): string => {
                if (!url || typeof url !== 'string') return 'unknown';
                const parts = url.split('/');
                return parts[parts.length - 1] || url;
              };

              if (type === 'progress') {
                const progress = data as IngestionProgress;
                const urlShort = getUrlShort(progress.epgUrl);
                console.log(`[EPG] ${urlShort}: ${progress.programsProcessed} programs processed`);
              } else if (type === 'complete') {
                const complete = data as { programsCount: number; epgUrl?: string };
                const urlShort = getUrlShort(complete.epgUrl);
                console.log(`[EPG] ${urlShort}: Complete - ${complete.programsCount} programs inserted`);
              } else if (type === 'error') {
                const error = data as { error: string; epgUrl?: string };
                const urlShort = getUrlShort(error.epgUrl);
                console.error(`[EPG] ${urlShort}: Error - ${error.error}`);
              }
            };

            await startNativeEpgIngestion(epgUrl, playlistId, channels, datasetSignature, onEvent);
            console.log('[EPG] Native ingest complete for', epgUrl);
          } catch (error) {
            console.error(`Native ingestion failed for ${epgUrl}:`, error);
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
        console.log('[EPG] Forcing initial channel load with cached metadata:', initialChannelIds);

        await loadProgramsForChannels(initialChannelIds, { force: true });
        const postIngestChannelIds = channels
          .slice(0, INITIAL_PREFETCH_COUNT)
          .map((channel) => channel.id);
        console.log('[EPG] Forcing initial channel load after ingest:', postIngestChannelIds);

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
    (channelId: string): EPGProgram[] => {
      if (
        channelId &&
        !loadedChannelsRef.current.has(channelId) &&
        !pendingChannelLoadsRef.current.has(channelId)
      ) {
        loadProgramsForChannels([channelId]);
      }
      const programs = programsByChannel[channelId] ?? [];
      
      // Debug logging when programs are requested but not found
      if (programs.length === 0 && loadedChannelsRef.current.has(channelId)) {
        const channel = channels.find(ch => ch.id === channelId);
        console.log(`[EPG] No programs found for channel ${channel?.name || channelId} (id: ${channelId}, tvgId: ${channel?.tvgId || 'none'})`);
      }
      
      return programs;
    },
    [programsByChannel, loadProgramsForChannels, channels]
  );

  const getCurrentProgram = useCallback(
    (channelId: string): EPGProgram | null => {
      const programs = getProgramsForChannel(channelId);
      const now = new Date();
      return (
        programs.find((program) => program.start <= now && program.end > now) ||
        programs[0] ||
        null
      );
    },
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


