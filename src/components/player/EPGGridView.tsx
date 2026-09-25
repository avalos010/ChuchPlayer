import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import { ScrollView, Platform, DeviceEventEmitter } from 'react-native';
import { FlashList, ListRenderItemInfo } from '@shopify/flash-list';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Channel, EPGProgram } from '../../types';
import { RootStackParamList } from '../../types';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useUIStore } from '../../store/useUIStore';
import { useThemeStore } from '../../store/useThemeStore';
import { groupChannelsByCategory } from '../../utils/m3uParser';
import NativeEpgGrid, { isNativeEpgGridAvailable } from './NativeEpgGrid';
import { FocusedInfo } from './EpgInfoPanel';
import { ChannelRow, ChannelRowData, EpgGroupItem } from './EpgGridParts';
import { SLOT_W, TV } from './EpgGridShared';
import { EpgGridLayout } from './EpgGridLayout';

const KeyEvent = Platform.OS === 'android'
  ? (require('react-native-keyevent').default ?? require('react-native-keyevent'))
  : null;

const USE_NATIVE_GRID = Platform.OS === 'android' && TV && isNativeEpgGridAvailable;

// ─── Info Panel ───────────────────────────────────────────────────────────────


interface EPGGridViewProps {
  getCurrentProgram: (channelId: string) => EPGProgram | null;
  getProgramsForChannel?: (channelId: string) => EPGProgram[];
  prefetchProgramsForChannels?: (channelIds: string[]) => void;
  onChannelSelect: (channel: Channel) => void;
  onExitPIP?: () => void;
  navigation?: NativeStackNavigationProp<RootStackParamList>;
  epgLoading?: boolean;
  epgError?: string | null;
  epgLastUpdated?: number;
  handleManualEpgRefresh?: () => void;
  clockFormat?: '12h' | '24h';
  showChannelNumbers?: boolean;
}
// ─── Main EPGGridView ─────────────────────────────────────────────────────────

const EPGGridView: React.FC<EPGGridViewProps> = ({
  getCurrentProgram,
  getProgramsForChannel,
  prefetchProgramsForChannels,
  onChannelSelect,
  onExitPIP,
  navigation,
  epgLoading = false,
  epgError = null,
  epgLastUpdated = 0,
  handleManualEpgRefresh,
  clockFormat = '24h',
  showChannelNumbers = false,
}) => {
  const theme        = useThemeStore((st) => st.theme);
  const showEPGGrid  = useUIStore((st) => st.showEPGGrid);
  const setShowEPGGrid = useUIStore((st) => st.setShowEPGGrid);
  const channels     = usePlayerStore((st) => st.channels);
  const channel      = usePlayerStore((st) => st.channel);
  const playlist     = usePlayerStore((st) => st.playlist);

  const [selectedGroup, setSelectedGroup] = useState('All');
  const [showGroupRail, setShowGroupRail] = useState(false);
  const [nativeGridFocusTrigger, setNativeGridFocusTrigger] = useState(0);
  const flashRef      = useRef<FlashList<ChannelRowData>>(null);
  const hScrollRef    = useRef<ScrollView>(null);
  const [focusedId, setFocusedId]       = useState<string | null>(null);
  const [initFocusId, setInitFocusId]   = useState<string | null>(null);
  const [timePos, setTimePos]           = useState(0);
  const loadedIdsRef = useRef<Set<string>>(new Set());
  const [epgVersion, setEpgVersion]     = useState(0);
  const [focusedInfo, setFocusedInfo]   = useState<FocusedInfo | null>(null);
  const horizontalScrollXRef = useRef(0);
  const [timelineScrollX, setTimelineScrollX] = useState(0);

  // Update current time position every 5 min — only while grid is visible
  useEffect(() => {
    if (!showEPGGrid) return;
    const update = () => {
      const now = new Date();
      setTimePos(12 * SLOT_W + (now.getMinutes() / 60) * SLOT_W);
    };
    update();
    const id = setInterval(update, 300_000);
    return () => clearInterval(id);
  }, [showEPGGrid]);

  // Listen for focus events from the native Kotlin grid
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('EPG_CHANNEL_FOCUS', (data: FocusedInfo) => {
      setFocusedInfo(data);
    });
    return () => sub.remove();
  }, []);

  // For the JS grid path: sync focusedId → focusedInfo
  useEffect(() => {
    if (USE_NATIVE_GRID || !focusedId) return;
    const ch = channels.find(c => c.id === focusedId);
    if (!ch) return;
    const now = new Date();
    const prog = getProgramsForChannel ? getProgramsForChannel(focusedId)
      .find(p => p.start <= now && p.end > now) : null;
    setFocusedInfo({
      channelId: ch.id,
      channelName: ch.name,
      channelNumber: channels.indexOf(ch) + 1,
      programTitle: prog?.title,
      programDesc:  prog?.description,
      programStart: prog?.start.getTime(),
      programEnd:   prog?.end.getTime(),
    });
  }, [focusedId, channels, getProgramsForChannel]);

  const groups = useMemo<EpgGroupItem[]>(() => {
    if (!channels?.length) return [{ name: 'All', count: 0 }];
    const grouped = groupChannelsByCategory(channels);
    return [
      { name: 'All', count: channels.length },
      ...Array.from(grouped.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, items]) => ({ name, count: items.length })),
    ];
  }, [channels]);

  const groupNames = useMemo(() => groups.map((group) => group.name), [groups]);
  const minTimelineX = useMemo(() => Math.max(0, timePos - 24), [timePos]);
  const syncTimelineScroll = useCallback((x: number, animated = false) => {
    const nextX = Math.max(minTimelineX, x);
    horizontalScrollXRef.current = nextX;
    setTimelineScrollX((prev) => (Math.abs(prev - nextX) > 3 ? nextX : prev));
    hScrollRef.current?.scrollTo({ x: nextX, animated });
  }, [minTimelineX]);

  useEffect(() => {
    if (!showEPGGrid) return;
    const rawGroup = channel?.group?.split(';')[0]?.trim();
    setSelectedGroup(rawGroup && groupNames.includes(rawGroup) ? rawGroup : 'All');
    setShowGroupRail(false);
  }, [showEPGGrid, channel?.id, channel?.group, groupNames]);

  // Scroll to current time when grid opens
  useEffect(() => {
    if (showEPGGrid && hScrollRef.current && timePos > 0) {
      setTimeout(() => {
        syncTimelineScroll(minTimelineX, false);
      }, 200);
    }
  }, [showEPGGrid, timePos, minTimelineX, syncTimelineScroll]);

  const handleClose = useCallback(() => {
    setShowEPGGrid(false);
    setShowGroupRail(false);
    onExitPIP?.();
  }, [setShowEPGGrid, onExitPIP]);

  const handleSettings = useCallback(() => {
    setShowEPGGrid(false);
    setShowGroupRail(false);
    onExitPIP?.();
    setTimeout(() => { try { navigation?.navigate('Settings', { focusTarget: 'epg' }); } catch {} }, 100);
  }, [setShowEPGGrid, onExitPIP, navigation]);

  const closeGroupRail = useCallback(() => {
    setShowGroupRail(false);
    setNativeGridFocusTrigger((trigger) => trigger + 1);
  }, []);

  const handleGroupSelect = useCallback((group: string) => {
    setSelectedGroup(group);
    closeGroupRail();
  }, [closeGroupRail]);

  const filteredChannels = useMemo(() => {
    if (!channels?.length) return [];
    if (selectedGroup === 'All') return channels.filter(Boolean);
    return channels.filter(ch => ch?.group === selectedGroup);
  }, [channels, selectedGroup]);

  const loadEpgFor = useCallback((ids: string[]) => {
    if (!ids.length || !prefetchProgramsForChannels) return;
    const toLoad = ids.filter(id => !loadedIdsRef.current.has(id));
    if (toLoad.length) {
      prefetchProgramsForChannels(toLoad);
      toLoad.forEach(id => loadedIdsRef.current.add(id));
      setEpgVersion(v => v + 1);
    }
  }, [prefetchProgramsForChannels]);

  // Stable ref to filtered channels for the viewability callback
  const filteredChannelsRef = useRef(filteredChannels);
  filteredChannelsRef.current = filteredChannels;

  const channelData = useMemo<ChannelRowData[]>(() =>
    filteredChannels.map(ch => ({
      channel: ch,
      isCurrent: ch.id === channel?.id,
      programs: loadedIdsRef.current.has(ch.id) && getProgramsForChannel
        ? getProgramsForChannel(ch.id)
        : [],
    })),
    [filteredChannels, channel?.id, epgVersion, getProgramsForChannel],
  );

  // O(1) map from channel ID to index for fast row lookups (vs O(n) findIndex)
  const channelIndexMap = useMemo(() => {
    const m = new Map<string, number>();
    channelData.forEach((row, i) => m.set(row.channel.id, i));
    return m;
  }, [channelData]);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: any[] }) => {
    const visIds: string[] = viewableItems.map((i: any) => i.item.channel.id);
    loadEpgFor(visIds);
    visIds.forEach(vid => {
      const idx = channelIndexMap.get(vid);
      if (idx !== undefined) {
        const allIds = filteredChannelsRef.current.map(c => c.id);
        loadEpgFor(allIds.slice(Math.max(0, idx - 5), idx + 6));
      }
    });
  }, [loadEpgFor, channelIndexMap]);

  // Keep a ref to the latest channel data so effects/callbacks can read it
  // without taking it as a dep — which would re-fire them on every lazy-load.
  const channelDataRef = useRef(channelData);
  channelDataRef.current = channelData;

  useEffect(() => {
    loadedIdsRef.current.clear();
    setEpgVersion(v => v + 1);
  }, [selectedGroup]);

  useEffect(() => {
    if (showEPGGrid && filteredChannels.length > 0) {
      loadEpgFor(filteredChannels.slice(0, 12).map(c => c.id));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEPGGrid, selectedGroup]);

  // Focus/scroll reset — ONLY when the grid opens, the user selects a different
  // channel, or the group filter changes. Lazy-load updates to `channelData`
  // must NOT re-trigger this, or the list constantly jumps back to the top.
  useEffect(() => {
    if (!showEPGGrid) { setFocusedId(null); setInitFocusId(null); return; }
    const data = channelDataRef.current;
    const fid = channel?.id ?? data[0]?.channel.id ?? null;
    if (!fid) return;
    setFocusedId(fid);
    setInitFocusId(fid);
    const idx = channelIndexMap.get(fid);
    if (idx !== undefined) {
      setTimeout(() => {
        flashRef.current?.scrollToIndex({ index: idx, animated: false, viewPosition: 0.3 });
      }, 150);
    }
  }, [showEPGGrid, channel?.id, selectedGroup, channelIndexMap]);

  const handleRowFocus = useCallback((id: string) => {
    setFocusedId(id);
    // Use O(1) map lookup instead of O(n) findIndex
    const idx = channelIndexMap.get(id);
    if (idx !== undefined) {
      flashRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.3 });
    }
  }, [channelIndexMap]);

  const renderItem = useCallback(({ item }: ListRenderItemInfo<ChannelRowData>) => (
    <ChannelRow
      data={item}
      onChannelSelect={onChannelSelect}
      onFocus={handleRowFocus}
      isFocused={item.channel.id === focusedId}
      hasTVPreferredFocus={item.channel.id === initFocusId}
      currentTimePosition={timePos}
      timelineScrollX={timelineScrollX}
      showChannelNumbers={showChannelNumbers}
      clockFormat={clockFormat}
    />
  ), [onChannelSelect, handleRowFocus, focusedId, initFocusId, timePos, timelineScrollX, showChannelNumbers, clockFormat]);

  const keyExtractor = useCallback((item: ChannelRowData) => item.channel.id, []);

  const buildFocusedInfo = useCallback((channelId: string): FocusedInfo | null => {
    const target = channels.find((c) => c.id === channelId);
    if (!target) return null;

    const programs = getProgramsForChannel ? getProgramsForChannel(channelId) : [];
    const activeProgram = programs.find((p) => p.start <= new Date() && p.end > new Date()) ?? programs[0] ?? null;

    return {
      channelId: target.id,
      channelName: target.name,
      channelNumber: channels.indexOf(target) + 1,
      programTitle: activeProgram?.title ?? 'No guide data',
      programDesc: activeProgram?.description,
      programStart: activeProgram?.start?.getTime(),
      programEnd: activeProgram?.end?.getTime(),
    };
  }, [channels, getProgramsForChannel]);

  const nativeDataVersion = useMemo(
    () => (Math.floor((epgLastUpdated || 0) / 1000) + epgVersion) % 2_000_000_000,
    [epgLastUpdated, epgVersion],
  );

  const handleNativeChannelSelect = useCallback((channelId: string) => {
    const selected = channels.find((item) => item.id === channelId);
    if (selected) onChannelSelect(selected);
  }, [channels, onChannelSelect]);

  const handleNativeOpenGroups = useCallback(() => {
    setShowGroupRail(true);
  }, []);

  useEffect(() => {
    if (!showEPGGrid || Platform.OS !== 'web') return undefined;

    const handleGridKeyDown = (e: KeyboardEvent) => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape'].includes(e.key)) {
        return;
      }

      if (showGroupRail) {
        e.preventDefault();
        const currentGroupIndex = Math.max(0, groupNames.indexOf(selectedGroup));
        if (e.key === 'Escape' || e.key === 'ArrowRight') {
          closeGroupRail();
          return;
        }
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          const nextIndex = e.key === 'ArrowUp'
            ? Math.max(0, currentGroupIndex - 1)
            : Math.min(groupNames.length - 1, currentGroupIndex + 1);
          setSelectedGroup(groupNames[nextIndex] ?? selectedGroup);
          return;
        }
        if (e.key === 'Enter') {
          closeGroupRail();
          return;
        }
        return;
      }

      if (!filteredChannels.length) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (horizontalScrollXRef.current <= minTimelineX + 4) {
          setShowGroupRail(true);
        } else {
          syncTimelineScroll(horizontalScrollXRef.current - SLOT_W, true);
        }
        return;
      }

      if (e.key === 'ArrowRight') {
        syncTimelineScroll(horizontalScrollXRef.current + SLOT_W, true);
        return;
      }

      const currentId = focusedId ?? channel?.id ?? filteredChannels[0]?.id;
      const currentIndex = Math.max(0, filteredChannels.findIndex((c) => c.id === currentId));

      if (e.key === 'Enter') {
        const selected = filteredChannels[currentIndex];
        if (selected) onChannelSelect(selected);
        return;
      }

      const nextIndex =
        e.key === 'ArrowUp'
          ? Math.max(0, currentIndex - 1)
          : Math.min(filteredChannels.length - 1, currentIndex + 1);

      const nextChannel = filteredChannels[nextIndex];
      if (!nextChannel) return;

      setFocusedId(nextChannel.id);
      setInitFocusId(nextChannel.id);
      setFocusedInfo(buildFocusedInfo(nextChannel.id));
      flashRef.current?.scrollToIndex({ index: nextIndex, animated: true, viewPosition: 0.3 });
      loadEpgFor(
        filteredChannels
          .slice(Math.max(0, nextIndex - 5), Math.min(filteredChannels.length, nextIndex + 6))
          .map((c) => c.id),
      );
    };

    window.addEventListener('keydown', handleGridKeyDown);
    return () => window.removeEventListener('keydown', handleGridKeyDown);
  }, [
    buildFocusedInfo,
    closeGroupRail,
    channel?.id,
    filteredChannels,
    focusedId,
    groupNames,
    loadEpgFor,
    onChannelSelect,
    selectedGroup,
    showEPGGrid,
    showGroupRail,
    minTimelineX,
    syncTimelineScroll,
  ]);

  useEffect(() => {
    if (!showEPGGrid || !KeyEvent || (USE_NATIVE_GRID && !showGroupRail)) return;
    KeyEvent.onKeyDownListener((e: { keyCode: number }) => {
      if (showGroupRail) {
        if (e.keyCode === 21 || e.keyCode === 22 || e.keyCode === 4) closeGroupRail();
        return;
      }
      if (e.keyCode === 21) {
        if (horizontalScrollXRef.current <= minTimelineX + 4) {
          setShowGroupRail(true);
        } else {
          syncTimelineScroll(horizontalScrollXRef.current - SLOT_W, true);
        }
      }
      if (e.keyCode === 22) syncTimelineScroll(horizontalScrollXRef.current + SLOT_W, true);
    });
    return () => KeyEvent.removeKeyDownListener();
  }, [showEPGGrid, showGroupRail, minTimelineX, syncTimelineScroll, closeGroupRail]);

  if (!showEPGGrid || !channels.length || !navigation) return null;

  // Only show the blocking overlay when we genuinely have nothing to display.
  // Once at least one channel has program data, fall back to a small badge so
  // the user can interact with the grid while background ingestion continues.
  const hasAnyData = loadedIdsRef.current.size > 0;

  return <EpgGridLayout
    channel={channel}
    channelData={channelData}
    channels={channels}
    clockFormat={clockFormat}
    epgError={epgError}
    epgLoading={epgLoading}
    filteredChannels={filteredChannels}
    flashRef={flashRef}
    focusedId={focusedId}
    focusedInfo={focusedInfo}
    groups={groups}
    handleClose={handleClose}
    handleGroupSelect={handleGroupSelect}
    handleManualEpgRefresh={handleManualEpgRefresh}
    handleNativeChannelSelect={handleNativeChannelSelect}
    handleNativeOpenGroups={handleNativeOpenGroups}
    handleSettings={handleSettings}
    hasAnyData={hasAnyData}
    horizontalScrollXRef={horizontalScrollXRef}
    hScrollRef={hScrollRef}
    initFocusId={initFocusId}
    minTimelineX={minTimelineX}
    nativeDataVersion={nativeDataVersion}
    nativeGridFocusTrigger={nativeGridFocusTrigger}
    onTimelineScroll={(x) => setTimelineScrollX((previous) => Math.abs(previous - x) > 3 ? x : previous)}
    onViewableItemsChanged={onViewableItemsChanged}
    playlistId={playlist?.id ?? ''}
    playlistName={playlist?.name}
    renderItem={renderItem}
    selectedGroup={selectedGroup}
    setShowGroupRail={setShowGroupRail}
    closeGroupRail={closeGroupRail}
    showChannelNumbers={showChannelNumbers}
    showGroupRail={showGroupRail}
    syncTimelineScroll={syncTimelineScroll}
    theme={theme}
    timePos={timePos}
    timelineScrollX={timelineScrollX}
    useNativeGrid={USE_NATIVE_GRID}
    buildFocusedInfo={buildFocusedInfo}
  />;
};

export default EPGGridView;

// ─── Styles ───────────────────────────────────────────────────────────────────
