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
import { isTvLikePlatform } from '../../utils/platform';
import { formatClockTime } from '../../utils/time';
import NativeEpgGrid, { isNativeEpgGridAvailable } from './NativeEpgGrid';

const KeyEvent = Platform.OS === 'android'
  ? (require('react-native-keyevent').default ?? require('react-native-keyevent'))
  : null;

const TV = isTvLikePlatform;
const USE_NATIVE_GRID = Platform.OS === 'android' && TV && isNativeEpgGridAvailable;

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

const INFO_H = TV ? 108 : 84;

const fmtAmPm = (ms?: number, clockFormat: '12h' | '24h' = '24h') =>
  formatClockTime(ms, clockFormat, { hour: 'numeric', minute: '2-digit' });

const EpgInfoPanel = memo<{
  info: FocusedInfo | null;
  channel: Channel | null;
  channels: Channel[];
  theme: any;
  showChannelNumbers: boolean;
  clockFormat: '12h' | '24h';
}>(({ info, channel, channels, theme, showChannelNumbers, clockFormat }) => {
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

  useEffect(() => {
    setImgErr(false);
  }, [displayChannel?.id]);

  const panelStyles = useMemo(() => ({
    panel: {
      height: INFO_H,
      backgroundColor: '#070b12',
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(148, 163, 184, 0.16)',
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingHorizontal: TV ? 22 : 16,
      gap: TV ? 18 : 14,
    },
    logoBox: {
      width: TV ? 72 : 56,
      height: TV ? 72 : 56,
      borderRadius: 10,
      backgroundColor: '#111827',
      borderWidth: 1,
      borderColor: 'rgba(148, 163, 184, 0.18)',
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      overflow: 'hidden' as const,
    },
    logoInitials: {
      color: '#93a4b8',
      fontSize: TV ? 18 : 14,
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
          {showChannelNumbers && (info?.channelNumber ?? 0) > 0 && (
            <Text style={{ color: theme.accent, fontSize: TV ? 13 : 11, fontWeight: '800' }}>
              {info?.channelNumber}
            </Text>
          )}
          <Text style={{ color: '#dbeafe', fontSize: TV ? 14 : 12, fontWeight: '800' }} numberOfLines={1}>
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
        <Text style={{ color: '#f8fafc', fontSize: TV ? 18 : 15, fontWeight: '900', lineHeight: TV ? 23 : 20 }} numberOfLines={1}>
          {info?.programTitle ?? 'No guide data'}
        </Text>

        {/* Time range + remaining */}
        {progStart && progEnd ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ color: '#8fb9e8', fontSize: TV ? 12 : 10, fontWeight: '700' }}>
              {fmtAmPm(progStart, clockFormat)} – {fmtAmPm(progEnd, clockFormat)}
            </Text>
            {remaining !== null && (
              <Text style={{ color: '#cbd5e1', fontSize: TV ? 12 : 10, fontWeight: '700' }}>
                {remaining} min
              </Text>
            )}
          </View>
        ) : null}

        {/* Progress bar */}
        {progress !== null && (
          <View style={{ height: 4, backgroundColor: 'rgba(148, 163, 184, 0.2)', borderRadius: 2, marginTop: 2, overflow: 'hidden' }}>
            <View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: '#38bdf8', borderRadius: 2 }} />
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
  clockFormat?: '12h' | '24h';
  showChannelNumbers?: boolean;
}

interface ChannelRowData {
  channel: Channel;
  isCurrent: boolean;
  programs: EPGProgram[];
}

interface EpgGroupItem {
  name: string;
  count: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CH_COL  = TV ? 286 : 226;
const SLOT_W  = TV ? 184 : 136;
const ROW_H   = TV ? 92 : 72;
const ROW_H_F = TV ? 118 : 92;
const HDR_H   = TV ? 50 : 42;
const GROUP_RAIL_W = TV ? 282 : 232;

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

const fmtTime = (d?: Date | null, clockFormat: '12h' | '24h' = '24h') =>
  formatClockTime(d, clockFormat);

// ─── Channel Row ─────────────────────────────────────────────────────────────

const ChannelRow = memo<{
  data: ChannelRowData;
  onChannelSelect: (ch: Channel) => void;
  onFocus?: (id: string) => void;
  isFocused?: boolean;
  hasTVPreferredFocus?: boolean;
  currentTimePosition?: number;
  timelineScrollX: number;
  showChannelNumbers?: boolean;
  clockFormat: '12h' | '24h';
}>(({ data, onChannelSelect, onFocus, isFocused = false, hasTVPreferredFocus = false, currentTimePosition, timelineScrollX, showChannelNumbers = false, clockFormat }) => {
  const { channel, isCurrent, programs } = data;
  const accent = useThemeStore((st) => st.theme.accent);
  const [imgErr, setImgErr] = useState(false);

  const initials   = useMemo(() => channel.name.substring(0, 2).toUpperCase(), [channel.name]);
  const handlePress = useCallback(() => onChannelSelect(channel), [channel, onChannelSelect]);
  const handleFocus = useCallback(() => onFocus?.(channel.id), [channel.id, onFocus]);
  const rowH = isFocused ? ROW_H_F : ROW_H;
  const logoSz = TV ? 50 : 38;

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
        const width = Math.max(durH * SLOT_W, TV ? 86 : 68);
        const isNow = p.start <= now && p.end > now;
        return { p, left, width, isNow };
      })
      .filter(b => b.left >= -SLOT_W && b.left <= 48 * SLOT_W);
  }, [programs]);

  const rowBg   = isCurrent ? '#111f32' : '#080d15';
  const lBorder = isCurrent ? accent : 'transparent';

  const focusedRowStyle = useMemo(() => ({
    backgroundColor: '#e8f2ff',
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
          const blockBg     = b.isNow ? '#1fa2ff' : (isFocused ? '#dbeafe' : '#101826');
          const blockBorder = b.isNow ? '#67d7ff' : (isFocused ? '#ffffff' : '#223049');
          const titleColor  = b.isNow ? '#ffffff' : (isFocused ? '#061225' : '#c7d2e1');
          const timeColor   = b.isNow ? '#eaf6ff' : (isFocused ? '#334155' : '#7f96b2');

          return (
            <View
              key={b.p.id}
              style={[s.block, {
                left: Math.max(0, b.left),
                width: b.width,
                backgroundColor: blockBg,
                borderColor: blockBorder,
                top: TV ? 7 : 6, bottom: TV ? 7 : 6,
              }]}
            >
              <Text style={[s.blockTitle, { color: titleColor }]} numberOfLines={isFocused ? 2 : 1}>
                {b.p.title}
              </Text>
              <Text style={[s.blockTime, { color: timeColor }]}>
                {fmtTime(b.p.start, clockFormat)} – {fmtTime(b.p.end, clockFormat)}
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
        style={[s.chCol, {
          backgroundColor: isFocused ? '#e8f2ff' : (isCurrent ? '#111f32' : '#080d15'),
          transform: [{ translateX: timelineScrollX }],
        }]}
      >
        {showChannelNumbers && (
          <Text style={s.channelNumber}>
            {channel.number ?? ''}
          </Text>
        )}
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
            style={[s.chName, isFocused && { color: '#061225' }]}
            numberOfLines={1}
          >
            {channel.name}
          </Text>
          {nowProgram && (
            <Text style={[s.chNow, isFocused && { color: '#334155' }]} numberOfLines={1}>{nowProgram.title}</Text>
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
  prev.timelineScrollX    === next.timelineScrollX &&
  prev.showChannelNumbers === next.showChannelNumbers &&
  prev.clockFormat      === next.clockFormat &&
  prev.onFocus           === next.onFocus,
);
ChannelRow.displayName = 'ChannelRow';

// ─── Time Header ─────────────────────────────────────────────────────────────

const TimeHeader = memo<{ currentTimePosition?: number; timelineScrollX: number }>(({ currentTimePosition, timelineScrollX }) => {
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
      <View pointerEvents="none" style={[s.timeChLabel, { transform: [{ translateX: timelineScrollX }] }]}>
        <Text style={s.timeChLabelTxt}>CHANNELS</Text>
      </View>
    </View>
  );
});
TimeHeader.displayName = 'TimeHeader';

const GroupRail = memo<{
  groups: EpgGroupItem[];
  selectedGroup: string;
  onSelect: (group: string) => void;
  onClose: () => void;
}>(({ groups, selectedGroup, onSelect, onClose }) => {
  const theme = useThemeStore((st) => st.theme);

  return (
    <View style={s.groupRail}>
      <View style={s.groupRailHeader}>
        <Text style={s.groupRailTitle}>Groups</Text>
        <FocusableItem onPress={onClose} style={s.groupRailClose} focusedStyle={HDR_BTN_FOCUSED}>
          <Text style={s.groupRailCloseTxt}>›</Text>
        </FocusableItem>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.groupRailScroll}>
        {groups.map((group) => {
          const active = selectedGroup === group.name;
          return (
            <FocusableItem
              key={group.name}
              onPress={() => onSelect(group.name)}
              hasTVPreferredFocus={active}
              style={[s.groupRailItem, active && s.groupRailItemActive]}
              focusedStyle={{ backgroundColor: '#e8f2ff', borderColor: '#ffffff', borderWidth: 2, transform: [], elevation: 6 }}
            >
              <View style={[s.groupRailAccent, active && { backgroundColor: theme.accent }]} />
              <View style={s.groupRailMeta}>
                <Text style={[s.groupRailName, active && s.groupRailNameActive]} numberOfLines={1}>
                  {group.name}
                </Text>
                <Text style={[s.groupRailCount, active && s.groupRailCountActive]}>
                  {group.count} channels
                </Text>
              </View>
            </FocusableItem>
          );
        })}
      </ScrollView>
    </View>
  );
});
GroupRail.displayName = 'GroupRail';

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

  const handleGroupSelect = useCallback((group: string) => {
    setSelectedGroup(group);
    setShowGroupRail(false);
  }, []);

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
          setShowGroupRail(false);
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
          setShowGroupRail(false);
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
    if (!showEPGGrid || !KeyEvent) return;
    KeyEvent.onKeyDownListener((e: { keyCode: number }) => {
      if (showGroupRail) {
        const currentGroupIndex = Math.max(0, groupNames.indexOf(selectedGroup));
        if (e.keyCode === 22 || e.keyCode === 4) {
          setShowGroupRail(false);
          return;
        }
        if (e.keyCode === 19 || e.keyCode === 20) {
          const nextIndex = e.keyCode === 19
            ? Math.max(0, currentGroupIndex - 1)
            : Math.min(groupNames.length - 1, currentGroupIndex + 1);
          setSelectedGroup(groupNames[nextIndex] ?? selectedGroup);
          return;
        }
        if (e.keyCode === 23 || e.keyCode === 66) {
          setShowGroupRail(false);
          return;
        }
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
  }, [showEPGGrid, showGroupRail, groupNames, selectedGroup, minTimelineX, syncTimelineScroll]);

  if (!showEPGGrid || !channels.length || !navigation) return null;

  // Only show the blocking overlay when we genuinely have nothing to display.
  // Once at least one channel has program data, fall back to a small badge so
  // the user can interact with the grid while background ingestion continues.
  const hasAnyData = loadedIdsRef.current.size > 0;

  return (
    <View style={s.root}>
      {/* ── Info panel ───────────────────────────────────────────────── */}
      <EpgInfoPanel
        info={focusedInfo ?? (channel ? buildFocusedInfo(channel.id) : null)}
        channel={channel}
        channels={channels}
        theme={theme}
        showChannelNumbers={showChannelNumbers}
        clockFormat={clockFormat}
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
          {groups.length > 1 && (
            <FocusableItem onPress={() => setShowGroupRail(true)} style={s.hBtn} focusedStyle={HDR_BTN_FOCUSED}>
              <Text style={s.hBtnIcon}>☰</Text>
            </FocusableItem>
          )}
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

      {showGroupRail && groups.length > 1 ? (
        <GroupRail
          groups={groups}
          selectedGroup={selectedGroup}
          onSelect={handleGroupSelect}
          onClose={() => setShowGroupRail(false)}
        />
      ) : null}

      {/* ── Error banner ─────────────────────────── */}
      {!epgLoading && epgError && (
        <View pointerEvents="none" style={s.errBanner}>
          <Text style={s.errTxt}>⚠  {epgError}</Text>
        </View>
      )}

      {/* ── Grid ─────────────────────────────────── */}
      <View style={[s.gridWrap, showGroupRail && { marginLeft: GROUP_RAIL_W }]}>
        {USE_NATIVE_GRID ? (
          <NativeEpgGrid
            style={{ flex: 1 }}
            playlistId={playlist?.id ?? ''}
            channels={filteredChannels}
            currentChannelId={channel?.id}
            accentColor={theme.accent}
            bgColor={theme.bg}
            dataVersion={nativeDataVersion}
            onChannelSelect={handleNativeChannelSelect}
            onOpenGroups={handleNativeOpenGroups}
          />
        ) : (
          <>
            <ScrollView
              ref={hScrollRef}
              style={{ flex: 1 }}
              horizontal
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              onScroll={(event) => {
                const x = event.nativeEvent.contentOffset.x;
                if (x < minTimelineX) {
                  syncTimelineScroll(minTimelineX, false);
                  return;
                }
                horizontalScrollXRef.current = x;
                setTimelineScrollX((prev) => (Math.abs(prev - x) > 3 ? x : prev));
              }}
              onScrollEndDrag={(event) => {
                if (event.nativeEvent.contentOffset.x < minTimelineX) {
                  syncTimelineScroll(minTimelineX, true);
                }
              }}
              onMomentumScrollEnd={(event) => {
                if (event.nativeEvent.contentOffset.x < minTimelineX) {
                  syncTimelineScroll(minTimelineX, true);
                }
              }}
            >
              <View style={{ flex: 1 }}>
                <TimeHeader currentTimePosition={timePos} timelineScrollX={timelineScrollX} />
                <View style={{ flex: 1 }}>
                  <FlashList
                    ref={flashRef}
                    data={channelData}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    estimatedItemSize={ROW_H}
                    extraData={{
                      focusedId,
                      initFocusId,
                      timePos,
                      timelineScrollX,
                      showChannelNumbers,
                      clockFormat,
                    }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled={TV}
                    onViewableItemsChanged={onViewableItemsChanged}
                    viewabilityConfig={{ itemVisiblePercentThreshold: 40, minimumViewTime: 250 }}
                  />
                </View>
              </View>
            </ScrollView>
            {TV && !showGroupRail && groups.length > 1 ? (
              <FocusableItem
                onPress={() => setShowGroupRail(true)}
                onFocus={() => setShowGroupRail(true)}
                style={s.leftGroupHotspot}
                focusedStyle={HDR_BTN_FOCUSED}
              >
                <View />
              </FocusableItem>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
};

export default EPGGridView;

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#05080d',
    zIndex: 25,
    elevation: 25,
  },

  // Loading
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40, elevation: 40,
    backgroundColor: 'rgba(5,8,13,0.94)',
    justifyContent: 'center', alignItems: 'center', gap: 12,
  },
  loadingTxt: { color: '#9fb3c8', fontSize: TV ? 17 : 14, fontWeight: '700' },

  loadingBadge: {
    position: 'absolute',
    top: TV ? 24 : 18, right: TV ? 24 : 18,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(8,13,21,0.95)',
    borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.16)',
    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6,
    zIndex: 45, elevation: 45,
  },
  loadingBadgeTxt: { color: '#9fb3c8', fontSize: TV ? 12 : 11, fontWeight: '700' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: TV ? 22 : 18,
    paddingVertical: TV ? 12 : 10,
    backgroundColor: '#05080d',
    borderBottomWidth: 1, borderBottomColor: 'rgba(148, 163, 184, 0.14)',
  },
  headerTitle: {
    color: '#e8f0fa',
    fontSize: TV ? 22 : 18,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  headerSub: {
    color: '#7f96b2',
    fontSize: TV ? 12 : 10,
    fontWeight: '700',
    marginTop: 3,
  },
  headerBtns: { flexDirection: 'row', gap: 10 },
  hBtn: {
    width: TV ? 50 : 42, height: TV ? 50 : 42,
    borderRadius: TV ? 12 : 10,
    backgroundColor: '#101826', borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.16)',
    justifyContent: 'center', alignItems: 'center',
  },
  hBtnClose: { backgroundColor: '#0a101a', borderColor: 'rgba(148, 163, 184, 0.12)' },
  hBtnIcon: { color: '#cbd5e1', fontSize: TV ? 20 : 17, fontWeight: '800' },

  gridWrap: {
    flex: 1,
  },
  leftGroupHotspot: {
    position: 'absolute',
    left: 0,
    top: HDR_H,
    bottom: 0,
    width: TV ? 34 : 28,
    backgroundColor: 'transparent',
    zIndex: 78,
    elevation: 78,
  },

  groupRail: {
    position: 'absolute',
    left: 0,
    top: INFO_H + (TV ? 75 : 63),
    bottom: 0,
    width: GROUP_RAIL_W,
    backgroundColor: 'rgba(5, 8, 13, 0.97)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(148, 163, 184, 0.18)',
    zIndex: 80,
    elevation: 80,
    paddingHorizontal: TV ? 14 : 10,
    paddingTop: TV ? 14 : 10,
  },
  groupRailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: TV ? 12 : 8,
    paddingHorizontal: TV ? 4 : 2,
  },
  groupRailTitle: {
    color: '#e8f0fa',
    fontSize: TV ? 18 : 15,
    fontWeight: '900',
  },
  groupRailClose: {
    width: TV ? 42 : 36,
    height: TV ? 42 : 36,
    borderRadius: 8,
    backgroundColor: '#101826',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.16)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupRailCloseTxt: {
    color: '#cbd5e1',
    fontSize: TV ? 25 : 20,
    fontWeight: '900',
  },
  groupRailScroll: {
    paddingBottom: TV ? 24 : 18,
    gap: TV ? 8 : 6,
  },
  groupRailItem: {
    minHeight: TV ? 64 : 54,
    borderRadius: 8,
    backgroundColor: '#0b111d',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  groupRailItemActive: {
    backgroundColor: '#17263c',
    borderColor: 'rgba(103, 215, 255, 0.45)',
  },
  groupRailAccent: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: 'transparent',
  },
  groupRailMeta: {
    flex: 1,
    paddingHorizontal: TV ? 13 : 10,
    gap: 3,
  },
  groupRailName: {
    color: '#dbeafe',
    fontSize: TV ? 14 : 12,
    fontWeight: '800',
  },
  groupRailNameActive: {
    color: '#f8fafc',
  },
  groupRailCount: {
    color: '#7f96b2',
    fontSize: TV ? 11 : 9,
    fontWeight: '700',
  },
  groupRailCountActive: {
    color: '#9ee7ff',
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
    backgroundColor: '#070b12',
    borderBottomWidth: 1, borderBottomColor: 'rgba(148, 163, 184, 0.14)',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  timeSlot: {
    width: SLOT_W, height: HDR_H,
    justifyContent: 'center', alignItems: 'center',
    borderRightWidth: 1, borderRightColor: 'rgba(148, 163, 184, 0.1)',
  },
  timeSlotNow: { backgroundColor: 'rgba(56,189,248,0.1)' },
  timeText:    { color: '#8fa4bd', fontSize: TV ? 12 : 10, fontWeight: '800', letterSpacing: 0.5 },
  timeTextNow: { color: '#67d7ff' },
  timeChLabel: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: CH_COL,
    borderRightWidth: 1, borderRightColor: 'rgba(148, 163, 184, 0.14)',
    backgroundColor: '#070b12',
    justifyContent: 'center', paddingHorizontal: TV ? 20 : 14, zIndex: 8,
  },
  timeChLabelTxt: { color: '#8fa4bd', fontSize: TV ? 10 : 8, fontWeight: '900', letterSpacing: 2 },

  // Row
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: 'rgba(148, 163, 184, 0.08)',
    borderLeftWidth: 5, overflow: 'hidden',
  },

  // Program blocks
  block: {
    position: 'absolute', borderRadius: 5, borderWidth: 1,
    paddingHorizontal: TV ? 10 : 8, paddingVertical: TV ? 7 : 5,
    justifyContent: 'center', overflow: 'hidden',
  },
  blockTitle: { fontSize: TV ? 13 : 11, fontWeight: '800', lineHeight: TV ? 17 : 15 },
  blockTime:  { fontSize: TV ? 10 : 9, fontWeight: '700', marginTop: 2 },
  blockDesc:  { color: '#475569', fontSize: TV ? 10 : 9, marginTop: 4, lineHeight: TV ? 14 : 13 },
  noData: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  noDataText: { color: '#64748b', fontSize: TV ? 12 : 10, fontWeight: '700' },

  timeLine: {
    position: 'absolute', top: 0, bottom: 0,
    width: 2.5, backgroundColor: '#38bdf8', zIndex: 20,
  },
  timeDot: {
    position: 'absolute', top: -4, left: -5,
    width: 11, height: 11, borderRadius: 6,
    backgroundColor: '#38bdf8', borderWidth: 2, borderColor: '#05080d',
  },

  // Channel column
  chCol: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: CH_COL,
    borderRightWidth: 1, borderRightColor: 'rgba(148, 163, 184, 0.14)',
    zIndex: 6, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: TV ? 12 : 9, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.7, shadowRadius: 12, elevation: 8,
  },
  channelNumber: {
    color: '#67d7ff',
    fontSize: TV ? 12 : 10,
    fontWeight: '900',
    minWidth: TV ? 30 : 26,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  chMeta: { flex: 1 },
  chName: {
    color: '#dbeafe',
    fontSize: TV ? 13 : 11,
    fontWeight: '800',
    lineHeight: TV ? 17 : 15,
    marginBottom: 2,
  },
  chNow:  { color: '#8fa4bd', fontSize: TV ? 10 : 9, fontWeight: '700' },
  chGroup:{ color: '#405060', fontSize: TV ? 10 : 8, fontWeight: '500', marginTop: 1 },
  logoFallback: {
    borderRadius: 8, backgroundColor: '#111827',
    borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.16)',
    justifyContent: 'center', alignItems: 'center',
  },
  logoInitials: { color: '#9fb3c8', fontSize: TV ? 14 : 11, fontWeight: '900' },
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
