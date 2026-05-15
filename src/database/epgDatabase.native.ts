import { NativeModules } from 'react-native';
import { EPGProgram } from '../types';

const { EpgIngestionModule } = NativeModules;

export type InsertableProgram = {
  playlistId: string;
  channelId: string;
  title: string;
  description?: string;
  start: number;
  end: number;
  epgChannelId?: string;
};

export type MetadataRow = {
  playlistId: string;
  lastUpdated: number;
  sourceSignature?: string | null;
};

const getNativeModule = () => {
  if (!EpgIngestionModule) {
    throw new Error('EpgIngestionModule is not available. Ensure a native build is installed.');
  }
  return EpgIngestionModule;
};

export const ensureEpgDatabase = async (): Promise<void> => {
  getNativeModule();
};

export const clearProgramsForPlaylist = async (_playlistId: string): Promise<void> => {
  // Programs are managed entirely by the native module; clearing is not exposed via bridge.
  // The native module deduplicates on insert so stale data is harmless.
};

export const setPlaylistMetadata = async (
  _playlistId: string,
  _lastUpdated: number,
  _sourceSignature?: string | null
): Promise<void> => {
  // Metadata is written by the native module after ingestion.
};

export const getPlaylistMetadata = async (
  playlistId: string
): Promise<MetadataRow | null> => {
  try {
    const meta = await getNativeModule().getNativePlaylistMetadata(playlistId);
    if (!meta) return null;
    return {
      playlistId: meta.playlistId,
      lastUpdated: meta.lastUpdated,
      sourceSignature: meta.sourceSignature || null,
    };
  } catch {
    return null;
  }
};

export const insertProgramsExclusive = async (
  _playlistId: string,
  _programs: InsertableProgram[]
): Promise<number> => {
  // Insertion is handled by the native module during ingestion.
  return 0;
};

export const queryProgramsForChannels = async (
  playlistId: string,
  channelIds: string[]
): Promise<Record<string, EPGProgram[]>> => {
  if (channelIds.length === 0) return {};

  try {
    const result: Record<string, { id: string; channelId: string; title: string; description: string; start: number; end: number }[]> =
      await getNativeModule().queryPrograms(playlistId, channelIds);

    const grouped: Record<string, EPGProgram[]> = {};
    for (const channelId of channelIds) {
      const programs = result[channelId] ?? [];
      grouped[channelId] = programs.map((p) => ({
        id: p.id,
        channelId: p.channelId,
        title: p.title,
        description: p.description || undefined,
        start: new Date(p.start),
        end: new Date(p.end),
      }));
    }
    return grouped;
  } catch (e) {
    console.warn('[EPG] queryProgramsForChannels failed:', e);
    return {};
  }
};

export const pruneOldPrograms = async (
  _playlistId: string,
  _cutoffTimestamp: number
): Promise<void> => {
  // Native module handles time-window filtering during ingestion and query.
};

export const debugDatabaseContents = async (playlistId?: string): Promise<void> => {
  try {
    if (playlistId) {
      const meta = await getPlaylistMetadata(playlistId);
      console.log('[DB DEBUG] Metadata:', meta);
    }
  } catch (e) {
    console.error('[DB DEBUG] Error:', e);
  }
};
