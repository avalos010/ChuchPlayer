import React from 'react';
import { Platform, requireNativeComponent, StyleProp, ViewStyle } from 'react-native';
import { Video, ResizeMode } from 'expo-av';

interface MultiScreenVideoViewProps {
  source: string;
  playing: boolean;
  volume: number;
  style?: StyleProp<ViewStyle>;
  onReady?: () => void;
  onBuffering?: (buffering: boolean) => void;
  onError?: (error: string) => void;
}

// Native per-instance ExoPlayer view (Android only)
const MultiExoPlayerNativeView =
  Platform.OS === 'android'
    ? requireNativeComponent<{
        source?: string;
        playing?: boolean;
        volume?: number;
        style?: any;
        onStateChange?: (e: any) => void;
        onError?: (e: any) => void;
      }>('MultiExoPlayerView')
    : null;

// Prop-driven video player for multi-screen tiles.
// Android: native ExoPlayer (one instance per tile, fully independent).
// Other platforms: expo-av fallback.
const MultiScreenVideoView: React.FC<MultiScreenVideoViewProps> = ({
  source,
  playing,
  volume,
  style,
  onReady,
  onBuffering,
  onError,
}) => {
  const handleStateChange = (e: any) => {
    const state: string = e.nativeEvent?.state ?? e.state;
    switch (state) {
      case 'ready':
        onReady?.();
        onBuffering?.(false);
        break;
      case 'buffering':
        onBuffering?.(true);
        break;
      case 'idle':
      case 'ended':
        onBuffering?.(false);
        break;
    }
  };

  const handleError = (e: any) => {
    const msg: string = e.nativeEvent?.error ?? e.error ?? 'Playback error';
    onError?.(msg);
  };

  if (Platform.OS === 'android' && MultiExoPlayerNativeView) {
    return (
      <MultiExoPlayerNativeView
        source={source}
        playing={playing}
        volume={volume}
        style={[{ flex: 1 }, style]}
        onStateChange={handleStateChange}
        onError={handleError}
      />
    );
  }

  // expo-av fallback for iOS / web
  return (
    <Video
      source={{ uri: source }}
      style={[{ flex: 1 }, style] as any}
      resizeMode={ResizeMode.COVER}
      shouldPlay={playing}
      volume={volume}
      useNativeControls={false}
      isLooping={false}
      onLoad={onReady}
      onError={(err) => onError?.(String(err))}
    />
  );
};

export default MultiScreenVideoView;
