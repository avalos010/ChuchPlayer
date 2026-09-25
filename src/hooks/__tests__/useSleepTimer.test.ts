import { act, renderHook } from '@testing-library/react-hooks';
import { clearSleepTimer, extendSleepTimer, setSleepTimer, useSleepTimer, useSleepTimerLabel } from '../useSleepTimer';

const mockPause = jest.fn().mockResolvedValue(true);
const mockRemove = jest.fn();
const mockAddEventListener = jest.fn((_event: string, _listener: (state: string) => void) => ({ remove: mockRemove }));
const mockSetIsPlaying = jest.fn();
const mockShowSuccess = jest.fn();
const mockSetMultiScreenState = jest.fn((_updater: (state: { screens: { id: string; isPlaying: boolean }[] }) => unknown) => {});

jest.mock('react-native', () => ({
  AppState: { addEventListener: (event: string, listener: (state: string) => void) => mockAddEventListener(event, listener) },
  NativeModules: { ExoPlayerModule: { pause: (...args: unknown[]) => mockPause(...args) } },
  Platform: { OS: 'android' },
}));

jest.mock('../../store/usePlayerStore', () => ({
  usePlayerStore: { getState: () => ({ setIsPlaying: mockSetIsPlaying }) },
}));

jest.mock('../../store/useMultiScreenStore', () => ({
  useMultiScreenStore: {
    setState: (updater: (state: { screens: { id: string; isPlaying: boolean }[] }) => unknown) => mockSetMultiScreenState(updater),
  },
}));

jest.mock('../../utils/toast', () => ({ showSuccess: (...args: unknown[]) => mockShowSuccess(...args) }));

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-01-01T12:00:00Z'));
  clearSleepTimer();
  jest.clearAllMocks();
});

afterEach(() => {
  clearSleepTimer();
  jest.useRealTimers();
});

it('keeps one countdown shared after a screen unmounts', () => {
  const first = renderHook(() => useSleepTimer());
  const label = renderHook(() => useSleepTimerLabel());

  act(() => first.result.current.setTimer(15));
  expect(label.result.current).toBe('15m');
  first.unmount();

  act(() => jest.advanceTimersByTime(61_000));
  const next = renderHook(() => useSleepTimer());
  expect(next.result.current.remainingSeconds).toBe(14 * 60 - 1);
  expect(label.result.current).toBe('14m');
});

it('uses the deadline when the app resumes after timers were suspended', () => {
  const timer = renderHook(() => useSleepTimer());
  act(() => setSleepTimer(15));

  act(() => {
    jest.setSystemTime(new Date('2026-01-01T12:10:00Z'));
    mockAddEventListener.mock.calls[0][1]('active');
  });

  expect(timer.result.current.remainingSeconds).toBe(5 * 60);
});

it('extends the active timer without resetting elapsed time', () => {
  const timer = renderHook(() => useSleepTimer());
  act(() => setSleepTimer(15));
  act(() => jest.advanceTimersByTime(60_000));
  act(() => extendSleepTimer(15));
  expect(timer.result.current.remainingSeconds).toBe(29 * 60);
});

it('pauses native and multi-screen playback on expiry', () => {
  const timer = renderHook(() => useSleepTimer());
  act(() => setSleepTimer(1 / 60));
  act(() => jest.advanceTimersByTime(1000));

  expect(timer.result.current.isActive).toBe(false);
  expect(mockSetIsPlaying).toHaveBeenCalledWith(false);
  expect(mockPause).toHaveBeenCalledTimes(1);
  expect(mockShowSuccess).toHaveBeenCalledTimes(1);
  expect(mockSetMultiScreenState.mock.calls[0][0]({ screens: [{ id: 'one', isPlaying: true }] }))
    .toEqual({ screens: [{ id: 'one', isPlaying: false }] });
  expect(mockRemove).toHaveBeenCalledTimes(1);
});

it('does not pause playback after cancellation', () => {
  act(() => setSleepTimer(15));
  act(() => clearSleepTimer());
  act(() => jest.advanceTimersByTime(16 * 60_000));

  expect(mockPause).not.toHaveBeenCalled();
  expect(mockSetIsPlaying).not.toHaveBeenCalled();
});
