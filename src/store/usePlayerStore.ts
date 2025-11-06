import { create } from 'zustand';
import { Channel, Playlist } from '../types';
import { ResizeMode, AVPlaybackStatus, Video } from 'expo-av';
import { Animated, Dimensions, Platform } from 'react-native';
import { useUIStore } from './useUIStore';

interface PlayerState {
  // Core Player State
  channel: Channel | null;
  isPlaying: boolean;
  loading: boolean;
  error: string | null;
  resizeMode: ResizeMode;
  volume: number;
  channels: Channel[];
  playlist: Playlist | null;
  channelNumberInput: string;

  // Actions for Player State
  setChannel: (channel: Channel | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setResizeMode: (mode: ResizeMode) => void;
  setVolume: (volume: number) => void;
  setChannels: (channels: Channel[]) => void;
  setPlaylist: (playlist: Playlist | null) => void;
  setChannelNumberInput: (input: string) => void;

  // Video handlers
  handleVideoReady: () => void;
  handlePlaybackStatusUpdate: (status: AVPlaybackStatus) => void;

  // Volume actions (accept videoRef as parameter)
  // Note: UI store handles showing volume indicator
  adjustVolume: (delta: number, videoRef: React.RefObject<Video | null>) => void;
  toggleMute: (videoRef: React.RefObject<Video | null>) => void;

  // Channel navigation
  navigateToChannel: (
    direction: 'prev' | 'next',
    channels: Channel[],
    currentChannelId: string
  ) => Channel | null;
  handleChannelNumberInput: (
    digit: string,
    channels: Channel[],
    onChannelSelect: (channel: Channel) => void
  ) => void;

  // PIP actions (accept animated values as parameters)
  enterPIP: (pipAnim: Animated.ValueXY, pipScale: Animated.Value) => void;
  exitPIP: (pipAnim: Animated.ValueXY, pipScale: Animated.Value) => void;

  // Helper actions
  togglePlayback: () => void;
  cycleResizeMode: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  // Initial Player State
  channel: null,
  isPlaying: false,
  loading: false,
  error: null,
  resizeMode: ResizeMode.CONTAIN,
  volume: 1.0,
  channels: [],
  playlist: null,
  channelNumberInput: '',

  // Player State Actions
  setChannel: (channel) => set({ channel }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setResizeMode: (mode) => set({ resizeMode: mode }),
  setVolume: (volume) => set({ volume }),
  setChannels: (channels) => set({ channels }),
  setPlaylist: (playlist) => set({ playlist }),
  setChannelNumberInput: (input) => set({ channelNumberInput: input }),

  // Video handlers
  handleVideoReady: () => {
    set({ loading: false, error: null });
  },
  handlePlaybackStatusUpdate: (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if (status.error) {
        let errorMsg = 'Failed to load stream. Please try again later.';
        
        // Try to extract a more specific error message
        if (typeof status.error === 'string') {
          errorMsg = status.error;
        } else if ((status.error as any)?.message) {
          const errorMessage = (status.error as any).message;
          
          // Check for ExoPlayer unrecognized format error
          if (errorMessage.includes('UnrecognizedInputFormatException') || 
              errorMessage.includes('could read the stream')) {
            errorMsg = 'Stream format not supported. This channel may not be available.';
          } else {
            errorMsg = errorMessage;
          }
        }
        
        set({ error: errorMsg, loading: false });
      }
      return;
    }
    set({ loading: status.isBuffering, isPlaying: status.isPlaying });
    if (status.didJustFinish) {
      set({ isPlaying: false });
    }
  },

  // Volume actions
  // Note: UI store handles showing volume indicator to keep concerns separated
  adjustVolume: (delta, videoRef) => {
    const newVolume = Math.max(0, Math.min(1, get().volume + delta));
    if (videoRef.current) {
      videoRef.current.setVolumeAsync(newVolume);
    }
    set({ volume: newVolume });
    // Show volume indicator via UI store
    useUIStore.getState().setShowVolumeIndicator(true);
  },
  toggleMute: (videoRef) => {
    const newVolume = get().volume > 0 ? 0 : 1;
    if (videoRef.current) {
      videoRef.current.setVolumeAsync(newVolume);
    }
    set({ volume: newVolume });
    // Show volume indicator via UI store
    useUIStore.getState().setShowVolumeIndicator(true);
  },

  // Channel navigation
  navigateToChannel: (direction, channels, currentChannelId) => {
    const currentIndex = channels.findIndex((c) => c.id === currentChannelId);
    if (currentIndex === -1) return null;

    let newIndex: number;
    if (direction === 'next') {
      newIndex = (currentIndex + 1) % channels.length;
    } else {
      newIndex = currentIndex - 1;
      if (newIndex < 0) newIndex = channels.length - 1;
    }

    return channels[newIndex] || null;
  },
  handleChannelNumberInput: (digit, channels, onChannelSelect) => {
    const currentInput = get().channelNumberInput;
    const newInput = currentInput + digit;
    if (newInput.length <= 4) {
      set({ channelNumberInput: newInput });
      // Show channel number pad via UI store
      useUIStore.getState().setShowChannelNumberPad(true);

      const channelNum = parseInt(newInput, 10);
      if (channelNum > 0 && channelNum <= channels.length) {
        const targetChannel = channels[channelNum - 1];
        if (targetChannel) {
          setTimeout(() => {
            onChannelSelect(targetChannel);
            set({ channelNumberInput: '' });
            // Hide channel number pad via UI store
            useUIStore.getState().setShowChannelNumberPad(false);
          }, 800);
        }
      }
    }
  },

  // PIP actions - TiviMate style: minimize to top-right corner
  enterPIP: (pipAnim, pipScale) => {
    const { width, height } = Dimensions.get('window');
    // Calculate position for top-right corner
    // Transform origin is at center, so we need to calculate from center
    const scale = 0.25; // 25% of original size
    const margin = 16;
    
    // After scaling, video is 25% of original size centered at origin
    // To position in top-right: move right by (half screen - half scaled width - margin)
    // and move up by (half screen - half scaled height - margin)
    const scaledWidth = width * scale;
    const scaledHeight = height * scale;
    const translateX = width / 2 - scaledWidth / 2 - margin;
    const translateY = -height / 2 + scaledHeight / 2 + margin;
    
    Animated.parallel([
      Animated.timing(pipAnim, {
        toValue: { x: translateX, y: translateY },
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(pipScale, {
        toValue: scale,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  },
  exitPIP: (pipAnim, pipScale) => {
    Animated.parallel([
      Animated.timing(pipAnim, {
        toValue: { x: 0, y: 0 },
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(pipScale, {
        toValue: 1,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  },

  // Helper actions
  togglePlayback: () => set((state) => ({ isPlaying: !state.isPlaying })),
  cycleResizeMode: () => {
    const modes: ResizeMode[] = [
      ResizeMode.COVER,
      ResizeMode.CONTAIN,
      ResizeMode.STRETCH,
    ];
    const currentMode = get().resizeMode;
    const currentIndex = modes.indexOf(currentMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    set({ resizeMode: nextMode });
  },
}));

