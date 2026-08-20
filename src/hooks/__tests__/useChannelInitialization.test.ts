import { act, renderHook } from '@testing-library/react-hooks';
import { Channel, Playlist } from '../../types';

const setChannel = jest.fn();
const setChannels = jest.fn();
const setPlaylist = jest.fn();
const setIsPlaying = jest.fn();
const setMaxScreens = jest.fn();
const setShowEPG = jest.fn();
const setShowEPGGrid = jest.fn();
const setCurrentProgram = jest.fn();
const addScreen = jest.fn();

const playerState: Record<string, any> = {
  channel: null,
  setChannel,
  setChannels,
  setPlaylist,
  setIsPlaying,
};

jest.mock('../../store/usePlayerStore', () => ({
  usePlayerStore: (selector: any) => selector(playerState),
}));

jest.mock('../../store/useUIStore', () => ({
  useUIStore: (selector: any) => selector({ setShowEPG, setShowEPGGrid }),
}));

jest.mock('../../store/useEPGStore', () => ({
  useEPGStore: (selector: any) => selector({ setCurrentProgram }),
}));

jest.mock('../../store/useMultiScreenStore', () => ({
  useMultiScreenStore: (selector?: any) => {
    const state = {
      isMultiScreenMode: false,
      screens: [],
      addScreen,
      setMaxScreens,
    };
    return selector ? selector(state) : state;
  },
}));

const getPlaylists = jest.fn();
const getLastChannel = jest.fn();
const getSettings = jest.fn();
const saveLastChannel = jest.fn();

jest.mock('../../utils/storage', () => ({
  getPlaylists: (...args: unknown[]) => getPlaylists(...args),
  getLastChannel: (...args: unknown[]) => getLastChannel(...args),
  getSettings: (...args: unknown[]) => getSettings(...args),
  saveLastChannel: (...args: unknown[]) => saveLastChannel(...args),
}));

jest.mock('../interfacePreferences/useInterfacePreferences', () => ({
  syncInterfacePreferences: jest.fn(),
}));

import { useChannelInitialization } from '../useChannelInitialization';

const channel: Channel = {
  id: 'channel-1',
  name: 'Channel 1',
  url: 'https://example.com/channel-1.m3u8',
};

const playlist: Playlist = {
  id: 'playlist-1',
  name: 'Playlist 1',
  url: 'https://example.com/get.php',
  sourceType: 'm3u',
  channels: [channel],
  epgUrls: [],
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

const settings = {
  autoPlay: true,
  showEPG: false,
  maxMultiScreens: 4,
};

beforeEach(() => {
  jest.clearAllMocks();
  playerState.channel = null;
  getLastChannel.mockResolvedValue(null);
  getSettings.mockResolvedValue(settings);
  saveLastChannel.mockResolvedValue(undefined);
});

it('stays uninitialized until persisted playlists finish loading', async () => {
  let resolvePlaylists: (playlists: Playlist[]) => void = () => {};
  getPlaylists.mockReturnValue(new Promise<Playlist[]>((resolve) => {
    resolvePlaylists = resolve;
  }));

  const { result, unmount } = renderHook(() => useChannelInitialization({
    getCurrentProgram: jest.fn(),
  }));

  expect(result.current.initialized).toBe(false);
  expect(setPlaylist).not.toHaveBeenCalled();

  await act(async () => {
    resolvePlaylists([playlist]);
    await Promise.resolve();
  });

  expect(result.current.initialized).toBe(true);
  expect(setPlaylist).toHaveBeenCalledWith(playlist);
  expect(setChannels).toHaveBeenCalledWith(playlist.channels);
  unmount();
});

it('loads the first playlist when the saved channel is stale', async () => {
  let resolveLastChannel: (channel: Channel) => void = () => {};
  getLastChannel.mockReturnValue(new Promise<Channel>((resolve) => {
    resolveLastChannel = resolve;
  }));
  getPlaylists.mockResolvedValue([playlist]);

  const { result, unmount } = renderHook(() => useChannelInitialization({
    getCurrentProgram: jest.fn(),
  }));

  await act(async () => {
    resolveLastChannel({
      ...channel,
      id: 'removed-channel',
    });
    await Promise.resolve();
  });

  expect(result.current.initialized).toBe(true);
  expect(setPlaylist).toHaveBeenCalledWith(playlist);
  expect(setChannels).toHaveBeenCalledWith(playlist.channels);
  expect(setChannel).not.toHaveBeenCalled();
  unmount();
});
