import { useCallback, useEffect, useRef, useState } from 'react';
import { NativeModules } from 'react-native';
import { usePlayerStore } from '../store/usePlayerStore';
import { useUIStore } from '../store/useUIStore';
import { exoPlayerEmitter } from '../components/player/ExoPlayerView';
import { showError } from '../utils/toast';

const { ExoPlayerModule } = NativeModules;

/**
 * Hook for managing ExoPlayer native playback.
 * Bridges native ExoPlayer events to Zustand store state.
 * Uses tight buffer config (1s min) for instant channel starts.
 */
export const useExoPlayerPlayback = () => {
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const currentChannelRef = useRef<string | null>(null);

  const setIsPlaying = usePlayerStore((state) => state.setIsPlaying);
  const setLoading = usePlayerStore((state) => state.setLoading);
  const setError = usePlayerStore((state) => state.setError);
  const channel = usePlayerStore((state) => state.channel);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const setShowEPG = useUIStore((state) => state.setShowEPG);

  // Track current channel to avoid duplicate loads
  useEffect(() => {
    currentChannelRef.current = channel?.id ?? null;
  }, [channel?.id]);

  // Subscribe to player state changes
  useEffect(() => {
    const stateListener = exoPlayerEmitter.addListener(
      'PLAYER_STATE_CHANGED',
      (event) => {
        console.log('[ExoPlayer] State changed:', event.state);
        switch (event.state) {
          case 'idle':
            setLoading(false);
            setIsPlaying(false);
            break;
          case 'buffering':
            setLoading(true);
            break;
          case 'ready':
            setLoading(false);
            // Will auto-play based on state
            break;
          case 'ended':
            setIsPlaying(false);
            setLoading(false);
            break;
        }
      }
    );

    const errorListener = exoPlayerEmitter.addListener('PLAYER_ERROR', (event) => {
      console.error('[ExoPlayer] Error:', event.error);
      setLoading(false);
      setError('Failed to play stream');
      setTimeout(() => {
        showError('Stream error', event.error || 'Failed to play stream');
      }, 100);
    });

    return () => {
      stateListener.remove();
      errorListener.remove();
    };
  }, [setIsPlaying, setLoading, setError]);

  const handleTogglePlayback = useCallback(async () => {
    if (!channel) return;

    try {
      if (isPlaying) {
        await ExoPlayerModule.pause();
        setIsPlaying(false);
      } else {
        await ExoPlayerModule.play();
        setIsPlaying(true);
      }

      // Show EPG overlay
      setShowEPG(true);
    } catch (error) {
      console.error('[ExoPlayer] Toggle playback error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to control playback';
      setTimeout(() => {
        showError('Playback error', errorMsg);
      }, 100);
    }
  }, [isPlaying, channel, setIsPlaying, setShowEPG]);

  const handleChannelLoad = useCallback(async (url: string) => {
    if (!url) return;

    try {
      console.log('[ExoPlayer] Loading channel:', url);
      setLoading(true);
      await ExoPlayerModule.loadSource(url);
      // Auto-play based on store setting
      await ExoPlayerModule.play();
    } catch (error) {
      console.error('[ExoPlayer] Channel load error:', error);
      setLoading(false);
      const errorMsg = error instanceof Error ? error.message : 'Failed to load stream';
      setError(errorMsg);
      setTimeout(() => {
        showError('Stream load error', errorMsg);
      }, 100);
    }
  }, [setLoading, setError]);

  const handlePreloadChannel = useCallback(async (url: string) => {
    if (!url) return;

    try {
      console.log('[ExoPlayer] Preloading channel:', url);
      await ExoPlayerModule.preloadSource(url);
    } catch (error) {
      console.warn('[ExoPlayer] Preload error:', error);
      // Don't show error for preload failures
    }
  }, []);

  return {
    hasUserInteracted,
    setHasUserInteracted,
    handleTogglePlayback,
    handleChannelLoad,
    handlePreloadChannel,
  };
};
