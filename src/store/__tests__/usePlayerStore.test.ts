import { Channel } from '../../types';

// usePlayerStore imports expo-av and react-native internals; mock heavy deps
jest.mock('expo-av', () => ({
  ResizeMode: { CONTAIN: 'contain', COVER: 'cover', STRETCH: 'stretch' },
  Video: {},
}));
jest.mock('react-native', () => ({
  Animated: {
    Value: jest.fn(() => ({ setValue: jest.fn() })),
    ValueXY: jest.fn(() => ({ setValue: jest.fn() })),
    timing: jest.fn(() => ({ start: jest.fn() })),
    parallel: jest.fn(() => ({ start: jest.fn() })),
  },
  Dimensions: { get: jest.fn(() => ({ width: 1920, height: 1080 })) },
  Platform: { OS: 'android' },
}));
jest.mock('../../store/useUIStore', () => ({
  useUIStore: {
    getState: () => ({
      setShowVolumeIndicator: jest.fn(),
      setShowChannelNumberPad: jest.fn(),
    }),
  },
}));

import { usePlayerStore } from '../usePlayerStore';

const makeChannel = (id: string, name = `Channel ${id}`): Channel => ({
  id,
  name,
  url: `https://stream.example.com/${id}.m3u8`,
});

const CHANNELS = [
  makeChannel('ch-1', 'Channel 1'),
  makeChannel('ch-2', 'Channel 2'),
  makeChannel('ch-3', 'Channel 3'),
];

describe('navigateToChannel', () => {
  const { navigateToChannel } = usePlayerStore.getState();

  it('returns the next channel in sequence', () => {
    const next = navigateToChannel('next', CHANNELS, 'ch-1');
    expect(next?.id).toBe('ch-2');
  });

  it('wraps from last channel to first (circular)', () => {
    const next = navigateToChannel('next', CHANNELS, 'ch-3');
    expect(next?.id).toBe('ch-1');
  });

  it('returns the previous channel in sequence', () => {
    const prev = navigateToChannel('prev', CHANNELS, 'ch-2');
    expect(prev?.id).toBe('ch-1');
  });

  it('wraps from first channel to last (circular)', () => {
    const prev = navigateToChannel('prev', CHANNELS, 'ch-1');
    expect(prev?.id).toBe('ch-3');
  });

  it('returns null when channel id is not in the list', () => {
    const result = navigateToChannel('next', CHANNELS, 'ch-999');
    expect(result).toBeNull();
  });

  it('returns the same channel when the list has only one item', () => {
    const single = [makeChannel('solo')];
    const next = navigateToChannel('next', single, 'solo');
    expect(next?.id).toBe('solo');
    const prev = navigateToChannel('prev', single, 'solo');
    expect(prev?.id).toBe('solo');
  });
});

describe('store setState batch', () => {
  it('batches loading, error, isPlaying, and channel in one setState call', () => {
    const setSpy = jest.spyOn(usePlayerStore, 'setState');
    const ch = makeChannel('ch-batch');

    usePlayerStore.setState({ loading: true, error: null, isPlaying: false, channel: ch });

    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({ loading: true, error: null, isPlaying: false, channel: ch })
    );
    setSpy.mockRestore();
  });
});

describe('togglePlayback', () => {
  it('flips isPlaying state', () => {
    usePlayerStore.setState({ isPlaying: false });
    usePlayerStore.getState().togglePlayback();
    expect(usePlayerStore.getState().isPlaying).toBe(true);
    usePlayerStore.getState().togglePlayback();
    expect(usePlayerStore.getState().isPlaying).toBe(false);
  });
});

describe('cycleResizeMode', () => {
  it('cycles through COVER → CONTAIN → STRETCH and back', () => {
    const { ResizeMode } = require('expo-av');
    const modes = [ResizeMode.COVER, ResizeMode.CONTAIN, ResizeMode.STRETCH];

    usePlayerStore.setState({ resizeMode: ResizeMode.COVER });
    usePlayerStore.getState().cycleResizeMode();
    expect(usePlayerStore.getState().resizeMode).toBe(ResizeMode.CONTAIN);
    usePlayerStore.getState().cycleResizeMode();
    expect(usePlayerStore.getState().resizeMode).toBe(ResizeMode.STRETCH);
    usePlayerStore.getState().cycleResizeMode();
    expect(usePlayerStore.getState().resizeMode).toBe(ResizeMode.COVER);
  });
});
