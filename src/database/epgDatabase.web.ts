import { EPGProgram } from '../types';

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

export const ensureEpgDatabase = async (): Promise<void> => {
  throw new Error('Realm database is not available on web. EPG features require a native build.');
};

export const clearProgramsForPlaylist = async (): Promise<void> => {
  throw new Error('Realm database is not available on web.');
};

export const setPlaylistMetadata = async (): Promise<void> => {
  throw new Error('Realm database is not available on web.');
};

export const getPlaylistMetadata = async (): Promise<null> => {
  return null;
};

export const insertProgramsExclusive = async (): Promise<number> => {
  return 0;
};

export const queryProgramsForChannels = async (): Promise<Record<string, EPGProgram[]>> => {
  return {};
};

export const pruneOldPrograms = async (): Promise<void> => {
  // No-op on web
};

export const debugDatabaseContents = async (): Promise<void> => {
  console.log('[DB DEBUG] EPG database not available on web');
};
