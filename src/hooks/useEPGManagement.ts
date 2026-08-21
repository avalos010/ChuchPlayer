import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InteractionManager } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { EPGProgram } from "../types";
import { usePlayerStore } from "../store/usePlayerStore";
import {
  queryProgramsForChannels,
  ensureEpgDatabase,
  getPlaylistMetadata,
  setPlaylistMetadata,
  pruneOldPrograms,
} from "../database/epgDatabase";
import { isNativeIngestionAvailable } from "../services/nativeEpgIngestion";
import {
  DEFAULT_REFRESH_INTERVAL_MS,
  EPG_LAST_INGEST_KEY,
  INITIAL_PREFETCH_COUNT,
  MIN_TIME_BETWEEN_FETCHES_MS,
  PRUNE_LOWER_BOUND_HOURS,
  STARTUP_SKIP_INTERVAL_MS,
} from "./epgManagement/constants";
import { loadE2EPrograms, isE2EWebMode, ProgramsByChannel } from "./epgManagement/e2e";
import { ingestEpgData } from "./epgManagement/ingestion";
import {
  buildDatasetSignature,
  getActiveEpgUrls,
} from "./epgManagement/signatures";

export const useEPGManagement = () => {
  const channels = usePlayerStore((state) => state.channels);
  const playlist = usePlayerStore((state) => state.playlist);

  const [programsByChannel, setProgramsByChannel] = useState<ProgramsByChannel>(
    {},
  );
  const [epgStatus, setEpgStatus] = useState<{
    loading: boolean;
    error: string | null;
  }>({
    loading: false,
    error: null,
  });
  const [epgLastUpdated, setEpgLastUpdated] = useState<number>(0);
  const loadedSignatureRef = useRef<string | null>(null);
  const loadedChannelsRef = useRef<Set<string>>(new Set());
  const pendingChannelLoadsRef = useRef<Set<string>>(new Set());
  const activeEpgUrlsRef = useRef<string[]>([]);

  const channelsSignature = useMemo(
    () => channels.map((channel) => channel.id).join("|"),
    [channels],
  );

  useEffect(() => {
    const e2ePrograms = loadE2EPrograms();
    if (!e2ePrograms) return;

    setProgramsByChannel(e2ePrograms);
    setEpgStatus({ loading: false, error: null });
    setEpgLastUpdated(Date.now());
    loadedChannelsRef.current = new Set(Object.keys(e2ePrograms));
  }, [channelsSignature]);

  const channelIdSet = useMemo(
    () => new Set(channels.map((channel) => channel.id)),
    [channels],
  );

  const activeEpgUrls = useMemo(() => getActiveEpgUrls(playlist), [playlist]);

  const datasetSignature = useMemo(() => {
    // Keep ref in sync so the effect always reads the latest URLs without
    // taking activeEpgUrls as a dep (its reference changes on every playlist
    // object re-creation even when the content is identical, which would
    // cancel in-flight ingestion and restart the loading spinner endlessly).
    activeEpgUrlsRef.current = activeEpgUrls;
    return buildDatasetSignature(playlist, channelsSignature, activeEpgUrls);
  }, [playlist, channelsSignature, activeEpgUrls]);

  const loadProgramsForChannels = useCallback(
    async (
      channelIds: string[],
      options?: { force?: boolean },
    ): Promise<boolean> => {
      if (!playlist || channelIds.length === 0) {
        return false;
      }

      const uniqueIds = Array.from(new Set(channelIds)).filter((id) =>
        channelIdSet.has(id),
      );

      const targetIds = uniqueIds.filter(
        (id) => options?.force || !loadedChannelsRef.current.has(id),
      );

      const fetchIds = targetIds.filter(
        (id) => !pendingChannelLoadsRef.current.has(id),
      );
      if (fetchIds.length === 0) {
        return false;
      }

      fetchIds.forEach((id) => pendingChannelLoadsRef.current.add(id));

      try {
        const result = await queryProgramsForChannels(playlist.id, fetchIds);
        let foundAny = false;

        fetchIds.forEach((id) => {
          const programs = result[id] ?? [];
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
        console.warn(
          "[EPG] Failed to load programs for channels",
          fetchIds,
          error,
        );
        fetchIds.forEach((id) => loadedChannelsRef.current.delete(id));
        return false;
      } finally {
        fetchIds.forEach((id) => pendingChannelLoadsRef.current.delete(id));
      }
    },
    [playlist, channelIdSet],
  );

  // Track last fetch time to prevent too frequent requests
  const lastFetchTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!datasetSignature) {
      loadedSignatureRef.current = null;
      if (!isE2EWebMode()) setProgramsByChannel({});
      setEpgStatus({ loading: false, error: null });
      setEpgLastUpdated(Date.now());
      return;
    }

    if (isE2EWebMode()) {
      loadedSignatureRef.current = datasetSignature;
      setEpgStatus({ loading: false, error: null });
      return;
    }

    // Prevent re-fetching if we already loaded this signature
    if (loadedSignatureRef.current === datasetSignature) {
      return;
    }

    // Rate limiting: Don't fetch if we fetched recently (within 5 minutes)
    const now = Date.now();
    if (now - lastFetchTimeRef.current < MIN_TIME_BETWEEN_FETCHES_MS) {
      console.log(
        "[EPG] Rate limiting: Skipping fetch, last fetch was",
        Math.round((now - lastFetchTimeRef.current) / 1000),
        "seconds ago",
      );
      // Mark as loaded to prevent re-triggering
      loadedSignatureRef.current = datasetSignature;
      return;
    }

    if (channels.length === 0) {
      return;
    }

    if (activeEpgUrlsRef.current.length === 0) {
      console.log("[EPG] No active EPG URLs found. Playlist info:", {
        id: playlist?.id,
        name: playlist?.name,
        sourceType: playlist?.sourceType,
        hasEpgUrls: !!playlist?.epgUrls?.length,
        epgUrls: playlist?.epgUrls,
        hasXtreamCreds: !!playlist?.xtreamCredentials,
        xtreamServer: playlist?.xtreamCredentials?.serverUrl,
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

      // ── Persistent cold-boot guard ─────────────────────────────────────────
      // loadedSignatureRef resets to null on every app open, so without this
      // check loadEpg() always runs even when the Realm DB has fresh data.
      // AsyncStorage survives cold boots — if the last ingest was recent and
      // used the same signature, load from Realm and skip the network round-trip.
      try {
        const stored = await AsyncStorage.getItem(EPG_LAST_INGEST_KEY);
        if (stored) {
          const { sig, ts } = JSON.parse(stored) as { sig: string; ts: number };
          if (sig === datasetSignature && Date.now() - ts < STARTUP_SKIP_INTERVAL_MS) {
            if (cancelled) return;
            const initialIds = channels.slice(0, INITIAL_PREFETCH_COUNT).map((c) => c.id);
            await loadProgramsForChannels(initialIds, { force: true });
            if (cancelled) return;
            loadedSignatureRef.current = datasetSignature;
            setEpgLastUpdated(ts);
            setEpgStatus({ loading: false, error: null });
            console.log("[EPG] Cold boot: cache fresh, skipped network ingest");
            return;
          }
        }
      } catch {
        // AsyncStorage failure is non-fatal — fall through to normal load
      }
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
            console.log("[EPG] Cache fresh, skipping re-ingest");
            // Persist so next cold boot takes the fast path
            AsyncStorage.setItem(
              EPG_LAST_INGEST_KEY,
              JSON.stringify({ sig: datasetSignature, ts: existingMetadata.lastUpdated }),
            ).catch(() => {/* non-fatal */});
            return;
          }
          console.log("[EPG] Cache stale, re-ingesting in background");
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
        console.log("[EPG] Active EPG URLs:", urlsToIngest);

        const ingestErrors = await ingestEpgData({
          playlistId,
          channels,
          datasetSignature: datasetSignature!,
          urlsToIngest,
        });
        errors.push(...ingestErrors);

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

        // Persist so the next cold boot can skip the network ingest
        AsyncStorage.setItem(
          EPG_LAST_INGEST_KEY,
          JSON.stringify({ sig: datasetSignature, ts: timestamp }),
        ).catch(() => {/* non-fatal */});

        const errorMessage =
          errors.length > 0 && errors.length === urlsToIngest.length
            ? errors.join("\n")
            : null;

        setEpgStatus({ loading: false, error: errorMessage });
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message =
          error instanceof Error ? error.message : "Unknown error";
        setEpgStatus({ loading: false, error: message });
      }
    };

    let interactionHandle: ReturnType<
      typeof InteractionManager.runAfterInteractions
    > | null = null;
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
      setEpgStatus((prev) =>
        prev.loading ? { loading: false, error: null } : prev,
      );
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
    [programsByChannel, loadProgramsForChannels],
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
    [getProgramsForChannel],
  );

  const peekCurrentProgram = useCallback(
    (channelId: string): EPGProgram | null => {
      const programs = programsByChannel[channelId] ?? [];
      const now = new Date();
      return (
        programs.find((program) => program.start <= now && program.end > now) ||
        programs[0] ||
        null
      );
    },
    [programsByChannel],
  );

  const forceRefresh = useCallback(() => {
    loadedSignatureRef.current = null;
    lastFetchTimeRef.current = 0;
    loadedChannelsRef.current.clear();
    pendingChannelLoadsRef.current.clear();
    setProgramsByChannel({});
    setEpgStatus({ loading: false, error: null });
  }, []);

  return {
    getProgramsForChannel,
    getCurrentProgram,
    peekCurrentProgram,
    epgLoading: epgStatus.loading,
    epgError: epgStatus.error,
    epgLastUpdated,
    prefetchProgramsForChannels: loadProgramsForChannels,
    forceRefresh,
  };
};
