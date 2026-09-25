import { AppState, NativeModules, Platform } from 'react-native';
import { create } from 'zustand';
import { usePlayerStore } from '../store/usePlayerStore';
import { useMultiScreenStore } from '../store/useMultiScreenStore';
import { showSuccess } from '../utils/toast';

interface SleepTimerState {
  endsAt: number | null;
  now: number;
  label: string | null;
}

const useSleepTimerState = create<SleepTimerState>(() => ({
  endsAt: null,
  now: Date.now(),
  label: null,
}));

let interval: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: { remove: () => void } | null = null;

const remainingSecondsAt = (endsAt: number | null, now: number) =>
  endsAt === null ? 0 : Math.max(0, Math.ceil((endsAt - now) / 1000));

const labelFor = (seconds: number) =>
  seconds === 0 ? null : seconds < 60 ? `${seconds}s` : `${Math.ceil(seconds / 60)}m`;

const stopTicking = () => {
  if (interval !== null) clearInterval(interval);
  interval = null;
  appStateSubscription?.remove();
  appStateSubscription = null;
};

const tick = () => {
  const now = Date.now();
  const { endsAt } = useSleepTimerState.getState();
  if (endsAt === null) return;

  const remainingSeconds = remainingSecondsAt(endsAt, now);
  if (remainingSeconds > 0) {
    useSleepTimerState.setState({ now, label: labelFor(remainingSeconds) });
    return;
  }

  stopTicking();
  useSleepTimerState.setState({ endsAt: null, now, label: null });
  usePlayerStore.getState().setIsPlaying(false);
  useMultiScreenStore.setState((state) => ({
    screens: state.screens.map((screen) => ({ ...screen, isPlaying: false })),
  }));
  if (Platform.OS === 'android') void NativeModules.ExoPlayerModule.pause();
  showSuccess('Sleep timer ended. Playback paused.');
};

export const clearSleepTimer = () => {
  stopTicking();
  useSleepTimerState.setState({ endsAt: null, now: Date.now(), label: null });
};

export const setSleepTimer = (minutes: number) => {
  clearSleepTimer();
  if (minutes <= 0) return;

  const now = Date.now();
  const endsAt = now + minutes * 60_000;
  useSleepTimerState.setState({ endsAt, now, label: labelFor(remainingSecondsAt(endsAt, now)) });
  interval = setInterval(tick, 1000);
  appStateSubscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') tick();
  });
};

export const extendSleepTimer = (minutes: number) => {
  const { endsAt } = useSleepTimerState.getState();
  if (endsAt === null) return;
  const now = Date.now();
  const nextEndsAt = Math.max(now, endsAt) + minutes * 60_000;
  useSleepTimerState.setState({ endsAt: nextEndsAt, now, label: labelFor(remainingSecondsAt(nextEndsAt, now)) });
};

export const useSleepTimerLabel = () => useSleepTimerState((state) => state.label);

export const useSleepTimer = () => {
  const endsAt = useSleepTimerState((state) => state.endsAt);
  const now = useSleepTimerState((state) => state.now);
  const remainingSeconds = remainingSecondsAt(endsAt, now);

  return {
    remainingSeconds,
    remainingMinutes: Math.ceil(remainingSeconds / 60),
    isActive: remainingSeconds > 0,
    endsAt,
    setTimer: setSleepTimer,
    clearTimer: clearSleepTimer,
    extendTimer: extendSleepTimer,
  };
};
