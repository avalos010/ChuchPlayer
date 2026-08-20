import { act, renderHook } from '@testing-library/react-hooks';
import { usePlayerHandlers } from '../usePlayerHandlers';

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

const setShowEPG = jest.fn();
const setShowEPGGrid = jest.fn();
const setShowGroupsPlaylists = jest.fn();
const setShowChannelList = jest.fn();
const setShowControls = jest.fn();
const setShowInfoBar = jest.fn();

const playerState = {
  channel: { id: 'channel-1', name: 'Channel 1', url: 'https://example.com/live.m3u8' },
  channels: [],
};

const uiState = {
  showEPG: false,
  showEPGGrid: false,
  showGroupsPlaylists: false,
  showChannelList: false,
  setShowEPG,
  setShowEPGGrid,
  setShowGroupsPlaylists,
  setShowChannelList,
  setShowControls,
  setShowInfoBar,
};

jest.mock('../../store/usePlayerStore', () => ({
  usePlayerStore: (selector: (state: typeof playerState) => unknown) => selector(playerState),
}));

jest.mock('../../store/useUIStore', () => ({
  useUIStore: Object.assign(
    (selector: (state: typeof uiState) => unknown) => selector(uiState),
    { getState: () => uiState },
  ),
}));

describe('usePlayerHandlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    uiState.showEPG = false;
    uiState.showEPGGrid = false;
    uiState.showGroupsPlaylists = false;
    uiState.showChannelList = false;
  });

  it('opens the horizontal info-bar controls on Center', () => {
    const { result } = renderHook(() => usePlayerHandlers(jest.fn(), true, { current: null }));

    act(() => result.current.handleCenterPress());

    expect(setShowControls).toHaveBeenCalledWith(true);
    expect(setShowInfoBar).toHaveBeenCalledWith(true);
    expect(setShowEPG).not.toHaveBeenCalledWith(true);
  });

  it('closes an existing overlay before opening the controls', () => {
    uiState.showEPG = true;
    const { result } = renderHook(() => usePlayerHandlers(jest.fn(), true, { current: null }));

    act(() => result.current.handleCenterPress());

    expect(setShowEPG).toHaveBeenCalledWith(false);
    expect(setShowControls).not.toHaveBeenCalled();
    expect(setShowInfoBar).not.toHaveBeenCalled();
  });
});
