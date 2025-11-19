import { useCallback, useRef, useState } from 'react';
import { Platform, AppState } from 'react-native';
import Video from 'react-native-video';
import { usePlayerStore } from '../store/usePlayerStore';
import { useUIStore } from '../store/useUIStore';
import { getSettings } from '../utils/storage';
import { showError } from '../utils/toast';

export const useVideoPlayback = (videoRef: React.RefObject<Video | null>) => {
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const setIsPlaying = usePlayerStore((state) => state.setIsPlaying);
  const setLoading = usePlayerStore((state) => state.setLoading);
  const setError = usePlayerStore((state) => state.setError);
  const channel = usePlayerStore((state) => state.channel);
  const handleVideoReady = usePlayerStore((state) => state.handleVideoReady);
  const handlePlaybackStatusUpdate = usePlayerStore((state) => state.handlePlaybackStatusUpdate);
  
  // UI state
  const setShowEPG = useUIStore((state) => state.setShowEPG);

  const handleTogglePlayback = useCallback(() => {
    try {
      // Mark user interaction for autoplay on web
      if (Platform.OS === 'web' && !hasUserInteracted) {
        setHasUserInteracted(true);
      }

      // react-native-video uses paused prop, so we just toggle the state
      setIsPlaying(!isPlaying);
      
      // Show EPG overlay instead of controls
      if (channel) {
        setShowEPG(true);
      }
    } catch (playbackError) {
      console.error('Error toggling playback:', playbackError);
      const errorMsg = playbackError instanceof Error ? playbackError.message : 'Unknown error';
      setTimeout(() => {
        showError('Failed to control playback.', errorMsg);
      }, 100);
    }
  }, [isPlaying, setIsPlaying, channel, setShowEPG, hasUserInteracted]);

  // Throttle status updates to reduce JS thread blocking
  const lastStatusUpdateRef = useRef<number>(0);
  const STATUS_UPDATE_THROTTLE_MS = 250; // Only process status updates every 250ms

  const handlePlaybackStatusUpdateWithError = useCallback((data: any) => {
    const now = Date.now();

    // Throttle status updates to reduce JS thread blocking
    if (now - lastStatusUpdateRef.current < STATUS_UPDATE_THROTTLE_MS) {
      return;
    }
    lastStatusUpdateRef.current = now;

    // react-native-video onProgress gives: { currentTime, playableDuration, seekableDuration }
    // onBuffer gives: { isBuffering: boolean }
    if (data.isBuffering !== undefined) {
      // This is from onBuffer
      if (!data.isBuffering && isPlaying) {
        setLoading(false);
      } else if (data.isBuffering) {
        setLoading(true);
      }
    } else if (data.currentTime !== undefined) {
      // This is from onProgress
      // Video is playing if we're getting progress updates
      if (isPlaying) {
        setLoading(false);
      }
    }
  }, [setLoading, isPlaying]);

  const handleVideoReadyWithPlayback = useCallback(async () => {
    console.log('Video onLoad callback - video is ready for channel:', channel?.name);
    handleVideoReady();
    // Clear loading immediately when video is ready
    setLoading(false);

    // Check if we should auto-play
    try {
      const settings = await getSettings();
      console.log('Auto-play setting:', settings.autoPlay);
      
      if (settings.autoPlay) {
        // On web, only autoplay if user has interacted
        if (Platform.OS === 'web' && !hasUserInteracted) {
          console.log('Skipping autoplay on web - waiting for user interaction');
          setIsPlaying(false);
          return;
        }
        console.log('Auto-playing video from onLoad...');
        setIsPlaying(true);
      } else {
        setIsPlaying(false);
      }
    } catch (errorPlaying) {
      console.error('Error starting playback:', errorPlaying);
      const errorMsg = errorPlaying instanceof Error ? errorPlaying.message : 'Unknown error';
      setTimeout(() => {
        showError('Failed to start playback.', errorMsg);
      }, 100);
      setLoading(false);
    }
  }, [handleVideoReady, setIsPlaying, setLoading, channel?.name, hasUserInteracted]);

  const handleVideoError = useCallback((error: any) => {
    console.error('Video onError callback:', error);
    setLoading(false);

    // Parse error to provide better user feedback
    let errorMsg = 'Failed to load stream. Please check your connection and try again.';
    const errorString = String(error);

    // Check for ExoPlayer unrecognized format error
    if (errorString.includes('UnrecognizedInputFormatException') ||
      errorString.includes('could read the stream')) {
      errorMsg = 'Stream format not supported. This channel may not be available or the stream format is incompatible.';
    } else if (errorString.includes('NetworkError') || errorString.includes('network')) {
      errorMsg = 'Network error. Please check your internet connection.';
    } else if (errorString.includes('404') || errorString.includes('Not Found')) {
      errorMsg = 'Stream not found. This channel may no longer be available.';
    } else if (errorString.includes('403') || errorString.includes('Forbidden')) {
      errorMsg = 'Access denied. This stream may require authentication.';
    }

    setError(errorMsg);
    setTimeout(() => {
      showError('Video load error', errorMsg);
    }, 100);
  }, [setLoading, setError]);

  return {
    hasUserInteracted,
    setHasUserInteracted,
    handleTogglePlayback,
    handlePlaybackStatusUpdateWithError,
    handleVideoReadyWithPlayback,
    handleVideoError,
  };
};

