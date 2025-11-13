import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';
import { EPGProgram } from '../types';
import { usePlayerStore } from '../store/usePlayerStore';
import { ingestXmltvToDatabase } from '../utils/epgParser';
import {
  queryProgramsForChannels,
  setPlaylistMetadata,
  ensureEpgDatabase,
  getPlaylistMetadata,
  pruneOldPrograms,
  debugDatabaseContents,
} from '../database/epgDatabase';

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

  useEffect(() => {
    if (!datasetSignature) {
      loadedSignatureRef.current = null;
      setProgramsByChannel({});
      setEpgStatus({ loading: false, error: null });
      setEpgLastUpdated(Date.now());
      return;
    }

    if (channels.length === 0) {
      return;
    }

    if (loadedSignatureRef.current === datasetSignature) {
      return;
    }

    if (activeEpgUrls.length === 0) {
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
    loadedChannelsRef.current.clear();
    pendingChannelLoadsRef.current.clear();
    setProgramsByChannel({});
    setEpgStatus({ loading: true, error: null });

    const loadEpg = async () => {
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
        if (now - existingMetadata.lastUpdated < DEFAULT_REFRESH_INTERVAL_MS) {
          console.log('[EPG] Cached data is still fresh, skipping ingestion');
          return;
        }
        console.log('[EPG] Cached data expired, continuing with ingestion');
          return;
        }

        const cutoff = Date.now() - PRUNE_LOWER_BOUND_HOURS * 60 * 60 * 1000;
        await pruneOldPrograms(playlistId, cutoff);
        console.log('[EPG] active URLs', activeEpgUrls);

        console.log('[EPG] Active EPG URLs:', activeEpgUrls);
        for (const epgUrl of activeEpgUrls) {
          console.log('[EPG] fetching', epgUrl);
          try {
            const response = await fetch(epgUrl);
            console.log(
              '[EPG] response status',
              response.status,
              response.headers.get('content-length')
            );
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            await ingestXmltvToDatabase({
              response,
              playlistId,
              channels,
            });

            console.log('[EPG] ingest complete for', epgUrl);
          } catch (error) {
            console.warn(`Failed to load EPG from ${epgUrl}:`, error);
            const message = error instanceof Error ? error.message : 'Unknown error';
            errors.push(`${epgUrl} - ${message}`);
          }
        }

        if (cancelled) {
          return;
        }

        const timestamp = Date.now();
        await setPlaylistMetadata(playlistId, timestamp, datasetSignature);

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
    };
  }, [datasetSignature, channels, activeEpgUrls, loadProgramsForChannels]);

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
