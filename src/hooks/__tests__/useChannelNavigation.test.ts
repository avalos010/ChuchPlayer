import { renderHook, act } from '@testing-library/react-hooks';
import { Channel } from '../../types';

// ─── Mock stores ──────────────────────────────────────────────────────────────

const mockPlayerState: Record<string, any> = {
  channel: null,
  channels: [],
  navigateToChannel: jest.fn(),
};
const mockPlayerSetState = jest.fn();

jest.mock('../../store/usePlayerStore', () => ({
  usePlayerStore: Object.assign(
    (selector: any) => selector(mockPlayerState),
    {
      getState: () => ({ ...mockPlayerState, setState: mockPlayerSetState }),
      setState: mockPlayerSetState,
    }
  ),
}));

const mockUIState: Record<string, any> = {
  showEPGGrid: false,
  showEPG: false,
  showGroupsPlaylists: false,
  setShowChannelList: jest.fn(),
  setShowEPGGrid: jest.fn(),
};

jest.mock('../../store/useUIStore', () => ({
  useUIStore: (selector: any) => selector(mockUIState),
}));

const mockSetCurrentProgram = jest.fn();
jest.mock('../../store/useEPGStore', () => ({
  useEPGStore: (selector: any) =>
    selector({ setCurrentProgram: mockSetCurrentProgram }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

import { useChannelNavigation } from '../useChannelNavigation';

const makeChannel = (id: string): Channel => ({
  id,
  name: `Channel ${id}`,
  url: `https://stream.example.com/${id}.m3u8`,
});

const CH1 = makeChannel('ch-1');
const CH2 = makeChannel('ch-2');

const defaultProps = () => ({
  videoRef: { current: null } as any,
  getCurrentProgram: jest.fn().mockReturnValue(null),
  setHasUserInteracted: jest.fn(),
  hasUserInteracted: false,
  centerZoneRef: { current: null },
  setShowChannelInfoCard: jest.fn(),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPlayerState.channel = null;
  mockPlayerState.channels = [CH1, CH2];
  mockUIState.showEPGGrid = false;
  mockUIState.showEPG = false;
  mockUIState.showGroupsPlaylists = false;
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('handleChannelSelect', () => {
  it('batches state update into a single setState call when channel changes', async () => {
    mockPlayerState.channel = null;
    (require('../../store/usePlayerStore').usePlayerStore.getState as jest.Mock) = jest.fn(() => ({
      channel: null,
    }));

    const props = defaultProps();
    const { result } = renderHook(() => useChannelNavigation(props));

    await act(async () => {
      await result.current.handleChannelSelect(CH1);
    });

    expect(mockPlayerSetState).toHaveBeenCalledTimes(1);
    expect(mockPlayerSetState).toHaveBeenCalledWith(
      expect.objectContaining({ loading: true, error: null, isPlaying: false, channel: CH1 })
    );
  });

  it('does not change state when selecting the same channel already playing', async () => {
    const getState = jest.fn(() => ({ channel: CH1 }));
    (require('../../store/usePlayerStore').usePlayerStore as any).getState = getState;

    const props = defaultProps();
    const { result } = renderHook(() => useChannelNavigation(props));

    await act(async () => {
      await result.current.handleChannelSelect(CH1);
    });

    expect(mockPlayerSetState).not.toHaveBeenCalled();
    expect(mockUIState.setShowChannelList).toHaveBeenCalledWith(false);
    expect(props.setShowChannelInfoCard).toHaveBeenCalledWith(true);
  });
});

describe('D-pad guards', () => {
  it('handleUpDpad skips when isSwitchingChannelRef is true', async () => {
    const props = defaultProps();
    const { result } = renderHook(() => useChannelNavigation(props));

    // Manually set the switching ref
    result.current.isSwitchingChannelRef.current = true;
    mockPlayerState.navigateToChannel = jest.fn();

    await act(async () => {
      await result.current.handleUpDpad();
    });

    expect(mockPlayerState.navigateToChannel).not.toHaveBeenCalled();
  });

  it('handleDownDpad skips when showEPGGrid is true', async () => {
    mockUIState.showEPGGrid = true;
    mockPlayerState.navigateToChannel = jest.fn();

    const props = defaultProps();
    const { result } = renderHook(() => useChannelNavigation(props));

    await act(async () => {
      await result.current.handleDownDpad();
    });

    expect(mockPlayerState.navigateToChannel).not.toHaveBeenCalled();
  });

  it('handleDownDpad skips when showEPG is true', async () => {
    mockUIState.showEPG = true;
    mockPlayerState.navigateToChannel = jest.fn();

    const props = defaultProps();
    const { result } = renderHook(() => useChannelNavigation(props));

    await act(async () => {
      await result.current.handleDownDpad();
    });

    expect(mockPlayerState.navigateToChannel).not.toHaveBeenCalled();
  });
});
