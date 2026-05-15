import React, {
  useCallback,
  useState,
  useMemo,
  memo,
  useRef,
  useEffect,
} from 'react';
import {
  View,
  Text,
  ScrollView,
  Platform,
  ActivityIndicator,
  Image,
  StyleSheet,
} from 'react-native';
import { FlashList, ListRenderItemInfo } from '@shopify/flash-list';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import FocusableItem from '../FocusableItem';
import { Channel, EPGProgram } from '../../types';
import { RootStackParamList } from '../../types';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useUIStore } from '../../store/useUIStore';
import { groupChannelsByCategory } from '../../utils/m3uParser';

interface EPGGridViewProps {
  getCurrentProgram: (channelId: string) => EPGProgram | null;
  getProgramsForChannel?: (channelId: string) => EPGProgram[];
  prefetchProgramsForChannels?: (channelIds: string[]) => void;
  onChannelSelect: (channel: Channel) => void;
  onExitPIP?: () => void;
  navigation?: NativeStackNavigationProp<RootStackParamList>;
  epgLoading?: boolean;
  epgError?: string | null;
  handleManualEpgRefresh?: () => void;
}

interface ChannelRowData {
  channel: Channel;
  isCurrent: boolean;
  programs: EPGProgram[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TV = Platform.OS === 'android';
const CH_COL  = TV ? 300 : 240;  // channel column px
const SLOT_W  = TV ? 180 : 140;  // 1-hour slot px
const ROW_H   = TV ? 110 : 90;   // unfocused row height
const ROW_H_F = TV ? 168 : 145;  // focused row height
const HDR_H   = TV ? 68 : 54;    // time header height

const HDR_BTN_FOCUSED = {
  backgroundColor: '#ffffff',
  borderColor: '#ffffff',
  borderWidth: 2,
  transform: [] as any[],
  elevation: 6,
  shadowColor: '#ffffff',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.2,
  shadowRadius: 8,
};

const GROUP_TAB_FOCUSED = {
  backgroundColor: '#1f1f1f',
  borderColor: '#e5e5e5',
  borderWidth: 2,
  transform: [] as any[],
  elevation: 4,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtTime = (d?: Date | null) => {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// ─── Channel Row ─────────────────────────────────────────────────────────────

const ChannelRow = memo<{
  data: ChannelRowData;
  onChannelSelect: (ch: Channel) => void;
  onFocus?: (id: string) => void;
  isFocused?: boolean;
  hasTVPreferredFocus?: boolean;
  currentTimePosition?: number;
}>(({ data, onChannelSelect, onFocus, isFocused = false, hasTVPreferredFocus = false, currentTimePosition }) => {
  const { channel, isCurrent, programs } = data;
  const [imgErr, setImgErr] = useState(false);

  const initials   = useMemo(() => channel.name.substring(0, 2).toUpperCase(), [channel.name]);
  const handlePress = useCallback(() => onChannelSelect(channel), [channel, onChannelSelect]);
  const handleFocus = useCallback(() => onFocus?.(channel.id), [channel.id, onFocus]);
  const rowH = isFocused ? ROW_H_F : ROW_H;
  const logoSz = TV ? 56 : 44;

  const nowProgram = useMemo(() => {
    const now = new Date();
    return programs.find(p => p.start <= now && p.end > now) ?? null;
  }, [programs]);

  const blocks = useMemo(() => {
    if (!programs.length) return [];
    const now = new Date();
    return programs
      .map(p => {
        const durH = (p.end.getTime() - p.start.getTime()) / 3_600_000;
        const hoursFromNow = (p.start.getTime() - now.getTime()) / 3_600_000;
        const left = 12 * SLOT_W + hoursFromNow * SLOT_W;
        const width = Math.max(durH * SLOT_W, 72);
        const isNow = p.start <= now && p.end > now;
        return { p, left, width, isNow };
      })
      .filter(b => b.left >= -SLOT_W && b.left <= 48 * SLOT_W);
  }, [programs]);

  // Row background: focused = near-white overlay, current channel = slightly lighter dark, else pure dark
  const rowBg   = isFocused ? '#1c1c1c' : isCurrent ? '#161616' : '#0e0e0e';
  const lBorder = isFocused ? '#ffffff' : isCurrent ? '#3d3d3d' : '#181818';

  return (
    <FocusableItem
      onPress={handlePress}
      onFocus={handleFocus}
      hasTVPreferredFocus={hasTVPreferredFocus}
      style={[s.row, { height: rowH, backgroundColor: rowBg, borderLeftColor: lBorder, paddingLeft: CH_COL }]}
      focusedStyle={{
        backgroundColor: '#1c1c1c',
        borderLeftColor: '#ffffff',
        borderLeftWidth: 3,
        transform: [],
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 6,
      }}
    >
      {/* ── Program timeline ────────────────────── */}
      <View style={{ flex: 1, position: 'relative', minWidth: 48 * SLOT_W }}>
        {currentTimePosition !== undefined && (
          <View style={[s.timeLine, { left: currentTimePosition }]}>
            <View style={s.timeDot} />
          </View>
        )}

        {blocks.length > 0 ? blocks.map(b => {
          // Current program: white bg with dark text. Others: dark surface with gray text.
          const blockBg     = b.isNow ? '#f5f5f5' : (isFocused ? '#252525' : '#181818');
          const blockBorder = b.isNow ? '#e5e5e5' : '#232323';
          const titleColor  = b.isNow ? '#0a0a0a' : (isFocused ? '#d4d4d4' : '#737373');
          const timeColor   = b.isNow ? '#4a4a4a' : '#3d3d3d';

          return (
            <View
              key={b.p.id}
              style={[s.block, {
                left: Math.max(0, b.left),
                width: b.width,
                backgroundColor: blockBg,
                borderColor: blockBorder,
                top: 8, bottom: 8,
              }]}
            >
              <Text style={[s.blockTitle, { color: titleColor }]} numberOfLines={isFocused ? 2 : 1}>
                {b.p.title}
              </Text>
              <Text style={[s.blockTime, { color: timeColor }]}>
                {fmtTime(b.p.start)} – {fmtTime(b.p.end)}
              </Text>
              {isFocused && b.isNow && typeof b.p.description === 'string' && b.p.description.trim() ? (
                <Text style={s.blockDesc} numberOfLines={2}>{b.p.description.trim()}</Text>
              ) : null}
            </View>
          );
        }) : (
          <View style={s.noData}>
            <Text style={s.noDataText}>No guide data</Text>
          </View>
        )}
      </View>

      {/* ── Fixed channel column ─────────────────── */}
      <View
        pointerEvents="none"
        style={[s.chCol, { backgroundColor: isFocused ? '#141414' : '#0a0a0a' }]}
      >
        {channel.logo && !imgErr ? (
          <Image
            source={{ uri: channel.logo }}
            style={{ width: logoSz, height: logoSz, borderRadius: 8, backgroundColor: '#141414' }}
            resizeMode="contain"
            onError={() => setImgErr(true)}
          />
        ) : (
          <View style={[s.logoFallback, { width: logoSz, height: logoSz }]}>
            <Text style={[s.logoInitials, isFocused && { color: '#f5f5f5' }]}>{initials}</Text>
          </View>
        )}

        <View style={s.chMeta}>
          <Text
            style={[s.chName, isFocused && { color: '#f5f5f5' }]}
            numberOfLines={2}
          >
            {channel.name}
          </Text>
          {nowProgram && (
            <Text style={s.chNow} numberOfLines={1}>{nowProgram.title}</Text>
          )}
          {channel.group ? (
            <Text style={s.chGroup} numberOfLines={1}>{channel.group}</Text>
          ) : null}
        </View>

        {isCurrent && (
          <View style={s.onNowBadge}>
            <Text style={s.onNowText}>ON NOW</Text>
          </View>
        )}
      </View>
    </FocusableItem>
  );
}, (prev, next) =>
  prev.data.channel.id   === next.data.channel.id   &&
  prev.data.isCurrent    === next.data.isCurrent    &&
  prev.data.programs.length === next.data.programs.length &&
  prev.isFocused         === next.isFocused         &&
  prev.hasTVPreferredFocus === next.hasTVPreferredFocus &&
  prev.currentTimePosition === next.currentTimePosition &&
  prev.onFocus           === next.onFocus,
);
ChannelRow.displayName = 'ChannelRow';

// ─── Time Header ─────────────────────────────────────────────────────────────

const TimeHeader = memo<{ currentTimePosition?: number }>(({ currentTimePosition }) => {
  const slots = useMemo(() => {
    const now = new Date();
    const cur = now.getHours();
    return Array.from({ length: 48 }, (_, i) => {
      const h = ((cur - 12 + i) % 24 + 24) % 24;
      return { id: i, h, isCurrent: i === 12 };
    });
  }, []);

  return (
    <View style={[s.timeHeader, { paddingLeft: CH_COL }]}>
      <View style={{ flexDirection: 'row' }}>
        {slots.map(slot => (
          <View
            key={slot.id}
            style={[s.timeSlot, slot.isCurrent && s.timeSlotNow]}
          >
            <Text style={[s.timeText, slot.isCurrent && s.timeTextNow]}>
              {slot.h.toString().padStart(2, '0')}:00
            </Text>
          </View>
        ))}
      </View>

      {currentTimePosition !== undefined && (
        <View style={[s.timeLine, {
          left: currentTimePosition + CH_COL,
          top: 0, bottom: 0,
          position: 'absolute',
        }]}>
          <View style={s.timeDot} />
        </View>
      )}

      {/* Sticky "CHANNELS" label */}
      <View pointerEvents="none" style={s.timeChLabel}>
        <Text style={s.timeChLabelTxt}>CHANNELS</Text>
      </View>
    </View>
  );
});
TimeHeader.displayName = 'TimeHeader';

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
}) => {
  const showEPGGrid  = useUIStore((st) => st.showEPGGrid);
  const setShowEPGGrid = useUIStore((st) => st.setShowEPGGrid);
  const channels     = usePlayerStore((st) => st.channels);
  const channel      = usePlayerStore((st) => st.channel);
  const playlist     = usePlayerStore((st) => st.playlist);

  const [selectedGroup, setSelectedGroup] = useState('All');
  const flashRef    = useRef<FlashList<ChannelRowData>>(null);
  const hScrollRef  = useRef<ScrollView>(null);
  const [focusedId, setFocusedId]       = useState<string | null>(null);
  const [initFocusId, setInitFocusId]   = useState<string | null>(null);
  const [timePos, setTimePos]           = useState(0);
  const [loadedIds, setLoadedIds]       = useState<Set<string>>(new Set());

  // Update current time position every 5 min
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimePos(12 * SLOT_W + (now.getMinutes() / 60) * SLOT_W);
    };
    update();
    const id = setInterval(update, 300_000);
    return () => clearInterval(id);
  }, []);

  // Scroll to current time when grid opens
  useEffect(() => {
    if (showEPGGrid && hScrollRef.current && timePos > 0) {
      setTimeout(() => {
        hScrollRef.current?.scrollTo({ x: Math.max(0, timePos - 24), animated: false });
      }, 200);
    }
  }, [showEPGGrid, timePos]);

  const handleClose = useCallback(() => {
    setShowEPGGrid(false);
    onExitPIP?.();
  }, [setShowEPGGrid, onExitPIP]);

  const handleSettings = useCallback(() => {
    setShowEPGGrid(false);
    onExitPIP?.();
    setTimeout(() => { try { navigation?.navigate('Settings'); } catch {} }, 100);
  }, [setShowEPGGrid, onExitPIP, navigation]);

  const groups = useMemo(() => {
    if (!channels?.length) return ['All'];
    const g = groupChannelsByCategory(channels);
    return ['All', ...Array.from(g.keys()).sort()];
  }, [channels]);

  const filteredChannels = useMemo(() => {
    if (!channels?.length) return [];
    if (selectedGroup === 'All') return channels.filter(Boolean);
    return channels.filter(ch => ch?.group === selectedGroup);
  }, [channels, selectedGroup]);

  const loadEpgFor = useCallback((ids: string[]) => {
    if (!ids.length || !prefetchProgramsForChannels) return;
    const toLoad = ids.filter(id => !loadedIds.has(id));
    if (toLoad.length) {
      prefetchProgramsForChannels(toLoad);
      setLoadedIds(prev => new Set([...prev, ...toLoad]));
    }
  }, [loadedIds, prefetchProgramsForChannels]);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: any[] }) => {
    const visIds: string[] = viewableItems.map((i: any) => i.item.channel.id);
    loadEpgFor(visIds);
    const allIds = filteredChannels.map(c => c.id);
    visIds.forEach(vid => {
      const idx = allIds.indexOf(vid);
      if (idx !== -1) loadEpgFor(allIds.slice(Math.max(0, idx - 5), idx + 6));
    });
  }, [filteredChannels, loadEpgFor]);

  const channelData = useMemo<ChannelRowData[]>(() =>
    filteredChannels.map(ch => ({
      channel: ch,
      isCurrent: ch.id === channel?.id,
      programs: loadedIds.has(ch.id) && getProgramsForChannel
        ? getProgramsForChannel(ch.id)
        : [],
    })),
    [filteredChannels, channel?.id, loadedIds, getProgramsForChannel],
  );

  useEffect(() => { setLoadedIds(new Set()); }, [selectedGroup]);

  useEffect(() => {
    if (showEPGGrid && filteredChannels.length > 0) {
      loadEpgFor(filteredChannels.slice(0, 12).map(c => c.id));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEPGGrid, selectedGroup]);

  useEffect(() => {
    if (!showEPGGrid) { setFocusedId(null); setInitFocusId(null); return; }
    const fid = channel?.id ?? channelData[0]?.channel.id ?? null;
    if (!fid) return;
    setFocusedId(fid);
    setInitFocusId(fid);
    const idx = channelData.findIndex(d => d.channel.id === fid);
    if (idx >= 0) {
      setTimeout(() => {
        flashRef.current?.scrollToIndex({ index: idx, animated: false, viewPosition: 0.3 });
      }, 150);
    }
  }, [showEPGGrid, channel?.id, selectedGroup, channelData]);

  const handleRowFocus = useCallback((id: string) => {
    setFocusedId(id);
    const idx = channelData.findIndex(d => d.channel.id === id);
    if (idx >= 0) {
      flashRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.3 });
    }
  }, [channelData]);

  const renderItem = useCallback(({ item }: ListRenderItemInfo<ChannelRowData>) => (
    <ChannelRow
      data={item}
      onChannelSelect={onChannelSelect}
      onFocus={handleRowFocus}
      isFocused={item.channel.id === focusedId}
      hasTVPreferredFocus={item.channel.id === initFocusId}
      currentTimePosition={timePos}
    />
  ), [onChannelSelect, handleRowFocus, focusedId, initFocusId, timePos]);

  const keyExtractor = useCallback((item: ChannelRowData) => item.channel.id, []);

  if (!showEPGGrid || !channels.length || !navigation) return null;

  return (
    <View style={s.root}>
      {/* ── Loading overlay ───────────────────────── */}
      {epgLoading && (
        <View pointerEvents="none" style={s.loadingOverlay}>
          <ActivityIndicator size="large" color="#555555" />
          <Text style={s.loadingTxt}>Loading program guide…</Text>
        </View>
      )}

      {/* ── Header ───────────────────────────────── */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Program Guide</Text>
          {playlist?.name ? (
            <Text style={s.headerSub}>{playlist.name}</Text>
          ) : null}
        </View>
        <View style={s.headerBtns}>
          <FocusableItem onPress={handleSettings} style={s.hBtn} focusedStyle={HDR_BTN_FOCUSED}>
            <Text style={s.hBtnIcon}>⚙</Text>
          </FocusableItem>
          <FocusableItem onPress={handleClose} style={[s.hBtn, s.hBtnClose]} focusedStyle={HDR_BTN_FOCUSED}>
            <Text style={[s.hBtnIcon, { color: '#737373' }]}>✕</Text>
          </FocusableItem>
        </View>
      </View>

      {/* ── Group filter ─────────────────────────── */}
      {groups.length > 1 && (
        <View style={s.groupBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}
          >
            {groups.map((g, idx) => {
              const active = selectedGroup === g;
              return (
                <FocusableItem
                  key={g}
                  onPress={() => setSelectedGroup(g)}
                  hasTVPreferredFocus={idx === 0 && showEPGGrid}
                  style={[s.groupTab, active && s.groupTabActive]}
                  focusedStyle={GROUP_TAB_FOCUSED}
                >
                  <Text style={[s.groupTabTxt, active && s.groupTabTxtActive]}>{g}</Text>
                  {active ? <View style={s.groupTabLine} /> : null}
                </FocusableItem>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── Error banner ─────────────────────────── */}
      {!epgLoading && epgError && (
        <View pointerEvents="none" style={s.errBanner}>
          <Text style={s.errTxt}>⚠  {epgError}</Text>
        </View>
      )}

      {/* ── Grid ─────────────────────────────────── */}
      <ScrollView
        ref={hScrollRef}
        style={{ flex: 1 }}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={32}
      >
        <View style={{ flex: 1 }}>
          <TimeHeader currentTimePosition={timePos} />
          <View style={{ flex: 1 }}>
            <FlashList
              ref={flashRef}
              data={channelData}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              estimatedItemSize={ROW_H}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={TV}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={{ itemVisiblePercentThreshold: 40, minimumViewTime: 250 }}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default EPGGridView;

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0a0a',
    zIndex: 25,
    elevation: 25,
  },

  // Loading
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40, elevation: 40,
    backgroundColor: 'rgba(10,10,10,0.88)',
    justifyContent: 'center', alignItems: 'center', gap: 12,
  },
  loadingTxt: { color: '#555555', fontSize: TV ? 17 : 14, fontWeight: '600' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: TV ? 28 : 20,
    paddingVertical: TV ? 18 : 14,
    backgroundColor: '#0d0d0d',
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  headerTitle: {
    color: '#f5f5f5',
    fontSize: TV ? 26 : 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSub: {
    color: '#3d3d3d',
    fontSize: TV ? 14 : 11,
    fontWeight: '500',
    marginTop: 3,
  },
  headerBtns: { flexDirection: 'row', gap: 10 },
  hBtn: {
    width: TV ? 50 : 42, height: TV ? 50 : 42,
    borderRadius: TV ? 12 : 10,
    backgroundColor: '#161616', borderWidth: 1, borderColor: '#222222',
    justifyContent: 'center', alignItems: 'center',
  },
  hBtnClose: { backgroundColor: '#141414', borderColor: '#1f1f1f' },
  hBtnIcon: { color: '#8a8a8a', fontSize: TV ? 20 : 17, fontWeight: '700' },

  // Group tabs
  groupBar: {
    backgroundColor: '#0d0d0d',
    paddingHorizontal: TV ? 24 : 16,
    paddingBottom: TV ? 14 : 10,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  groupTab: {
    paddingHorizontal: TV ? 22 : 14,
    paddingVertical: TV ? 11 : 7,
    borderRadius: 10,
    backgroundColor: '#111111',
    borderWidth: 1, borderColor: '#1e1e1e',
    alignItems: 'center',
    minWidth: TV ? 100 : 72,
  },
  groupTabActive: { backgroundColor: '#181818', borderColor: '#333333' },
  groupTabTxt: { color: '#3d3d3d', fontSize: TV ? 14 : 11, fontWeight: '600' },
  groupTabTxtActive: { color: '#e5e5e5' },
  groupTabLine: {
    width: 20, height: 2, borderRadius: 1,
    backgroundColor: '#e5e5e5', marginTop: 5,
  },

  // Error banner
  errBanner: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(239,68,68,0.2)',
    paddingHorizontal: TV ? 28 : 20, paddingVertical: 10,
  },
  errTxt: { color: '#f87171', fontSize: TV ? 14 : 12, fontWeight: '500' },

  // Time header
  timeHeader: {
    height: HDR_H,
    backgroundColor: '#0d0d0d',
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  timeSlot: {
    width: SLOT_W, height: HDR_H,
    justifyContent: 'center', alignItems: 'center',
    borderRightWidth: 1, borderRightColor: '#181818',
  },
  timeSlotNow: { backgroundColor: 'rgba(255,255,255,0.03)' },
  timeText:    { color: '#333333', fontSize: TV ? 13 : 10, fontWeight: '600', letterSpacing: 0.5 },
  timeTextNow: { color: '#a3a3a3' },
  timeChLabel: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: CH_COL,
    borderRightWidth: 1, borderRightColor: '#1a1a1a',
    backgroundColor: '#0a0a0a',
    justifyContent: 'center', paddingHorizontal: TV ? 20 : 14, zIndex: 8,
  },
  timeChLabelTxt: { color: '#252525', fontSize: TV ? 10 : 8, fontWeight: '800', letterSpacing: 2.5 },

  // Row
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: '#111111',
    borderLeftWidth: 3, overflow: 'hidden',
  },

  // Program blocks
  block: {
    position: 'absolute', borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 6,
    justifyContent: 'center', overflow: 'hidden',
  },
  blockTitle: { fontSize: TV ? 14 : 12, fontWeight: '700', lineHeight: TV ? 19 : 16 },
  blockTime:  { fontSize: TV ? 11 : 10, fontWeight: '500', marginTop: 2 },
  blockDesc:  { color: '#5a5a5a', fontSize: TV ? 11 : 9, marginTop: 4, lineHeight: TV ? 16 : 13 },
  noData: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  noDataText: { color: '#252525', fontSize: TV ? 12 : 10, fontWeight: '600' },

  // Current time line
  timeLine: {
    position: 'absolute', top: 0, bottom: 0,
    width: 1, backgroundColor: '#e5e5e5', zIndex: 20,
  },
  timeDot: {
    position: 'absolute', top: -4, left: -5,
    width: 11, height: 11, borderRadius: 6,
    backgroundColor: '#e5e5e5', borderWidth: 2, borderColor: '#0a0a0a',
  },

  // Channel column
  chCol: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: CH_COL,
    borderRightWidth: 1, borderRightColor: '#181818',
    zIndex: 6, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: TV ? 14 : 10, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 10, elevation: 6,
  },
  chMeta: { flex: 1 },
  chName: {
    color: '#8a8a8a',
    fontSize: TV ? 15 : 12,
    fontWeight: '700',
    lineHeight: TV ? 20 : 17,
    marginBottom: 3,
  },
  chNow:  { color: '#3d3d3d', fontSize: TV ? 11 : 9, fontWeight: '500' },
  chGroup:{ color: '#252525', fontSize: TV ? 10 : 8, fontWeight: '500', marginTop: 2 },
  logoFallback: {
    borderRadius: 8, backgroundColor: '#141414',
    borderWidth: 1, borderColor: '#1f1f1f',
    justifyContent: 'center', alignItems: 'center',
  },
  logoInitials: { color: '#333333', fontSize: TV ? 16 : 13, fontWeight: '800' },
  onNowBadge: {
    position: 'absolute', bottom: 8, right: 10,
    backgroundColor: '#e5e5e5', borderRadius: 5,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  onNowText: { color: '#0a0a0a', fontSize: TV ? 9 : 7, fontWeight: '800', letterSpacing: 1 },
});
