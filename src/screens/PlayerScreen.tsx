import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  FlatList,
  Image,
  Keyboard,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import FocusableItem from '../components/FocusableItem';
import { RootStackParamList, EPGProgram, Channel, Playlist } from '../types';
import { getSettings, getPlaylists } from '../utils/storage';
import { showError } from '../utils/toast';
import EPGOverlay from '../components/player/EPGOverlay';
import EPGGridView from '../components/player/EPGGridView';
import ChannelListPanel from '../components/player/ChannelListPanel';
import ChannelNumberPad from '../components/player/ChannelNumberPad';
import VolumeIndicator from '../components/player/VolumeIndicator';
import VideoControls from '../components/player/VideoControls';
import FloatingButtons from '../components/player/FloatingButtons';
import MultiScreenView from '../components/player/MultiScreenView';
import MultiScreenControls from '../components/player/MultiScreenControls';
import { usePlayerStore } from '../store/usePlayerStore';
import { useMultiScreenStore } from '../store/useMultiScreenStore';


interface PlayerScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Player'>;
  route: RouteProp<RootStackParamList, 'Player'>;
}

const PlayerScreen: React.FC<PlayerScreenProps> = ({ navigation, route }) => {
  const { channel: initialChannel } = route.params;
  
  // Use Zustand store for all state and actions (using individual selectors to avoid infinite loops)
  const channel = usePlayerStore((state) => state.channel);
  const channels = usePlayerStore((state) => state.channels);
  const playlist = usePlayerStore((state) => state.playlist);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const loading = usePlayerStore((state) => state.loading);
  const error = usePlayerStore((state) => state.error);
  const resizeMode = usePlayerStore((state) => state.resizeMode);
  const volume = usePlayerStore((state) => state.volume);
  const channelNumberInput = usePlayerStore((state) => state.channelNumberInput);
  const currentProgram = usePlayerStore((state) => state.currentProgram);
  const showControls = usePlayerStore((state) => state.showControls);
  const showFloatingButtons = usePlayerStore((state) => state.showFloatingButtons);
  const showEPG = usePlayerStore((state) => state.showEPG);
  const showEPGGrid = usePlayerStore((state) => state.showEPGGrid);
  const showChannelList = usePlayerStore((state) => state.showChannelList);
  const showChannelNumberPad = usePlayerStore((state) => state.showChannelNumberPad);
  const showVolumeIndicator = usePlayerStore((state) => state.showVolumeIndicator);
  
  // Setters
  const setChannel = usePlayerStore((state) => state.setChannel);
  const setChannels = usePlayerStore((state) => state.setChannels);
  const setPlaylist = usePlayerStore((state) => state.setPlaylist);
  const setIsPlaying = usePlayerStore((state) => state.setIsPlaying);
  const setLoading = usePlayerStore((state) => state.setLoading);
  const setError = usePlayerStore((state) => state.setError);
  const setResizeMode = usePlayerStore((state) => state.setResizeMode);
  const setChannelNumberInput = usePlayerStore((state) => state.setChannelNumberInput);
  const setCurrentProgram = usePlayerStore((state) => state.setCurrentProgram);
  const setShowControls = usePlayerStore((state) => state.setShowControls);
  const setShowFloatingButtons = usePlayerStore((state) => state.setShowFloatingButtons);
  const setShowEPG = usePlayerStore((state) => state.setShowEPG);
  const setShowEPGGrid = usePlayerStore((state) => state.setShowEPGGrid);
  const setShowChannelList = usePlayerStore((state) => state.setShowChannelList);
  const setShowChannelNumberPad = usePlayerStore((state) => state.setShowChannelNumberPad);
  const setVolume = usePlayerStore((state) => state.setVolume);
  const setShowVolumeIndicator = usePlayerStore((state) => state.setShowVolumeIndicator);
  
  // Actions
  const handleVideoReady = usePlayerStore((state) => state.handleVideoReady);
  const handlePlaybackStatusUpdate = usePlayerStore((state) => state.handlePlaybackStatusUpdate);
  const adjustVolumeStore = usePlayerStore((state) => state.adjustVolume);
  const toggleMuteStore = usePlayerStore((state) => state.toggleMute);
  const navigateToChannel = usePlayerStore((state) => state.navigateToChannel);
  const handleChannelNumberInput = usePlayerStore((state) => state.handleChannelNumberInput);
  const enterPIPStore = usePlayerStore((state) => state.enterPIP);
  const exitPIPStore = usePlayerStore((state) => state.exitPIP);

  // Refs that need to stay in component (React refs)
  const videoRef = useRef<Video>(null);
  const pipAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const pipScale = useRef(new Animated.Value(1)).current;
  const channelListSlideAnim = useRef(new Animated.Value(-400)).current;
  const channelListRef = useRef<FlatList>(null);

  // Multi-screen state
  const {
    isMultiScreenMode,
    screens,
    addScreen,
    getFocusedScreen,
    setMaxScreens,
  } = useMultiScreenStore();
  const [showMultiScreenControls, setShowMultiScreenControls] = useState(false);

  // Initialize store with initial channel (only once on mount)
  useEffect(() => {
    if (initialChannel && !channel) {
      console.log('Setting initial channel:', initialChannel.name, initialChannel.url);
      setChannel(initialChannel);
    }
  }, [initialChannel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wrappers for actions that need refs
  const adjustVolume = useCallback((delta: number) => {
    adjustVolumeStore(delta, videoRef);
  }, [adjustVolumeStore]);

  const toggleMute = useCallback(() => {
    toggleMuteStore(videoRef);
  }, [toggleMuteStore]);

  const enterPIP = useCallback(() => {
    enterPIPStore(pipAnim, pipScale);
  }, [enterPIPStore, pipAnim, pipScale]);

  const exitPIP = useCallback(() => {
    exitPIPStore(pipAnim, pipScale);
  }, [exitPIPStore, pipAnim, pipScale]);

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

  // Load playlist that contains the current channel
  useEffect(() => {
    if (!channel) return;
    
    const loadPlaylistData = async () => {
    try {
      const playlists = await getPlaylists();
      const foundPlaylist = playlists.find(p => 
        p.channels.some(c => c.id === channel.id)
      );
      
      if (foundPlaylist) {
        setPlaylist(foundPlaylist);
        setChannels(foundPlaylist.channels);
          
          if (isMultiScreenMode && screens.length === 0) {
            addScreen(channel);
          }
      }
    } catch (error) {
      console.error('Error loading playlist:', error);
    }
    };

    loadPlaylistData();
  }, [channel?.id, isMultiScreenMode, screens.length, addScreen, setPlaylist, setChannels]);


  // Animate channel list slide and scroll to current channel
  useEffect(() => {
    if (showChannelList) {
      Animated.timing(channelListSlideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
      // Scroll to current channel after animation
      setTimeout(() => {
        if (channel) {
        const currentIndex = channels.findIndex(c => c.id === channel.id);
        if (currentIndex >= 0 && channelListRef.current) {
          channelListRef.current.scrollToIndex({
            index: currentIndex,
            animated: true,
            viewPosition: 0.5,
          });
          }
        }
      }, 350);
    } else {
      Animated.timing(channelListSlideAnim, {
        toValue: -420, // Slide out to left (match panel width)
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [showChannelList, channelListSlideAnim, channels, channel?.id]);


  // Reload settings and video when channel changes
  useEffect(() => {
    if (!channel?.url) {
      console.log('No channel URL, skipping video load');
      return;
    }
    
    console.log('Loading channel:', channel.name, channel.url);
    let mounted = true;
    const channelUrl = channel.url;
    const channelId = channel.id;
    
    const loadChannelData = async () => {
      // Load settings
      try {
        const settings = await getSettings();
        if (settings.autoPlay) {
          setIsPlaying(true);
        }
        setMaxScreens(settings.maxMultiScreens);
        
        // Always load current program data
        const program = getCurrentProgram(channelId);
        setCurrentProgram(program);
      } catch (settingsError) {
        console.error('Error loading settings:', settingsError);
        showError('Failed to load playback settings.', String(settingsError));
      }
      
      // Reset video when channel changes
      if (!mounted) return;
      
      setLoading(true);
      setError(null);
      
      if (videoRef.current) {
        // Native or non-HLS: use expo-av
        try {
          console.log('Unloading previous video...');
          await videoRef.current.unloadAsync();
          if (!mounted) return;
          
          console.log('Loading video from URL:', channelUrl);
          await videoRef.current.loadAsync({ uri: channelUrl }, {}, false);
          if (!mounted) return;
          
          console.log('Video loaded successfully in useEffect');
          // Don't auto-play here - let onLoad callback handle it
        } catch (err) {
          console.error('Error loading new channel:', err);
          if (mounted) {
            setError('Failed to load stream. Please check your connection and try again.');
            setLoading(false);
          }
        }
      } else {
        console.log('videoRef is null');
      }
    };
    
    loadChannelData();
    
    return () => {
      mounted = false;
    };
    // Only depend on channel URL to avoid loops
  }, [channel?.url]); // eslint-disable-line react-hooks/exhaustive-deps

  // TVimate-style keyboard/remote shortcuts
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleKeyPress = (e: KeyboardEvent) => {
        // Number keys (0-9) - Channel number input
        if (e.key >= '0' && e.key <= '9') {
          setShowChannelNumberPad(true);
          handleChannelNumberInput(e.key, channels, handleChannelSelect);
          e.preventDefault();
          return;
        }

        // EPG Grid view
        if (showEPGGrid) {
          if (e.key === 'Escape' || e.key === 'Backspace') {
            setShowEPGGrid(false);
            exitPIP();
            e.preventDefault();
          }
          // Arrow keys navigate in EPG grid
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            if (channel) {
              const newChannel = navigateToChannel(e.key === 'ArrowDown' ? 'next' : 'prev', channels, channel.id);
              if (newChannel) {
                setChannel(newChannel);
              }
            }
            e.preventDefault();
          }
          return;
        }

        // Channel List
        if (showChannelList) {
          if (e.key === 'Escape' || e.key === 'ArrowRight') {
            setShowChannelList(false);
            e.preventDefault();
          }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            if (channel) {
              const newChannel = navigateToChannel(e.key === 'ArrowDown' ? 'next' : 'prev', channels, channel.id);
              if (newChannel) {
                setChannel(newChannel);
              }
            }
            e.preventDefault();
          }
          return;
        }

        // Channel Number Pad
        if (showChannelNumberPad) {
          if (e.key === 'Escape' || e.key === 'Backspace') {
            setShowChannelNumberPad(false);
            setChannelNumberInput('');
            e.preventDefault();
          }
          return;
        }
        
        // EPG Overlay
        if (showEPG) {
          if (e.key === 'Escape' || e.key === 'Enter') {
            setShowEPG(false);
            e.preventDefault();
          }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            if (channel) {
              const newChannel = navigateToChannel(e.key === 'ArrowDown' ? 'next' : 'prev', channels, channel.id);
              if (newChannel) {
                setChannel(newChannel);
              }
            }
            e.preventDefault();
          }
          return;
        }

        // Main player shortcuts (TVimate-style)
        switch (e.key) {
          case 'ArrowLeft':
            // Left - Show channel list
            if (channels.length > 0) {
              setShowChannelList(true);
              e.preventDefault();
            }
            break;

          case 'ArrowRight':
            // Right - Show EPG/info for current channel
            setShowEPG(true);
            e.preventDefault();
            break;

          case 'ArrowUp':
            // Up - Previous channel or show channel number pad
            if (e.ctrlKey || e.metaKey) {
              setShowChannelNumberPad(true);
            } else {
                    if (channel) {
                      const newChannel = navigateToChannel('prev', channels, channel.id);
                      if (newChannel) {
                        setChannel(newChannel);
                      }
                    }
            }
            e.preventDefault();
            break;

          case 'ArrowDown':
            // Down - Next channel
                  if (channel) {
                    const newChannel = navigateToChannel('next', channels, channel.id);
                    if (newChannel) {
                      setChannel(newChannel);
                    }
                  }
            e.preventDefault();
            break;

          case 'Enter':
          case ' ':
            // OK/Space - Toggle play/pause
            handleTogglePlayback();
            e.preventDefault();
            break;

          case 'Escape':
          case 'Backspace':
            // Back - Show EPG grid
            if (channels.length > 0) {
              setShowEPGGrid(true);
              enterPIP();
              e.preventDefault();
            }
            break;

          case 'i':
          case 'I':
            // Info key - Show channel info
            setShowEPG(true);
            e.preventDefault();
            break;

          case 'PageUp':
            // Channel up
                  if (channel) {
                    const newChannel = navigateToChannel('prev', channels, channel.id);
                    if (newChannel) {
                      setChannel(newChannel);
                    }
                  }
            e.preventDefault();
            break;

          case 'PageDown':
            // Channel down
                  if (channel) {
                    const newChannel = navigateToChannel('next', channels, channel.id);
                    if (newChannel) {
                      setChannel(newChannel);
                    }
                  }
            e.preventDefault();
            break;

          case '+':
          case '=':
            // Volume up
            adjustVolume(0.1);
            e.preventDefault();
            break;

          case '-':
          case '_':
            // Volume down
            adjustVolume(-0.1);
            e.preventDefault();
            break;

          case 'm':
          case 'M':
            // Mute toggle
            toggleMute();
            e.preventDefault();
            break;
        }
      };

      window.addEventListener('keydown', handleKeyPress);
      return () => window.removeEventListener('keydown', handleKeyPress);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEPG, showControls, showChannelList, showEPGGrid, showChannelNumberPad, channels.length, channelNumberInput]);

    useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // If channel number pad is showing, close it
      if (showChannelNumberPad) {
        setShowChannelNumberPad(false);
        setChannelNumberInput('');
        return true;
      }
      // If EPG grid is showing, close it and restore full video
      if (showEPGGrid) {
        setShowEPGGrid(false);
        // Restore full video
        Animated.parallel([
          Animated.timing(pipAnim, {
            toValue: { x: 0, y: 0 },
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(pipScale, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
        return true;
      }
      // If channel list is showing, close it
      if (showChannelList) {
        setShowChannelList(false);
        return true;
      }
      // If EPG overlay is showing, close it
      if (showEPG) {
        setShowEPG(false);
        return true;
      }
      // Show EPG grid with picture-in-picture video
      if (channels.length > 0) {
        setShowEPGGrid(true);
        enterPIP();
        return true;
      }
      // Otherwise go back
      navigation.goBack();
      return true;
    });

    return () => backHandler.remove();
  }, [navigation, showEPG, showChannelList, showEPGGrid, showChannelNumberPad, channels.length, exitPIP, enterPIP, setShowEPGGrid, setShowChannelList, setShowEPG, setShowChannelNumberPad, setChannelNumberInput]);


  // Enhanced playback status handler with error logging
  const handlePlaybackStatusUpdateWithError = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if (status.error) {
        console.error('Playback error:', status.error);
        const errorDetails = typeof status.error === 'string' 
          ? status.error 
          : (status.error as any)?.message || 'Unknown playback error';
        setError('Stream playback error. Please check your connection.');
        showError('Stream playback error. Please check your connection.', errorDetails);
      }
      return;
    }
    
    // Update loading and playing states
    setLoading(status.isBuffering);
    setIsPlaying(status.isPlaying);
    
    if (status.didJustFinish) {
      setIsPlaying(false);
    }
  }, [setLoading, setIsPlaying, setError]);

  // Enhanced toggle playback with error handling
  const handleTogglePlayback = useCallback(async () => {
    try {
      if (videoRef.current) {
        if (isPlaying) {
          await videoRef.current.pauseAsync();
          setIsPlaying(false);
        } else {
          await videoRef.current.playAsync();
          setIsPlaying(true);
        }
        setShowControls(true);
      }
    } catch (playbackError) {
      console.error('Error toggling playback:', playbackError);
      const errorMsg = playbackError instanceof Error ? playbackError.message : 'Unknown error';
      showError('Failed to control playback.', errorMsg);
    }
  }, [isPlaying, setIsPlaying, setShowControls]);

  // Enhanced screen press handler
  const handleScreenPress = useCallback(() => {
    if (showEPG) {
      return; // Don't handle screen press when EPG is open
    }
    
    if (!showControls) {
      // Show controls and floating buttons when screen is tapped
      setShowControls(true);
      setShowFloatingButtons(true);
      setTimeout(() => {
        setShowControls(false);
        setShowFloatingButtons(false);
      }, 5000);
    } else {
      // Toggle controls when already visible
      setShowControls(false);
      setShowFloatingButtons(true);
      setTimeout(() => setShowFloatingButtons(false), 5000);
    }
  }, [showEPG, showControls, setShowControls, setShowFloatingButtons]);

  const handleCenterPress = useCallback(() => {
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
  }, [showEPG, showControls, setShowEPG, handleTogglePlayback]);

  const handleChannelSelect = useCallback((selectedChannel: Channel) => {
    setChannel(selectedChannel);
    setShowChannelList(false);
    setShowEPG(true); // Show EPG when channel is selected
    // Load EPG for the new channel
    const program = getCurrentProgram(selectedChannel.id);
    setCurrentProgram(program);
  }, [getCurrentProgram, setChannel, setShowChannelList, setShowEPG, setCurrentProgram]);

  // Helper for channel navigation that also updates EPG
  const navigateToChannelWithEPG = useCallback((direction: 'prev' | 'next') => {
    if (!channel) return;
    const newChannel = navigateToChannel(direction, channels, channel.id);
    if (newChannel) {
      setChannel(newChannel);
      const program = getCurrentProgram(newChannel.id);
      setCurrentProgram(program);
      // Briefly show channel info
      setShowEPG(true);
      setTimeout(() => setShowEPG(false), 3000);
    }
  }, [navigateToChannel, channels, channel, getCurrentProgram, setChannel, setCurrentProgram, setShowEPG]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Enhanced video ready handler
  const handleVideoReadyWithPlayback = useCallback(async () => {
    console.log('Video onLoad callback - video is ready');
    handleVideoReady();
    
    // Check if we should auto-play
    try {
      const settings = await getSettings();
      console.log('Auto-play setting:', settings.autoPlay);
      if (settings.autoPlay && videoRef.current) {
        console.log('Auto-playing video from onLoad...');
        await videoRef.current.playAsync();
        setIsPlaying(true);
      }
    } catch (errorPlaying) {
      console.error('Error starting playback:', errorPlaying);
      const errorMsg = errorPlaying instanceof Error ? errorPlaying.message : 'Unknown error';
      showError('Failed to start playback.', errorMsg);
    }
  }, [handleVideoReady, setIsPlaying]);

  const showControlsOnFocus = useCallback(() => {
    if (!showEPG) {
      setShowControls(true);
    }
  }, [showEPG, setShowControls]);

  const handleMultiScreenPress = useCallback(() => {
    setShowMultiScreenControls(true);
  }, []);

  // If in multi-screen mode, show multi-screen view
  if (isMultiScreenMode && screens.length > 0) {
    return (
      <View className="flex-1 bg-black w-full h-full">
        <MultiScreenView
          channels={channels}
          onChannelSelect={handleChannelSelect}
        />
        <MultiScreenControls
          channels={channels}
          onChannelSelect={handleChannelSelect}
          isVisible={showMultiScreenControls}
          onClose={() => setShowMultiScreenControls(false)}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black w-full h-full">
      {/* Floating Buttons */}
      <FloatingButtons
        onBack={handleBack}
        onEPGInfo={() => setShowEPG(true)}
      />

      {!showControls && !showEPG && !error && (
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 120,
            zIndex: 2,
            backgroundColor: 'transparent',
            pointerEvents: 'auto',
          }}
          activeOpacity={1}
          onPress={handleScreenPress}
        >
          <FocusableItem
            onPress={handleCenterPress}
            onFocus={showControlsOnFocus}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 120,
              backgroundColor: 'transparent',
            }}
          >
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 120, backgroundColor: 'transparent' }} />
          </FocusableItem>
        </TouchableOpacity>
      )}

      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
          transform: [
            { translateX: pipAnim.x },
            { translateY: pipAnim.y },
            { scale: pipScale },
          ],
        }}
      >
        {channel && (
          <Video
            ref={videoRef}
            source={{ uri: channel.url }}
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#000',
            }}
            resizeMode={resizeMode}
            shouldPlay={isPlaying}
            onLoad={handleVideoReadyWithPlayback}
            onError={(error) => {
              setLoading(false);
              const errorMsg = 'Failed to load stream. Please check your connection and try again.';
              setError(errorMsg);
              showError('Video load error. Please check your connection and try again.', String(error));
            }}
            onPlaybackStatusUpdate={handlePlaybackStatusUpdateWithError}
            useNativeControls={false}
            isLooping={false}
          />
        )}
      </Animated.View>

      {loading && !error && (
        <View 
          className="absolute inset-0 justify-center items-center bg-black/70 p-6 gap-4"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            zIndex: 3,
          }}
        >
          <ActivityIndicator size="large" color="#00aaff" />
          <Text className="text-white text-lg text-center">Loading stream...</Text>
        </View>
      )}

      {error && (
        <View 
          className="absolute inset-0 justify-center items-center bg-black/70 p-6 gap-4"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            zIndex: 3,
          }}
        >
          <Text className="text-white text-lg text-center">{error}</Text>
          <FocusableItem 
            onPress={handleBack} 
            className="bg-accent px-8 py-4 rounded-lg"
          >
            <Text className="text-white text-base font-bold">Go Back</Text>
          </FocusableItem>
        </View>
      )}

      {/* Video Controls */}
      <VideoControls
        onTogglePlayback={handleCenterPress}
        onBack={handleBack}
        onMultiScreen={handleMultiScreenPress}
      />

      {/* Multi-Screen Controls Modal */}
      <MultiScreenControls
        channels={channels}
        onChannelSelect={handleChannelSelect}
        isVisible={showMultiScreenControls}
        onClose={() => setShowMultiScreenControls(false)}
      />

      {/* EPG Overlay */}
        <EPGOverlay
          onTogglePlayback={handleTogglePlayback}
          onBack={() => navigation.goBack()}
        />

      {/* EPG Grid View */}
        <EPGGridView
          getCurrentProgram={getCurrentProgram}
          onChannelSelect={handleChannelSelect}
        onExitPIP={exitPIP}
        />

      {/* Channel List Panel */}
      <ChannelListPanel
        onChannelSelect={handleChannelSelect}
      />

      

      {/* Volume Indicator */}
      <VolumeIndicator />

      {/* Channel Number Pad */}
      <ChannelNumberPad />


    </View>
  );
};

export default PlayerScreen;
