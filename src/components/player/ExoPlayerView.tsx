import React, { useEffect } from 'react';
import { NativeModules, NativeEventEmitter, View, StyleSheet } from 'react-native';

const { ExoPlayerModule } = NativeModules;

export const exoPlayerEmitter = new NativeEventEmitter(ExoPlayerModule);

interface ExoPlayerViewProps {
  source: string;
  autoPlay?: boolean;
  onStateChange?: (state: 'idle' | 'buffering' | 'ready' | 'ended') => void;
  onError?: (error: string) => void;
  onProgress?: (positionMs: number, bufferedMs: number) => void;
  style?: any;
}

/**
 * Native ExoPlayer wrapper component.
 * Note: On non-Android platforms, this should fallback to expo-av's Video component.
 */
const ExoPlayerView: React.FC<ExoPlayerViewProps> = ({
  source,
  autoPlay = true,
  onStateChange,
  onError,
  onProgress,
  style,
}) => {
  useEffect(() => {
    if (!source) return;

    // Load source
    ExoPlayerModule.loadSource(source)
      .then(() => {
        if (autoPlay) {
          return ExoPlayerModule.play();
        }
      })
      .catch((err: any) => {
        console.error('[ExoPlayer] Failed to load:', err);
        onError?.(err.message || 'Failed to load stream');
      });

    // Subscribe to state changes
    const stateListener = exoPlayerEmitter.addListener('PLAYER_STATE_CHANGED', (event) => {
      onStateChange?.(event.state);
    });

    const errorListener = exoPlayerEmitter.addListener('PLAYER_ERROR', (event) => {
      console.error('[ExoPlayer] Error:', event.error);
      onError?.(event.error);
    });

    const progressListener = exoPlayerEmitter.addListener('PLAYER_PROGRESS', (event) => {
      onProgress?.(event.positionMs, event.bufferedMs);
    });

    return () => {
      stateListener.remove();
      errorListener.remove();
      progressListener.remove();
    };
  }, [source, autoPlay, onStateChange, onError, onProgress]);

  // This is a placeholder view — actual rendering is done by native module
  // In a full implementation, we'd use requireNativeComponent<ExoPlayerView>('ExoPlayerView')
  return (
    <View style={[styles.container, style]}>
      {/* Native ExoPlayer view will be rendered here */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
});

export default ExoPlayerView;
