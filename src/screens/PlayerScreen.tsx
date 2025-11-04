import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import FocusableItem from '../components/FocusableItem';
import { RootStackParamList } from '../types';
import { getSettings } from '../utils/storage';
import { showError } from '../utils/toast';

interface PlayerScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Player'>;
  route: RouteProp<RootStackParamList, 'Player'>;
}

const PlayerScreen: React.FC<PlayerScreenProps> = ({ navigation, route }) => {
  const { channel } = route.params;
  const videoRef = useRef<Video>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [controlsTimeout, setControlsTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const settings = await getSettings();
      if (settings.autoPlay) {
        setIsPlaying(true);
      }
    } catch (settingsError) {
      console.error('Error loading settings:', settingsError);
      showError('Failed to load playback settings.', String(settingsError));
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.goBack();
      return true;
    });

    return () => backHandler.remove();
  }, [navigation]);

  useEffect(() => {
    if (showControls && isPlaying) {
      const timeout = setTimeout(() => setShowControls(false), 5000);
      setControlsTimeout(timeout);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [showControls, isPlaying]);

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if (status.error) {
        console.error('Playback error:', status.error);
        const errorMsg = status.error.message || 'Failed to load stream. Please try again later.';
        setError(errorMsg);
        setLoading(false);
        showError('Stream playback error. Please check your connection.', status.error.message);
      }
      return;
    }

    setLoading(status.isBuffering);
  };

  const handleTogglePlayback = async () => {
    try {
      if (isPlaying) {
        await videoRef.current?.pauseAsync();
        setIsPlaying(false);
      } else {
        await videoRef.current?.playAsync();
        setIsPlaying(true);
      }
      setShowControls(true);
    } catch (playbackError) {
      console.error('Error toggling playback:', playbackError);
      const errorMsg = playbackError instanceof Error ? playbackError.message : 'Unknown error';
      showError('Failed to control playback.', errorMsg);
    }
  };

  const handleToggleControls = () => {
    setShowControls(prev => !prev);
    if (controlsTimeout) {
      clearTimeout(controlsTimeout);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleVideoReady = async () => {
    setLoading(false);
    if (isPlaying) {
      try {
        await videoRef.current?.playAsync();
      } catch (errorPlaying) {
        console.error('Error starting playback:', errorPlaying);
        const errorMsg = errorPlaying instanceof Error ? errorPlaying.message : 'Unknown error';
        showError('Failed to start playback.', errorMsg);
      }
    }
  };

  const showControlsOnFocus = () => {
    setShowControls(true);
    if (controlsTimeout) {
      clearTimeout(controlsTimeout);
    }
  };

  return (
    <View style={styles.container}>
      {!showControls && !error && (
        <FocusableItem
          onPress={showControlsOnFocus}
          onFocus={showControlsOnFocus}
          style={styles.invisibleFocusArea}
        >
          <View style={styles.invisibleFocusArea} />
        </FocusableItem>
      )}

      <Video
        ref={videoRef}
        source={{ uri: channel.url }}
        style={styles.video}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay={isPlaying}
        onLoad={handleVideoReady}
        onError={(error) => {
          setLoading(false);
          const errorMsg = 'Failed to load stream. Please check your connection and try again.';
          setError(errorMsg);
          showError('Video load error. Please check your connection and try again.', String(error));
        }}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        useNativeControls={false}
      />

      {loading && !error && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#00aaff" />
          <Text style={styles.overlayText}>Loading stream...</Text>
        </View>
      )}

      {error && (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>{error}</Text>
          <FocusableItem onPress={handleBack} style={styles.errorButton}>
            <Text style={styles.errorButtonText}>Go Back</Text>
          </FocusableItem>
        </View>
      )}

      {showControls && !error && (
        <TouchableOpacity style={styles.controlsOverlay} activeOpacity={1} onPress={handleToggleControls}>
          <View style={styles.topBar}>
            <FocusableItem onPress={handleBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Back</Text>
            </FocusableItem>
            <View style={styles.channelInfo}>
              <Text style={styles.channelName}>{channel.name}</Text>
              {channel.group ? <Text style={styles.channelGroup}>{channel.group}</Text> : null}
            </View>
          </View>

          <View style={styles.centerControls}>
            <FocusableItem onPress={handleTogglePlayback} style={styles.playPauseButton}>
              <Text style={styles.playPauseText}>{isPlaying ? '❚❚' : '▶'}</Text>
            </FocusableItem>
          </View>

          <View style={styles.bottomBar}>
            <Text style={styles.streamInfo}>{loading ? 'Buffering...' : 'Live Stream'}</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  invisibleFocusArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: 'transparent',
    zIndex: 2,
  },
  video: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 24,
    zIndex: 3,
    gap: 16,
  },
  overlayText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
  },
  errorButton: {
    backgroundColor: '#00aaff',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
  },
  errorButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingBottom: 24,
    zIndex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    gap: 16,
  },
  backButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  channelInfo: {
    flex: 1,
  },
  channelName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  channelGroup: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 4,
  },
  centerControls: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playPauseButton: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(0, 170, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playPauseText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  streamInfo: {
    color: '#fff',
    fontSize: 14,
  },
});

export default PlayerScreen;
