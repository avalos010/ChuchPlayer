import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EPGProgram } from '../types';
import { usePlayerStore } from '../store/usePlayerStore';
import { parseXmltvToPrograms } from '../utils/epgParser';

type ProgramsByChannel = Record<string, EPGProgram[]>;

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

  const channelsSignature = useMemo(
    () => channels.map((channel) => channel.id).join('|'),
    [channels]
  );

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
      loadedSignatureRef.current = datasetSignature;
      setProgramsByChannel({});
      setEpgStatus({ loading: false, error: null });
      setEpgLastUpdated(Date.now());
      return;
    }

    let cancelled = false;
    setEpgStatus({ loading: true, error: null });

    const loadEpg = async () => {
      const aggregated = new Map<string, EPGProgram[]>();
      const errors: string[] = [];

      for (const epgUrl of activeEpgUrls) {
        try {
          const response = await fetch(epgUrl);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const xml = await response.text();
          const parsed = parseXmltvToPrograms(xml, channels);

          Object.entries(parsed).forEach(([channelId, programs]) => {
            if (!aggregated.has(channelId)) {
              aggregated.set(channelId, []);
            }
            aggregated.get(channelId)!.push(...programs);
          });
        } catch (error) {
          console.warn(`Failed to load EPG from ${epgUrl}:`, error);
          const message = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`${epgUrl} - ${message}`);
        }
      }

      if (cancelled) {
        return;
      }

      const merged: ProgramsByChannel = {};
      aggregated.forEach((programs, channelId) => {
        const dedup = new Map<string, EPGProgram>();
        programs.forEach((program) => {
          const key = `${program.start.getTime()}-${program.end.getTime()}-${program.title.toLowerCase()}`;
          if (!dedup.has(key)) {
            dedup.set(key, program);
          }
        });
        merged[channelId] = Array.from(dedup.values()).sort(
          (a, b) => a.start.getTime() - b.start.getTime()
        );
      });

      loadedSignatureRef.current = datasetSignature;
      setProgramsByChannel(merged);
      setEpgLastUpdated(Date.now());

      const errorMessage =
        errors.length > 0 && errors.length === activeEpgUrls.length
          ? errors.join('\n')
          : null;

      setEpgStatus({ loading: false, error: errorMessage });
    };

    loadEpg();

    return () => {
      cancelled = true;
    };
  }, [datasetSignature, channels, activeEpgUrls]);

  const getProgramsForChannel = useCallback(
    (channelId: string): EPGProgram[] => {
      return programsByChannel[channelId] ?? [];
    },
    [programsByChannel]
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
  };
};
