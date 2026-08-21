import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { ResizeMode } from 'expo-av';
import { View, StyleSheet } from 'react-native';
import Hls from 'hls.js';
import type {
  PlayerPlaybackStatus,
  PlayerVideoHandle,
  PlayerVideoProps,
} from '../../types/video';
import { getXtreamProxyUrl } from '../../utils/xtreamProxy';

const isHlsUri = (uri: string) =>
  uri.includes('.m3u8') || uri.includes('m3u8') || uri.includes('/hls/');

const getUri = (source: PlayerVideoProps['source']): string => {
  if (!source) return '';
  if (typeof source === 'number') return '';
  if (Array.isArray(source)) return '';
  if ('uri' in source && typeof source.uri === 'string') return source.uri;
  return '';
};

const getObjectFit = (resizeMode?: ResizeMode) => {
  switch (resizeMode) {
    case ResizeMode.COVER:
      return 'cover';
    case ResizeMode.STRETCH:
      return 'fill';
    default:
      return 'contain';
  }
};

const AppVideo = forwardRef<PlayerVideoHandle, PlayerVideoProps>(({
  source,
  style,
  resizeMode = ResizeMode.CONTAIN,
  shouldPlay = false,
  onLoad,
  onError,
  onPlaybackStatusUpdate,
  progressUpdateIntervalMillis = 1000,
  useNativeControls = false,
  isLooping = false,
  volume = 1,
  isMuted = false,
}, ref) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shouldPlayRef = useRef(shouldPlay);
  const volumeRef = useRef(volume);
  const mutedRef = useRef(isMuted);
  const uri = getXtreamProxyUrl(getUri(source));

  const emitStatus = useCallback((status: PlayerPlaybackStatus) => {
    onPlaybackStatusUpdate?.(status);
    return status;
  }, [onPlaybackStatusUpdate]);

  const snapshotStatus = useCallback((overrides?: Partial<Extract<PlayerPlaybackStatus, { isLoaded: true }>>): PlayerPlaybackStatus => {
    const el = videoRef.current;
    return {
      isLoaded: true as const,
      isPlaying: !!el && !el.paused && !el.ended,
      isBuffering: !!el && el.readyState < 3,
      didJustFinish: !!el && el.ended,
      positionMillis: el ? el.currentTime * 1000 : 0,
      playableDurationMillis: el?.buffered.length ? el.buffered.end(el.buffered.length - 1) * 1000 : 0,
      durationMillis: el && Number.isFinite(el.duration) ? el.duration * 1000 : 0,
      ...(overrides ?? {}),
    };
  }, []);

  const clearProgressTimer = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const startProgressTimer = useCallback(() => {
    clearProgressTimer();
    progressTimerRef.current = setInterval(() => {
      emitStatus(snapshotStatus());
    }, progressUpdateIntervalMillis);
  }, [clearProgressTimer, emitStatus, progressUpdateIntervalMillis, snapshotStatus]);

  const syncMediaState = useCallback(async () => {
    const el = videoRef.current;
    if (!el) return { isLoaded: false as const, error: 'Video element unavailable' };
    el.loop = isLooping;
    el.volume = volumeRef.current;
    el.muted = mutedRef.current;
    if (shouldPlayRef.current) {
      await el.play();
    } else {
      el.pause();
    }
    return snapshotStatus();
  }, [isLooping, snapshotStatus]);

  const destroyHls = useCallback(() => {
    hlsRef.current?.destroy();
    hlsRef.current = null;
  }, []);

  const attachSource = useCallback(async (nextUri: string, autoPlay: boolean) => {
    const el = videoRef.current;
    shouldPlayRef.current = autoPlay;
    if (!el || !nextUri) {
      return emitStatus({ isLoaded: false, error: 'Missing video URL' });
    }

    clearProgressTimer();
    destroyHls();
    el.pause();
    el.removeAttribute('src');
    el.load();

    const handleLoaded = async () => {
      try {
        onLoad?.();
        await syncMediaState();
        emitStatus(snapshotStatus({ isBuffering: false }));
        startProgressTimer();
      } catch (error) {
        onError?.(error);
        emitStatus({ isLoaded: false, error: error instanceof Error ? error.message : String(error) });
      }
    };

    if (isHlsUri(nextUri) && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
      });
      hlsRef.current = hls;
      hls.loadSource(nextUri);
      hls.attachMedia(el);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { void handleLoaded(); });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          onError?.(data);
          emitStatus({ isLoaded: false, error: data.details || 'HLS playback error' });
        }
      });
      return emitStatus(snapshotStatus({ isBuffering: true }));
    }

    el.src = nextUri;
    el.load();
    void handleLoaded();
    return emitStatus(snapshotStatus({ isBuffering: true }));
  }, [clearProgressTimer, destroyHls, emitStatus, onError, onLoad, snapshotStatus, startProgressTimer, syncMediaState]);

  useImperativeHandle(ref, () => ({
    playAsync: async () => {
      shouldPlayRef.current = true;
      try {
        const status = await syncMediaState();
        return emitStatus(status);
      } catch (error) {
        onError?.(error);
        return emitStatus({ isLoaded: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
    pauseAsync: async () => {
      shouldPlayRef.current = false;
      const status = await syncMediaState();
      return emitStatus(status);
    },
    unloadAsync: async () => {
      clearProgressTimer();
      destroyHls();
      const el = videoRef.current;
      if (!el) return;
      el.pause();
      el.removeAttribute('src');
      el.load();
    },
    setVolumeAsync: async (nextVolume: number) => {
      volumeRef.current = nextVolume;
      const el = videoRef.current;
      if (!el) return;
      el.volume = nextVolume;
      emitStatus(snapshotStatus());
    },
    loadAsync: async (nextSource) => attachSource(
      getXtreamProxyUrl(getUri(nextSource)),
      shouldPlayRef.current,
    ),
    seekToAsync: async (positionMillis) => {
      const el = videoRef.current;
      if (el) el.currentTime = positionMillis / 1000;
      return emitStatus(snapshotStatus());
    },
    getStatusAsync: async () => snapshotStatus(),
  }), [attachSource, clearProgressTimer, destroyHls, emitStatus, onError, snapshotStatus, syncMediaState]);

  useEffect(() => {
    volumeRef.current = volume;
    mutedRef.current = isMuted;
    const el = videoRef.current;
    if (!el) return;
    el.volume = volume;
    el.muted = isMuted;
  }, [isMuted, volume]);

  useEffect(() => {
    shouldPlayRef.current = shouldPlay;
    void syncMediaState().then(emitStatus).catch((error) => {
      onError?.(error);
    });
  }, [emitStatus, onError, shouldPlay, syncMediaState]);

  useEffect(() => {
    void attachSource(uri, shouldPlay);
    return () => {
      clearProgressTimer();
      destroyHls();
    };
  }, [attachSource, clearProgressTimer, destroyHls, shouldPlay, uri]);

  const videoStyle = useMemo(() => ({
    width: '100%',
    height: '100%',
    objectFit: getObjectFit(resizeMode) as 'contain' | 'cover' | 'fill',
    backgroundColor: '#000',
    display: 'block',
  }), [resizeMode]);

  return (
    <View style={[styles.container, style]}>
      {/* @ts-ignore React Native Web supports DOM video elements here */}
      <video
        ref={videoRef}
        style={videoStyle}
        controls={useNativeControls}
        playsInline
        loop={isLooping}
        onPlaying={() => emitStatus(snapshotStatus({ isBuffering: false }))}
        onPause={() => emitStatus(snapshotStatus())}
        onWaiting={() => emitStatus(snapshotStatus({ isBuffering: true }))}
        onEnded={() => emitStatus(snapshotStatus({ didJustFinish: true }))}
        onError={(event: unknown) => {
          onError?.(event);
          emitStatus({ isLoaded: false, error: 'Web video playback failed' });
        }}
      />
    </View>
  );
});

AppVideo.displayName = 'AppVideo';

export default AppVideo;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
