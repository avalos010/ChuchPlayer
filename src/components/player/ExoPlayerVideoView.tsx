import React, { forwardRef, useEffect, useImperativeHandle } from 'react';
import { DeviceEventEmitter, NativeModules, requireNativeComponent } from 'react-native';
import type { PlayerPlaybackStatus, PlayerVideoHandle, PlayerVideoProps } from '../../types/video';

const { ExoPlayerModule } = NativeModules;

// Native Media3 PlayerView surface — hardware-accelerated, zero JS rendering overhead
const ExoPlayerNativeView = requireNativeComponent<{ style?: any }>('ExoPlayerView');

const READY_STATUS: PlayerPlaybackStatus = {
  isLoaded: true,
  isPlaying: true,
  isBuffering: false,
  didJustFinish: false,
};

const PAUSED_STATUS: PlayerPlaybackStatus = {
  isLoaded: true,
  isPlaying: false,
  isBuffering: false,
  didJustFinish: false,
};

// Drop-in replacement for AppVideo on Android. Uses a native ExoPlayer/PlayerView pair
// instead of expo-av so the video decoder path is fully hardware-accelerated (no bridge
// involvement in the render loop — fixes buffering stutter on live HLS streams).
const ExoPlayerVideoView = forwardRef<PlayerVideoHandle, PlayerVideoProps>(
  ({ source, onLoad, onError, onPlaybackStatusUpdate, style }, ref) => {
    const uri = (source as any)?.uri as string | undefined;

    useImperativeHandle(ref, () => ({
      playAsync: async () => {
        await ExoPlayerModule.play();
        return READY_STATUS;
      },
      pauseAsync: async () => {
        await ExoPlayerModule.pause();
        return PAUSED_STATUS;
      },
      unloadAsync: async () => {
        await ExoPlayerModule.stop();
      },
      setVolumeAsync: async (_vol: number) => {},
      loadAsync: async (src: any) => {
        const url = typeof src === 'string' ? src : src?.uri;
        if (url) await ExoPlayerModule.loadSource(url);
        return PAUSED_STATUS;
      },
    }));

    // Load source whenever the URI changes (PlayerVideoStage re-keys this component on channel change)
    useEffect(() => {
      if (!uri) return;
      ExoPlayerModule.loadSource(uri).catch((err: any) => {
        onError?.(err?.message ?? 'Failed to load stream');
      });
    }, [uri]);

    // Bridge native player events to existing PlayerVideoStage callbacks
    useEffect(() => {
      const stateSubscription = DeviceEventEmitter.addListener(
        'PLAYER_STATE_CHANGED',
        (event: { state: string }) => {
          switch (event.state) {
            case 'ready':
              onLoad?.();
              onPlaybackStatusUpdate?.(READY_STATUS);
              break;
            case 'buffering':
              onPlaybackStatusUpdate?.({
                isLoaded: true,
                isPlaying: false,
                isBuffering: true,
                didJustFinish: false,
              });
              break;
            case 'ended':
              onPlaybackStatusUpdate?.({
                isLoaded: true,
                isPlaying: false,
                isBuffering: false,
                didJustFinish: true,
              });
              break;
            case 'idle':
              onPlaybackStatusUpdate?.({ isLoaded: false });
              break;
          }
        },
      );

      const errorSubscription = DeviceEventEmitter.addListener(
        'PLAYER_ERROR',
        (event: { error: string }) => {
          onError?.(event.error);
        },
      );

      return () => {
        stateSubscription.remove();
        errorSubscription.remove();
      };
    }, [onLoad, onError, onPlaybackStatusUpdate]);

    return <ExoPlayerNativeView style={[{ flex: 1 }, style]} />;
  },
);

ExoPlayerVideoView.displayName = 'ExoPlayerVideoView';
export default ExoPlayerVideoView;
