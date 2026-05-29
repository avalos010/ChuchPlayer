import type { AVPlaybackStatus, AVPlaybackSource, ResizeMode } from 'expo-av';
import type { StyleProp, ViewStyle } from 'react-native';

export type PlayerPlaybackStatus =
  | AVPlaybackStatus
  | {
      isLoaded: true;
      isPlaying: boolean;
      isBuffering: boolean;
      didJustFinish: boolean;
      error?: string;
    }
  | {
      isLoaded: false;
      error?: string;
    };

export interface PlayerVideoHandle {
  playAsync: () => Promise<PlayerPlaybackStatus>;
  pauseAsync: () => Promise<PlayerPlaybackStatus>;
  unloadAsync: () => Promise<void>;
  setVolumeAsync: (volume: number) => Promise<void>;
  loadAsync: (source: AVPlaybackSource) => Promise<PlayerPlaybackStatus>;
}

export interface PlayerVideoProps {
  source: AVPlaybackSource;
  style?: StyleProp<ViewStyle>;
  resizeMode?: ResizeMode;
  shouldPlay?: boolean;
  onLoad?: () => void;
  onError?: (error: unknown) => void;
  onPlaybackStatusUpdate?: (status: PlayerPlaybackStatus) => void;
  progressUpdateIntervalMillis?: number;
  useNativeControls?: boolean;
  isLooping?: boolean;
  volume?: number;
  isMuted?: boolean;
  focusable?: boolean;
  importantForAccessibility?: 'auto' | 'yes' | 'no' | 'no-hide-descendants';
}
