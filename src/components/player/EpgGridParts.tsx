import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import FocusableItem, { type FocusableItemHandle } from '../FocusableItem';
import { Channel, EPGProgram } from '../../types';
import { useThemeStore } from '../../store/useThemeStore';
import { formatClockTime } from '../../utils/time';
import { CH_COL, HDR_BTN_FOCUSED, ROW_H, ROW_H_F, SLOT_W, TV, s } from './EpgGridShared';

export interface ChannelRowData {
  channel: Channel;
  isCurrent: boolean;
  programs: EPGProgram[];
}

export interface EpgGroupItem {
  name: string;
  count: number;
}

const fmtTime = (date?: Date | null, clockFormat: '12h' | '24h' = '24h') =>
  formatClockTime(date, clockFormat);

export const ChannelRow = memo<{
  data: ChannelRowData;
  onChannelSelect: (channel: Channel) => void;
  onFocus?: (id: string) => void;
  isFocused?: boolean;
  hasTVPreferredFocus?: boolean;
  currentTimePosition?: number;
  timelineScrollX: number;
  showChannelNumbers?: boolean;
  clockFormat: '12h' | '24h';
}>(({ data, onChannelSelect, onFocus, isFocused = false, hasTVPreferredFocus = false, currentTimePosition, timelineScrollX, showChannelNumbers = false, clockFormat }) => {
  const { channel, isCurrent, programs } = data;
  const accent = useThemeStore((state) => state.theme.accent);
  const [imgErr, setImgErr] = useState(false);
  const initials = useMemo(() => channel.name.substring(0, 2).toUpperCase(), [channel.name]);
  const handlePress = useCallback(() => onChannelSelect(channel), [channel, onChannelSelect]);
  const handleFocus = useCallback(() => onFocus?.(channel.id), [channel.id, onFocus]);
  const rowH = isFocused ? ROW_H_F : ROW_H;
  const logoSz = TV ? 50 : 38;
  const nowProgram = useMemo(() => {
    const now = new Date();
    return programs.find((program) => program.start <= now && program.end > now) ?? null;
  }, [programs]);
  const blocks = useMemo(() => {
    if (!programs.length) return [];
    const now = new Date();
    return programs.map((program) => {
      const durationHours = (program.end.getTime() - program.start.getTime()) / 3_600_000;
      const hoursFromNow = (program.start.getTime() - now.getTime()) / 3_600_000;
      return {
        program,
        left: 12 * SLOT_W + hoursFromNow * SLOT_W,
        width: Math.max(durationHours * SLOT_W, TV ? 86 : 68),
        isNow: program.start <= now && program.end > now,
      };
    }).filter((block) => block.left >= -SLOT_W && block.left <= 48 * SLOT_W);
  }, [programs]);
  const focusedRowStyle = useMemo(() => ({ backgroundColor: '#e8f2ff', borderLeftColor: accent, borderLeftWidth: 5, transform: [] as any[], elevation: 6 }), [accent]);

  return <FocusableItem onPress={handlePress} onFocus={handleFocus} hasTVPreferredFocus={hasTVPreferredFocus} style={[s.row, { height: rowH, backgroundColor: isCurrent ? '#111f32' : '#080d15', borderLeftColor: isCurrent ? accent : 'transparent', paddingLeft: CH_COL }]} focusedStyle={focusedRowStyle}>
    <View style={{ flex: 1, position: 'relative', minWidth: 48 * SLOT_W }}>
      {currentTimePosition !== undefined && <View style={[s.timeLine, { left: currentTimePosition }]}><View style={s.timeDot} /></View>}
      {blocks.length ? blocks.map((block) => <View key={block.program.id} style={[s.block, { left: Math.max(0, block.left), width: block.width, backgroundColor: block.isNow ? '#1fa2ff' : (isFocused ? '#dbeafe' : '#101826'), borderColor: block.isNow ? '#67d7ff' : (isFocused ? '#ffffff' : '#223049'), top: TV ? 7 : 6, bottom: TV ? 7 : 6 }]}>
        <Text style={[s.blockTitle, { color: block.isNow ? '#ffffff' : (isFocused ? '#061225' : '#c7d2e1') }]} numberOfLines={isFocused ? 2 : 1}>{block.program.title}</Text>
        <Text style={[s.blockTime, { color: block.isNow ? '#eaf6ff' : (isFocused ? '#334155' : '#7f96b2') }]}>{fmtTime(block.program.start, clockFormat)} – {fmtTime(block.program.end, clockFormat)}</Text>
        {isFocused && block.isNow && typeof block.program.description === 'string' && block.program.description.trim() ? <Text style={s.blockDesc} numberOfLines={2}>{block.program.description.trim()}</Text> : null}
      </View>) : <View style={s.noData}><Text style={s.noDataText}>No guide data</Text></View>}
    </View>
    <View pointerEvents="none" style={[s.chCol, { backgroundColor: isFocused ? '#e8f2ff' : (isCurrent ? '#111f32' : '#080d15'), transform: [{ translateX: timelineScrollX }] }]}>
      {showChannelNumbers && <Text style={s.channelNumber}>{channel.number ?? ''}</Text>}
      {channel.logo && !imgErr ? <Image source={{ uri: channel.logo }} style={{ width: logoSz, height: logoSz, borderRadius: 8, backgroundColor: '#141414' }} contentFit="contain" cachePolicy="disk" onError={() => setImgErr(true)} /> : <View style={[s.logoFallback, { width: logoSz, height: logoSz }]}><Text style={[s.logoInitials, isFocused && { color: '#f5f5f5' }]}>{initials}</Text></View>}
      <View style={s.chMeta}><Text style={[s.chName, isFocused && { color: '#061225' }]} numberOfLines={1}>{channel.name}</Text>{nowProgram && <Text style={[s.chNow, isFocused && { color: '#334155' }]} numberOfLines={1}>{nowProgram.title}</Text>}</View>
      {isCurrent && <View style={s.onNowBadge}><Text style={s.onNowText}>ON NOW</Text></View>}
    </View>
  </FocusableItem>;
}, (prev, next) => prev.data.channel.id === next.data.channel.id && prev.data.isCurrent === next.data.isCurrent && prev.data.programs.length === next.data.programs.length && prev.isFocused === next.isFocused && prev.hasTVPreferredFocus === next.hasTVPreferredFocus && prev.currentTimePosition === next.currentTimePosition && prev.timelineScrollX === next.timelineScrollX && prev.showChannelNumbers === next.showChannelNumbers && prev.clockFormat === next.clockFormat && prev.onFocus === next.onFocus);

export const TimeHeader = memo<{ currentTimePosition?: number; timelineScrollX: number }>(({ currentTimePosition, timelineScrollX }) => {
  const slots = useMemo(() => {
    const hour = new Date().getHours();
    return Array.from({ length: 48 }, (_, id) => ({ id, hour: ((hour - 12 + id) % 24 + 24) % 24, isCurrent: id === 12 }));
  }, []);
  return <View style={[s.timeHeader, { paddingLeft: CH_COL }]}>
    <View style={{ flexDirection: 'row' }}>{slots.map((slot) => <View key={slot.id} style={[s.timeSlot, slot.isCurrent && s.timeSlotNow]}><Text style={[s.timeText, slot.isCurrent && s.timeTextNow]}>{slot.hour.toString().padStart(2, '0')}:00</Text></View>)}</View>
    {currentTimePosition !== undefined && <View style={[s.timeLine, { left: currentTimePosition + CH_COL, top: 0, bottom: 0, position: 'absolute' }]}><View style={s.timeDot} /></View>}
    <View pointerEvents="none" style={[s.timeChLabel, { transform: [{ translateX: timelineScrollX }] }]}><Text style={s.timeChLabelTxt}>CHANNELS</Text></View>
  </View>;
});

export const GroupRail = memo<{ groups: EpgGroupItem[]; selectedGroup: string; onSelect: (group: string) => void; onClose: () => void }>(({ groups, selectedGroup, onSelect, onClose }) => {
  const theme = useThemeStore((state) => state.theme);
  const firstGroupRef = useRef<FocusableItemHandle>(null);

  useEffect(() => {
    if (!TV) return undefined;
    const frame = requestAnimationFrame(() => firstGroupRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  return <View style={s.groupRail}>
    <View style={s.groupRailHeader}><Text style={s.groupRailTitle}>Groups</Text><FocusableItem onPress={onClose} style={s.groupRailClose} focusedStyle={HDR_BTN_FOCUSED}><Text style={s.groupRailCloseTxt}>›</Text></FocusableItem></View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.groupRailScroll}>{groups.map((group, index) => {
      const active = selectedGroup === group.name;
      return <FocusableItem key={group.name} ref={index === 0 ? firstGroupRef : undefined} onPress={() => onSelect(group.name)} hasTVPreferredFocus={index === 0} style={[s.groupRailItem, active && s.groupRailItemActive]} focusedStyle={{ backgroundColor: '#e8f2ff', borderColor: '#ffffff', borderWidth: 2, transform: [], elevation: 6 }}><View style={[s.groupRailAccent, active && { backgroundColor: theme.accent }]} /><View style={s.groupRailMeta}><Text style={[s.groupRailName, active && s.groupRailNameActive]} numberOfLines={1}>{group.name}</Text><Text style={[s.groupRailCount, active && s.groupRailCountActive]}>{group.count} channels</Text></View></FocusableItem>;
    })}</ScrollView>
  </View>;
});
