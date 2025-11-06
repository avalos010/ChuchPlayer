import { useCallback } from 'react';
import { Platform } from 'react-native';
import { usePlayerStore } from '../store/usePlayerStore';
import { useUIStore } from '../store/useUIStore';

export const usePlayerHandlers = (
  setHasUserInteracted: (value: boolean) => void,
  hasUserInteracted: boolean,
  videoRef: React.RefObject<any>
) => {
  const channel = usePlayerStore((state) => state.channel);
  const channels = usePlayerStore((state) => state.channels);
  
  // UI state
  const showEPG = useUIStore((state) => state.showEPG);
  const showEPGGrid = useUIStore((state) => state.showEPGGrid);
  const showGroupsPlaylists = useUIStore((state) => state.showGroupsPlaylists);
  const showChannelList = useUIStore((state) => state.showChannelList);
  const setShowEPG = useUIStore((state) => state.setShowEPG);
  const setShowEPGGrid = useUIStore((state) => state.setShowEPGGrid);
  const setShowGroupsPlaylists = useUIStore((state) => state.setShowGroupsPlaylists);
  const setShowChannelList = useUIStore((state) => state.setShowChannelList);

  const handleScreenPress = useCallback(() => {
    // Mark user interaction for autoplay on web
    if (Platform.OS === 'web' && !hasUserInteracted) {
      setHasUserInteracted(true);
      // Try to play if autoplay is enabled
      // This will be handled by the video playback hook
    }

    // If EPG overlay is showing, close it
    if (showEPG) {
      setShowEPG(false);
      return;
    }

    // If EPG grid is showing, close it first
    if (showEPGGrid) {
      setShowEPGGrid(false);
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
  }, [
    showEPG,
    showEPGGrid,
    showGroupsPlaylists,
    showChannelList,
    channel,
    setShowEPG,
    setShowEPGGrid,
    setShowGroupsPlaylists,
    setShowChannelList,
    hasUserInteracted,
    setHasUserInteracted,
  ]);

  const handleCenterPress = useCallback(() => {
    // If EPG overlay is showing, close it
    if (showEPG) {
      setShowEPG(false);
      return;
    }

    // If EPG grid is showing, close it first
    if (showEPGGrid) {
      setShowEPGGrid(false);
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
  }, [
    showEPG,
    showEPGGrid,
    showGroupsPlaylists,
    showChannelList,
    channel,
    setShowEPG,
    setShowEPGGrid,
    setShowGroupsPlaylists,
    setShowChannelList,
  ]);

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
      if (channels.length > 0) {
        setShowChannelList(true);
      }
      return;
    }
    // Otherwise, show channel list
    if (channels.length > 0) {
      setShowChannelList(true);
    }
  }, [
    showChannelList,
    showGroupsPlaylists,
    showEPG,
    showEPGGrid,
    channels.length,
    setShowChannelList,
    setShowGroupsPlaylists,
    setShowEPG,
    setShowEPGGrid,
  ]);

  const showControlsOnFocus = useCallback(() => {
    if (!showEPG && channel) {
      setShowEPG(true);
    }
  }, [showEPG, channel, setShowEPG]);

  return {
    handleScreenPress,
    handleCenterPress,
    handleLeftDpad,
    handleBack,
    showControlsOnFocus,
  };
};

