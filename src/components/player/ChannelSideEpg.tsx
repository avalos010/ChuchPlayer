import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import FocusableItem from '../FocusableItem';
import { Channel, EPGProgram } from '../../types';
import { useThemeStore } from '../../store/useThemeStore';
import { Theme } from '../../theme/themes';
import { formatClockTime } from '../../utils/time';
import { TV } from './ChannelListPanel.constants';

interface ChannelSideEpgProps {
  channel: Channel | null;
  programs: EPGProgram[];
  now: number;
  clockFormat: '12h' | '24h';
  onCatchupSelect?: (channelId: string, startMs: number, endMs: number, programTitle: string) => void;
}

const EPG_ROW_H = TV ? 88 : 74;

const ChannelSideEpgInner: React.FC<ChannelSideEpgProps> = ({
  channel, programs, now, clockFormat, onCatchupSelect,
}) => {
  const theme = useThemeStore((s) => s.theme);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const focusedStyle = useMemo(() => ({
    backgroundColor: theme.card,
    borderColor: theme.focused,
    borderWidth: 1,
    transform: [] as any[],
    elevation: 4,
  }), [theme]);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!programs.length) return;
    const index = programs.findIndex((program) => program.start.getTime() <= now && program.end.getTime() > now);
    if (index <= 1) return;
    const timer = setTimeout(
      () => scrollRef.current?.scrollTo({ y: (index - 1) * EPG_ROW_H, animated: false }),
      50,
    );
    return () => clearTimeout(timer);
  }, [channel?.id, programs]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRowFocus = useCallback((index: number) => {
    scrollRef.current?.scrollTo({
      y: Math.max(0, (index - 1) * EPG_ROW_H),
      animated: true,
    });
  }, []);

  if (!channel) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTxt}>Focus a channel</Text>
      </View>
    );
  }

  const hasCatchup = channel.catchupAvailable;

  return (
    <View style={styles.root}>
      <View style={styles.chHeader}>
        <Text style={styles.chName} numberOfLines={1}>{channel.name}</Text>
        {hasCatchup && (
          <View style={styles.catchupBadge}><Text style={styles.catchupTxt}>⏮ catchup</Text></View>
        )}
      </View>
      <ScrollView ref={scrollRef} scrollEnabled showsVerticalScrollIndicator={false} style={styles.scroll}>
        {programs.length === 0 ? (
          <Text style={styles.noProg}>No guide data</Text>
        ) : (
          programs.map((program, index) => {
            const isCurrent = program.start.getTime() <= now && program.end.getTime() > now;
            const isPast = program.end.getTime() <= now;
            const canCatchup = isPast && hasCatchup;
            return (
              <FocusableItem
                key={program.id}
                onPress={() => {
                  if (canCatchup) onCatchupSelect?.(channel.id, program.start.getTime(), program.end.getTime(), program.title);
                }}
                onFocus={() => handleRowFocus(index)}
                style={[
                  styles.row,
                  isCurrent && styles.rowCurrent,
                  isPast && !canCatchup && styles.rowPastNoCatchup,
                ]}
                focusedStyle={focusedStyle}
              >
                <View style={styles.rowLeft}>
                  <Text style={[styles.time, isCurrent && styles.timeCurrent, isPast && !canCatchup && styles.timeGray]}>
                    {formatClockTime(program.start, clockFormat, { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                  {canCatchup && <Text style={styles.catchupDot}>⏮</Text>}
                  {isCurrent && <View style={styles.nowDot} />}
                </View>
                <View style={styles.rowRight}>
                  <Text
                    style={[styles.title, isCurrent && styles.titleCurrent, isPast && !canCatchup && styles.titleGray]}
                    numberOfLines={1}
                  >
                    {program.title}
                  </Text>
                  <Text style={[styles.dur, isCurrent && styles.durCurrent]}>
                    {formatClockTime(program.start, clockFormat, { hour: 'numeric', minute: '2-digit' })} – {formatClockTime(program.end, clockFormat, { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                  {typeof program.description === 'string' && program.description.trim().length > 0 && (
                    <Text style={styles.desc} numberOfLines={1}>{program.description.trim()}</Text>
                  )}
                </View>
              </FocusableItem>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const ChannelSideEpg = React.memo(ChannelSideEpgInner, (prev, next) =>
  prev.channel?.id === next.channel?.id &&
  prev.programs === next.programs &&
  prev.clockFormat === next.clockFormat &&
  prev.onCatchupSelect === next.onCatchupSelect &&
  Math.abs(prev.now - next.now) < 60_000,
);

export default ChannelSideEpg;

const createStyles = (theme: Theme) => StyleSheet.create({
  root: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyTxt: {
    color: theme.textMuted,
    fontSize: TV ? 11 : 9,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: TV ? 18 : 15,
  },
  chHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: TV ? 12 : 10,
    paddingVertical: TV ? 10 : 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    backgroundColor: theme.surface,
  },
  chName: {
    flex: 1,
    color: theme.textSub,
    fontSize: TV ? 14 : 12,
    fontWeight: '700',
  },
  catchupBadge: {
    backgroundColor: theme.card,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: theme.accent,
  },
  catchupTxt: { color: theme.accent, fontSize: TV ? 9 : 8, fontWeight: '700' },
  scroll: { flex: 1 },
  noProg: {
    color: theme.textMuted,
    fontSize: TV ? 11 : 9,
    fontWeight: '500',
    padding: 16,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: TV ? 10 : 8,
    paddingVertical: TV ? 8 : 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    minHeight: 72,
    alignItems: 'flex-start',
  },
  rowCurrent: {
    backgroundColor: theme.cardActive,
    borderLeftWidth: 3,
    borderLeftColor: theme.accent,
  },
  rowPastNoCatchup: { opacity: 0.35 },
  rowLeft: { width: TV ? 44 : 38, alignItems: 'center', gap: 4, paddingTop: 2 },
  time: {
    color: theme.textMuted,
    fontSize: TV ? 10 : 9,
    fontWeight: '700',
    textAlign: 'center',
  },
  timeCurrent: { color: theme.accent },
  timeGray: { color: theme.textMuted },
  catchupDot: { fontSize: TV ? 9 : 8, color: theme.accent },
  nowDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.accent },
  rowRight: { flex: 1, gap: 3, paddingLeft: TV ? 6 : 4 },
  title: {
    color: theme.textSub,
    fontSize: TV ? 13 : 11,
    fontWeight: '600',
    lineHeight: TV ? 17 : 15,
  },
  titleCurrent: { color: theme.text },
  titleGray: { color: theme.textMuted },
  dur: { color: theme.textMuted, fontSize: TV ? 10 : 9, fontWeight: '500' },
  durCurrent: { color: theme.textSub },
  desc: {
    color: theme.textMuted,
    fontSize: TV ? 11 : 10,
    fontWeight: '400' as const,
    marginTop: 2,
  },
});
