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
  // Only subscribe to state that drives re-renders needed by callers
  const channel = usePlayerStore((state) => state.channel);

  // EPG state
  const setCurrentProgram = useEPGStore((state) => state.setCurrentProgram);
  const isSwitchingChannelRef = useRef(false);
  const channelSwitchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChannelSelect = useCallback(async (selectedChannel: Channel) => {
    const { channel: currentChannel, setChannel, setLoading, setError, setIsPlaying } = usePlayerStore.getState();
    const { showEPGGrid, setShowChannelList, setShowEPGGrid } = useUIStore.getState();

    if (!hasUserInteracted) setHasUserInteracted(true);

    if (currentChannel?.id === selectedChannel.id) {
      setShowChannelList(false);
      setShowChannelInfoCard?.(true);
      return;
    }

    if (videoRef.current) {
      try {
        await videoRef.current.pauseAsync();
        await videoRef.current.unloadAsync();
      } catch {
        // ignore cleanup errors
      }
    }

    setLoading(true);
    setError(null);
    setIsPlaying(false);

    setChannel(selectedChannel);
    setShowChannelList(false);
    setShowChannelInfoCard?.(true);

    if (showEPGGrid) setShowEPGGrid(false);

    const program = getCurrentProgram(selectedChannel.id);
    setCurrentProgram(program);
  }, [
    hasUserInteracted,
    setHasUserInteracted,
    videoRef,
    getCurrentProgram,
    setCurrentProgram,
    setShowChannelInfoCard,
  ]);

  const switchChannel = useCallback(async (
    newChannel: Channel,
    exitPIP?: () => void
  ) => {
    if (isSwitchingChannelRef.current) return;

    if (channelSwitchTimeoutRef.current) {
      clearTimeout(channelSwitchTimeoutRef.current);
      channelSwitchTimeoutRef.current = null;
    }

    isSwitchingChannelRef.current = true;

    try {
      if (videoRef.current) {
        try {
          await videoRef.current.pauseAsync();
          await videoRef.current.unloadAsync();
        } catch {
          // ignore cleanup errors
        }
      }

      const { setChannel, setLoading, setError, setIsPlaying } = usePlayerStore.getState();
      setLoading(true);
      setError(null);
      setIsPlaying(false);

      exitPIP?.();

      setChannel(newChannel);
      const program = getCurrentProgram(newChannel.id);
      setCurrentProgram(program);
      setShowChannelInfoCard?.(true);

      isSwitchingChannelRef.current = false;
      if (channelSwitchTimeoutRef.current) {
        clearTimeout(channelSwitchTimeoutRef.current);
        channelSwitchTimeoutRef.current = null;
      }

      if (centerZoneRef?.current) {
        centerZoneRef.current?.focus?.();
      }
    } catch {
      isSwitchingChannelRef.current = false;
      if (channelSwitchTimeoutRef.current) {
        clearTimeout(channelSwitchTimeoutRef.current);
        channelSwitchTimeoutRef.current = null;
      }
      usePlayerStore.getState().setError('Failed to switch channel. Please try again.');
    }
  }, [videoRef, getCurrentProgram, setCurrentProgram, centerZoneRef, setShowChannelInfoCard]);

  const handleUpDpad = useCallback(async (exitPIP?: () => void) => {
    const { showEPGGrid, showEPG, showGroupsPlaylists } = useUIStore.getState();
    if (showEPGGrid || showEPG || showGroupsPlaylists) return;
    if (isSwitchingChannelRef.current) return;

    const { channel: currentChannel, channels: currentChannels, navigateToChannel } = usePlayerStore.getState();
    if (currentChannel && currentChannels.length > 0) {
      const newChannel = navigateToChannel('prev', currentChannels, currentChannel.id);
      if (newChannel && newChannel.id !== currentChannel.id) {
        await switchChannel(newChannel, exitPIP);
      }
    }
  }, [switchChannel]);

  const handleDownDpad = useCallback(async (exitPIP?: () => void) => {
    const { showEPGGrid, showEPG, showGroupsPlaylists } = useUIStore.getState();
    if (showEPGGrid || showEPG || showGroupsPlaylists) return;
    if (isSwitchingChannelRef.current) return;

    const { channel: currentChannel, channels: currentChannels, navigateToChannel } = usePlayerStore.getState();
    if (currentChannel && currentChannels.length > 0) {
      const newChannel = navigateToChannel('next', currentChannels, currentChannel.id);
      if (newChannel && newChannel.id !== currentChannel.id) {
        await switchChannel(newChannel, exitPIP);
      }
    }
  }, [switchChannel]);

  return {
    handleChannelSelect,
    handleUpDpad,
    handleDownDpad,
    switchChannel,
    isSwitchingChannelRef,
    channelSwitchTimeoutRef,
  };
};

