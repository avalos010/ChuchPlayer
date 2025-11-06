import { useEffect, useCallback } from 'react';
import { Platform, BackHandler } from 'react-native';
import KeyEvent from 'react-native-keyevent';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { usePlayerStore } from '../store/usePlayerStore';
import { useUIStore } from '../store/useUIStore';
import { useChannelNavigation } from './useChannelNavigation';
import { useVideoPlayback } from './useVideoPlayback';

interface UseKeyboardNavigationProps {
  videoRef: React.RefObject<any>;
  navigation: NativeStackNavigationProp<RootStackParamList, 'Player'>;
  handleChannelSelect: (channel: any) => void;
  handleUpDpad: (exitPIP?: () => void) => void;
  handleDownDpad: (exitPIP?: () => void) => void;
  handleLeftDpad: () => void;
  handleCenterPress: () => void;
  handleBack: () => void;
  enterPIP: () => void;
  exitPIP: () => void;
  setHasUserInteracted: (value: boolean) => void;
  centerZoneRef: React.RefObject<any>;
}

export const useKeyboardNavigation = ({
  videoRef,
  navigation,
  handleChannelSelect,
  handleUpDpad,
  handleDownDpad,
  handleLeftDpad,
  handleCenterPress,
  handleBack,
  enterPIP,
  exitPIP,
  setHasUserInteracted,
  centerZoneRef,
}: UseKeyboardNavigationProps) => {
  const channels = usePlayerStore((state) => state.channels);
  const channel = usePlayerStore((state) => state.channel);
  const channelNumberInput = usePlayerStore((state) => state.channelNumberInput);
  const setChannel = usePlayerStore((state) => state.setChannel);
  const setChannelNumberInput = usePlayerStore((state) => state.setChannelNumberInput);
  const navigateToChannel = usePlayerStore((state) => state.navigateToChannel);
  const handleChannelNumberInput = usePlayerStore((state) => state.handleChannelNumberInput);
  const adjustVolume = usePlayerStore((state) => state.adjustVolume);
  const toggleMute = usePlayerStore((state) => state.toggleMute);
  
  // UI state
  const showEPG = useUIStore((state) => state.showEPG);
  const showEPGGrid = useUIStore((state) => state.showEPGGrid);
  const showChannelList = useUIStore((state) => state.showChannelList);
  const showGroupsPlaylists = useUIStore((state) => state.showGroupsPlaylists);
  const showChannelNumberPad = useUIStore((state) => state.showChannelNumberPad);
  const setShowEPG = useUIStore((state) => state.setShowEPG);
  const setShowEPGGrid = useUIStore((state) => state.setShowEPGGrid);
  const setShowChannelList = useUIStore((state) => state.setShowChannelList);
  const setShowGroupsPlaylists = useUIStore((state) => state.setShowGroupsPlaylists);
  const setShowChannelNumberPad = useUIStore((state) => state.setShowChannelNumberPad);
  const { handleTogglePlayback } = useVideoPlayback(videoRef);

  // Web keyboard navigation
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
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
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
              console.log('🌐 Web: ArrowUp pressed - calling handleUpDpad');
              handleUpDpad(exitPIP);
            }
            e.preventDefault();
            break;

          case 'ArrowDown':
            // Down - Next channel
            console.log('🌐 Web: ArrowDown pressed - calling handleDownDpad');
            handleDownDpad(exitPIP);
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
            adjustVolume(0.1, videoRef);
            e.preventDefault();
            break;

          case '-':
          case '_':
            // Volume down
            adjustVolume(-0.1, videoRef);
            e.preventDefault();
            break;

          case 'm':
          case 'M':
            // Mute toggle
            toggleMute(videoRef);
            e.preventDefault();
            break;
        }
      };

      window.addEventListener('keydown', handleKeyPress);
      return () => window.removeEventListener('keydown', handleKeyPress);
    }
    return undefined;
  }, [
    showEPG,
    showChannelList,
    showGroupsPlaylists,
    showEPGGrid,
    showChannelNumberPad,
    channels.length,
    channelNumberInput,
    handleUpDpad,
    handleDownDpad,
    handleChannelSelect,
    handleChannelNumberInput,
    navigateToChannel,
    channel,
    setChannel,
    setShowChannelList,
    setShowEPG,
    setShowEPGGrid,
    setShowChannelNumberPad,
    setChannelNumberInput,
    exitPIP,
    showGroupsPlaylists,
    setShowGroupsPlaylists,
    handleTogglePlayback,
    adjustVolume,
    toggleMute,
    videoRef,
    enterPIP,
  ]);

  // Android TV: Handle DPAD navigation using KeyEvent
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
            handleUpDpad(exitPIP);
          } else if (keyCode === 20) {
            // Down D-pad
            console.log('⬇️ Down D-pad pressed - calling handleDownDpad');
            handleDownDpad(exitPIP);
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
  }, [handleLeftDpad, handleUpDpad, handleDownDpad, exitPIP]);

  // Android back button handler
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
  }, [
    navigation,
    showEPG,
    showChannelList,
    showGroupsPlaylists,
    showEPGGrid,
    showChannelNumberPad,
    channels.length,
    exitPIP,
    enterPIP,
    setShowEPGGrid,
    setShowChannelList,
    setShowGroupsPlaylists,
    setShowEPG,
    setShowChannelNumberPad,
    setChannelNumberInput,
  ]);
};

