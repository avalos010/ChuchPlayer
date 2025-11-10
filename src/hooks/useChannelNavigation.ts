import { useCallback, useRef } from 'react';
import { Video } from 'expo-av';
import { Channel, EPGProgram } from '../types';
import { usePlayerStore } from '../store/usePlayerStore';
import { useUIStore } from '../store/useUIStore';
import { useEPGStore } from '../store/useEPGStore';
import { saveLastChannel } from '../utils/storage';
import { showError } from '../utils/toast';

interface UseChannelNavigationProps {
  videoRef: React.RefObject<Video | null>;
  getCurrentProgram: (channelId: string) => EPGProgram | null;
  setHasUserInteracted: (value: boolean) => void;
  hasUserInteracted: boolean;
  centerZoneRef?: React.RefObject<any>;
  setShowChannelInfoCard?: (visible: boolean) => void;
}

export const useChannelNavigation = ({
  videoRef,
  getCurrentProgram,
  setHasUserInteracted,
  hasUserInteracted,
  centerZoneRef,
  setShowChannelInfoCard,
}: UseChannelNavigationProps) => {
  const channel = usePlayerStore((state) => state.channel);
  const channels = usePlayerStore((state) => state.channels);
  const setChannel = usePlayerStore((state) => state.setChannel);
  const setChannels = usePlayerStore((state) => state.setChannels);
  const setPlaylist = usePlayerStore((state) => state.setPlaylist);
  const setLoading = usePlayerStore((state) => state.setLoading);
  const setError = usePlayerStore((state) => state.setError);
  const setIsPlaying = usePlayerStore((state) => state.setIsPlaying);
  const navigateToChannel = usePlayerStore((state) => state.navigateToChannel);
  
  // UI state
  const showEPGGrid = useUIStore((state) => state.showEPGGrid);
  const showEPG = useUIStore((state) => state.showEPG);
  const showGroupsPlaylists = useUIStore((state) => state.showGroupsPlaylists);
  const setShowChannelList = useUIStore((state) => state.setShowChannelList);
  const setShowEPGGrid = useUIStore((state) => state.setShowEPGGrid);
  
  // EPG state
  const setCurrentProgram = useEPGStore((state) => state.setCurrentProgram);
  const isSwitchingChannelRef = useRef(false);
  const channelSwitchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleChannelSelect = useCallback(async (selectedChannel: Channel) => {
    console.log('Channel selected:', selectedChannel.name, selectedChannel.url);
    console.log('Current channel before switch:', channel?.name, channel?.url);

    // Mark user interaction for autoplay on web
    if (!hasUserInteracted) {
      setHasUserInteracted(true);
    }

    // Don't switch if it's the same channel
    if (channel?.id === selectedChannel.id) {
      console.log('Same channel selected, skipping switch');
      setShowChannelList(false);
      setShowChannelInfoCard?.(true);
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
    setShowChannelInfoCard?.(true);

    // Close EPG grid and restore full video when channel is selected
    if (showEPGGrid) {
      setShowEPGGrid(false);
    }

    // Load EPG for the new channel
    const program = getCurrentProgram(selectedChannel.id);
    setCurrentProgram(program);
  }, [
    channel,
    hasUserInteracted,
    setHasUserInteracted,
    videoRef,
    showEPGGrid,
    getCurrentProgram,
    setChannel,
    setShowChannelList,
    setCurrentProgram,
    setLoading,
    setError,
    setIsPlaying,
    setShowEPGGrid,
    setShowChannelInfoCard,
  ]);

  const switchChannel = useCallback(async (
    newChannel: Channel,
    exitPIP?: () => void
  ) => {
    if (isSwitchingChannelRef.current) {
      console.log('Channel switch already in progress, ignoring');
      return;
    }

    // Clear any pending channel switch
    if (channelSwitchTimeoutRef.current) {
      clearTimeout(channelSwitchTimeoutRef.current);
      channelSwitchTimeoutRef.current = null;
    }

    isSwitchingChannelRef.current = true;

    try {
      // Stop current video before switching
      if (videoRef.current) {
        try {
          console.log('Stopping current video before channel switch...');
          await videoRef.current.pauseAsync();
          await videoRef.current.unloadAsync();
          // Reduced delay to allow faster channel switching
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err) {
          console.warn('Error stopping current video:', err);
          // Minimal delay even on error
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      // Reset loading state when switching channels
      setLoading(true);
      setError(null);
      setIsPlaying(false);

      // Exit PIP if provided (before setting new channel to avoid conflicts)
      if (exitPIP) {
        exitPIP();
      }

      console.log('Switching to channel', newChannel.name);
      setChannel(newChannel);
      const program = getCurrentProgram(newChannel.id);
      setCurrentProgram(program);
      setShowChannelInfoCard?.(true);

      // Reset flag immediately after channel is set to allow rapid switching
      // The video will continue loading in the background
      isSwitchingChannelRef.current = false;
      if (channelSwitchTimeoutRef.current) {
        clearTimeout(channelSwitchTimeoutRef.current);
        channelSwitchTimeoutRef.current = null;
      }

      // Return focus to center zone after switching (for Android TV)
      if (centerZoneRef?.current) {
        setTimeout(() => {
          centerZoneRef.current?.focus?.();
        }, 100);
      }
    } catch (error) {
      console.error('Error switching channel:', error);
      isSwitchingChannelRef.current = false;
      if (channelSwitchTimeoutRef.current) {
        clearTimeout(channelSwitchTimeoutRef.current);
        channelSwitchTimeoutRef.current = null;
      }
      setError('Failed to switch channel. Please try again.');
    }
  }, [videoRef, getCurrentProgram, setChannel, setCurrentProgram, setLoading, setError, setIsPlaying, centerZoneRef, setShowChannelInfoCard]);

  const handleUpDpad = useCallback(async (exitPIP?: () => void) => {
    // Get latest state from store to avoid stale closures
    const currentState = usePlayerStore.getState();
    const currentChannel = currentState.channel;
    const currentChannels = currentState.channels;
    const currentNavigateToChannel = currentState.navigateToChannel;
    
    console.log('🔵 handleUpDpad called', { 
      showEPGGrid, 
      showEPG, 
      showGroupsPlaylists, 
      isSwitching: isSwitchingChannelRef.current,
      currentChannelId: currentChannel?.id 
    });

    // Only handle when no blocking overlays are showing
    if (showEPGGrid || showEPG || showGroupsPlaylists) {
      console.log('🔵 Blocked by overlay');
      return;
    }

    // Prevent rapid channel switching
    if (isSwitchingChannelRef.current) {
      console.log('🔵 Channel switch already in progress, ignoring');
      return;
    }

    console.log('🔵 D-pad Up: Navigating to previous channel');
    if (currentChannel && currentChannels.length > 0) {
      const newChannel = currentNavigateToChannel('prev', currentChannels, currentChannel.id);
      console.log('🔵 New channel:', newChannel?.name, 'Current:', currentChannel?.name);
      if (newChannel && newChannel.id !== currentChannel.id) {
        await switchChannel(newChannel, exitPIP);
      } else {
        console.log('🔵 Same channel or no channel found');
      }
    }
  }, [showEPGGrid, showEPG, showGroupsPlaylists, switchChannel]);

  const handleDownDpad = useCallback(async (exitPIP?: () => void) => {
    // Get latest state from store to avoid stale closures
    const currentState = usePlayerStore.getState();
    const currentChannel = currentState.channel;
    const currentChannels = currentState.channels;
    const currentNavigateToChannel = currentState.navigateToChannel;
    
    console.log('🔴 handleDownDpad called', { 
      showEPGGrid, 
      showEPG, 
      showGroupsPlaylists, 
      isSwitching: isSwitchingChannelRef.current,
      currentChannelId: currentChannel?.id 
    });

    // Only handle when no blocking overlays are showing
    if (showEPGGrid || showEPG || showGroupsPlaylists) {
      console.log('🔴 Blocked by overlay');
      return;
    }

    // Prevent rapid channel switching
    if (isSwitchingChannelRef.current) {
      console.log('🔴 Channel switch already in progress, ignoring');
      return;
    }

    console.log('🔴 D-pad Down: Navigating to next channel');
    if (currentChannel && currentChannels.length > 0) {
      const newChannel = currentNavigateToChannel('next', currentChannels, currentChannel.id);
      console.log('🔴 New channel:', newChannel?.name, 'Current:', currentChannel?.name);
      if (newChannel && newChannel.id !== currentChannel.id) {
        await switchChannel(newChannel, exitPIP);
      } else {
        console.log('🔴 Same channel or no channel found');
      }
    }
  }, [showEPGGrid, showEPG, showGroupsPlaylists, switchChannel]);

  return {
    handleChannelSelect,
    handleUpDpad,
    handleDownDpad,
    switchChannel,
    isSwitchingChannelRef,
    channelSwitchTimeoutRef,
  };
};

