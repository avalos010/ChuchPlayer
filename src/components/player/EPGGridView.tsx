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
  StyleSheet,
  DeviceEventEmitter,
} from 'react-native';
import { Image } from 'expo-image';
import { FlashList, ListRenderItemInfo } from '@shopify/flash-list';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import FocusableItem from '../FocusableItem';
import { Channel, EPGProgram } from '../../types';
import { RootStackParamList } from '../../types';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useUIStore } from '../../store/useUIStore';
import { useThemeStore } from '../../store/useThemeStore';
import { groupChannelsByCategory } from '../../utils/m3uParser';
import NativeEpgGrid, { isNativeEpgGridAvailable } from './NativeEpgGrid';

const TV = Platform.OS === 'android';
const USE_NATIVE_GRID = isNativeEpgGridAvailable;

// ─── Info Panel ───────────────────────────────────────────────────────────────

interface FocusedInfo {
  channelId: string;
  channelName: string;
  channelNumber: number;
  programTitle?: string;
  programDesc?: string;
  programStart?: number;
  programEnd?: number;
}

const INFO_H = Platform.OS === 'android' ? 140 : 96;

const fmtAmPm = (ms?: number) => {
  if (!ms) return '';
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const EpgInfoPanel = memo<{
  info: FocusedInfo | null;
  channel: Channel | null;
  channels: Channel[];
  theme: any;
}>(({ info, channel, channels, theme }) => {
  const displayChannel = useMemo(() =>
    channels.find(c => c.id === (info?.channelId ?? channel?.id)) ?? channel,
    [channels, info?.channelId, channel],
  );

  const now = Date.now();
  const progStart = info?.programStart;
  const progEnd   = info?.programEnd;
  const progress  = (progStart && progEnd && progEnd > progStart)
    ? Math.min(Math.max((now - progStart) / (progEnd - progStart), 0), 1)
    : null;
  const remaining = progEnd ? Math.max(0, Math.round((progEnd - now) / 60000)) : null;

  const isLive = displayChannel?.id === channel?.id;
  const [imgErr, setImgErr] = useState(false);
  const initials = displayChannel?.name.substring(0, 2).toUpperCase() ?? '';

  const panelStyles = useMemo(() => ({
    panel: {
      height: INFO_H,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingHorizontal: TV ? 24 : 16,
      gap: TV ? 24 : 16,
    },
    logoBox: {
      width: TV ? 96 : 64,
      height: TV ? 96 : 64,
      borderRadius: 12,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      overflow: 'hidden' as const,
    },
    logoInitials: {
      color: theme.textMuted,
      fontSize: TV ? 22 : 16,
      fontWeight: '800' as const,
    },
  }), [theme]);

  return (
    <View style={panelStyles.panel}>
      {/* Logo */}
      <View style={panelStyles.logoBox}>
        {displayChannel?.logo && !imgErr ? (
          <Image
            source={{ uri: displayChannel.logo }}
            style={{ width: '100%', height: '100%' }}
            contentFit="contain"
            cachePolicy="disk"
            onError={() => setImgErr(true)}
          />
        ) : (
          <Text style={panelStyles.logoInitials}>{initials}</Text>
        )}
      </View>

      {/* Info */}
      <View style={{ flex: 1, gap: 4 }}>
        {/* Channel number + name row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {(info?.channelNumber ?? 0) > 0 && (
            <Text style={{ color: theme.accent, fontSize: TV ? 13 : 11, fontWeight: '800' }}>
              {info?.channelNumber}
            </Text>
          )}
          <Text style={{ color: theme.textMuted, fontSize: TV ? 13 : 11, fontWeight: '600' }} numberOfLines={1}>
            {displayChannel?.name ?? ''}
          </Text>
          {isLive && (
            <View style={{ backgroundColor: theme.accent, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
              <Text style={{ color: theme.accentText, fontSize: TV ? 10 : 8, fontWeight: '800', letterSpacing: 0.5 }}>
                LIVE
              </Text>
            </View>
          )}
        </View>

        {/* Program title */}
        <Text style={{ color: theme.text, fontSize: TV ? 20 : 15, fontWeight: '800', lineHeight: TV ? 26 : 20 }} numberOfLines={1}>
          {info?.programTitle ?? 'No guide data'}
        </Text>

        {/* Time range + remaining */}
        {progStart && progEnd ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ color: theme.textMuted, fontSize: TV ? 12 : 10, fontWeight: '500' }}>
              {fmtAmPm(progStart)} – {fmtAmPm(progEnd)}
            </Text>
            {remaining !== null && (
              <Text style={{ color: theme.textSub, fontSize: TV ? 12 : 10, fontWeight: '600' }}>
                {remaining} min
              </Text>
            )}
          </View>
        ) : null}

        {/* Progress bar */}
        {progress !== null && (
          <View style={{ height: 3, backgroundColor: theme.card, borderRadius: 2, marginTop: 2, overflow: 'hidden' }}>
            <View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: theme.accent, borderRadius: 2 }} />
          </View>
        )}
      </View>
    </View>
  );
});
EpgInfoPanel.displayName = 'EpgInfoPanel';

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
}

interface ChannelRowData {
  channel: Channel;
  isCurrent: boolean;
  programs: EPGProgram[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CH_COL  = TV ? 320 : 240;  // channel column px
const SLOT_W  = TV ? 200 : 140;  // 1-hour slot px
const ROW_H   = TV ? 140 : 90;   // unfocused row height (spacious)
const ROW_H_F = TV ? 220 : 145;  // focused row height (expanded)
const HDR_H   = TV ? 76 : 54;    // time header height

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
  const accent = useThemeStore((st) => st.theme.accent);
  const [imgErr, setImgErr] = useState(false);

  const initials   = useMemo(() => channel.name.substring(0, 2).toUpperCase(), [channel.name]);
  const handlePress = useCallback(() => onChannelSelect(channel), [channel, onChannelSelect]);
  const handleFocus = useCallback(() => onFocus?.(channel.id), [channel.id, onFocus]);
  const rowH = isFocused ? ROW_H_F : ROW_H;
  const logoSz = TV ? 68 : 44;

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

  const rowBg   = isCurrent ? '#172840' : '#0d1521';
  const lBorder = isCurrent ? accent : 'transparent';

  const focusedRowStyle = useMemo(() => ({
    backgroundColor: '#1a3d6b',  // strong blue — clearly visible
    borderLeftColor: accent,
    borderLeftWidth: 5,
    transform: [] as any[],
    elevation: 6,
  }), [accent]);

  return (
    <FocusableItem
      onPress={handlePress}
      onFocus={handleFocus}
      hasTVPreferredFocus={hasTVPreferredFocus}
      style={[s.row, { height: rowH, backgroundColor: rowBg, borderLeftColor: lBorder, paddingLeft: CH_COL }]}
      focusedStyle={focusedRowStyle}
    >
      {/* ── Program timeline ────────────────────── */}
      <View style={{ flex: 1, position: 'relative', minWidth: 48 * SLOT_W }}>
        {currentTimePosition !== undefined && (
          <View style={[s.timeLine, { left: currentTimePosition }]}>
            <View style={s.timeDot} />
          </View>
        )}

        {blocks.length > 0 ? blocks.map(b => {
          const blockBg     = b.isNow ? accent : (isFocused ? '#1e3558' : '#111b2a');
          const blockBorder = b.isNow ? accent : (isFocused ? '#2a4870' : '#1c2e42');
          const titleColor  = b.isNow ? '#ffffff' : (isFocused ? '#e8f0fa' : '#7090b0');
          const timeColor   = b.isNow ? '#ffffffAA' : (isFocused ? '#5a80a8' : '#3a5068');

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
        style={[s.chCol, { backgroundColor: isFocused ? '#1a3d6b' : (isCurrent ? '#162840' : '#0d1521') }]}
      >
        {channel.logo && !imgErr ? (
          <Image
            source={{ uri: channel.logo }}
            style={{ width: logoSz, height: logoSz, borderRadius: 8, backgroundColor: '#141414' }}
            contentFit="contain"
            cachePolicy="disk"
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
            numberOfLines={1}
          >
            {channel.name}
          </Text>
          {nowProgram && (
            <Text style={s.chNow} numberOfLines={1}>{nowProgram.title}</Text>
          )}
          {channel.catchupAvailable && (
            <View style={s.catchupBadge}>
              <Text style={s.catchupText}>◉ CATCHUP</Text>
            </View>
          )}
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
  epgLastUpdated = 0,
  handleManualEpgRefresh,
}) => {
  const theme        = useThemeStore((st) => st.theme);
  const showEPGGrid  = useUIStore((st) => st.showEPGGrid);
  const setShowEPGGrid = useUIStore((st) => st.setShowEPGGrid);
  const channels     = usePlayerStore((st) => st.channels);
  const channel      = usePlayerStore((st) => st.channel);
  const playlist     = usePlayerStore((st) => st.playlist);

  const [selectedGroup, setSelectedGroup] = useState('All');
  const flashRef      = useRef<FlashList<ChannelRowData>>(null);
  const hScrollRef    = useRef<ScrollView>(null);
  const groupScrollRef = useRef<ScrollView>(null);
  const [focusedId, setFocusedId]       = useState<string | null>(null);
  const [initFocusId, setInitFocusId]   = useState<string | null>(null);
  const [timePos, setTimePos]           = useState(0);
  const loadedIdsRef = useRef<Set<string>>(new Set());
  const [epgVersion, setEpgVersion]     = useState(0);
  const [focusedInfo, setFocusedInfo]   = useState<FocusedInfo | null>(null);

  // Keep a stable ref to the current channel's group so the open-effect
  // can read it without taking `channel` as a dep (avoids scroll-jump loops).
  const currentChannelGroupRef = useRef(channel?.group);
  currentChannelGroupRef.current = channel?.group;

  // When the EPG opens, switch the group filter to the playing channel's group
  // so the user immediately sees their channel's playlist section.
  useEffect(() => {
    if (!showEPGGrid) return;
    const group = currentChannelGroupRef.current;
    setSelectedGroup(group && group.trim() ? group : 'All');
  }, [showEPGGrid]);

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

  const groups = useMemo(() => {
    if (!channels?.length) return ['All'];
    const g = groupChannelsByCategory(channels);
    return ['All', ...Array.from(g.keys()).sort()];
  }, [channels]);

  // Scroll group tab bar to the active tab when selection changes
  useEffect(() => {
    const idx = groups.indexOf(selectedGroup);
    if (idx < 0) return;
    const TAB_W = TV ? 100 : 76; // approximate tab width including gap
    setTimeout(() => {
      groupScrollRef.current?.scrollTo({ x: Math.max(0, idx * TAB_W - 40), animated: true });
    }, 80);
  }, [selectedGroup, groups]);

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
    setTimeout(() => { try { navigation?.navigate('Settings', { focusTarget: 'epg' }); } catch {} }, 100);
  }, [setShowEPGGrid, onExitPIP, navigation]);

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
    />
  ), [onChannelSelect, handleRowFocus, focusedId, initFocusId, timePos]);

  const keyExtractor = useCallback((item: ChannelRowData) => item.channel.id, []);

  if (!showEPGGrid || !channels.length || !navigation) return null;

  // Only show the blocking overlay when we genuinely have nothing to display.
  // Once at least one channel has program data, fall back to a small badge so
  // the user can interact with the grid while background ingestion continues.
  const hasAnyData = loadedIdsRef.current.size > 0;

  return (
    <View style={s.root}>
      {/* ── Info panel ───────────────────────────────────────────────── */}
      <EpgInfoPanel
        info={focusedInfo}
        channel={channel}
        channels={channels}
        theme={theme}
      />

      {/* ── Full-screen loading overlay (only when no data at all) ────── */}
      {epgLoading && !hasAnyData && (
        <View pointerEvents="none" style={s.loadingOverlay}>
          <ActivityIndicator size="large" color="#555555" />
          <Text style={s.loadingTxt}>Loading program guide…</Text>
        </View>
      )}

      {/* ── Inline loading badge (when data exists but more is loading) ─ */}
      {epgLoading && hasAnyData && (
        <View pointerEvents="none" style={s.loadingBadge}>
          <ActivityIndicator size="small" color="#888" />
          <Text style={s.loadingBadgeTxt}>Updating guide…</Text>
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
          {handleManualEpgRefresh && !epgLoading && (
            <FocusableItem onPress={handleManualEpgRefresh} style={s.hBtn} focusedStyle={HDR_BTN_FOCUSED}>
              <Text style={s.hBtnIcon}>↺</Text>
            </FocusableItem>
          )}
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
            ref={groupScrollRef}
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
                  style={[s.groupTab, active && s.groupTabActive]}
                  focusedStyle={{ backgroundColor: '#1f1f1f', borderColor: theme.accent, borderWidth: 2, transform: [], elevation: 4 }}
                >
                  <Text style={[s.groupTabTxt, active && { color: theme.accent }]}>{g}</Text>
                  {active ? <View style={[s.groupTabLine, { backgroundColor: theme.accent }]} /> : null}
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
      {USE_NATIVE_GRID && playlist ? (
        <NativeEpgGrid
          style={{ flex: 1 }}
          playlistId={playlist.id}
          channels={filteredChannels}
          currentChannelId={channel?.id}
          accentColor={theme.accent}
          bgColor={theme.bg}
          dataVersion={epgLastUpdated}
          onChannelSelect={(channelId) => {
            const ch = channels.find((c) => c.id === channelId);
            if (ch) onChannelSelect(ch);
          }}
        />
      ) : (
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
      )}
    </View>
  );
};

export default EPGGridView;

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0d1521',
    zIndex: 25,
    elevation: 25,
  },

  // Loading
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40, elevation: 40,
    backgroundColor: 'rgba(9,15,24,0.92)',
    justifyContent: 'center', alignItems: 'center', gap: 12,
  },
  loadingTxt: { color: '#607898', fontSize: TV ? 17 : 14, fontWeight: '600' },

  loadingBadge: {
    position: 'absolute',
    top: TV ? 24 : 18, right: TV ? 24 : 18,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(13,21,33,0.95)',
    borderWidth: 1, borderColor: '#1e2e42',
    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6,
    zIndex: 45, elevation: 45,
  },
  loadingBadgeTxt: { color: '#607898', fontSize: TV ? 12 : 11, fontWeight: '600' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: TV ? 28 : 20,
    paddingVertical: TV ? 18 : 14,
    backgroundColor: '#090f18',
    borderBottomWidth: 1, borderBottomColor: '#1e2e42',
  },
  headerTitle: {
    color: '#e8f0fa',
    fontSize: TV ? 26 : 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSub: {
    color: '#405878',
    fontSize: TV ? 14 : 11,
    fontWeight: '500',
    marginTop: 3,
  },
  headerBtns: { flexDirection: 'row', gap: 10 },
  hBtn: {
    width: TV ? 50 : 42, height: TV ? 50 : 42,
    borderRadius: TV ? 12 : 10,
    backgroundColor: '#111d2e', borderWidth: 1, borderColor: '#1e2e42',
    justifyContent: 'center', alignItems: 'center',
  },
  hBtnClose: { backgroundColor: '#0e1928', borderColor: '#1a2838' },
  hBtnIcon: { color: '#607898', fontSize: TV ? 20 : 17, fontWeight: '700' },

  // Group tabs
  groupBar: {
    backgroundColor: '#090f18',
    paddingHorizontal: TV ? 24 : 16,
    paddingBottom: TV ? 14 : 10,
    borderBottomWidth: 1, borderBottomColor: '#1e2e42',
  },
  groupTab: {
    paddingHorizontal: TV ? 18 : 12,
    paddingVertical: TV ? 8 : 6,
    borderRadius: 8,
    backgroundColor: '#111d2e',
    borderWidth: 1, borderColor: '#1e2e42',
    alignItems: 'center',
    minWidth: TV ? 80 : 60,
  },
  groupTabActive: { backgroundColor: '#1a3558', borderColor: '#2a4870' },
  groupTabTxt: { color: '#507090', fontSize: TV ? 13 : 11, fontWeight: '700' },
  groupTabTxtActive: { color: '#e5e5e5' },
  groupTabLine: {
    width: 16, height: 2, borderRadius: 1,
    backgroundColor: '#1b90ff', marginTop: 4,
  },

  // Error banner
  errBanner: {
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(239,68,68,0.25)',
    paddingHorizontal: TV ? 28 : 20, paddingVertical: 10,
  },
  errTxt: { color: '#f87171', fontSize: TV ? 14 : 12, fontWeight: '500' },

  // Time header
  timeHeader: {
    height: HDR_H,
    backgroundColor: '#090f18',
    borderBottomWidth: 1, borderBottomColor: '#1e2e42',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  timeSlot: {
    width: SLOT_W, height: HDR_H,
    justifyContent: 'center', alignItems: 'center',
    borderRightWidth: 1, borderRightColor: '#1e2e42',
  },
  timeSlotNow: { backgroundColor: 'rgba(27,144,255,0.07)' },
  timeText:    { color: '#607898', fontSize: TV ? 13 : 10, fontWeight: '600', letterSpacing: 0.5 },
  timeTextNow: { color: '#1b90ff' },
  timeChLabel: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: CH_COL,
    borderRightWidth: 1, borderRightColor: '#1e2e42',
    backgroundColor: '#0d1521',
    justifyContent: 'center', paddingHorizontal: TV ? 20 : 14, zIndex: 8,
  },
  timeChLabelTxt: { color: '#405878', fontSize: TV ? 10 : 8, fontWeight: '800', letterSpacing: 2 },

  // Row
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: '#141e2d',
    borderLeftWidth: 5, overflow: 'hidden',
  },

  // Program blocks
  block: {
    position: 'absolute', borderRadius: 6, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 8,
    justifyContent: 'center', overflow: 'hidden',
  },
  blockTitle: { fontSize: TV ? 15 : 12, fontWeight: '700', lineHeight: TV ? 21 : 16 },
  blockTime:  { fontSize: TV ? 12 : 10, fontWeight: '500', marginTop: 3 },
  blockDesc:  { color: '#5a88b0', fontSize: TV ? 12 : 9, marginTop: 5, lineHeight: TV ? 17 : 13 },
  noData: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  noDataText: { color: '#304050', fontSize: TV ? 12 : 10, fontWeight: '600' },

  // Current time line (accent blue, not red)
  timeLine: {
    position: 'absolute', top: 0, bottom: 0,
    width: 2.5, backgroundColor: '#1b90ff', zIndex: 20,
  },
  timeDot: {
    position: 'absolute', top: -4, left: -5,
    width: 11, height: 11, borderRadius: 6,
    backgroundColor: '#1b90ff', borderWidth: 2, borderColor: '#0d1521',
  },

  // Channel column
  chCol: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: CH_COL,
    borderRightWidth: 1, borderRightColor: '#1e2e42',
    zIndex: 6, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: TV ? 16 : 10, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.7, shadowRadius: 12, elevation: 8,
  },
  chMeta: { flex: 1 },
  chName: {
    color: '#adbece',
    fontSize: TV ? 14 : 12,
    fontWeight: '700',
    lineHeight: TV ? 20 : 16,
    marginBottom: 2,
  },
  chNow:  { color: '#5888aa', fontSize: TV ? 11 : 9, fontWeight: '500' },
  chGroup:{ color: '#405060', fontSize: TV ? 10 : 8, fontWeight: '500', marginTop: 1 },
  logoFallback: {
    borderRadius: 8, backgroundColor: '#182840',
    borderWidth: 1, borderColor: '#243650',
    justifyContent: 'center', alignItems: 'center',
  },
  logoInitials: { color: '#7898b8', fontSize: TV ? 15 : 12, fontWeight: '800' },
  onNowBadge: {
    position: 'absolute', bottom: 6, right: 8,
    backgroundColor: '#ef4444', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  onNowText: { color: '#ffffff', fontSize: TV ? 9 : 7, fontWeight: '800', letterSpacing: 0.5 },
  catchupBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#1a3550',
    borderRadius: 3,
    paddingHorizontal: 5, paddingVertical: 1,
    marginTop: 3,
  },
  catchupText: { color: '#5aaad0', fontSize: TV ? 9 : 7, fontWeight: '800', letterSpacing: 0.3 },
});
