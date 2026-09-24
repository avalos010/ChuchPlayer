import { useCallback } from 'react';
import { Channel, EPGProgram } from '../types';
import { usePlayerStore } from '../store/usePlayerStore';
import { useUIStore } from '../store/useUIStore';
import { useEPGStore } from '../store/useEPGStore';

interface UseChannelNavigationProps {
  getCurrentProgram: (channelId: string) => EPGProgram | null;
  setHasUserInteracted: (value: boolean) => void;
  hasUserInteracted: boolean;
  centerZoneRef?: React.RefObject<any>;
  setShowChannelInfoCard?: (visible: boolean) => void;
}

export const useChannelNavigation = ({
  getCurrentProgram,
  setHasUserInteracted,
  hasUserInteracted,
  centerZoneRef,
  setShowChannelInfoCard,
}: UseChannelNavigationProps) => {
  // EPG state
  const setCurrentProgram = useEPGStore((state) => state.setCurrentProgram);

  const handleChannelSelect = useCallback((selectedChannel: Channel) => {
    const { channel: currentChannel } = usePlayerStore.getState();
    const { showEPGGrid, setShowChannelList, setShowEPGGrid } = useUIStore.getState();

    if (!hasUserInteracted) setHasUserInteracted(true);

    if (currentChannel?.id === selectedChannel.id) {
      setShowChannelList(false);
      setShowChannelInfoCard?.(true);
      return;
    }

    usePlayerStore.setState({
      loading: true, error: null, isPlaying: false,
      previousChannel: currentChannel && currentChannel.id !== selectedChannel.id ? currentChannel : usePlayerStore.getState().previousChannel,
      channel: selectedChannel,
    });
    setShowChannelList(false);
    setShowChannelInfoCard?.(true);

    if (showEPGGrid) setShowEPGGrid(false);

    const program = getCurrentProgram(selectedChannel.id);
    setCurrentProgram(program);
  }, [
    hasUserInteracted,
    setHasUserInteracted,
    getCurrentProgram,
    setCurrentProgram,
    setShowChannelInfoCard,
  ]);

  const switchChannel = useCallback((
    newChannel: Channel,
    exitPIP?: () => void
  ) => {
    const prevChannel = usePlayerStore.getState().channel;
    if (prevChannel?.id === newChannel.id) return;

    exitPIP?.();

    usePlayerStore.setState({
      loading: true, error: null, isPlaying: false,
      previousChannel: prevChannel ?? usePlayerStore.getState().previousChannel,
      channel: newChannel,
    });
    const program = getCurrentProgram(newChannel.id);
    setCurrentProgram(program);
    setShowChannelInfoCard?.(true);
    centerZoneRef?.current?.focus?.();
  }, [getCurrentProgram, setCurrentProgram, centerZoneRef, setShowChannelInfoCard]);

  const handleUpDpad = useCallback((exitPIP?: () => void) => {
    const { showEPGGrid, showEPG, showGroupsPlaylists } = useUIStore.getState();
    if (showEPGGrid || showEPG || showGroupsPlaylists) return;
    const { channel: currentChannel, channels: currentChannels, navigateToChannel } = usePlayerStore.getState();
    if (currentChannel && currentChannels.length > 0) {
      const newChannel = navigateToChannel('prev', currentChannels, currentChannel.id)
        ?? currentChannels[currentChannels.length - 1];
      if (newChannel && newChannel.id !== currentChannel.id) {
        switchChannel(newChannel, exitPIP);
      }
    }
  }, [switchChannel]);

  const handleDownDpad = useCallback((exitPIP?: () => void) => {
    const { showEPGGrid, showEPG, showGroupsPlaylists } = useUIStore.getState();
    if (showEPGGrid || showEPG || showGroupsPlaylists) return;
    const { channel: currentChannel, channels: currentChannels, navigateToChannel } = usePlayerStore.getState();
    if (currentChannel && currentChannels.length > 0) {
      const newChannel = navigateToChannel('next', currentChannels, currentChannel.id)
        ?? currentChannels[0];
      if (newChannel && newChannel.id !== currentChannel.id) {
        switchChannel(newChannel, exitPIP);
      }
    }
  }, [switchChannel]);

  return {
    handleChannelSelect,
    handleUpDpad,
    handleDownDpad,
    switchChannel,
  };
};
