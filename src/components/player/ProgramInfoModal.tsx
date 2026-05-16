import React, { useCallback, memo } from 'react';
import {
  View, Text, StyleSheet, Platform, ScrollView, TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import FocusableItem from '../FocusableItem';
import { useUIStore } from '../../store/useUIStore';
import { usePlayerStore } from '../../store/usePlayerStore';

const TV = Platform.OS === 'android';

const BTN_FOCUSED = {
  backgroundColor: '#ffffff',
  borderColor: '#ffffff',
  borderWidth: 2,
  transform: [] as any[],
  elevation: 6,
};
const DANGER_FOCUSED = {
  backgroundColor: '#ef4444',
  borderColor: '#ef4444',
  borderWidth: 2,
  transform: [] as any[],
  elevation: 6,
};

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
  const showProgramInfo   = useUIStore((s) => s.showProgramInfo);
  const programInfoData   = useUIStore((s) => s.programInfoData);
  const setShowProgramInfo = useUIStore((s) => s.setShowProgramInfo);
  const setChannel  = usePlayerStore((s) => s.setChannel);
  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying);

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
    const catchupChannel = {
      ...programInfoData.channel,
      url: programInfoData.program.catchupUrl,
    };
    setChannel(catchupChannel);
    setIsPlaying(true);
  }, [programInfoData, setChannel, setIsPlaying, setShowProgramInfo]);

  if (!showProgramInfo || !programInfoData) return null;

  const { channel, program } = programInfoData;
  const now = Date.now();
  const startMs = program.start.getTime();
  const endMs = program.end.getTime();
  const progress = Math.min(1, Math.max(0, (now - startMs) / (endMs - startMs)));
  const isLive = startMs <= now && now < endMs;
  const isPast = endMs < now;

  return (
    <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} focusable={false}>
      <TouchableOpacity activeOpacity={1} onPress={() => {}} style={s.modal} focusable={false}>
        {/* Channel + title header */}
        <View style={s.header}>
          <View style={s.logoWrap}>
            {channel.logo ? (
              <Image source={{ uri: channel.logo }} style={s.logo} contentFit="contain" cachePolicy="disk" />
            ) : (
              <View style={s.logoBg}>
                <Text style={s.logoInitials}>{channel.name.substring(0, 2).toUpperCase()}</Text>
              </View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.chName} numberOfLines={1}>{channel.name}</Text>
            <View style={s.badges}>
              {isLive && <View style={s.liveBadge}><Text style={s.liveTxt}>LIVE</Text></View>}
              {program.catchupAvailable && <View style={s.catchupBadge}><Text style={s.catchupTxt}>CATCH-UP</Text></View>}
            </View>
          </View>
          <FocusableItem onPress={onClose} style={s.closeBtn} focusedStyle={BTN_FOCUSED}>
            <Text style={s.closeTxt}>✕</Text>
          </FocusableItem>
        </View>

        <View style={s.divider} />

        {/* Program info */}
        <View style={s.progHeader}>
          <Text style={s.progTitle}>{program.title}</Text>
          <Text style={s.progMeta}>
            {fmtDate(program.start)} · {fmtTime(program.start)} – {fmtTime(program.end)}
            {'  '}
            <Text style={s.duration}>({fmtDuration(startMs, endMs)})</Text>
          </Text>
        </View>

        {/* Progress bar */}
        {(isLive || isPast) && (
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${progress * 100}%` as any }]} />
            {isLive && (
              <Text style={s.progressPct}>{Math.round(progress * 100)}% watched</Text>
            )}
          </View>
        )}

        <View style={s.divider} />

        {/* Description */}
        {program.description ? (
          <ScrollView style={s.descScroll} showsVerticalScrollIndicator={false}>
            <Text style={s.desc}>{program.description}</Text>
          </ScrollView>
        ) : (
          <Text style={s.noDesc}>No description available.</Text>
        )}

        <View style={s.divider} />

        {/* Actions */}
        <View style={s.actions}>
          <FocusableItem
            onPress={onWatch}
            hasTVPreferredFocus
            style={s.watchBtn}
            focusedStyle={BTN_FOCUSED}
          >
            <Text style={s.watchTxt}>▶  Watch Now</Text>
          </FocusableItem>
          {program.catchupAvailable && (
            <FocusableItem onPress={onCatchup} style={s.catchupBtn} focusedStyle={DANGER_FOCUSED}>
              <Text style={s.catchupBtnTxt}>📅  Catch-Up</Text>
            </FocusableItem>
          )}
          <FocusableItem onPress={onClose} style={s.cancelBtn} focusedStyle={BTN_FOCUSED}>
            <Text style={s.cancelTxt}>Close</Text>
          </FocusableItem>
        </View>
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

export default memo(ProgramInfoModal);

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
    elevation: 50,
  },
  modal: {
    backgroundColor: '#111111',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    padding: TV ? 36 : 24,
    width: '100%',
    maxWidth: TV ? 780 : 560,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.9,
    shadowRadius: 48,
    elevation: 50,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  logoWrap: {
    width: TV ? 64 : 48,
    height: TV ? 64 : 48,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1e1e1e',
  },
  logo: { width: '100%', height: '100%' },
  logoBg: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#222' },
  logoInitials: { color: '#555', fontSize: TV ? 22 : 16, fontWeight: '800' },
  chName: { color: '#f5f5f5', fontSize: TV ? 20 : 16, fontWeight: '800' },
  badges: { flexDirection: 'row', gap: 6, marginTop: 4 },
  liveBadge: { backgroundColor: '#ef4444', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  liveTxt: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  catchupBadge: { backgroundColor: '#1d4ed8', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  catchupTxt: { color: '#fff', fontSize: 10, fontWeight: '700' },
  closeBtn: {
    width: TV ? 42 : 36, height: TV ? 42 : 36,
    borderRadius: 10, backgroundColor: '#1a1a1a',
    borderWidth: 1, borderColor: '#2a2a2a',
    justifyContent: 'center', alignItems: 'center',
  },
  closeTxt: { color: '#555', fontSize: TV ? 17 : 15, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#1a1a1a' },
  progHeader: { gap: 6 },
  progTitle: { color: '#f5f5f5', fontSize: TV ? 26 : 20, fontWeight: '800', lineHeight: TV ? 34 : 26 },
  progMeta: { color: '#555', fontSize: TV ? 15 : 13, fontWeight: '500' },
  duration: { color: '#3d3d3d' },
  progressTrack: {
    height: 6, backgroundColor: '#1e1e1e', borderRadius: 3,
    overflow: 'hidden', position: 'relative',
  },
  progressFill: { height: '100%', backgroundColor: '#f5f5f5', borderRadius: 3 },
  progressPct: {
    position: 'absolute', right: 0, top: -18,
    color: '#555', fontSize: 12, fontWeight: '600',
  },
  descScroll: { maxHeight: TV ? 120 : 90 },
  desc: { color: '#888', fontSize: TV ? 16 : 14, lineHeight: TV ? 26 : 22 },
  noDesc: { color: '#333', fontSize: TV ? 15 : 13, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  watchBtn: {
    flex: 1, paddingVertical: TV ? 16 : 12,
    backgroundColor: '#f5f5f5', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  watchTxt: { color: '#0a0a0a', fontSize: TV ? 16 : 14, fontWeight: '800' },
  catchupBtn: {
    paddingHorizontal: TV ? 24 : 18, paddingVertical: TV ? 16 : 12,
    backgroundColor: '#1e3a8a', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#1d4ed8',
  },
  catchupBtnTxt: { color: '#93c5fd', fontSize: TV ? 15 : 13, fontWeight: '700' },
  cancelBtn: {
    paddingHorizontal: TV ? 24 : 18, paddingVertical: TV ? 16 : 12,
    backgroundColor: '#161616', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#222',
  },
  cancelTxt: { color: '#555', fontSize: TV ? 15 : 13, fontWeight: '700' },
});
