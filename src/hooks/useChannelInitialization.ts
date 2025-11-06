import { useEffect } from 'react';
import { Channel } from '../types';
import { usePlayerStore } from '../store/usePlayerStore';
import { useUIStore } from '../store/useUIStore';
import { useEPGStore } from '../store/useEPGStore';
import { getPlaylists, getLastChannel, getSettings } from '../utils/storage';
import { saveLastChannel } from '../utils/storage';
import { useMultiScreenStore } from '../store/useMultiScreenStore';

interface UseChannelInitializationProps {
  initialChannel?: Channel;
  getCurrentProgram: (channelId: string) => any;
}

export const useChannelInitialization = ({
  initialChannel,
  getCurrentProgram,
}: UseChannelInitializationProps) => {
  const channel = usePlayerStore((state) => state.channel);
  const setChannel = usePlayerStore((state) => state.setChannel);
  const setChannels = usePlayerStore((state) => state.setChannels);
  const setPlaylist = usePlayerStore((state) => state.setPlaylist);
  const setIsPlaying = usePlayerStore((state) => state.setIsPlaying);
  const setMaxScreens = useMultiScreenStore((state) => state.setMaxScreens);
  const { isMultiScreenMode, screens, addScreen } = useMultiScreenStore();
  
  // UI state
  const setShowEPGGrid = useUIStore((state) => state.setShowEPGGrid);
  
  // EPG state
  const setCurrentProgram = useEPGStore((state) => state.setCurrentProgram);

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
      }
    };

    loadChannelData();
    // Only depend on channel ID to avoid loops
  }, [channel?.id, getCurrentProgram, setCurrentProgram, setIsPlaying, setMaxScreens]);
};

