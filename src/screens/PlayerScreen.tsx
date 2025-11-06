import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  BackHandler,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import KeyEvent from 'react-native-keyevent';
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
import ChannelInfoCard from '../components/player/ChannelInfoCard';
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
  const mainViewRef = useRef<View>(null);

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
  // Channel info card visibility
  const [showChannelInfoCard, setShowChannelInfoCard] = useState(false);
  const previousChannelIdRef = useRef<string | null>(null);

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

  // EPG data - Generate hourly dummy programs for each channel
  const getProgramsForChannel = useCallback((channelId: string): EPGProgram[] => {
    const channelData = channels.find(c => c.id === channelId);
    if (!channelData) return [];

    const now = new Date();
    const channelName = channelData.name || 'Unknown Channel';
    const programs: EPGProgram[] = [];

    // Generate programs for the past 12 hours and next 36 hours (48 hours total)
    for (let i = -12; i < 36; i++) {
      const hourStart = new Date(now);
      hourStart.setHours(now.getHours() + i, 0, 0, 0);
      const hourEnd = new Date(hourStart);
      hourEnd.setHours(hourStart.getHours() + 1);

      // Generate program titles based on channel name patterns and hour
      let programTitle = '';
      const hour = hourStart.getHours();
      
      if (channelName.toLowerCase().includes('news')) {
        const newsTitles = [
          'Morning News', 'Breaking News', 'Noon Update', 'Evening News',
          'Nightly Report', 'Late Night Update', 'Early Morning Brief'
        ];
        programTitle = newsTitles[hour % newsTitles.length];
      } else if (channelName.toLowerCase().includes('sport')) {
        const sportTitles = [
          'Live Match', 'Sports Highlights', 'Game Analysis', 'Live Coverage',
          'Sports Center', 'Match Replay', 'Sports Talk'
        ];
        programTitle = sportTitles[hour % sportTitles.length];
      } else if (channelName.toLowerCase().includes('movie')) {
        const movieTitles = [
          'Movie: Action Film', 'Movie: Drama', 'Movie: Comedy', 'Movie: Thriller',
          'Classic Cinema', 'Movie Night', 'Film Festival'
        ];
        programTitle = movieTitles[hour % movieTitles.length];
      } else {
        const genericTitles = [
          'Live Program', 'Featured Show', 'Entertainment Hour', 'Special Program',
          'Main Event', 'Live Coverage', 'Popular Series'
        ];
        programTitle = genericTitles[hour % genericTitles.length];
      }

      programs.push({
        id: `epg-${channelId}-${i}-${hourStart.getTime()}`,
        channelId,
        title: programTitle,
        description: `${programTitle} on ${channelName}`,
        start: hourStart,
        end: hourEnd,
      });
    }

    return programs;
  }, [channels]);

  // Get current program (for compatibility with existing code)
  const getCurrentProgram = useCallback((channelId: string): EPGProgram | null => {
    const programs = getProgramsForChannel(channelId);
    const now = new Date();
    return programs.find(p => p.start <= now && p.end > now) || programs[0] || null;
  }, [getProgramsForChannel]);

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
        setTimeout(() => {
          showError('Failed to load playback settings.', String(settingsError));
        }, 100);
      }
    };
    
    loadChannelData();
    // Only depend on channel ID to avoid loops
  }, [channel?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show channel info card when channel changes (but not on initial load)
  useEffect(() => {
    if (!channel) return;
    
    // Skip showing on initial load
    if (previousChannelIdRef.current === null) {
      previousChannelIdRef.current = channel.id;
      return;
    }
    
    // Only show if channel actually changed
    if (previousChannelIdRef.current !== channel.id) {
      previousChannelIdRef.current = channel.id;
      setShowChannelInfoCard(true);
    }
  }, [channel?.id]);

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
      setTimeout(() => {
        showError('Failed to control playback.', errorMsg);
      }, 100);
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
    // Show channel info card
    setShowChannelInfoCard(true);
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
          // Arrow keys navigate focus in EPG grid (handled by FocusableItem components)
          // Don't change the playing channel - only change when user presses/selects
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            // Let the EPG grid's FocusableItem components handle navigation
            // Don't prevent default - let the focus system handle it
            e.preventDefault(); // Prevent page scroll
            return;
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
            // Left - Always show channel list (Android TV behavior)
            if (channels.length > 0) {
              // Close EPG grid if showing
              if (showEPGGrid) {
                setShowEPGGrid(false);
                exitPIP();
              }
              // Close EPG overlay if showing
              if (showEPG) {
                setShowEPG(false);
              }
              // Close groups/playlists if showing
              if (showGroupsPlaylists) {
                setShowGroupsPlaylists(false);
              }
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
            // Back key behavior (Android TV):
            // - Close overlays in order (channel number pad, EPG grid, groups/playlists, channel list, EPG overlay)
            // - If nothing is showing, show EPG grid
            if (showChannelNumberPad) {
              setShowChannelNumberPad(false);
              setChannelNumberInput('');
              e.preventDefault();
            } else if (showEPGGrid) {
              setShowEPGGrid(false);
              exitPIP();
              e.preventDefault();
            } else if (showGroupsPlaylists) {
              setShowGroupsPlaylists(false);
              e.preventDefault();
            } else if (showChannelList) {
              setShowChannelList(false);
              e.preventDefault();
            } else if (showEPG) {
              setShowEPG(false);
              e.preventDefault();
            } else if (channels.length > 0) {
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
  }, [showEPG, showControls, showChannelList, showGroupsPlaylists, showEPGGrid, showChannelNumberPad, channels.length, channelNumberInput]);

    // Android TV: Handle DPAD navigation using invisible focusable buttons
    // Since TVEventHandler is not available, we use FocusableItem components
    // positioned off-screen to capture D-pad navigation events
    const handleLeftDpad = useCallback(() => {
      // Don't handle left D-pad when EPG grid is showing - let it scroll
      if (showEPGGrid) {
        return;
      }
      
      console.log('D-pad Left: Opening channel list');
      if (channels.length > 0) {
        // Close EPG overlay if showing
        if (showEPG) {
          setShowEPG(false);
        }
        // Close groups/playlists if showing
        if (showGroupsPlaylists) {
          setShowGroupsPlaylists(false);
        }
        // Show channel list
        setShowChannelList(true);
      }
    }, [showEPGGrid, showEPG, showGroupsPlaylists, channels.length, setShowChannelList, setShowEPG, setShowGroupsPlaylists]);

    const handleUpDpad = useCallback(() => {
      // Only handle when no blocking overlays are showing
      if (showEPGGrid || showEPG || showGroupsPlaylists) {
        return;
      }
      
      console.log('D-pad Up: Navigating to previous channel');
      if (channel && channels.length > 0) {
        const newChannel = navigateToChannel('prev', channels, channel.id);
        if (newChannel) {
          console.log('Switching to channel', newChannel.name);
          setChannel(newChannel);
          const program = getCurrentProgram(newChannel.id);
          setCurrentProgram(program);
          // Show channel info card
          setShowChannelInfoCard(true);
        }
      }
    }, [showEPGGrid, showEPG, showGroupsPlaylists, channel, channels, navigateToChannel, getCurrentProgram, setChannel, setCurrentProgram]);

    const handleDownDpad = useCallback(() => {
      // Only handle when no blocking overlays are showing
      if (showEPGGrid || showEPG || showGroupsPlaylists) {
        return;
      }
      
      console.log('D-pad Down: Navigating to next channel');
      if (channel && channels.length > 0) {
        const newChannel = navigateToChannel('next', channels, channel.id);
        if (newChannel) {
          console.log('Switching to channel', newChannel.name);
          setChannel(newChannel);
          const program = getCurrentProgram(newChannel.id);
          setCurrentProgram(program);
          // Show channel info card
          setShowChannelInfoCard(true);
        }
      }
    }, [showEPGGrid, showEPG, showGroupsPlaylists, channel, channels, navigateToChannel, getCurrentProgram, setChannel, setCurrentProgram]);

    useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // If channel number pad is showing, close it
      if (showChannelNumberPad) {
        setShowChannelNumberPad(false);
        setChannelNumberInput('');
        return true;
      }
      // If EPG grid is showing, close it and restore full video instantly
      if (showEPGGrid) {
        setShowEPGGrid(false);
        exitPIP();
        return true;
      }
      // If groups/playlists menu is showing, close it
      if (showGroupsPlaylists) {
        setShowGroupsPlaylists(false);
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
      // Show EPG grid when back is pressed and nothing is showing (Android TV behavior)
      if (channels.length > 0) {
        setShowEPGGrid(true);
        enterPIP();
        return true;
      }
      // Otherwise, navigate to Settings if we can't go back
      if (navigation.canGoBack()) {
      navigation.goBack();
      } else {
        navigation.navigate('Settings');
      }
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
    // If not playing and buffering, keep loading state (but this should be rare after initial load)
    
    // Log playback status for debugging
    if (Platform.OS === 'android') {
      console.log('Playback status:', {
        isPlaying: status.isPlaying,
        isBuffering: status.isBuffering,
        durationMillis: status.durationMillis,
        positionMillis: status.positionMillis,
      });
    }

    if (status.didJustFinish) {
        setIsPlaying(false);
        setLoading(false);
    }
  }, [setLoading, setIsPlaying, setError, isPlaying]);

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
      // If no channels, navigate to Settings (or go back if possible)
      if (navigation.canGoBack()) {
    navigation.goBack();
      } else {
        navigation.navigate('Settings');
      }
    }
  }, [navigation, showChannelList, showGroupsPlaylists, showEPG, showEPGGrid, channels.length, setShowChannelList, setShowGroupsPlaylists, setShowEPG, setShowEPGGrid, exitPIP]);

  // Enhanced video ready handler
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
            // Don't throw, let the error handler below catch it
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
          }, 1000); // Increased delay to 1 second
          return;
        }
        
        // Only show error for unexpected errors
        const errorMsg = errorMessage || 'Unknown error';
        setTimeout(() => {
        showError('Failed to start playback.', errorMsg);
        }, 100);
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

  // Enter PIP mode when EPG grid is shown - minimize video to top-right corner (TiviMate style)
  useEffect(() => {
    if (showEPGGrid && channels.length > 0) {
      enterPIP();
    } else if (!showEPGGrid) {
      exitPIP();
    }
  }, [showEPGGrid, channels.length, enterPIP, exitPIP]);

  // Retry playback when app comes to foreground (Android audio focus)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: string) => {
      if (Platform.OS === 'android' && nextAppState === 'active') {
        // App came to foreground - retry playback if we should be playing
        if (isPlaying && videoRef.current && channel) {
          getSettings().then(settings => {
            if (settings.autoPlay) {
              console.log('App came to foreground - retrying playback...');
              videoRef.current?.playAsync().catch(err => {
                console.log('Retry playback failed:', err);
              });
            }
          }).catch(err => {
            console.log('Error getting settings for retry:', err);
          });
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isPlaying, channel]);

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

  // Use react-native-keyevent to capture D-pad events on Android TV
  useEffect(() => {
    if (Platform.OS === 'android') {
      console.log('Setting up KeyEvent listener for Android TV...');
      
      try {
        // Check if KeyEvent module is available (requires native build)
        if (typeof KeyEvent === 'undefined' || !KeyEvent) {
          console.log('⚠️ react-native-keyevent not available - needs native rebuild');
          console.log('Run: npx expo run:android');
          return;
        }
        
        // Listen for key events
        const keyDownListener = (keyEvent: any) => {
          console.log('🎮 KeyEvent received:', JSON.stringify(keyEvent));
          
          // Android TV key codes:
          // DPAD_LEFT = 21, DPAD_UP = 19, DPAD_RIGHT = 22, DPAD_DOWN = 20, DPAD_CENTER = 23
          const { keyCode } = keyEvent;
          
          console.log(`🎮 Key code: ${keyCode}`);
          
          if (keyCode === 21) {
            // Left D-pad
            console.log('⬅️ Left D-pad pressed - calling handleLeftDpad');
            handleLeftDpad();
          } else if (keyCode === 19) {
            // Up D-pad
            console.log('⬆️ Up D-pad pressed - calling handleUpDpad');
            handleUpDpad();
          } else if (keyCode === 20) {
            // Down D-pad
            console.log('⬇️ Down D-pad pressed - calling handleDownDpad');
            handleDownDpad();
          }
        };
        
        KeyEvent.onKeyDownListener(keyDownListener);
        console.log('✅ react-native-keyevent listener registered successfully');
        
        return () => {
          console.log('Removing KeyEvent listener');
          KeyEvent.removeKeyDownListener();
        };
      } catch (error) {
        console.log('⚠️ Error setting up KeyEvent:', error);
        console.log('You need a native rebuild for react-native-keyevent to work');
      }
    }
  }, [handleLeftDpad, handleUpDpad, handleDownDpad]);

  return (
    <View 
      ref={mainViewRef}
      className="flex-1 bg-black relative"
    >
      {/* Floating Buttons */}
      <FloatingButtons
        onBack={handleBack}
        onEPGInfo={() => setShowEPG(true)}
      />

      {/* Invisible D-pad navigation zones for Android TV */}
      {!showEPG && !showEPGGrid && !showChannelList && !showGroupsPlaylists && !error && Platform.OS === 'android' && (
        <>
          {/* Central focusable zone - default focus */}
          <FocusableItem
            onPress={() => {
              console.log('Center zone pressed');
              handleCenterPress();
            }}
            hasTVPreferredFocus={true}
            style={{
              position: 'absolute',
              top: '25%',
              left: '25%',
              right: '25%',
              bottom: '25%',
              zIndex: 2,
              backgroundColor: 'transparent',
            }}
            focusedStyle={{
              backgroundColor: 'transparent',
              transform: [],
            }}
          >
            <View style={{ flex: 1, backgroundColor: 'transparent' }} />
          </FocusableItem>

          {/* Left edge - opens channel list */}
          <FocusableItem
            onPress={() => {
              console.log('Left zone pressed - opening channel list');
              handleLeftDpad();
            }}
            onFocus={() => {
              console.log('Left zone focused - opening channel list');
              handleLeftDpad();
            }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 100,
              bottom: 0,
              zIndex: 2,
              backgroundColor: 'transparent',
            }}
            focusedStyle={{
              backgroundColor: 'rgba(0, 170, 255, 0.1)',
              transform: [],
            }}
          >
            <View style={{ flex: 1, backgroundColor: 'transparent' }} />
          </FocusableItem>

          {/* Top edge - previous channel */}
          <FocusableItem
            onPress={() => {
              console.log('Top zone pressed - previous channel');
              handleUpDpad();
            }}
            onFocus={() => {
              console.log('Top zone focused - previous channel');
              handleUpDpad();
            }}
            style={{
              position: 'absolute',
              top: 0,
              left: 100,
              right: 100,
              height: 100,
              zIndex: 2,
              backgroundColor: 'transparent',
            }}
            focusedStyle={{
              backgroundColor: 'rgba(0, 170, 255, 0.1)',
              transform: [],
            }}
          >
            <View style={{ flex: 1, backgroundColor: 'transparent' }} />
          </FocusableItem>

          {/* Bottom edge - next channel */}
          <FocusableItem
            onPress={() => {
              console.log('Bottom zone pressed - next channel');
              handleDownDpad();
            }}
            onFocus={() => {
              console.log('Bottom zone focused - next channel');
              handleDownDpad();
            }}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 100,
              right: 100,
              height: 100,
              zIndex: 2,
              backgroundColor: 'transparent',
            }}
            focusedStyle={{
              backgroundColor: 'rgba(0, 170, 255, 0.1)',
              transform: [],
            }}
          >
            <View style={{ flex: 1, backgroundColor: 'transparent' }} />
          </FocusableItem>
        </>
      )}
      
      {/* Focusable overlay for non-Android platforms */}
      {!showEPG && !showEPGGrid && !showChannelList && !showGroupsPlaylists && !error && Platform.OS !== 'android' && (
        <>
          {/* Main overlay for center button press and keyboard navigation */}
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
            onFocus={() => {
              showControlsOnFocus();
            }}
            className="absolute inset-0 bg-transparent"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 2,
              backgroundColor: 'transparent',
            }}
          >
            <View className="absolute inset-0 bg-transparent" />
          </FocusableItem>
        </>
      )}


      {/* Video Container - Minimized to top-right when EPG grid is shown */}
      {channel && (
      <Animated.View
        style={{
          flex: 1,
          position: 'relative',
          zIndex: showEPGGrid ? 30 : 1,
          elevation: showEPGGrid ? 30 : 1,
          ...(showEPGGrid && {
            borderRadius: 8,
            borderWidth: 2,
            borderColor: '#00aaff',
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.5,
            shadowRadius: 8,
          }),
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
              width: Platform.OS === 'web' ? '-webkit-fill-available' : '100%',
              height: '100%',
              margin: Platform.OS === 'web' ? 'auto' : 0,
              backgroundColor: '#000000',
            } as any}
          resizeMode={resizeMode}
          shouldPlay={isPlaying}
            onLoad={handleVideoReadyWithPlayback}
          onError={(error) => {
            console.error('Video onError callback:', error);
            setLoading(false);
            const errorMsg = 'Failed to load stream. Please check your connection and try again.';
            setError(errorMsg);
            setTimeout(() => {
            showError('Video load error. Please check your connection and try again.', String(error));
            }, 100);
          }}
            onPlaybackStatusUpdate={handlePlaybackStatusUpdateWithError}
          useNativeControls={false}
          isLooping={false}
          volume={1.0}
          isMuted={false}
        />
        </View>
        {/* Channel name overlay when minimized */}
        {showEPGGrid && (
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              paddingHorizontal: 8,
              paddingVertical: 4,
            }}
            pointerEvents="none"
          >
            <Text
              style={{
                color: '#fff',
                fontSize: 12,
                fontWeight: '600',
              }}
              numberOfLines={1}
            >
              {channel.name}
            </Text>
          </View>
        )}
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

      {/* EPG Overlay - Only render when visible and navigation is ready */}
      {showEPG && (
        <EPGOverlay
          onTogglePlayback={handleTogglePlayback}
          onBack={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Settings');
            }
          }}
          navigation={navigation}
        />
      )}

      {/* EPG Grid View - Only render when visible and navigation is ready */}
      {showEPGGrid && navigation && (
        <EPGGridView
          getCurrentProgram={getCurrentProgram}
          getProgramsForChannel={getProgramsForChannel}
          onChannelSelect={handleChannelSelect}
          onExitPIP={exitPIP}
          navigation={navigation}
        />
      )}

      {/* Channel List Panel */}
      <ChannelListPanel
        onChannelSelect={handleChannelSelect}
      />

      {/* Groups & Playlists Panel */}
      <GroupsPlaylistsPanel />

      {/* Volume Indicator */}
      <VolumeIndicator />

      {/* Channel Info Card */}
      {!showEPGGrid && !showEPG && !showChannelList && !showGroupsPlaylists && (
        <ChannelInfoCard
          channel={channel}
          program={currentProgram}
          visible={showChannelInfoCard}
          onHide={() => setShowChannelInfoCard(false)}
        />
      )}

      {/* Channel Number Pad */}
      <ChannelNumberPad />


    </View>
  );
};

export default PlayerScreen;

