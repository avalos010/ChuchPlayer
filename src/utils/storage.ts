import AsyncStorage from '@react-native-async-storage/async-storage';
import { Playlist, Settings, Channel } from '../types';

const PLAYLISTS_KEY = '@chuchPlayer:playlists';
const SETTINGS_KEY = '@chuchPlayer:settings';
const FAVORITES_KEY = '@chuchPlayer:favorites';
const LAST_CHANNEL_KEY = '@chuchPlayer:lastChannel';

type StoredPlaylist = Omit<Playlist, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

const serializePlaylist = (playlist: Playlist): StoredPlaylist => ({
  ...playlist,
  createdAt: playlist.createdAt.toISOString(),
  updatedAt: playlist.updatedAt.toISOString(),
});

const deserializePlaylist = (stored: StoredPlaylist): Playlist => ({
  ...stored,
  sourceType: stored.sourceType || 'm3u', // Default to 'm3u' for backward compatibility
  epgUrls: stored.epgUrls ?? [],
  createdAt: new Date(stored.createdAt),
  updatedAt: new Date(stored.updatedAt),
});

export const getPlaylists = async (): Promise<Playlist[]> => {
  try {
    const data = await AsyncStorage.getItem(PLAYLISTS_KEY);
    if (!data) {
      return [];
    }

    const parsed: StoredPlaylist[] = JSON.parse(data);
    return parsed.map(deserializePlaylist);
  } catch (error) {
    console.error('Error getting playlists:', error);
    return [];
  }
};

export const savePlaylist = async (playlist: Playlist): Promise<void> => {
  try {
    const playlists = await getPlaylists();
    const index = playlists.findIndex(p => p.id === playlist.id);

    if (index >= 0) {
      playlists[index] = playlist;
    } else {
      playlists.push(playlist);
    }

    const serialized = playlists.map(serializePlaylist);
    await AsyncStorage.setItem(PLAYLISTS_KEY, JSON.stringify(serialized));
  } catch (error) {
    console.error('Error saving playlist:', error);
    throw error;
  }
};

export const deletePlaylist = async (playlistId: string): Promise<void> => {
  try {
    const playlists = await getPlaylists();
    const filtered = playlists.filter(p => p.id !== playlistId);
    const serialized = filtered.map(serializePlaylist);
    await AsyncStorage.setItem(PLAYLISTS_KEY, JSON.stringify(serialized));
  } catch (error) {
    console.error('Error deleting playlist:', error);
    throw error;
  }
};

export const getSettings = async (): Promise<Settings> => {
  try {
    const data = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!data) {
      return {
        autoPlay: true,
        showEPG: false,
        theme: 'dark',
        multiScreenEnabled: true,
        maxMultiScreens: 4,
        epgRefreshIntervalMinutes: 120,
        channelRefreshIntervalMinutes: 120,
      };
    }

    const parsed = JSON.parse(data) as Settings;
    // Ensure backward compatibility
    return {
      ...parsed,
      multiScreenEnabled: parsed.multiScreenEnabled ?? true,
      maxMultiScreens: parsed.maxMultiScreens ?? 4,
      epgRefreshIntervalMinutes: parsed.epgRefreshIntervalMinutes ?? 120,
      channelRefreshIntervalMinutes: parsed.channelRefreshIntervalMinutes ?? 120,
    };
  } catch (error) {
    console.error('Error getting settings:', error);
    return {
      autoPlay: true,
      showEPG: false,
      theme: 'dark',
      multiScreenEnabled: true,
      maxMultiScreens: 4,
      epgRefreshIntervalMinutes: 120,
      channelRefreshIntervalMinutes: 120,
    };
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

