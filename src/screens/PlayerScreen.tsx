import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import FocusableItem from '../components/FocusableItem';
import { RootStackParamList, EPGProgram } from '../types';
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
  const [showEPG, setShowEPG] = useState(false);
  const [currentProgram, setCurrentProgram] = useState<EPGProgram | null>(null);

  // Mock EPG data - in production, this would come from an EPG API
  const getCurrentProgram = useCallback((channelId: string): EPGProgram | null => {
    // Mock current program - replace with real EPG fetch
    const now = new Date();
    const start = new Date(now.getTime() - 30 * 60 * 1000); // Started 30 min ago
    const end = new Date(now.getTime() + 30 * 60 * 1000); // Ends in 30 min
    
    return {
      id: `epg-${channelId}-${Date.now()}`,
      channelId,
      title: 'Live Program',
      description: 'Currently airing program. EPG data will be available when integrated with an EPG service.',
      start,
      end,
    };
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const settings = await getSettings();
      if (settings.autoPlay) {
        setIsPlaying(true);
      }
      // Always load current program data (EPG availability depends on service)
      const program = getCurrentProgram(channel.id);
      setCurrentProgram(program);
    } catch (settingsError) {
      console.error('Error loading settings:', settingsError);
      showError('Failed to load playback settings.', String(settingsError));
    }
  }, [channel.id, getCurrentProgram]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // If EPG is showing, close it instead of going back
      if (showEPG) {
        setShowEPG(false);
        return true;
      }
      navigation.goBack();
      return true;
    });

    return () => backHandler.remove();
  }, [navigation, showEPG]);

  useEffect(() => {
    if (showControls && isPlaying && !showEPG) {
      const timeout = setTimeout(() => setShowControls(false), 5000);
      setControlsTimeout(timeout);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [showControls, isPlaying, showEPG]);

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if (status.error) {
        console.error('Playback error:', status.error);
        const errorMsg = typeof status.error === 'string' 
          ? status.error 
          : (status.error as any)?.message || 'Failed to load stream. Please try again later.';
        setError(errorMsg);
        setLoading(false);
        const errorDetails = typeof status.error === 'string' 
          ? status.error 
          : (status.error as any)?.message || 'Unknown playback error';
        showError('Stream playback error. Please check your connection.', errorDetails);
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

  const handleCenterPress = () => {
    // When EPG is showing, center press closes it
    if (showEPG) {
      setShowEPG(false);
      return;
    }
    // When controls are hidden, show EPG overlay
    if (!showControls) {
      setShowEPG(true);
      return;
    }
    // Otherwise toggle playback
    handleTogglePlayback();
  };

  const handleCloseEPG = () => {
    setShowEPG(false);
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
    if (!showEPG) {
      setShowControls(true);
      if (controlsTimeout) {
        clearTimeout(controlsTimeout);
      }
    }
  };



  return (
    <View style={styles.container}>
      {/* Always visible back button for touch devices */}
      {!error && (
        <TouchableOpacity
          style={styles.floatingBackButton}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <Text style={styles.floatingBackButtonText}>←</Text>
        </TouchableOpacity>
      )}

      {!showControls && !showEPG && !error && (
        <FocusableItem
          onPress={handleCenterPress}
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
        resizeMode={ResizeMode.COVER}
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
        isLooping={false}
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

      {showControls && !showEPG && !error && (
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
            <FocusableItem onPress={handleCenterPress} style={styles.playPauseButton}>
              <Text style={styles.playPauseText}>{isPlaying ? '❚❚' : '▶'}</Text>
            </FocusableItem>
          </View>

          <View style={styles.bottomBar}>
            <Text style={styles.streamInfo}>{loading ? 'Buffering...' : 'Live Stream'}</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* EPG Overlay */}
      {showEPG && !error && (
        <View style={styles.epgOverlay}>
          <View style={styles.epgContainer}>
            {/* Channel Info Section */}
            <View style={styles.epgHeader}>
              {channel.logo ? (
                <Image source={{ uri: channel.logo }} style={styles.epgLogo} resizeMode="contain" />
              ) : (
                <View style={[styles.epgLogo, styles.epgLogoPlaceholder]}>
                  <Text style={styles.epgLogoPlaceholderText}>
                    {channel.name.substring(0, 2).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.epgChannelInfo}>
                <Text style={styles.epgChannelName}>{channel.name}</Text>
                {channel.group && (
                  <Text style={styles.epgChannelGroup}>{channel.group}</Text>
                )}
                {currentProgram && (
                  <View style={styles.epgTimeInfo}>
                    <Text style={styles.epgTimeText}>Now</Text>
                    <Text style={styles.epgTimeSeparator}>•</Text>
                    <Text style={styles.epgTimeText}>
                      {currentProgram.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {currentProgram.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                )}
              </View>
              <FocusableItem onPress={handleCloseEPG} style={styles.epgCloseButton}>
                <Text style={styles.epgCloseButtonText}>✕</Text>
              </FocusableItem>
            </View>

            <ScrollView style={styles.epgContent} showsVerticalScrollIndicator={false}>
              {/* Current Program Section */}
              {currentProgram ? (
                <View style={styles.epgProgramSection}>
                  <Text style={styles.epgProgramTitle}>{currentProgram.title}</Text>
                  {currentProgram.description && (
                    <Text style={styles.epgProgramDescription}>{currentProgram.description}</Text>
                  )}
                </View>
              ) : (
                <View style={styles.epgProgramSection}>
                  <Text style={styles.epgProgramTitle}>No EPG Data Available</Text>
                  <Text style={styles.epgProgramDescription}>
                    Electronic Program Guide data is not available for this channel.
                  </Text>
                </View>
              )}

              {/* Options Section */}
              <View style={styles.epgOptionsSection}>
                <Text style={styles.epgSectionTitle}>Options</Text>
                
                <FocusableItem
                  onPress={() => {
                    handleTogglePlayback();
                    setShowEPG(false);
                  }}
                  style={styles.epgOptionItem}
                >
                  <Text style={styles.epgOptionIcon}>{isPlaying ? '❚❚' : '▶'}</Text>
                  <Text style={styles.epgOptionText}>{isPlaying ? 'Pause' : 'Play'}</Text>
                </FocusableItem>

                <FocusableItem
                  onPress={() => {
                    navigation.goBack();
                  }}
                  style={styles.epgOptionItem}
                >
                  <Text style={styles.epgOptionIcon}>←</Text>
                  <Text style={styles.epgOptionText}>Back to Channels</Text>
                </FocusableItem>

                <FocusableItem
                  onPress={() => {
                    handleCloseEPG();
                    setShowControls(true);
                  }}
                  style={styles.epgOptionItem}
                >
                  <Text style={styles.epgOptionIcon}>⚙️</Text>
                  <Text style={styles.epgOptionText}>Player Settings</Text>
                </FocusableItem>
              </View>
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    width: '100%',
    height: '100%',
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
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
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
  floatingBackButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    elevation: 10, // For Android
  },
  floatingBackButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  epgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    zIndex: 5,
    elevation: 5,
  },
  epgContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    margin: 40,
    borderRadius: 12,
    overflow: 'hidden',
  },
  epgHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#2a2a2a',
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a3a',
    gap: 16,
  },
  epgLogo: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#3a3a3a',
  },
  epgLogoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  epgLogoPlaceholderText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  epgChannelInfo: {
    flex: 1,
    gap: 4,
  },
  epgChannelName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  epgChannelGroup: {
    color: '#aaa',
    fontSize: 14,
  },
  epgTimeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  epgTimeText: {
    color: '#00aaff',
    fontSize: 14,
    fontWeight: '600',
  },
  epgTimeSeparator: {
    color: '#666',
    fontSize: 14,
  },
  epgCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3a3a3a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  epgCloseButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  epgContent: {
    flex: 1,
    padding: 20,
  },
  epgProgramSection: {
    marginBottom: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a3a',
  },
  epgProgramTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  epgProgramDescription: {
    color: '#ccc',
    fontSize: 16,
    lineHeight: 24,
  },
  epgOptionsSection: {
    gap: 12,
  },
  epgSectionTitle: {
    color: '#00aaff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  epgOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 8,
    gap: 16,
  },
  epgOptionIcon: {
    fontSize: 24,
    width: 32,
    textAlign: 'center',
  },
  epgOptionText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default PlayerScreen;
