import AsyncStorage from '@react-native-async-storage/async-storage';
import { Playlist, Settings, Channel } from '../types';
import { ensureUniqueChannelIds } from './channelIds';
import { playlistStorage } from './playlistStorage';

const PLAYLISTS_KEY = '@chuchPlayer:playlists';
const PLAYLIST_INDEX_KEY = '@chuchPlayer:playlistIndex:v2';
const PLAYLIST_ITEM_PREFIX = '@chuchPlayer:playlist:v2';
const MAX_CHUNK_CHARS = 350_000;
const SETTINGS_KEY = '@chuchPlayer:settings';
const FAVORITES_KEY = '@chuchPlayer:favorites';
const LAST_CHANNEL_KEY = '@chuchPlayer:lastChannel';
const RECENT_CHANNELS_KEY = '@chuchPlayer:recentChannels';

export const DEFAULT_SETTINGS: Settings = {
  autoPlay: true,
  showEPG: false,
  theme: 'dark',
  multiScreenEnabled: true,
  maxMultiScreens: 4,
  epgRefreshIntervalMinutes: 120,
  channelRefreshIntervalMinutes: 120,
  bufferMode: 'balanced',
  hardwareDecoder: true,
  infoBarTimeoutSeconds: 6,
  showChannelNumbers: false,
  clockFormat: '24h',
};

type StoredPlaylist = Omit<Playlist, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

type StoredPlaylistMetadata = Omit<StoredPlaylist, 'channels' | 'vodItems'> & {
  channelChunkCount: number;
  vodChunkCount: number;
};

const serializePlaylist = (playlist: Playlist): StoredPlaylist => ({
  ...playlist,
  createdAt: playlist.createdAt.toISOString(),
  updatedAt: playlist.updatedAt.toISOString(),
});

const deserializePlaylist = (stored: StoredPlaylist): Playlist => ({
  ...stored,
  channels: ensureUniqueChannelIds(stored.channels),
  vodItems: stored.vodItems ?? [],
  sourceType: stored.sourceType || 'm3u', // Default to 'm3u' for backward compatibility
  epgUrls: stored.epgUrls ?? [],
  createdAt: new Date(stored.createdAt),
  updatedAt: new Date(stored.updatedAt),
});

const metadataKey = (playlistId: string) => `${PLAYLIST_ITEM_PREFIX}:${playlistId}:meta`;
const chunkKey = (playlistId: string, type: 'channels' | 'vod', index: number) =>
  `${PLAYLIST_ITEM_PREFIX}:${playlistId}:${type}:${index}`;

const chunkItems = <T>(items: T[]): T[][] => {
  const chunks: T[][] = [];
  let current: T[] = [];
  let currentSize = 2;

  items.forEach((item) => {
    const itemSize = JSON.stringify(item).length + 1;
    if (current.length && currentSize + itemSize > MAX_CHUNK_CHARS) {
      chunks.push(current);
      current = [];
      currentSize = 2;
    }
    current.push(item);
    currentSize += itemSize;
  });

  if (current.length) chunks.push(current);
  return chunks;
};

const readIndex = async (): Promise<string[] | null> => {
  const data = await playlistStorage.getItem(PLAYLIST_INDEX_KEY);
  return data ? JSON.parse(data) : null;
};

const readChunkedPlaylist = async (playlistId: string): Promise<Playlist | null> => {
  const metadataData = await playlistStorage.getItem(metadataKey(playlistId));
  if (!metadataData) return null;
  const metadata = JSON.parse(metadataData) as StoredPlaylistMetadata;
  const keys = [
    ...Array.from({ length: metadata.channelChunkCount }, (_, index) => chunkKey(playlistId, 'channels', index)),
    ...Array.from({ length: metadata.vodChunkCount }, (_, index) => chunkKey(playlistId, 'vod', index)),
  ];
  const values = keys.length ? await playlistStorage.multiGet(keys) : [];
  const channelChunks = values.slice(0, metadata.channelChunkCount);
  const vodChunks = values.slice(metadata.channelChunkCount);
  const channels = channelChunks.flatMap(([, value]) => value ? JSON.parse(value) : []);
  const vodItems = vodChunks.flatMap(([, value]) => value ? JSON.parse(value) : []);
  const { channelChunkCount: _channelChunkCount, vodChunkCount: _vodChunkCount, ...stored } = metadata;
  return deserializePlaylist({ ...stored, channels, vodItems });
};

const writeChunkedPlaylist = async (playlist: Playlist): Promise<void> => {
  const previousData = await playlistStorage.getItem(metadataKey(playlist.id));
  const previous = previousData ? JSON.parse(previousData) as StoredPlaylistMetadata : null;
  const stored = serializePlaylist(playlist);
  const channelChunks = chunkItems(stored.channels);
  const vodChunks = chunkItems(stored.vodItems ?? []);
  const { channels: _channels, vodItems: _vodItems, ...rest } = stored;
  const metadata: StoredPlaylistMetadata = {
    ...rest,
    channelChunkCount: channelChunks.length,
    vodChunkCount: vodChunks.length,
  };
  const entries: [string, string][] = [
    [metadataKey(playlist.id), JSON.stringify(metadata)],
    ...channelChunks.map((chunk, index): [string, string] => [chunkKey(playlist.id, 'channels', index), JSON.stringify(chunk)]),
    ...vodChunks.map((chunk, index): [string, string] => [chunkKey(playlist.id, 'vod', index), JSON.stringify(chunk)]),
  ];
  await playlistStorage.multiSet(entries);

  if (previous) {
    const staleKeys = [
      ...Array.from(
        { length: Math.max(0, previous.channelChunkCount - channelChunks.length) },
        (_, index) => chunkKey(playlist.id, 'channels', channelChunks.length + index),
      ),
      ...Array.from(
        { length: Math.max(0, previous.vodChunkCount - vodChunks.length) },
        (_, index) => chunkKey(playlist.id, 'vod', vodChunks.length + index),
      ),
    ];
    if (staleKeys.length) await playlistStorage.multiRemove(staleKeys);
  }
};

const readLegacyPlaylists = async (): Promise<{ playlists: Playlist[]; readable: boolean }> => {
  try {
    const data = await playlistStorage.getItem(PLAYLISTS_KEY);
    if (!data) return { playlists: [], readable: true };
    const parsed: StoredPlaylist[] = JSON.parse(data);
    return { playlists: parsed.map(deserializePlaylist), readable: true };
  } catch (error) {
    console.error('Error reading legacy playlists:', error);
    return { playlists: [], readable: false };
  }
};

export const getPlaylists = async (): Promise<Playlist[]> => {
  try {
    const index = await readIndex();
    if (index) {
      const playlists = await Promise.all(index.map(readChunkedPlaylist));
      return playlists.filter((playlist): playlist is Playlist => playlist != null);
    }
    return (await readLegacyPlaylists()).playlists;
  } catch (error) {
    console.error('Error getting playlists:', error);
    return [];
  }
};

export const savePlaylist = async (playlist: Playlist): Promise<void> => {
  try {
    const existingIndex = await readIndex();
    let ids = existingIndex ?? [];
    let legacyReadable = false;

    if (!existingIndex) {
      const legacy = await readLegacyPlaylists();
      legacyReadable = legacy.readable;
      for (const existing of legacy.playlists) {
        await writeChunkedPlaylist(existing.id === playlist.id ? playlist : existing);
      }
      ids = legacy.playlists.map((existing) => existing.id);
    }
    await writeChunkedPlaylist(playlist);
    if (!ids.includes(playlist.id)) ids.push(playlist.id);
    await playlistStorage.setItem(PLAYLIST_INDEX_KEY, JSON.stringify(ids));
    if (!existingIndex && legacyReadable) await playlistStorage.removeItem(PLAYLISTS_KEY);
  } catch (error) {
    console.error('Error saving playlist:', error);
    throw error;
  }
};

export const deletePlaylist = async (playlistId: string): Promise<void> => {
  try {
    const index = await readIndex();
    if (!index) {
      const playlists = (await readLegacyPlaylists()).playlists;
      const filtered = playlists.filter((playlist) => playlist.id !== playlistId);
      await playlistStorage.setItem(PLAYLISTS_KEY, JSON.stringify(filtered.map(serializePlaylist)));
      return;
    }

    const metadataData = await playlistStorage.getItem(metadataKey(playlistId));
    const metadata = metadataData ? JSON.parse(metadataData) as StoredPlaylistMetadata : null;
    const keys = [metadataKey(playlistId)];
    if (metadata) {
      keys.push(
        ...Array.from({ length: metadata.channelChunkCount }, (_, chunkIndex) => chunkKey(playlistId, 'channels', chunkIndex)),
        ...Array.from({ length: metadata.vodChunkCount }, (_, chunkIndex) => chunkKey(playlistId, 'vod', chunkIndex)),
      );
    }
    await playlistStorage.multiRemove(keys);
    await playlistStorage.setItem(PLAYLIST_INDEX_KEY, JSON.stringify(index.filter((id) => id !== playlistId)));
  } catch (error) {
    console.error('Error deleting playlist:', error);
    throw error;
  }
};

export const getSettings = async (): Promise<Settings> => {
  try {
    const data = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!data) {
      return DEFAULT_SETTINGS;
    }

    const parsed = JSON.parse(data) as Settings;
    // Ensure backward compatibility
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      multiScreenEnabled: parsed.multiScreenEnabled ?? true,
      maxMultiScreens: parsed.maxMultiScreens ?? 4,
      epgRefreshIntervalMinutes: parsed.epgRefreshIntervalMinutes ?? 120,
      channelRefreshIntervalMinutes: parsed.channelRefreshIntervalMinutes ?? 120,
    };
  } catch (error) {
    console.error('Error getting settings:', error);
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = async (settings: Settings): Promise<void> => {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
};

export const getFavorites = async (): Promise<Channel[]> => {
  try {
    const data = await AsyncStorage.getItem(FAVORITES_KEY);
    return data ? (JSON.parse(data) as Channel[]) : [];
  } catch (error) {
    console.error('Error getting favorites:', error);
    return [];
  }
};

export const addToFavorites = async (channel: Channel): Promise<void> => {
  try {
    const favorites = await getFavorites();
    if (favorites.some(c => c.id === channel.id)) {
      return;
    }

    favorites.push(channel);
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  } catch (error) {
    console.error('Error adding to favorites:', error);
    throw error;
  }
};

export const removeFromFavorites = async (channelId: string): Promise<void> => {
  try {
    const favorites = await getFavorites();
    const filtered = favorites.filter(c => c.id !== channelId);
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error removing from favorites:', error);
    throw error;
  }
};

export const getRecentChannels = async (): Promise<string[]> => {
  try {
    const data = await AsyncStorage.getItem(RECENT_CHANNELS_KEY);
    return data ? (JSON.parse(data) as string[]) : [];
  } catch {
    return [];
  }
};

export const saveRecentChannels = async (ids: string[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(RECENT_CHANNELS_KEY, JSON.stringify(ids));
  } catch {}
};

export const saveLastChannel = async (channel: Channel): Promise<void> => {
  try {
    await AsyncStorage.setItem(LAST_CHANNEL_KEY, JSON.stringify(channel));
  } catch (error) {
    console.error('Error saving last channel:', error);
    throw error;
  }
};

export const getLastChannel = async (): Promise<Channel | null> => {
  try {
    const data = await AsyncStorage.getItem(LAST_CHANNEL_KEY);
    return data ? (JSON.parse(data) as Channel) : null;
  } catch (error) {
    console.error('Error getting last channel:', error);
    return null;
  }
};
