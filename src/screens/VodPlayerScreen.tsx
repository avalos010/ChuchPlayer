import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { ResizeMode } from 'expo-av';
import { MaterialCommunityIcons as MCI } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import ExoPlayerVideoView from '../components/player/ExoPlayerVideoView';
import AppVideo from '../components/player/AppVideo';
import FocusableItem from '../components/FocusableItem';
import { RootStackParamList } from '../types';
import type { PlayerVideoHandle, PlayerPlaybackStatus } from '../types/video';
import { Theme } from '../theme/themes';
import { useThemeStore } from '../store/useThemeStore';

const VideoPlayer: typeof AppVideo = Platform.OS === 'android' ? (ExoPlayerVideoView as typeof AppVideo) : AppVideo;

interface VodPlayerScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'VodPlayer'>;
  route: RouteProp<RootStackParamList, 'VodPlayer'>;
}

const formatDuration = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    : `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

interface PlayerButtonProps {
  icon: React.ComponentProps<typeof MCI>['name'];
  label: string;
  onPress: () => void;
  preferred?: boolean;
  theme: Theme;
}

const PlayerButton: React.FC<PlayerButtonProps> = ({ icon, label, onPress, preferred, theme }) => (
  <FocusableItem
    onPress={onPress}
    hasTVPreferredFocus={preferred}
    style={[styles.control, { backgroundColor: theme.card, borderColor: theme.border }]}
    focusedStyle={{ borderColor: theme.accent, borderWidth: 3, transform: [{ scale: 1.05 }] }}
  >
    <MCI name={icon} size={27} color={theme.text} />
    <Text style={[styles.controlLabel, { color: theme.text }]}>{label}</Text>
  </FocusableItem>
);

const VodPlayerScreen: React.FC<VodPlayerScreenProps> = ({ navigation, route }) => {
  const theme = useThemeStore((state) => state.theme);
  const item = route.params.item;
  const videoRef = useRef<PlayerVideoHandle | null>(null);
  const positionRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isBuffering, setIsBuffering] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resizeMode, setResizeMode] = useState(ResizeMode.CONTAIN);

  const updateStatus = useCallback((status: PlayerPlaybackStatus) => {
    if (!status.isLoaded || !('isPlaying' in status)) return;
    const loaded = status;
    if (loaded.positionMillis != null) {
      positionRef.current = loaded.positionMillis;
      setPosition(loaded.positionMillis);
    }
    if (loaded.durationMillis != null && loaded.durationMillis > 0) setDuration(loaded.durationMillis);
    setIsBuffering(loaded.isBuffering ?? false);
    setIsPlaying(loaded.isPlaying);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      videoRef.current?.getStatusAsync().then(updateStatus).catch(() => undefined);
    }, 1000);
    return () => {
      clearInterval(interval);
      void videoRef.current?.unloadAsync();
    };
  }, [updateStatus]);

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      void videoRef.current?.pauseAsync().then(updateStatus);
    } else {
      void videoRef.current?.playAsync().then(updateStatus);
    }
  }, [isPlaying, updateStatus]);

  const seekBy = useCallback((delta: number) => {
    const target = Math.max(0, duration ? Math.min(duration, positionRef.current + delta) : positionRef.current + delta);
    positionRef.current = target;
    setPosition(target);
    void videoRef.current?.seekToAsync(target).then(updateStatus);
  }, [duration, updateStatus]);

  const cycleResizeMode = useCallback(() => {
    setResizeMode((current) => current === ResizeMode.CONTAIN ? ResizeMode.COVER : ResizeMode.CONTAIN);
  }, []);

  const progress = useMemo(() => duration > 0 ? Math.min(1, position / duration) : 0, [duration, position]);

  return (
    <View style={styles.screen}>
      <VideoPlayer
        ref={videoRef}
        source={{ uri: item.url }}
        style={StyleSheet.absoluteFill}
        resizeMode={resizeMode}
        shouldPlay
        onLoad={() => {
          setError(null);
          setIsBuffering(false);
          void videoRef.current?.playAsync().then(updateStatus);
        }}
        onError={(playbackError) => {
          setIsBuffering(false);
          setError(String(playbackError));
        }}
        onPlaybackStatusUpdate={updateStatus}
        progressUpdateIntervalMillis={1000}
        useNativeControls={false}
        isLooping={false}
        volume={1}
        isMuted={false}
        focusable={false}
      />

      <View style={styles.scrim} pointerEvents="none" />
      {isBuffering && !error ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.loadingTitle}>Loading movie…</Text>
          <Text style={styles.loadingHint}>Playback will start automatically</Text>
        </View>
      ) : null}
      <View style={styles.details} pointerEvents="none">
        <Text style={styles.nowPlaying}>NOW PLAYING</Text>
        <Text style={styles.title} numberOfLines={1}>{item.name}</Text>
        {item.plot ? <Text style={styles.plot} numberOfLines={2}>{item.plot}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={styles.bottomPanel}>
        <View style={styles.timelineRow}>
          <Text style={styles.time}>{formatDuration(position)}</Text>
          <View style={styles.timeline}>
            <View style={[styles.timelineProgress, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.time}>{duration ? formatDuration(duration) : '0:00'}</Text>
        </View>
        <View style={styles.controls}>
          <PlayerButton icon="arrow-left" label="Movies" onPress={() => navigation.goBack()} theme={theme} />
          <PlayerButton icon="rewind-30" label="Back 30s" onPress={() => seekBy(-30_000)} theme={theme} />
          <PlayerButton
            icon={isPlaying ? 'pause' : 'play'}
            label={isPlaying ? 'Pause' : 'Play'}
            onPress={togglePlayback}
            preferred
            theme={theme}
          />
          <PlayerButton icon="fast-forward-30" label="Forward 30s" onPress={() => seekBy(30_000)} theme={theme} />
          <PlayerButton icon="aspect-ratio" label={resizeMode === ResizeMode.CONTAIN ? 'Fit' : 'Cover'} onPress={cycleResizeMode} theme={theme} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.08)' },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingBottom: 90 },
  loadingTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 18 },
  loadingHint: { color: '#9ca3af', fontSize: 14, marginTop: 6 },
  details: { position: 'absolute', top: 40, left: 52, right: 52 },
  nowPlaying: { color: '#d1d5db', fontSize: 12, fontWeight: '900', letterSpacing: 1.8 },
  title: { color: '#fff', fontSize: 34, fontWeight: '900', marginTop: 5 },
  plot: { color: '#d1d5db', fontSize: 15, lineHeight: 21, marginTop: 8, maxWidth: 800 },
  error: { color: '#fca5a5', fontSize: 15, fontWeight: '700', marginTop: 10 },
  bottomPanel: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 52, paddingTop: 26, paddingBottom: 38, backgroundColor: 'rgba(0,0,0,0.82)' },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  timeline: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.25)' },
  timelineProgress: { height: '100%', backgroundColor: '#fff' },
  time: { color: '#e5e7eb', fontSize: 13, fontVariant: ['tabular-nums'], minWidth: 62, textAlign: 'center' },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 24 },
  control: { minWidth: 142, height: 70, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 18 },
  controlLabel: { fontSize: 15, fontWeight: '800' },
});

export default VodPlayerScreen;
