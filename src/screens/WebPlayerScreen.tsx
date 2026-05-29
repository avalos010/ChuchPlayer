import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList, Channel, EPGProgram, Settings } from '../types';
import { usePlayerStore } from '../store/usePlayerStore';
import { useEPGManagement } from '../hooks/useEPGManagement';
import { useChannelInitialization } from '../hooks/useChannelInitialization';
import { useWebPlayerKeyboard } from '../hooks/useWebPlayerKeyboard';
import { getSettings, saveLastChannel } from '../utils/storage';
import TopOverlay from '../components/webPlayer/TopOverlay';
import SidebarPanel from '../components/webPlayer/SidebarPanel';
import InfoOverlay from '../components/webPlayer/InfoOverlay';
import MainEpgGuide from '../components/webPlayer/MainEpgGuide';
import { webPlayerStyles as s } from '../components/webPlayer/styles';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const WebVideo = require('../components/player/WebVideo.web').default;

interface WebPlayerScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Player'>;
  route: RouteProp<RootStackParamList, 'Player'>;
}

const ALL_CHANNELS_GROUP = 'All Channels';

const WebPlayerScreen: React.FC<WebPlayerScreenProps> = ({ navigation, route }) => {
  const channel = usePlayerStore((state) => state.channel);
  const channels = usePlayerStore((state) => state.channels);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const loading = usePlayerStore((state) => state.loading);
  const playlist = usePlayerStore((state) => state.playlist);
  const setChannel = usePlayerStore((state) => state.setChannel);
  const setIsPlaying = usePlayerStore((state) => state.setIsPlaying);
  const navigateToChannel = usePlayerStore((state) => state.navigateToChannel);

  const { getProgramsForChannel, getCurrentProgram, epgLoading } = useEPGManagement();

  useChannelInitialization({
    initialChannel: route.params?.channel,
    getCurrentProgram,
  });

  const [selectedGroup, setSelectedGroup] = useState<string>(ALL_CHANNELS_GROUP);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [highlightedChannelId, setHighlightedChannelId] = useState<string | null>(null);
  const [clock, setClock] = useState(() => new Date());
  const [chromeVisible, setChromeVisible] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const hideChromeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showChrome = useCallback(() => {
    setChromeVisible(true);
  }, []);

  useEffect(() => {
    setVideoError(false);
    showChrome();
  }, [channel?.id]);

  useEffect(() => {
    let active = true;

    getSettings()
      .then((nextSettings) => {
        if (!active) return;
        setSettings(nextSettings);
        setGuideOpen(nextSettings.showEPG);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (hideChromeTimerRef.current) {
      clearTimeout(hideChromeTimerRef.current);
      hideChromeTimerRef.current = null;
    }

    const timeoutSeconds = settings?.infoBarTimeoutSeconds ?? 6;
    if (!channel || sidebarOpen || loading || !chromeVisible || timeoutSeconds <= 0) return undefined;

    hideChromeTimerRef.current = setTimeout(() => {
      setChromeVisible(false);
      hideChromeTimerRef.current = null;
    }, timeoutSeconds * 1000);

    return () => {
      if (hideChromeTimerRef.current) {
        clearTimeout(hideChromeTimerRef.current);
        hideChromeTimerRef.current = null;
      }
    };
  }, [channel, chromeVisible, loading, settings?.infoBarTimeoutSeconds, sidebarOpen]);

  useEffect(() => {
    const handleActivity = () => showChrome();
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('click', handleActivity);
    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('click', handleActivity);
    };
  }, [showChrome]);

  const groups = useMemo(() => {
    const seen = new Set<string>();
    const nextGroups = [ALL_CHANNELS_GROUP];
    channels.forEach((item) => {
      if (item.group && !seen.has(item.group)) {
        seen.add(item.group);
        nextGroups.push(item.group);
      }
    });
    return nextGroups;
  }, [channels]);

  const filteredChannels = useMemo(() => {
    if (selectedGroup === ALL_CHANNELS_GROUP) return channels;
    return channels.filter((item) => item.group === selectedGroup);
  }, [channels, selectedGroup]);

  useEffect(() => {
    if (!filteredChannels.length) {
      setHighlightedChannelId(null);
      return;
    }

    if (channel && filteredChannels.some((item) => item.id === channel.id)) {
      setHighlightedChannelId(channel.id);
      return;
    }

    if (!highlightedChannelId || !filteredChannels.some((item) => item.id === highlightedChannelId)) {
      setHighlightedChannelId(filteredChannels[0].id);
    }
  }, [channel?.id, filteredChannels, highlightedChannelId]);

  const currentProgram = channel ? getCurrentProgram(channel.id) : null;
  const showChannelNumbers = settings?.showChannelNumbers ?? false;
  const clockLabel = clock.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: (settings?.clockFormat ?? '24h') === '12h',
  });
  const visiblePrograms = useMemo(
    () => (channel ? getProgramsForChannel(channel.id).slice(0, 10) : []),
    [channel, getProgramsForChannel],
  );

  const handleChannelSelect = useCallback(async (nextChannel: Channel) => {
    showChrome();
    setChannel(nextChannel);
    setIsPlaying(true);
    setHighlightedChannelId(nextChannel.id);
    await saveLastChannel(nextChannel);
  }, [setChannel, setIsPlaying, showChrome]);

  const buildCatchupUrl = useCallback((targetChannel: Channel, program: EPGProgram) => {
    if (program.catchupUrl) return program.catchupUrl;

    const match = targetChannel.url.match(/^(https?:\/\/[^/]+)\/live\/([^/]+)\/([^/]+)\/(\d+)\.m3u8/i);
    if (!match) return null;

    const [, server, user, pass, streamId] = match;
    const durationMin = Math.ceil((program.end.getTime() - program.start.getTime()) / 60_000);
    const start = program.start;
    const pad = (value: number) => value.toString().padStart(2, '0');
    const date = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}:${pad(start.getHours())}-${pad(start.getMinutes())}`;
    return `${server}/timeshift/${user}/${pass}/${durationMin}/${date}/${streamId}.m3u8`;
  }, []);

  const handleCatchupSelect = useCallback(async (targetChannel: Channel, program: EPGProgram) => {
    const catchupUrl = buildCatchupUrl(targetChannel, program);
    if (!catchupUrl) return;

    await handleChannelSelect({
      ...targetChannel,
      url: catchupUrl,
      name: `${targetChannel.name} - ${program.title}`,
    });
    setGuideOpen(false);
    setSidebarOpen(false);
  }, [buildCatchupUrl, handleChannelSelect]);

  const handleTogglePlayback = useCallback(async () => {
    if (!channel) return;
    showChrome();
    setIsPlaying(!isPlaying);
  }, [channel, isPlaying, setIsPlaying, showChrome]);

  const handleSettings = useCallback(() => {
    navigation.navigate('Settings');
  }, [navigation]);

  const switchRelativeChannel = useCallback(async (direction: 'prev' | 'next') => {
    if (!channel || !channels.length) return;
    const nextChannel = navigateToChannel(direction, channels, channel.id);
    if (nextChannel) {
      await handleChannelSelect(nextChannel);
    }
  }, [channel, channels, handleChannelSelect, navigateToChannel]);

  const setSidebarOpenWithChrome = useCallback((open: boolean) => {
    showChrome();
    setSidebarOpen(open);
  }, [showChrome]);

  useWebPlayerKeyboard({
    sidebarOpen,
    setSidebarOpen: setSidebarOpenWithChrome,
    filteredChannels,
    highlightedChannelId,
    setHighlightedChannelId,
    groups,
    selectedGroup,
    setSelectedGroup,
    guideOpen,
    setGuideOpen,
    handleChannelSelect,
    handleTogglePlayback,
    handleSettings,
    switchRelativeChannel,
    onUserActivity: showChrome,
  });

  if (!playlist && channels.length === 0) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyTitle}>No playlist loaded</Text>
        <Text style={s.emptyDesc}>Add a playlist in Settings to get started.</Text>
        <TouchableOpacity style={s.emptyBtn} onPress={handleSettings}>
          <Text style={s.emptyBtnTxt}>Open Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <View style={s.videoStage}>
        {!channel ? (
          <View style={s.videoPlaceholder}>
            <Text style={s.videoPlaceholderIcon}>TV</Text>
            <Text style={s.videoPlaceholderTxt}>Pick a channel to start watching</Text>
          </View>
        ) : videoError ? (
          <View style={s.videoPlaceholder}>
            <Text style={s.videoPlaceholderIcon}>!</Text>
            <Text style={s.videoPlaceholderTxt}>Stream unavailable</Text>
            <Text style={s.videoPlaceholderSub}>{channel.url}</Text>
          </View>
        ) : (
          <WebVideo
            uri={channel.url}
            isPlaying={isPlaying}
            onError={() => setVideoError(true)}
            onLoad={async () => {
              const activeSettings = settings ?? await getSettings();
              setIsPlaying(activeSettings.autoPlay ?? true);
            }}
          />
        )}

        {(chromeVisible || sidebarOpen) ? (
          <>
            <View pointerEvents="none" style={s.videoShadeTop} />
            <View pointerEvents="none" style={s.videoShadeBottom} />
          </>
        ) : null}

        {(chromeVisible || sidebarOpen) ? (
          <TopOverlay
            playlistName={playlist?.name}
            clockLabel={clockLabel}
            onSettings={handleSettings}
          />
        ) : null}

        {sidebarOpen ? (
          <SidebarPanel
            groups={groups}
            selectedGroup={selectedGroup}
            filteredChannels={filteredChannels}
            currentChannelId={channel?.id}
            highlightedChannelId={highlightedChannelId}
            showChannelNumbers={showChannelNumbers}
            onGroupSelect={setSelectedGroup}
            onChannelSelect={async (nextChannel) => {
              await handleChannelSelect(nextChannel);
              setSidebarOpen(false);
            }}
            getCurrentProgram={getCurrentProgram}
          />
        ) : null}

        {guideOpen ? (
          <MainEpgGuide
            channels={channels}
            currentChannel={channel}
            isPlaying={isPlaying}
            showChannelNumbers={showChannelNumbers}
            getProgramsForChannel={getProgramsForChannel}
            onClose={() => setGuideOpen(false)}
            onChannelSelect={async (nextChannel) => {
              await handleChannelSelect(nextChannel);
            }}
            onCatchupSelect={handleCatchupSelect}
          />
        ) : null}

        {loading ? (
          <View style={s.loadingOverlay}>
            <ActivityIndicator size="large" color="#dbeafe" />
            <Text style={s.loadingText}>Loading stream...</Text>
          </View>
        ) : null}

        {channel ? (
          (chromeVisible || sidebarOpen) ? (
            <InfoOverlay
              channel={channel}
              currentProgram={currentProgram}
              visiblePrograms={visiblePrograms}
              sidebarOpen={sidebarOpen}
              guideOpen={guideOpen}
              epgLoading={epgLoading}
              onToggleSidebar={() => {
                showChrome();
                setSidebarOpen((value) => !value);
              }}
              onToggleGuide={() => {
                showChrome();
                setSidebarOpen(false);
                setGuideOpen(true);
              }}
            />
          ) : null
        ) : null}
      </View>
    </View>
  );
};

export default WebPlayerScreen;
