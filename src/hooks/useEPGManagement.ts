import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';
import { EPGProgram } from '../types';
import { usePlayerStore } from '../store/usePlayerStore';
import {
  queryProgramsForChannels,
  ensureEpgDatabase,
  getPlaylistMetadata,
  setPlaylistMetadata,
  pruneOldPrograms,
  debugDatabaseContents,
} from '../database/epgDatabase';
import { ingestXmltvToDatabase } from '../utils/epgParser';
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
  const activeEpgUrlsRef = useRef<string[]>([]);

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

    // Keep ref in sync so the effect always reads the latest URLs without
    // taking activeEpgUrls as a dep (its reference changes on every playlist
    // object re-creation even when the content is identical, which would
    // cancel in-flight ingestion and restart the loading spinner endlessly).
    activeEpgUrlsRef.current = activeEpgUrls;
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
        console.log(`[EPG] Loading programs for channels: ${fetchIds.join(', ')}`);
        const result = await queryProgramsForChannels(playlist.id, fetchIds);
        console.log('[EPG] Loaded programs for channels:', Object.keys(result));
        let foundAny = false;

        // Debug: log what we found
        fetchIds.forEach((id) => {
          const programs = result[id] ?? [];
          console.log(`[EPG] Found ${programs.length} programs for channel ${id}`);
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
    [playlist, channelIdSet]
  );

  // Track last fetch time to prevent too frequent requests
  const lastFetchTimeRef = useRef<number>(0);
  const MIN_TIME_BETWEEN_FETCHES_MS = 5 * 60 * 1000; // 5 minutes minimum between fetches

  useEffect(() => {
    if (!datasetSignature) {
      loadedSignatureRef.current = null;
      setProgramsByChannel({});
      setEpgStatus({ loading: false, error: null });
      setEpgLastUpdated(Date.now());
      return;
    }

    // Prevent re-fetching if we already loaded this signature
    if (loadedSignatureRef.current === datasetSignature) {
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

    if (channels.length === 0) {
      return;
    }

    if (activeEpgUrlsRef.current.length === 0) {
      console.log('[EPG] No active EPG URLs found. Playlist info:', {
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
      setEpgStatus({ loading: false, error: null });
      setEpgLastUpdated(Date.now());
      return;
    }

    if (!playlist) {
      return;
    }

    const playlistId = playlist.id;
    let cancelled = false;

    const loadEpg = async () => {
      lastFetchTimeRef.current = Date.now();
      const errors: string[] = [];

      try {
        await ensureEpgDatabase();

        const existingMetadata = await getPlaylistMetadata(playlistId);
        const hasCachedData =
          existingMetadata?.sourceSignature === datasetSignature &&
          !!existingMetadata?.lastUpdated;

        if (hasCachedData) {
          // Serve cached programs immediately — no loading overlay needed.
          const initialChannelIds = channels
            .slice(0, INITIAL_PREFETCH_COUNT)
            .map((channel) => channel.id);
          await loadProgramsForChannels(initialChannelIds, { force: true });
          if (cancelled) return;

          loadedSignatureRef.current = datasetSignature;
          setEpgLastUpdated(existingMetadata.lastUpdated);
          setEpgStatus({ loading: false, error: null });

          const timeSinceLastUpdate = Date.now() - existingMetadata.lastUpdated;
          if (timeSinceLastUpdate < DEFAULT_REFRESH_INTERVAL_MS) {
            console.log('[EPG] Cache fresh, skipping re-ingest');
            return;
          }
          console.log('[EPG] Cache stale, re-ingesting in background');
          // Fall through to re-ingest without showing the overlay.
        } else {
          // No usable cache — clear stale data and show loading overlay.
          loadedChannelsRef.current.clear();
          pendingChannelLoadsRef.current.clear();
          setProgramsByChannel({});
          setEpgStatus({ loading: true, error: null });
        }

        const cutoff = Date.now() - PRUNE_LOWER_BOUND_HOURS * 60 * 60 * 1000;
        await pruneOldPrograms(playlistId, cutoff);
        const urlsToIngest = activeEpgUrlsRef.current;
        console.log('[EPG] Active EPG URLs:', urlsToIngest);

        if (!isNativeIngestionAvailable()) {
          // Web / non-Android: fetch + JS parser → IndexedDB
          for (let i = 0; i < urlsToIngest.length; i++) {
            const epgUrl = urlsToIngest[i];
            if (i > 0) await new Promise((r) => setTimeout(r, 2000));
            try {
              const response = await fetch(epgUrl);
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              await ingestXmltvToDatabase({ response, playlistId, channels });
            } catch (err) {
              errors.push(`${epgUrl} - ${err instanceof Error ? err.message : 'Unknown error'}`);
            }
          }
        } else {
          // Native ingestion runs in Kotlin background thread
          for (let i = 0; i < urlsToIngest.length; i++) {
            const epgUrl = urlsToIngest[i];
            if (i > 0) await new Promise((resolve) => setTimeout(resolve, 2000));
            try {
              const INGESTION_TIMEOUT_MS = 90 * 1000;
              const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('EPG ingestion timed out after 5 minutes')), INGESTION_TIMEOUT_MS)
              );
              const onEvent: IngestionEventListener = (type, data) => {
                const getUrlShort = (url?: string): string => {
                  if (!url || typeof url !== 'string') return 'unknown';
                  const parts = url.split('/');
                  return parts[parts.length - 1] || url;
                };
                if (type === 'progress') {
                  const progress = data as IngestionProgress;
                  console.log(`[EPG] ${getUrlShort(progress.epgUrl)}: ${progress.programsProcessed} processed`);
                } else if (type === 'complete') {
                  const complete = data as { programsCount: number; epgUrl?: string };
                  console.log(`[EPG] ${getUrlShort(complete.epgUrl)}: ${complete.programsCount} inserted`);
                } else if (type === 'error') {
                  const error = data as { error: string; epgUrl?: string };
                  console.error(`[EPG] ${getUrlShort(error.epgUrl)}: ${error.error}`);
                }
              };
              await Promise.race([
                startNativeEpgIngestion(epgUrl, playlistId, channels, datasetSignature, onEvent),
                timeoutPromise,
              ]);
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Unknown error';
              errors.push(`${epgUrl} - ${message}`);
            }
          }
        }

        if (cancelled) {
          return;
        }

        const timestamp = Date.now();

        // Metadata is written by Kotlin on native; on web we write it ourselves
        if (!isNativeIngestionAvailable()) {
          await setPlaylistMetadata(playlistId, timestamp, datasetSignature);
        }

        if (cancelled) {
          return;
        }

        if (cancelled) return;

        const postIngestChannelIds = channels
          .slice(0, INITIAL_PREFETCH_COUNT)
          .map((channel) => channel.id);
        await loadProgramsForChannels(postIngestChannelIds, { force: true });

        if (cancelled) return;

        loadedSignatureRef.current = datasetSignature;
        setEpgLastUpdated(timestamp);

        const errorMessage =
          errors.length > 0 && errors.length === urlsToIngest.length
            ? errors.join('\n')
            : null;

        setEpgStatus({ loading: false, error: errorMessage });
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Unknown error';
        setEpgStatus({ loading: false, error: message });
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
      interactionHandle?.cancel();
      // If loading was set to true by this effect and ingestion was cancelled
      // before completion, reset it so the spinner doesn't get stuck.
      setEpgStatus((prev) => (prev.loading ? { loading: false, error: null } : prev));
    };
    // datasetSignature already encodes activeEpgUrls.join('|'), so depending on
    // activeEpgUrls here would cause spurious re-runs every time the playlist
    // object gets a new reference (even with identical URLs). That would cancel
    // in-flight ingestion and restart the loading spinner in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetSignature]);

  const getProgramsForChannel = useCallback(
    (channelId: string): EPGProgram[] => {
      if (
        channelId &&
        !loadedChannelsRef.current.has(channelId) &&
        !pendingChannelLoadsRef.current.has(channelId)
      ) {
        loadProgramsForChannels([channelId]);
      }
      return programsByChannel[channelId] ?? [];
    },
    [programsByChannel, loadProgramsForChannels]
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
  };
};


