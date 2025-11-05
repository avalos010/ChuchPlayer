import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Dimensions,
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
import { getSettings, getPlaylists, saveLastChannel, getLastChannel } from '../utils/storage';
import { showError } from '../utils/toast';
import EPGOverlay from '../components/player/EPGOverlay';
import EPGGridView from '../components/player/EPGGridView';
import ChannelListPanel from '../components/player/ChannelListPanel';
import GroupsPlaylistsPanel from '../components/player/GroupsPlaylistsPanel';
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
  const { channel: initialChannel } = route.params || {};
  
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
  const showGroupsPlaylists = usePlayerStore((state) => state.showGroupsPlaylists);
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
  const setShowGroupsPlaylists = usePlayerStore((state) => state.setShowGroupsPlaylists);
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
  // Track user interaction for autoplay on web
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  // Initialize store with initial channel or last played channel (only once on mount)
  useEffect(() => {
    const initializeChannel = async () => {
      if (channel) return; // Already have a channel
      
      // First try initialChannel from route params
      if (initialChannel) {
        console.log('Setting initial channel from route:', initialChannel.name, initialChannel.url);
        setChannel(initialChannel);
        await saveLastChannel(initialChannel);
        return;
      }
      
      // If no initialChannel, try to restore last played channel
      try {
        const lastChannel = await getLastChannel();
        if (lastChannel) {
          console.log('Restoring last played channel:', lastChannel.name, lastChannel.url);
          setChannel(lastChannel);
          // Auto-play the restored channel (will be handled by the channel change effect)
          setIsPlaying(true);
          
          // Also load the playlist that contains this channel
          try {
            const playlists = await getPlaylists();
            const foundPlaylist = playlists.find(p => 
              p.channels.some(c => c.id === lastChannel.id)
            );
            if (foundPlaylist) {
              setPlaylist(foundPlaylist);
              setChannels(foundPlaylist.channels);
            }
          } catch (playlistError) {
            console.error('Error loading playlist for last channel:', playlistError);
          }
        } else {
          console.log('No last channel found, showing EPG grid');
          // Load all playlists and show EPG grid
          try {
            const playlists = await getPlaylists();
            if (playlists.length > 0) {
              // Use the first playlist and show all its channels in EPG
              const firstPlaylist = playlists[0];
              setPlaylist(firstPlaylist);
              setChannels(firstPlaylist.channels);
              // Show EPG grid
              setShowEPGGrid(true);
              // Enter PIP mode - use the store function directly
              enterPIPStore(pipAnim, pipScale);
            }
          } catch (playlistError) {
            console.error('Error loading playlists:', playlistError);
          }
        }
      } catch (error) {
        console.error('Error restoring last channel:', error);
      }
    };
    
    initializeChannel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialChannel]);

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

  // EPG data - uses channel info to generate better program data
  const getCurrentProgram = useCallback((channelId: string): EPGProgram | null => {
    const channelData = channels.find(c => c.id === channelId);
    if (!channelData) return null;

    const now = new Date();
    // Generate program based on channel name or tvgId
    const channelName = channelData.name || 'Unknown Channel';
    const tvgId = channelData.tvgId || '';
    
    // Try to create a more realistic program title based on channel name
    let programTitle = 'Live Program';
    if (tvgId) {
      // Use channel name as program title if we have tvgId
      programTitle = `${channelName} - Live`;
    } else {
      // Generate program titles based on channel name patterns
      if (channelName.toLowerCase().includes('news')) {
        programTitle = 'News Update';
      } else if (channelName.toLowerCase().includes('sport')) {
        programTitle = 'Sports Coverage';
      } else if (channelName.toLowerCase().includes('movie')) {
        programTitle = 'Movie Presentation';
      } else {
        programTitle = `${channelName} - Live Stream`;
      }
    }

    // Program started 30 minutes ago and ends in 1.5 hours (typical show length)
    const start = new Date(now.getTime() - 30 * 60 * 1000);
    const end = new Date(now.getTime() + 90 * 60 * 1000);
    
    return {
      id: `epg-${channelId}-${Date.now()}`,
      channelId,
      title: programTitle,
      description: `Currently airing on ${channelName}. EPG data will be available when integrated with an EPG service.`,
      start,
      end,
    };
  }, [channels]);

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


  // Save last channel and reload settings and EPG when channel changes
  useEffect(() => {
    if (!channel?.url) {
      console.log('No channel URL, skipping channel data load');
      return;
    }
    
    console.log('Loading channel data:', channel.name, channel.url);
    const channelId = channel.id;
    
    const loadChannelData = async () => {
      // Save as last played channel
      try {
        await saveLastChannel(channel);
      } catch (error) {
        console.warn('Error saving last channel:', error);
      }
      
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
    };
    
    loadChannelData();
    // Only depend on channel ID to avoid loops
  }, [channel?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Enhanced toggle playback with error handling
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
      showError('Failed to control playback.', errorMsg);
    }
  }, [isPlaying, setIsPlaying, channel, setShowEPG, hasUserInteracted]);

  const handleChannelSelect = useCallback(async (selectedChannel: Channel) => {
    console.log('Channel selected:', selectedChannel.name, selectedChannel.url);
    console.log('Current channel before switch:', channel?.name, channel?.url);
    
    // Mark user interaction for autoplay on web
    if (Platform.OS === 'web' && !hasUserInteracted) {
      setHasUserInteracted(true);
    }
    
    // Don't switch if it's the same channel
    if (channel?.id === selectedChannel.id) {
      console.log('Same channel selected, skipping switch');
      setShowChannelList(false);
      return;
    }
    
    // Stop current video before switching
    if (videoRef.current) {
      try {
        console.log('Stopping current video before channel switch...');
        await videoRef.current.pauseAsync();
        await videoRef.current.unloadAsync();
        // Small delay to ensure cleanup
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (err) {
        console.warn('Error stopping current video:', err);
      }
    }
    
    // Reset loading state when switching channels
    setLoading(true);
    setError(null);
    setIsPlaying(false);
    
    // Update channel - this will trigger Video component remount due to key prop
    console.log('Setting new channel:', selectedChannel.name);
    setChannel(selectedChannel);
    setShowChannelList(false);
    
    // Close EPG grid and restore full video when channel is selected
    if (showEPGGrid) {
      setShowEPGGrid(false);
      exitPIP();
    }
    
    // Load EPG for the new channel
    const program = getCurrentProgram(selectedChannel.id);
    setCurrentProgram(program);
  }, [getCurrentProgram, setChannel, setShowChannelList, setCurrentProgram, setLoading, setError, setIsPlaying, channel, showEPGGrid, setShowEPGGrid, exitPIP, hasUserInteracted]);

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
            // Left - Show channel list or groups/playlists menu
            if (showEPG) {
              // If EPG overlay is showing, close it and show channel list
              setShowEPG(false);
            if (channels.length > 0) {
              setShowChannelList(true);
              }
            } else if (showEPGGrid) {
              // If EPG grid is showing, close it and show channel list
              setShowEPGGrid(false);
              exitPIP();
              if (channels.length > 0) {
                setShowChannelList(true);
              }
            } else if (showChannelList) {
              // If channel list is already showing, show groups/playlists menu
              setShowGroupsPlaylists(true);
            } else if (showGroupsPlaylists) {
              // If groups/playlists is showing, close it
              setShowGroupsPlaylists(false);
            } else if (channels.length > 0) {
              // Show channel list
              setShowChannelList(true);
            }
            e.preventDefault();
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
            // OK/Middle button - Show EPG overlay (channel logo and options)
            if (showEPG) {
              setShowEPG(false);
            } else if (channel) {
              setShowEPG(true);
            }
            e.preventDefault();
            break;
            
          case ' ':
            // Space - Toggle play/pause
            handleTogglePlayback();
            e.preventDefault();
            break;

          case 'Escape':
          case 'Backspace':
            // Back key behavior:
            // - If EPG overlay is showing, close it
            // - If EPG grid is showing, close it
            // - Otherwise, show EPG grid
            if (showEPG) {
              setShowEPG(false);
              e.preventDefault();
            } else if (showEPGGrid) {
              setShowEPGGrid(false);
              exitPIP();
              e.preventDefault();
            } else if (channels.length > 0) {
              setShowEPGGrid(true);
              // Enter PIP immediately without animation delay
              if (Platform.OS === 'web') {
              const { width, height } = Dimensions.get('window');
                pipAnim.setValue({ x: -width * 0.35, y: -height * 0.35 });
                pipScale.setValue(0.3);
              } else {
                enterPIP();
              }
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
  }, [showEPG, showControls, showChannelList, showGroupsPlaylists, showEPGGrid, showChannelNumberPad, channels.length, channelNumberInput]);

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
      // If groups/playlists menu is showing, close it and show channel list
      if (showGroupsPlaylists) {
        setShowGroupsPlaylists(false);
        if (channels.length > 0) {
          setShowChannelList(true);
        }
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
      // Show EPG grid with picture-in-picture video (without animation delay)
      if (channels.length > 0) {
        setShowEPGGrid(true);
        // Enter PIP immediately without animation delay
        if (Platform.OS === 'web') {
        const { width, height } = Dimensions.get('window');
          pipAnim.setValue({ x: -width * 0.35, y: -height * 0.35 });
          pipScale.setValue(0.3);
        } else {
          enterPIP();
        }
        return true;
      }
      // Otherwise go back
      navigation.goBack();
      return true;
    });

    return () => backHandler.remove();
  }, [navigation, showEPG, showChannelList, showGroupsPlaylists, showEPGGrid, showChannelNumberPad, channels.length, exitPIP, enterPIP, setShowEPGGrid, setShowChannelList, setShowGroupsPlaylists, setShowEPG, setShowChannelNumberPad, setChannelNumberInput]);


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

  // Enhanced screen press handler - shows EPG overlay (channel logo and options)
  const handleScreenPress = useCallback(() => {
    // If EPG overlay is showing, close it
    if (showEPG) {
      setShowEPG(false);
      return;
    }
    
    // If EPG grid is showing, close it first
    if (showEPGGrid) {
      setShowEPGGrid(false);
      exitPIP();
      return;
    }
    
    // If groups/playlists menu is showing, close it first
    if (showGroupsPlaylists) {
      setShowGroupsPlaylists(false);
      return;
    }
    
    // If channel list is showing, close it first
    if (showChannelList) {
      setShowChannelList(false);
      return;
    }
    
    // Show EPG overlay (channel logo and options menu)
    if (channel) {
      setShowEPG(true);
    }
  }, [showEPG, showEPGGrid, showGroupsPlaylists, showChannelList, channel, setShowEPG, setShowEPGGrid, setShowGroupsPlaylists, setShowChannelList, exitPIP]);

  const handleCenterPress = useCallback(() => {
    // If EPG overlay is showing, close it
    if (showEPG) {
      setShowEPG(false);
      return;
    }
    
    // If EPG grid is showing, close it first
    if (showEPGGrid) {
      setShowEPGGrid(false);
      exitPIP();
      return;
    }
    
    // If groups/playlists menu is showing, close it first
    if (showGroupsPlaylists) {
      setShowGroupsPlaylists(false);
      return;
    }
    
    // If channel list is showing, close it first
    if (showChannelList) {
    setShowChannelList(false);
      return;
    }
    
    // Show EPG overlay (channel logo and options menu)
    if (channel) {
      setShowEPG(true);
    }
  }, [showEPG, showEPGGrid, showGroupsPlaylists, showChannelList, channel, setShowEPG, setShowEPGGrid, setShowGroupsPlaylists, setShowChannelList, exitPIP]);

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
    // If groups/playlists menu is showing, close it and show channel list
    if (showGroupsPlaylists) {
      setShowGroupsPlaylists(false);
      if (channels.length > 0) {
        setShowChannelList(true);
      }
      return;
    }
    // If channel list is already showing, close it
    if (showChannelList) {
      setShowChannelList(false);
      return;
    }
    // If EPG overlay is showing, close it and show channel list
    if (showEPG) {
      setShowEPG(false);
      if (channels.length > 0) {
        setShowChannelList(true);
      }
      return;
    }
    // If EPG grid is showing, close it and show channel list
    if (showEPGGrid) {
      setShowEPGGrid(false);
      exitPIP();
      if (channels.length > 0) {
        setShowChannelList(true);
      }
      return;
    }
    // Otherwise, show channel list
    if (channels.length > 0) {
      setShowChannelList(true);
    } else {
      // If no channels, go back
    navigation.goBack();
    }
  }, [navigation, showChannelList, showGroupsPlaylists, showEPG, showEPGGrid, channels.length, setShowChannelList, setShowGroupsPlaylists, setShowEPG, setShowEPGGrid, exitPIP]);

  // Enhanced video ready handler
  const handleVideoReadyWithPlayback = useCallback(async () => {
    console.log('Video onLoad callback - video is ready for channel:', channel?.name);
    handleVideoReady();
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
          await videoRef.current.playAsync();
          setIsPlaying(true);
        } else {
          // Still pause to ensure clean state
          await videoRef.current.pauseAsync();
          setIsPlaying(false);
        }
      }
      } catch (errorPlaying) {
        console.error('Error starting playback:', errorPlaying);
        // On web, don't show error for NotAllowedError (autoplay blocked)
        if (Platform.OS === 'web' && errorPlaying instanceof Error && errorPlaying.name === 'NotAllowedError') {
          console.log('Autoplay blocked by browser - user interaction required');
          setIsPlaying(false);
          setLoading(false);
          return;
        }
        const errorMsg = errorPlaying instanceof Error ? errorPlaying.message : 'Unknown error';
        showError('Failed to start playback.', errorMsg);
      setLoading(false);
    }
  }, [handleVideoReady, setIsPlaying, setLoading, channel?.name, hasUserInteracted]);

  const showControlsOnFocus = useCallback(() => {
    if (!showEPG && channel) {
      setShowEPG(true);
    }
  }, [showEPG, channel, setShowEPG]);

  // Ref to store the auto-hide timer
  const epgAutoHideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Function to reset the EPG auto-hide timer
  const resetEPGAutoHideTimer = useCallback(() => {
    if (!showEPG) return;
    
    // Clear existing timer
    if (epgAutoHideTimerRef.current) {
      clearTimeout(epgAutoHideTimerRef.current);
    }
    
    // Set new timer
    epgAutoHideTimerRef.current = setTimeout(() => {
      setShowEPG(false);
      epgAutoHideTimerRef.current = null;
    }, 5000);
  }, [showEPG, setShowEPG]);

  // Auto-hide EPG overlay after 5 seconds of inactivity
  useEffect(() => {
    if (!showEPG) {
      // Clear timer if EPG is hidden
      if (epgAutoHideTimerRef.current) {
        clearTimeout(epgAutoHideTimerRef.current);
        epgAutoHideTimerRef.current = null;
      }
      return;
    }
    
    // Start/reset timer when EPG is shown
    resetEPGAutoHideTimer();
    
    return () => {
      if (epgAutoHideTimerRef.current) {
        clearTimeout(epgAutoHideTimerRef.current);
        epgAutoHideTimerRef.current = null;
      }
    };
  }, [showEPG, resetEPGAutoHideTimer]);

  const handleMultiScreenPress = useCallback(() => {
    setShowMultiScreenControls(true);
  }, []);

  // If in multi-screen mode, show multi-screen view
  if (isMultiScreenMode && screens.length > 0) {
    const { width, height } = Dimensions.get('window');
    return (
      <View 
        className="flex-1 bg-black w-full h-full absolute inset-0"
        style={Platform.OS === 'web' ? {
          width,
          height,
          minHeight: height,
        } as any : undefined}
      >
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

  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  return (
    <View 
      className="flex-1 bg-black relative"
    >
      {/* Floating Buttons */}
      <FloatingButtons
        onBack={handleBack}
        onEPGInfo={() => setShowEPG(true)}
      />

      {!showEPG && !showEPGGrid && !showChannelList && !showGroupsPlaylists && !error && (
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 2,
            backgroundColor: 'transparent',
            pointerEvents: 'auto',
          }}
          activeOpacity={1}
          onPress={() => {
            // Mark user interaction for autoplay on web
            if (Platform.OS === 'web' && !hasUserInteracted) {
              setHasUserInteracted(true);
              // Try to play if autoplay is enabled
              if (isPlaying && videoRef.current) {
                videoRef.current.playAsync().catch(err => {
                  console.log('Play failed:', err);
                });
              }
            }
            handleScreenPress();
          }}
        >
          <FocusableItem
            onPress={() => {
              // Mark user interaction for autoplay on web
              if (Platform.OS === 'web' && !hasUserInteracted) {
                setHasUserInteracted(true);
                // Try to play if autoplay is enabled
                if (isPlaying && videoRef.current) {
                  videoRef.current.playAsync().catch(err => {
                    console.log('Play failed:', err);
                  });
                }
              }
              handleCenterPress();
            }}
            onFocus={showControlsOnFocus}
            className="absolute inset-0 bg-transparent"
          >
            <View className="absolute inset-0 bg-transparent" />
          </FocusableItem>
        </TouchableOpacity>
      )}

      {/* Video Container - Must be visible */}
      {channel && (
      <Animated.View
        style={{
          flex: 1,
          position: 'relative',
            transform: [
              { translateX: pipAnim.x },
              { translateY: pipAnim.y },
              { scale: pipScale },
            ],
        }}
      >
        <View style={{ flex: 1, position: 'relative' }}>
        <Video
            key={`video-${channel.id}-${channel.url}`}
          ref={videoRef}
          source={{ uri: channel.url }}
            style={{
              flex: 1,
              width: '-webkit-fill-available',
              height: '100%',
              margin: 'auto',
              backgroundColor: '#000000',
            } as any}
          resizeMode={resizeMode}
            shouldPlay={Platform.OS === 'web' ? false : isPlaying}
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
        </View>
      </Animated.View>
      )}

      {loading && !error && (
        <View className="absolute inset-0 justify-center items-center bg-black/70 p-6 gap-4 z-[3]">
          <ActivityIndicator size="large" color="#00aaff" />
          <Text className="text-white text-lg text-center">Loading stream...</Text>
        </View>
      )}

      {error && (
        <View className="absolute inset-0 justify-center items-center bg-black/70 p-6 gap-4 z-[3]">
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
        onTogglePlayback={handleTogglePlayback}
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

      {/* Groups & Playlists Panel */}
      <GroupsPlaylistsPanel />

      {/* Volume Indicator */}
      <VolumeIndicator />

      {/* Channel Number Pad */}
      <ChannelNumberPad />


    </View>
  );
};

export default PlayerScreen;
