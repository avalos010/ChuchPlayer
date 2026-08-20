import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  saveLastChannel,
  getLastChannel,
  getSettings,
  saveSettings,
  addToFavorites,
  removeFromFavorites,
  getFavorites,
  savePlaylist,
  getPlaylists,
  deletePlaylist,
} from '../storage';
import { Channel, Playlist, Settings } from '../../types';

const CHANNEL: Channel = {
  id: 'ch-1',
  name: 'Test Channel',
  url: 'https://stream.example.com/ch1.m3u8',
  logo: 'https://example.com/logo.png',
  group: 'News',
  tvgId: 'test.ch',
};

const makePlaylist = (overrides: Partial<Playlist> = {}): Playlist => ({
  id: 'pl-1',
  name: 'My Playlist',
  url: 'https://example.com/playlist.m3u',
  sourceType: 'm3u',
  channels: [CHANNEL],
  epgUrls: ['https://epg.example.com/guide.xml'],
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-06-01T00:00:00.000Z'),
  ...overrides,
});

beforeEach(() => {
  (AsyncStorage.clear as jest.Mock)?.();
  jest.clearAllMocks();
});

describe('last channel', () => {
  it('round-trips a channel through AsyncStorage', async () => {
    await saveLastChannel(CHANNEL);
    const retrieved = await getLastChannel();
    expect(retrieved).toEqual(CHANNEL);
  });

  it('returns null when no channel is stored', async () => {
    const result = await getLastChannel();
    expect(result).toBeNull();
  });

  it('preserves all channel fields including optional ones', async () => {
    const full: Channel = { ...CHANNEL, number: 42, catchupAvailable: true };
    await saveLastChannel(full);
    const retrieved = await getLastChannel();
    expect(retrieved?.number).toBe(42);
    expect(retrieved?.catchupAvailable).toBe(true);
  });
});

describe('settings', () => {
  it('returns default settings when nothing is stored', async () => {
    const settings = await getSettings();
    expect(settings.autoPlay).toBe(true);
    expect(settings.theme).toBe('dark');
    expect(settings.maxMultiScreens).toBe(4);
  });

  it('round-trips saved settings', async () => {
    const custom: Settings = {
      autoPlay: false,
      showEPG: true,
      theme: 'light',
      multiScreenEnabled: false,
      maxMultiScreens: 2,
      epgRefreshIntervalMinutes: 60,
      channelRefreshIntervalMinutes: 30,
    };
    await saveSettings(custom);
    const result = await getSettings();
    expect(result.autoPlay).toBe(false);
    expect(result.theme).toBe('light');
    expect(result.maxMultiScreens).toBe(2);
  });

  it('applies defaults for missing optional fields (backward compat)', async () => {
    // Simulate old stored settings without multiScreenEnabled
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      JSON.stringify({ autoPlay: true, showEPG: false, theme: 'dark' })
    );
    const settings = await getSettings();
    expect(settings.multiScreenEnabled).toBe(true);
    expect(settings.maxMultiScreens).toBe(4);
  });
});

describe('favorites', () => {
  it('starts empty', async () => {
    expect(await getFavorites()).toEqual([]);
  });

  it('adds a channel to favorites', async () => {
    await addToFavorites(CHANNEL);
    const favs = await getFavorites();
    expect(favs).toHaveLength(1);
    expect(favs[0].id).toBe('ch-1');
  });

  it('does not duplicate an already-favorited channel', async () => {
    await addToFavorites(CHANNEL);
    await addToFavorites(CHANNEL);
    const favs = await getFavorites();
    expect(favs).toHaveLength(1);
  });

  it('removes a channel from favorites', async () => {
    await addToFavorites(CHANNEL);
    await removeFromFavorites('ch-1');
    const favs = await getFavorites();
    expect(favs).toHaveLength(0);
  });
});

describe('playlists', () => {
  it('returns empty array when no playlists stored', async () => {
    expect(await getPlaylists()).toEqual([]);
  });

  it('saves and retrieves a playlist with Date fields intact', async () => {
    const pl = makePlaylist();
    await savePlaylist(pl);
    const playlists = await getPlaylists();
    expect(playlists).toHaveLength(1);
    expect(playlists[0].createdAt).toBeInstanceOf(Date);
    expect(playlists[0].updatedAt).toBeInstanceOf(Date);
    expect(playlists[0].createdAt.toISOString()).toBe('2025-01-01T00:00:00.000Z');
    expect(playlists[0].updatedAt.toISOString()).toBe('2025-06-01T00:00:00.000Z');
  });

  it('updates an existing playlist by id', async () => {
    await savePlaylist(makePlaylist());
    await savePlaylist(makePlaylist({ name: 'Renamed Playlist' }));
    const playlists = await getPlaylists();
    expect(playlists).toHaveLength(1);
    expect(playlists[0].name).toBe('Renamed Playlist');
  });

  it('deletes only the selected playlist', async () => {
    await savePlaylist(makePlaylist());
    await savePlaylist(makePlaylist({ id: 'pl-2', name: 'Sports' }));

    await deletePlaylist('pl-1');

    const playlists = await getPlaylists();
    expect(playlists.map(playlist => playlist.id)).toEqual(['pl-2']);
  });

  it('normalizes duplicate channel IDs in saved playlists', async () => {
    await savePlaylist(makePlaylist({
      channels: [
        CHANNEL,
        { ...CHANNEL, name: 'Test Channel Backup', url: 'https://stream.example.com/backup.m3u8' },
      ],
    }));

    const [playlist] = await getPlaylists();
    expect(new Set(playlist.channels.map(channel => channel.id)).size).toBe(2);
    expect(playlist.channels[0].id).toBe(CHANNEL.id);
    expect(playlist.channels[1].id).toMatch(/^ch-1-/);
  });

  it('preserves epgUrls through serialization round-trip', async () => {
    const pl = makePlaylist({ epgUrls: ['https://epg1.com/guide.xml', 'https://epg2.com/guide.xml'] });
    await savePlaylist(pl);
    const [retrieved] = await getPlaylists();
    expect(retrieved.epgUrls).toEqual(['https://epg1.com/guide.xml', 'https://epg2.com/guide.xml']);
  });

  it('defaults sourceType to m3u for old records missing the field', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      JSON.stringify([{ id: 'pl-x', name: 'Old', url: 'http://x.com', channels: [], createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' }])
    );
    const playlists = await getPlaylists();
    expect(playlists[0].sourceType).toBe('m3u');
  });
});
