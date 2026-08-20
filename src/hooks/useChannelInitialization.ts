import { useEffect, useRef, useState } from 'react';
import { Channel, Playlist } from '../types';
import { usePlayerStore } from '../store/usePlayerStore';
import { useUIStore } from '../store/useUIStore';
import { useEPGStore } from '../store/useEPGStore';
import { getPlaylists, getLastChannel, getSettings } from '../utils/storage';
import { saveLastChannel } from '../utils/storage';
import { useMultiScreenStore } from '../store/useMultiScreenStore';
import { syncInterfacePreferences } from './interfacePreferences/useInterfacePreferences';

interface UseChannelInitializationProps {
  initialChannel?: Channel;
  getCurrentProgram: (channelId: string) => any;
}

export const useChannelInitialization = ({
  initialChannel,
  getCurrentProgram,
}: UseChannelInitializationProps) => {
  const [initialized, setInitialized] = useState(false);
  const channel = usePlayerStore((state) => state.channel);
  const setChannel = usePlayerStore((state) => state.setChannel);
  const setChannels = usePlayerStore((state) => state.setChannels);
  const setPlaylist = usePlayerStore((state) => state.setPlaylist);
  const setIsPlaying = usePlayerStore((state) => state.setIsPlaying);
  const setMaxScreens = useMultiScreenStore((state) => state.setMaxScreens);
  const { isMultiScreenMode, screens, addScreen } = useMultiScreenStore();

  // UI state
  const setShowEPG = useUIStore((state) => state.setShowEPG);
  const setShowEPGGrid = useUIStore((state) => state.setShowEPGGrid);

  // EPG state
  const setCurrentProgram = useEPGStore((state) => state.setCurrentProgram);

  // Cache playlists from startup read so the channel-change effect can reuse it
  const playlistsCacheRef = useRef<Playlist[] | null>(null);

  const applyPlaylist = (playlists: Playlist[], channelId: string) => {
    const found = playlists.find((p) => p.channels.some((c) => c.id === channelId));
    if (found) {
      setPlaylist(found);
      setChannels(found.channels);
    }
    return found ?? null;
  };

  // Initialize store with initial channel or last played channel (only once on mount)
  useEffect(() => {
    let active = true;

    const initializeChannel = async () => {
      try {
        if (channel) return;

        if (initialChannel) {
          setChannel(initialChannel);
          await saveLastChannel(initialChannel);
          return;
        }

        // Parallel fetch: last channel + playlists + settings together
        const [lastChannel, playlists, settings] = await Promise.all([
          getLastChannel(),
          getPlaylists(),
          getSettings(),
        ]);
        playlistsCacheRef.current = playlists;
        syncInterfacePreferences(settings);
        setShowEPG(false);

        if (lastChannel) {
          const activePlaylist = applyPlaylist(playlists, lastChannel.id);
          if (activePlaylist) {
            setChannel(lastChannel);
            setIsPlaying(true);
          } else if (playlists.length > 0) {
            const first = playlists[0];
            setPlaylist(first);
            setChannels(first.channels);
            setShowEPGGrid(settings.showEPG);
          }
        } else if (playlists.length > 0) {
          const first = playlists[0];
          setPlaylist(first);
          setChannels(first.channels);
          setShowEPGGrid(settings.showEPG);
        }
      } catch (error) {
        console.error('Error during channel initialization:', error);
      } finally {
        if (active) setInitialized(true);
      }
    };

    initializeChannel();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialChannel]);

  // Load playlist + settings when channel changes; reuse cached playlists if available
  useEffect(() => {
    if (!channel?.url) return;

    const channelId = channel.id;

    const loadChannelData = async () => {
      try {
        // Parallel: settings + playlists (from cache when possible)
        const [settings, playlists] = await Promise.all([
          getSettings(),
          playlistsCacheRef.current
            ? Promise.resolve(playlistsCacheRef.current)
            : getPlaylists(),
        ]);
        // Keep cache warm
        playlistsCacheRef.current = playlists;

        syncInterfacePreferences(settings);
        applyPlaylist(playlists, channelId);

        if (settings.autoPlay) setIsPlaying(true);
        setMaxScreens(settings.maxMultiScreens);
        setCurrentProgram(getCurrentProgram(channelId));
        setShowEPG(false);
        setShowEPGGrid(settings.showEPG);

        if (isMultiScreenMode && screens.length === 0) addScreen(channel);

        await saveLastChannel(channel).catch(() => {});
      } catch (error) {
        console.error('Error loading channel data:', error);
      }
    };

    loadChannelData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel?.id]);

  return { initialized };
};
