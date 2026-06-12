import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  Dimensions,
  Platform,
  Text,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { ResizeMode } from 'expo-av';
import { RootStackParamList } from '../types';
import type { PlayerVideoHandle } from '../types/video';
import EPGOverlay from '../components/player/EPGOverlay';
import EPGGridView from '../components/player/EPGGridView';
import ChannelListPanel from '../components/player/ChannelListPanel';
import GroupsPlaylistsPanel from '../components/player/GroupsPlaylistsPanel';
import ChannelNumberPad from '../components/player/ChannelNumberPad';
import VolumeIndicator from '../components/player/VolumeIndicator';
import MultiScreenControls from '../components/player/MultiScreenControls';
import ChannelInfoBar from '../components/player/ChannelInfoBar';
import ProgramInfoModal from '../components/player/ProgramInfoModal';
import SleepTimerModal from '../components/player/SleepTimerModal';
import { usePlayerStore } from '../store/usePlayerStore';
import { useUIStore } from '../store/useUIStore';
import { useEPGStore } from '../store/useEPGStore';
import { useMultiScreenStore } from '../store/useMultiScreenStore';
import { useVideoPlayback } from '../hooks/useVideoPlayback';
import { useChannelNavigation } from '../hooks/useChannelNavigation';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { useChannelInitialization } from '../hooks/useChannelInitialization';
import { useChannelInfo } from '../hooks/useChannelInfo';
import { usePIPMode } from '../hooks/usePIPMode';
import { useEPGAutoHide } from '../hooks/useEPGAutoHide';
import { usePlayerHandlers } from '../hooks/usePlayerHandlers';
import { useEPGManagement } from '../hooks/useEPGManagement';
import { useFavorites } from '../hooks/useFavorites';
import { useRecentChannels } from '../hooks/useRecentChannels';
import { useSleepTimer } from '../hooks/useSleepTimer';
import { useInterfacePreferences } from '../hooks/interfacePreferences/useInterfacePreferences';
import PlayerDpadZones from './player/PlayerDpadZones';
import PlayerVideoStage from './player/PlayerVideoStage';
import PlayerMultiScreenStage from './player/PlayerMultiScreenStage';
import { hasPlayerModalOverlay } from './player/usePlayerModalOverlay';


interface PlayerScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Player'>;
  route: RouteProp<RootStackParamList, 'Player'>;
}

const PlayerScreen: React.FC<PlayerScreenProps> = ({ navigation, route }) => {
  const { channel: initialChannel } = route.params || {};

  // Refs
  const videoRef = useRef<PlayerVideoHandle>(null);
  const mainViewRef = useRef<View>(null);
  const centerZoneRef = useRef<any>(null);

  // Player store state
  const channel = usePlayerStore((state) => state.channel);
  const channels = usePlayerStore((state) => state.channels);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const loading = usePlayerStore((state) => state.loading);
  const error = usePlayerStore((state) => state.error);
  const resizeMode = usePlayerStore((state) => state.resizeMode);
  
  // UI store state
  const showEPG = useUIStore((state) => state.showEPG);
  const showEPGGrid = useUIStore((state) => state.showEPGGrid);
  const showChannelList = useUIStore((state) => state.showChannelList);
  const showGroupsPlaylists = useUIStore((state) => state.showGroupsPlaylists);
  const showProgramInfo = useUIStore((state) => state.showProgramInfo);
  const showSleepTimer = useUIStore((state) => state.showSleepTimer);
  const showChannelNumberPad = useUIStore((state) => state.showChannelNumberPad);
  const showInfoBar = useUIStore((state) => state.showInfoBar);
  
  // EPG store state
  const currentProgram = useEPGStore((state) => state.currentProgram);
  const setCurrentProgram = useEPGStore((state) => state.setCurrentProgram);

  // Multi-screen state
  const { isMultiScreenMode, screens } = useMultiScreenStore();
  const [showMultiScreenControls, setShowMultiScreenControls] = useState(false);

  // Custom hooks
  const {
    getProgramsForChannel,
    getCurrentProgram,
    epgLoading,
    epgError,
    epgLastUpdated,
    prefetchProgramsForChannels,
    forceRefresh: forceEpgRefresh,
  } = useEPGManagement();
  const interfacePreferences = useInterfacePreferences();
  const { pipAnim, pipScale, enterPIP, exitPIP } = usePIPMode();
  const { setShowChannelInfoCard } = useChannelInfo({ showOnInitialLoad: true });
  const { toggleFavorite, isFavorite } = useFavorites(channels);
  const { recentChannels, addRecent } = useRecentChannels(channels);
  const { label: sleepLabel } = useSleepTimer();
  const {
    hasUserInteracted,
    setHasUserInteracted,
    handleTogglePlayback,
    handlePlaybackStatusUpdateWithError,
    handleVideoReadyWithPlayback,
    handleVideoError,
  } = useVideoPlayback(videoRef);
  const {
    handleChannelSelect,
    handleUpDpad,
    handleDownDpad,
    switchChannel,
  } = useChannelNavigation({
    videoRef,
    getCurrentProgram,
    setHasUserInteracted,
    hasUserInteracted,
    centerZoneRef,
    setShowChannelInfoCard,
  });
  const {
    handleCenterPress,
    handleLeftDpad,
    handleBack,
    showControlsOnFocus,
  } = usePlayerHandlers(setHasUserInteracted, hasUserInteracted, videoRef);

  // Initialize channel
  useChannelInitialization({
    initialChannel,
    getCurrentProgram,
  });

  // Show info bar when channel changes; track recents
  useEffect(() => {
    if (!channel) return;
    useUIStore.getState().setShowInfoBar(true);
    addRecent(channel.id);
  }, [channel?.id]);

  // Listen for EPG_PROGRAM_INFO events from native long-press
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('EPG_PROGRAM_INFO', (data) => {
      const ch = channels.find((c) => c.id === data.channelId);
      if (!ch) return;
      useUIStore.getState().setShowProgramInfo(true, {
        channel: ch,
        program: {
          id: data.programId ?? '',
          channelId: data.channelId ?? '',
          title: data.title ?? '',
          description: data.description ?? '',
          start: new Date(data.startMs),
          end: new Date(data.endMs),
          catchupAvailable: data.catchupAvailable ?? false,
          catchupUrl: data.catchupUrl,
        },
      });
    });
    return () => sub.remove();
  }, [channels]);

  // Build Xtream Codes timeshift URL from a live stream URL + time window
  const buildCatchupUrl = useCallback((channel: { url: string }, startMs: number, endMs: number): string | null => {
    // Xtream Codes live URL pattern: {server}/live/{user}/{pass}/{id}.m3u8
    const m = channel.url.match(/^(https?:\/\/[^/]+)\/live\/([^/]+)\/([^/]+)\/(\d+)\.m3u8/i);
    if (!m) return null;
    const [, server, user, pass, streamId] = m;
    const durationMin = Math.ceil((endMs - startMs) / 60_000);
    const d = new Date(startMs);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}:${pad(d.getHours())}-${pad(d.getMinutes())}`;
    return `${server}/timeshift/${user}/${pass}/${durationMin}/${dateStr}/${streamId}.m3u8`;
  }, []);

  // Handle EPG_CATCHUP_SELECT — load the timeshift stream for the selected past program
  const handleCatchupSelect = useCallback((channelId: string, startMs: number, endMs: number, programTitle: string) => {
    const ch = channels.find((c) => c.id === channelId);
    if (!ch) return;
    const url = buildCatchupUrl(ch, startMs, endMs);
    if (!url) return;
    useUIStore.getState().setShowEPGGrid(false);
    usePlayerStore.getState().setChannel({ ...ch, url, name: `${ch.name} — ${programTitle}` });
  }, [channels, buildCatchupUrl]);

  // Ensure a focus target is available on Android TV when overlays are closed
  useEffect(() => {
    if (
      Platform.OS === 'android' &&
      !showEPG &&
      !showEPGGrid &&
      !showChannelList &&
      !showGroupsPlaylists &&
      !showProgramInfo &&
      !showSleepTimer &&
      !showChannelNumberPad
    ) {
      centerZoneRef.current?.focus?.();
    }
  }, [showEPG, showEPGGrid, showChannelList, showGroupsPlaylists, showProgramInfo, showSleepTimer, showChannelNumberPad]);

  useEffect(() => {
    if (!channel) return;
    const program = getCurrentProgram(channel.id);
    setCurrentProgram(program);
  }, [channel?.id, getCurrentProgram, setCurrentProgram, epgLastUpdated]);

  const currentChannelPrograms = useMemo(() => {
    if (!channel) return [];
    return getProgramsForChannel(channel.id);
  }, [channel?.id, getProgramsForChannel, epgLastUpdated]);

  const nextProgram = useMemo(() => {
    const now = new Date();
    return currentChannelPrograms.find((p) => p.start > now) ?? null;
  }, [currentChannelPrograms]);

  // EPG auto-hide
  useEPGAutoHide(interfacePreferences.infoBarTimeoutSeconds);

  // Stable wrappers that bundle exitPIP so useKeyboardNavigation doesn't need it directly
  const handleUpDpadWithPIP = useCallback(() => handleUpDpad(exitPIP), [handleUpDpad, exitPIP]);
  const handleDownDpadWithPIP = useCallback(() => handleDownDpad(exitPIP), [handleDownDpad, exitPIP]);

  // Keyboard navigation
  useKeyboardNavigation({
    videoRef,
    navigation,
    handleChannelSelect,
    handleUpDpad: handleUpDpadWithPIP,
    handleDownDpad: handleDownDpadWithPIP,
    handleLeftDpad,
    handleCenterPress,
    handleBack,
    enterPIP,
    exitPIP,
    setHasUserInteracted,
    centerZoneRef,
  });


  const handleMultiScreenPress = useCallback(() => {
    setShowMultiScreenControls(true);
  }, []);

  // D-pad right: single screen → jump to previously-watched channel.
  // Multi-screen → cycle the next screen to fullscreen.
  const handleRightDpad = useCallback(() => {
    const { showEPGGrid, showEPG, showChannelList, showGroupsPlaylists } = useUIStore.getState();
    if (showEPGGrid || showEPG || showChannelList || showGroupsPlaylists) return;

    const ms = useMultiScreenStore.getState();
    if (ms.isMultiScreenMode && ms.screens.length > 0) {
      ms.cycleFullscreen();
      centerZoneRef.current?.focus?.();
      return;
    }

    const { previousChannel, channel } = usePlayerStore.getState();
    if (previousChannel && previousChannel.id !== channel?.id) {
      switchChannel(previousChannel, exitPIP);
    }
  }, [switchChannel, exitPIP]);

  const handleMultiScreenClose = useCallback(() => setShowMultiScreenControls(false), []);

  const handleEPGOverlayBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Settings');
  }, [navigation]);

  const handleManualEpgRefresh = useCallback(() => {
    forceEpgRefresh();
  }, [forceEpgRefresh]);

const { pipPreviewWidth, pipPreviewHeight } = useMemo(() => {
    const { width } = Dimensions.get('window');
    const w = Math.min(width * 0.34, 560);
    return { pipPreviewWidth: w, pipPreviewHeight: w * (9 / 16) };
  }, []);

  const handleUpDpadPress = useCallback(() => {
    handleUpDpad(exitPIP);
    setTimeout(() => centerZoneRef.current?.focus?.(), 50);
  }, [handleUpDpad, exitPIP]);

  const handleUpDpadFocus = useCallback(() => {
    handleUpDpad(exitPIP);
    setTimeout(() => centerZoneRef.current?.focus?.(), 10);
  }, [handleUpDpad, exitPIP]);

  const handleDownDpadPress = useCallback(() => {
    handleDownDpad(exitPIP);
    setTimeout(() => centerZoneRef.current?.focus?.(), 50);
  }, [handleDownDpad, exitPIP]);

  const handleDownDpadFocus = useCallback(() => {
    handleDownDpad(exitPIP);
    setTimeout(() => centerZoneRef.current?.focus?.(), 10);
  }, [handleDownDpad, exitPIP]);

  const hasModalOverlay = hasPlayerModalOverlay({
    showEPG,
    showEPGGrid,
    showChannelList,
    showGroupsPlaylists,
    showProgramInfo,
    showSleepTimer,
    showChannelNumberPad,
    showInfoBar,
  });

  // If in multi-screen mode, show multi-screen view
  if (isMultiScreenMode && screens.length > 0) {
    return (
      <PlayerMultiScreenStage
        channels={channels}
        onChannelSelect={handleChannelSelect}
        showControls={showMultiScreenControls}
        onCloseControls={handleMultiScreenClose}
      />
    );
  }

  return (
    <View 
      ref={mainViewRef}
      className="flex-1 bg-black relative"
    >
      <PlayerDpadZones
        hasModalOverlay={hasModalOverlay}
        centerZoneRef={centerZoneRef}
        onCenterPress={handleCenterPress}
        onLeftPress={handleLeftDpad}
        onRightPress={handleRightDpad}
        onUpPress={handleUpDpadPress}
        onUpFocus={handleUpDpadFocus}
        onDownPress={handleDownDpadPress}
        onDownFocus={handleDownDpadFocus}
        hasUserInteracted={hasUserInteracted}
        isPlaying={isPlaying}
        onFirstInteraction={() => {
          if (Platform.OS !== 'web' || hasUserInteracted) return;
          setHasUserInteracted(true);
          if (videoRef.current) {
            videoRef.current.playAsync().catch((err) => {
              console.log('Play failed:', err);
            });
          }
        }}
        showControlsOnFocus={showControlsOnFocus}
      />

      {channel && (
        <PlayerVideoStage
          channel={channel}
          currentProgram={currentProgram}
          showEPGGrid={showEPGGrid}
          pipAnim={pipAnim}
          pipScale={pipScale}
          pipPreviewWidth={pipPreviewWidth}
          pipPreviewHeight={pipPreviewHeight}
          videoRef={videoRef}
          resizeMode={resizeMode}
          isPlaying={isPlaying}
          onLoad={handleVideoReadyWithPlayback}
          onError={handleVideoError}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdateWithError}
        />
      )}

      {loading && !error && (
        <View className="absolute inset-0 justify-center items-center bg-black/70 p-6 gap-4 z-[3]">
          <ActivityIndicator size="large" color="#00aaff" />
          <Text className="text-white text-lg text-center">Loading stream...</Text>
        </View>
      )}

      {error && (
        <View
          pointerEvents="none"
          className="absolute inset-0 justify-center items-center bg-black/70 p-6 gap-4 z-[3]"
        >
          <Text className="text-white text-lg text-center font-semibold">
            {error}
          </Text>
          <Text className="text-white/80 text-base text-center">
            Press up or down on your remote to switch to another channel.
          </Text>
        </View>
      )}

      {/* Multi-Screen Controls Modal */}
      <MultiScreenControls
        channels={channels}
        onChannelSelect={handleChannelSelect}
        isVisible={showMultiScreenControls}
        onClose={handleMultiScreenClose}
      />

      {/* EPG Overlay - Only render when visible and navigation is ready */}
      {showEPG && (
        <EPGOverlay
          onTogglePlayback={handleTogglePlayback}
          onBack={handleEPGOverlayBack}
          navigation={navigation}
          programs={currentChannelPrograms}
          epgLoading={epgLoading}
          epgError={epgError}
          clockFormat={interfacePreferences.clockFormat}
          recentChannels={recentChannels}
          onChannelSelect={(nextChannel) => handleChannelSelect(nextChannel)}
          onMultiScreen={handleMultiScreenPress}
          onSleepTimer={() => useUIStore.getState().setShowSleepTimer(true)}
        />
      )}

      {/* EPG Grid View - Only render when visible and navigation is ready */}
      {showEPGGrid && navigation && (
        <EPGGridView
          getCurrentProgram={getCurrentProgram}
          getProgramsForChannel={getProgramsForChannel}
          prefetchProgramsForChannels={prefetchProgramsForChannels}
          onChannelSelect={handleChannelSelect}
          onExitPIP={exitPIP}
          navigation={navigation}
          epgLoading={epgLoading}
          epgError={epgError}
          epgLastUpdated={epgLastUpdated}
          handleManualEpgRefresh={handleManualEpgRefresh}
          clockFormat={interfacePreferences.clockFormat}
          showChannelNumbers={interfacePreferences.showChannelNumbers}
        />
      )}

      {/* Channel List Panel */}
      <ChannelListPanel
        onChannelSelect={handleChannelSelect}
        onCatchupSelect={handleCatchupSelect}
        getCurrentProgram={getCurrentProgram}
        getProgramsForChannel={getProgramsForChannel}
        epgLastUpdated={epgLastUpdated}
        showChannelNumbers={interfacePreferences.showChannelNumbers}
        clockFormat={interfacePreferences.clockFormat}
      />

      {/* Groups & Playlists Panel */}
      <GroupsPlaylistsPanel />

      {/* Volume Indicator */}
      <VolumeIndicator />

      {/* Channel Info Bar */}
      {showInfoBar && !showEPGGrid && !showEPG && !showChannelList && !showGroupsPlaylists && !showProgramInfo && !showSleepTimer && !showChannelNumberPad && (
        <ChannelInfoBar
          channel={channel}
          currentProgram={currentProgram}
          nextProgram={nextProgram}
          isFavorite={channel ? isFavorite(channel.id) : false}
          onToggleFavorite={() => channel && toggleFavorite(channel)}
          onTogglePlayback={handleTogglePlayback}
          onMultiScreen={handleMultiScreenPress}
          onSleepTimer={() => useUIStore.getState().setShowSleepTimer(true)}
          sleepLabel={sleepLabel}
          navigation={navigation}
          timeoutSeconds={interfacePreferences.infoBarTimeoutSeconds}
          clockFormat={interfacePreferences.clockFormat}
          showControls={false}
        />
      )}

      {/* Program Info Modal */}
      <ProgramInfoModal />

      {/* Sleep Timer Modal */}
      <SleepTimerModal />

      {/* Channel Number Pad */}
      <ChannelNumberPad />
    </View>
  );
};

export default PlayerScreen;
