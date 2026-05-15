import { useEffect, useRef } from 'react';
import { Platform, BackHandler } from 'react-native';
import KeyEvent from 'react-native-keyevent';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { usePlayerStore } from '../store/usePlayerStore';
import { useUIStore } from '../store/useUIStore';
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
  const { handleTogglePlayback } = useVideoPlayback(videoRef);

  // Keep latest callbacks in a ref so listeners registered once always call fresh logic
  const handlersRef = useRef({
    handleUpDpad,
    handleDownDpad,
    handleLeftDpad,
    handleCenterPress,
    handleBack,
    enterPIP,
    exitPIP,
    handleChannelSelect,
    handleTogglePlayback,
  });
  handlersRef.current = {
    handleUpDpad,
    handleDownDpad,
    handleLeftDpad,
    handleCenterPress,
    handleBack,
    enterPIP,
    exitPIP,
    handleChannelSelect,
    handleTogglePlayback,
  };

  // Web keyboard navigation — reads fresh state via getState() so the listener
  // only needs to be registered once (empty dep array).
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;

    const handleKeyPress = (e: KeyboardEvent) => {
      const ui = useUIStore.getState();
      const player = usePlayerStore.getState();
      const h = handlersRef.current;

      const {
        showEPGGrid, showChannelList, showChannelNumberPad, showEPG, showGroupsPlaylists,
        setShowEPGGrid, setShowChannelList, setShowChannelNumberPad, setShowEPG, setShowGroupsPlaylists,
      } = ui;
      const {
        channels, channel, navigateToChannel, setChannel,
        handleChannelNumberInput, adjustVolume, toggleMute, setChannelNumberInput,
      } = player;

      // Number keys (0-9) - Channel number input
      if (e.key >= '0' && e.key <= '9') {
        setShowChannelNumberPad(true);
        handleChannelNumberInput(e.key, channels, h.handleChannelSelect);
        e.preventDefault();
        return;
      }

      if (showEPGGrid) {
        if (e.key === 'Escape' || e.key === 'Backspace') {
          setShowEPGGrid(false);
          h.exitPIP();
          e.preventDefault();
        }
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          return;
        }
        return;
      }

      if (showChannelList) {
        if (e.key === 'Escape' || e.key === 'ArrowRight') {
          setShowChannelList(false);
          e.preventDefault();
        }
        if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && channel) {
          const newChannel = navigateToChannel(e.key === 'ArrowDown' ? 'next' : 'prev', channels, channel.id);
          if (newChannel) setChannel(newChannel);
          e.preventDefault();
        }
        return;
      }

      if (showChannelNumberPad) {
        if (e.key === 'Escape' || e.key === 'Backspace') {
          setShowChannelNumberPad(false);
          setChannelNumberInput('');
          e.preventDefault();
        }
        return;
      }

      if (showEPG) {
        if (e.key === 'Escape' || e.key === 'Enter') {
          setShowEPG(false);
          e.preventDefault();
        }
        if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && channel) {
          const newChannel = navigateToChannel(e.key === 'ArrowDown' ? 'next' : 'prev', channels, channel.id);
          if (newChannel) setChannel(newChannel);
          e.preventDefault();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          if (channels.length > 0) {
            if (showEPGGrid) { setShowEPGGrid(false); h.exitPIP(); }
            if (showEPG) setShowEPG(false);
            if (showGroupsPlaylists) setShowGroupsPlaylists(false);
            setShowChannelList(true);
          }
          e.preventDefault();
          break;
        case 'ArrowRight':
          setShowEPG(true);
          e.preventDefault();
          break;
        case 'ArrowUp':
          if (e.ctrlKey || e.metaKey) { setShowChannelNumberPad(true); }
          else { h.handleUpDpad(h.exitPIP); }
          e.preventDefault();
          break;
        case 'ArrowDown':
          h.handleDownDpad(h.exitPIP);
          e.preventDefault();
          break;
        case 'Enter':
          if (showEPG) setShowEPG(false);
          else if (channel) setShowEPG(true);
          e.preventDefault();
          break;
        case ' ':
          h.handleTogglePlayback();
          e.preventDefault();
          break;
        case 'Escape':
        case 'Backspace':
          if (showChannelNumberPad) { setShowChannelNumberPad(false); setChannelNumberInput(''); e.preventDefault(); }
          else if (showEPGGrid) { setShowEPGGrid(false); h.exitPIP(); e.preventDefault(); }
          else if (showGroupsPlaylists) { setShowGroupsPlaylists(false); e.preventDefault(); }
          else if (showChannelList) { setShowChannelList(false); e.preventDefault(); }
          else if (showEPG) { setShowEPG(false); e.preventDefault(); }
          else if (channels.length > 0) { setShowEPGGrid(true); h.enterPIP(); e.preventDefault(); }
          break;
        case 'i':
        case 'I':
          setShowEPG(true);
          e.preventDefault();
          break;
        case 'PageUp':
          if (channel) {
            const newChannel = navigateToChannel('prev', channels, channel.id);
            if (newChannel) setChannel(newChannel);
          }
          e.preventDefault();
          break;
        case 'PageDown':
          if (channel) {
            const newChannel = navigateToChannel('next', channels, channel.id);
            if (newChannel) setChannel(newChannel);
          }
          e.preventDefault();
          break;
        case '+':
        case '=':
          adjustVolume(0.1, videoRef);
          e.preventDefault();
          break;
        case '-':
        case '_':
          adjustVolume(-0.1, videoRef);
          e.preventDefault();
          break;
        case 'm':
        case 'M':
          toggleMute(videoRef);
          e.preventDefault();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRef]); // stable — reads state via getState() on each keypress

  // Android TV: DPAD via KeyEvent — registered once, reads latest handlers via ref
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;

    try {
      if (typeof KeyEvent === 'undefined' || !KeyEvent) return undefined;

      const keyDownListener = (keyEvent: any) => {
        const { keyCode } = keyEvent;
        const h = handlersRef.current;
        // DPAD_LEFT=21, DPAD_UP=19, DPAD_DOWN=20
        if (keyCode === 21) h.handleLeftDpad();
        else if (keyCode === 19) h.handleUpDpad(h.exitPIP);
        else if (keyCode === 20) h.handleDownDpad(h.exitPIP);
      };

      KeyEvent.onKeyDownListener(keyDownListener);
      return () => KeyEvent.removeKeyDownListener();
    } catch {
      return undefined;
    }
  }, []); // registered exactly once — no re-registration on overlay state changes

  // Android back button — reads current state via getState() to avoid stale closures
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      const ui = useUIStore.getState();
      const player = usePlayerStore.getState();
      const h = handlersRef.current;

      if (ui.showChannelNumberPad) {
        ui.setShowChannelNumberPad(false);
        player.setChannelNumberInput('');
        return true;
      }
      if (ui.showEPGGrid) {
        ui.setShowEPGGrid(false);
        h.exitPIP();
        return true;
      }
      if (ui.showGroupsPlaylists) {
        ui.setShowGroupsPlaylists(false);
        return true;
      }
      if (ui.showChannelList) {
        ui.setShowChannelList(false);
        return true;
      }
      if (ui.showEPG) {
        ui.setShowEPG(false);
        return true;
      }
      if (player.channels.length > 0) {
        ui.setShowEPGGrid(true);
        h.enterPIP();
        return true;
      }
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.navigate('Settings');
      return true;
    });

    return () => backHandler.remove();
  }, [navigation]); // only re-register when navigation instance changes
};

