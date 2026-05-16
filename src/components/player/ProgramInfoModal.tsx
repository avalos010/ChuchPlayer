import React, { useCallback, useMemo, memo } from 'react';
import {
  View, Text, StyleSheet, Platform, ScrollView, TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import FocusableItem from '../FocusableItem';
import { useUIStore } from '../../store/useUIStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useThemeStore } from '../../store/useThemeStore';
import { Theme } from '../../theme/themes';

const TV = Platform.OS === 'android';

const fmtTime = (d: Date) =>
  d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const fmtDate = (d: Date) =>
  d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

const fmtDuration = (startMs: number, endMs: number) => {
  const mins = Math.round((endMs - startMs) / 60_000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

const ProgramInfoModal: React.FC = () => {
  const theme  = useThemeStore((s) => s.theme);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const showProgramInfo    = useUIStore((s) => s.showProgramInfo);
  const programInfoData    = useUIStore((s) => s.programInfoData);
  const setShowProgramInfo = useUIStore((s) => s.setShowProgramInfo);
  const setChannel         = usePlayerStore((s) => s.setChannel);
  const setIsPlaying       = usePlayerStore((s) => s.setIsPlaying);

  const onClose = useCallback(() => setShowProgramInfo(false), [setShowProgramInfo]);

  const onWatch = useCallback(() => {
    if (!programInfoData) return;
    setShowProgramInfo(false);
    setChannel(programInfoData.channel);
    setIsPlaying(true);
  }, [programInfoData, setChannel, setIsPlaying, setShowProgramInfo]);

  const onCatchup = useCallback(() => {
    if (!programInfoData?.program.catchupUrl) return;
    setShowProgramInfo(false);
    setChannel({ ...programInfoData.channel, url: programInfoData.program.catchupUrl });
    setIsPlaying(true);
  }, [programInfoData, setChannel, setIsPlaying, setShowProgramInfo]);

  const watchBtnFocused = useMemo(() => ({
    backgroundColor: theme.accent,
    borderColor: theme.accent,
    borderWidth: 2,
    transform: [] as any[],
    elevation: 6,
  }), [theme]);

  const catchupBtnFocused = useMemo(() => ({
    backgroundColor: theme.accent + '33',
    borderColor: theme.accent,
    borderWidth: 2,
    transform: [] as any[],
    elevation: 6,
  }), [theme]);

  const closeBtnFocused = useMemo(() => ({
    backgroundColor: theme.card,
    borderColor: theme.focused,
    borderWidth: 2,
    transform: [] as any[],
    elevation: 4,
  }), [theme]);

  if (!showProgramInfo || !programInfoData) return null;

  const { channel, program } = programInfoData;
  const now      = Date.now();
  const startMs  = program.start.getTime();
  const endMs    = program.end.getTime();
  const progress = Math.min(1, Math.max(0, (now - startMs) / (endMs - startMs)));
  const isLive   = startMs <= now && now < endMs;
  const isPast   = endMs < now;

  return (
    <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} focusable={false}>
      <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.modal} focusable={false}>

        {/* Channel header row */}
        <View style={styles.header}>
          <View style={styles.logoWrap}>
            {channel.logo ? (
              <Image source={{ uri: channel.logo }} style={styles.logo} contentFit="contain" cachePolicy="disk" />
            ) : (
              <View style={styles.logoBg}>
                <Text style={styles.logoInitials}>{channel.name.substring(0, 2).toUpperCase()}</Text>
              </View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.chName} numberOfLines={1}>{channel.name}</Text>
            <View style={styles.badges}>
              {isLive && <View style={styles.liveBadge}><Text style={styles.liveTxt}>LIVE</Text></View>}
              {program.catchupAvailable && (
                <View style={styles.catchupBadge}><Text style={styles.catchupTxt}>CATCH-UP</Text></View>
              )}
            </View>
          </View>
          <FocusableItem onPress={onClose} style={styles.closeBtn} focusedStyle={closeBtnFocused}>
            <Text style={styles.closeTxt}>✕</Text>
          </FocusableItem>
        </View>

        <View style={styles.divider} />

        {/* Program title + meta */}
        <View style={styles.progHeader}>
          <Text style={styles.progTitle}>{program.title}</Text>
          <Text style={styles.progMeta}>
            {fmtDate(program.start)} · {fmtTime(program.start)} – {fmtTime(program.end)}
            {'  '}
            <Text style={styles.duration}>({fmtDuration(startMs, endMs)})</Text>
          </Text>
        </View>

        {/* Progress bar */}
        {(isLive || isPast) && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
          </View>
        )}

        <View style={styles.divider} />

        {/* Description */}
        {program.description ? (
          <ScrollView style={styles.descScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.desc}>{program.description}</Text>
          </ScrollView>
        ) : (
          <Text style={styles.noDesc}>No description available.</Text>
        )}

        <View style={styles.divider} />

        {/* Action buttons */}
        <View style={styles.actions}>
          <FocusableItem
            onPress={onWatch}
            hasTVPreferredFocus
            style={styles.watchBtn}
            focusedStyle={watchBtnFocused}
          >
            <Text style={styles.watchTxt}>▶  Watch Now</Text>
          </FocusableItem>
          {program.catchupAvailable && (
            <FocusableItem onPress={onCatchup} style={styles.catchupBtn} focusedStyle={catchupBtnFocused}>
              <Text style={styles.catchupBtnTxt}>📅  Catch-Up</Text>
            </FocusableItem>
          )}
          <FocusableItem onPress={onClose} style={styles.cancelBtn} focusedStyle={closeBtnFocused}>
            <Text style={styles.cancelTxt}>Close</Text>
          </FocusableItem>
        </View>

      </TouchableOpacity>
    </TouchableOpacity>
  );
};

export default memo(ProgramInfoModal);

function createStyles(theme: Theme) {
  return StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.82)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 50,
      elevation: 50,
    },
    modal: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: TV ? 28 : 20,
      width: '100%',
      maxWidth: TV ? 720 : 520,
      gap: 14,
      elevation: 50,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    logoWrap: {
      width: TV ? 52 : 40,
      height: TV ? 52 : 40,
      borderRadius: 10,
      overflow: 'hidden',
      backgroundColor: theme.card,
    },
    logo: { width: '100%', height: '100%' },
    logoBg: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.card },
    logoInitials: { color: theme.textMuted, fontSize: TV ? 18 : 14, fontWeight: '800' },
    chName: { color: theme.text, fontSize: TV ? 18 : 15, fontWeight: '800' },
    badges: { flexDirection: 'row', gap: 6, marginTop: 4 },
    liveBadge: {
      backgroundColor: theme.live,
      borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
    },
    liveTxt: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
    catchupBadge: {
      backgroundColor: theme.accent + '22',
      borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
      borderWidth: 1, borderColor: theme.accent,
    },
    catchupTxt: { color: theme.accent, fontSize: 10, fontWeight: '700' },
    closeBtn: {
      width: TV ? 38 : 32, height: TV ? 38 : 32,
      borderRadius: 8, backgroundColor: theme.card,
      borderWidth: 1, borderColor: theme.border,
      justifyContent: 'center', alignItems: 'center',
    },
    closeTxt: { color: theme.textMuted, fontSize: TV ? 15 : 13, fontWeight: '700' },
    divider: { height: 1, backgroundColor: theme.border },
    progHeader: { gap: 5 },
    progTitle: {
      color: theme.text,
      fontSize: TV ? 24 : 18,
      fontWeight: '800',
      lineHeight: TV ? 30 : 24,
    },
    progMeta: { color: theme.textMuted, fontSize: TV ? 13 : 12, fontWeight: '500' },
    duration: { color: theme.textMuted },
    progressTrack: {
      height: 4, backgroundColor: theme.card, borderRadius: 2, overflow: 'hidden',
    },
    progressFill: { height: '100%', backgroundColor: theme.accent, borderRadius: 2 },
    descScroll: { maxHeight: TV ? 100 : 80 },
    desc: { color: theme.textSub, fontSize: TV ? 15 : 13, lineHeight: TV ? 24 : 20 },
    noDesc: { color: theme.textMuted, fontSize: TV ? 14 : 12, fontStyle: 'italic' },
    actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    watchBtn: {
      flex: 1, paddingVertical: TV ? 14 : 10,
      backgroundColor: theme.accent, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
    },
    watchTxt: { color: theme.accentText, fontSize: TV ? 15 : 13, fontWeight: '800' },
    catchupBtn: {
      paddingHorizontal: TV ? 20 : 14, paddingVertical: TV ? 14 : 10,
      backgroundColor: theme.surface, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: theme.accent,
    },
    catchupBtnTxt: { color: theme.accent, fontSize: TV ? 14 : 12, fontWeight: '700' },
    cancelBtn: {
      paddingHorizontal: TV ? 20 : 14, paddingVertical: TV ? 14 : 10,
      backgroundColor: theme.card, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: theme.border,
    },
    cancelTxt: { color: theme.textSub, fontSize: TV ? 14 : 12, fontWeight: '700' },
  });
}
