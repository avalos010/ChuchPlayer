import { useCallback, useRef, useState } from 'react';
import { Platform, AppState } from 'react-native';
import { Video, AVPlaybackStatus } from 'expo-av';
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

  const handleTogglePlayback = useCallback(async () => {
    try {
      // Mark user interaction for autoplay on web
      if (Platform.OS === 'web' && !hasUserInteracted) {
        setHasUserInteracted(true);
      }

      if (videoRef.current) {
        if (isPlaying) {
          await videoRef.current.pauseAsync();
          setIsPlaying(false);
        } else {
          await videoRef.current.playAsync();
          setIsPlaying(true);
        }
        // Show EPG overlay instead of controls
        if (channel) {
          setShowEPG(true);
        }
      }
    } catch (playbackError) {
      console.error('Error toggling playback:', playbackError);
      // On web, don't show error for NotAllowedError (autoplay blocked)
      if (Platform.OS === 'web' && playbackError instanceof Error && playbackError.name === 'NotAllowedError') {
        console.log('Autoplay blocked by browser');
        setIsPlaying(false);
        return;
      }
      const errorMsg = playbackError instanceof Error ? playbackError.message : 'Unknown error';
      setTimeout(() => {
        showError('Failed to control playback.', errorMsg);
      }, 100);
    }
  }, [isPlaying, setIsPlaying, channel, setShowEPG, hasUserInteracted, videoRef]);

  const handlePlaybackStatusUpdateWithError = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if (status.error) {
        console.error('Playback error:', status.error);
        const errorDetails = typeof status.error === 'string'
          ? status.error
          : (status.error as any)?.message || 'Unknown playback error';
        setError('Stream playback error. Please check your connection.');
        setLoading(false); // Clear loading on error
        setTimeout(() => {
          showError('Stream playback error. Please check your connection.', errorDetails);
        }, 100);
      }
      return;
    }

    // Update playing state first
    setIsPlaying(status.isPlaying);

    // Clear loading immediately when video starts playing
    // Don't show loading overlay once playback has started, even if buffering
    if (status.isPlaying) {
      setLoading(false);
    } else if (!status.isBuffering) {
      // Only clear loading if not buffering and not playing
      setLoading(false);
    }

    if (status.didJustFinish) {
      setIsPlaying(false);
      setLoading(false);
    }
  }, [setLoading, setIsPlaying, setError]);

  const handleVideoReadyWithPlayback = useCallback(async () => {
    console.log('Video onLoad callback - video is ready for channel:', channel?.name);
    handleVideoReady();
    // Clear loading immediately when video is ready
    setLoading(false);

    // Check if we should auto-play
    try {
      const settings = await getSettings();
      console.log('Auto-play setting:', settings.autoPlay);
      if (videoRef.current) {
        if (settings.autoPlay) {
          // On web, only autoplay if user has interacted
          if (Platform.OS === 'web' && !hasUserInteracted) {
            console.log('Skipping autoplay on web - waiting for user interaction');
            setIsPlaying(false);
            return;
          }
          console.log('Auto-playing video from onLoad...');
          try {
            const playbackStatus = await videoRef.current.playAsync();
            console.log('PlayAsync result:', playbackStatus);
            if (playbackStatus.isLoaded) {
              setIsPlaying(playbackStatus.isPlaying);
              console.log('Video playback started, isPlaying:', playbackStatus.isPlaying);
            }
          } catch (playError) {
            console.error('PlayAsync error:', playError);
            throw playError;
          }
        } else {
          // Still pause to ensure clean state
          await videoRef.current.pauseAsync();
          setIsPlaying(false);
        }
      }
    } catch (errorPlaying) {
      console.error('Error starting playback:', errorPlaying);

      // Handle platform-specific expected errors gracefully
      const errorMessage = errorPlaying instanceof Error ? errorPlaying.message : String(errorPlaying);
      const errorName = errorPlaying instanceof Error ? errorPlaying.name : '';

      // On web, don't show error for NotAllowedError (autoplay blocked)
      if (Platform.OS === 'web' && errorName === 'NotAllowedError') {
        console.log('Autoplay blocked by browser - user interaction required');
        setIsPlaying(false);
        setLoading(false);
        return;
      }

      // On Android, don't show error for AudioFocusNotAcquiredException (app in background)
      if (Platform.OS === 'android' && errorMessage.includes('AudioFocusNotAcquiredException')) {
        console.log('Audio focus not acquired - app may be in background. Will retry when app comes to foreground.');
        setIsPlaying(false);
        setLoading(false);

        // Retry after a short delay in case app is actually foreground
        setTimeout(() => {
          if (videoRef.current && AppState.currentState === 'active') {
            console.log('Retrying playback after audio focus error...');
            videoRef.current.playAsync()
              .then(status => {
                console.log('Retry successful, status:', status);
                if (status.isLoaded) {
                  setIsPlaying(status.isPlaying);
                }
              })
              .catch(retryErr => {
                console.log('Retry failed:', retryErr);
              });
          }
        }, 1000);
        return;
      }

      // Only show error for unexpected errors
      const errorMsg = errorMessage || 'Unknown error';
      setTimeout(() => {
        showError('Failed to start playback.', errorMsg);
      }, 100);
      setLoading(false);
    }
  }, [handleVideoReady, setIsPlaying, setLoading, channel?.name, hasUserInteracted, videoRef]);

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

