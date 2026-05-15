import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  StyleSheet,
  Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import FocusableItem from '../FocusableItem';
import { ResizeMode } from 'expo-av';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useUIStore } from '../../store/useUIStore';
import { useEPGStore } from '../../store/useEPGStore';
import { RootStackParamList, EPGProgram } from '../../types';

interface EPGOverlayProps {
  onTogglePlayback: () => void;
  onBack: () => void;
  navigation?: NativeStackNavigationProp<RootStackParamList>;
  programs?: EPGProgram[];
  epgLoading?: boolean;
  epgError?: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TV = Platform.OS === 'android';
const TS = TV ? 1.15 : 1;

const BTN_FOCUSED = {
  backgroundColor: '#ffffff',
  borderColor: '#ffffff',
  borderWidth: 2,
  transform: [] as any[],
  elevation: 8,
  shadowColor: '#ffffff',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.25,
  shadowRadius: 10,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtTime = (d?: Date | null): string => {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const progressPct = (start?: Date | null, end?: Date | null): number => {
  if (!start || !end) return 0;
  const now = Date.now();
  const s = (start instanceof Date ? start : new Date(start)).getTime();
  const e = (end instanceof Date ? end : new Date(end)).getTime();
  if (now < s || now > e) return 0;
  return Math.min(100, ((now - s) / (e - s)) * 100);
};

// ─── Small sub-component ─────────────────────────────────────────────────────

const ActionBtn: React.FC<{
  onPress: () => void;
  icon: string;
  label: string;
  active?: boolean;
}> = ({ onPress, icon, label, active }) => (
  <FocusableItem
    onPress={onPress}
    style={[s.actionBtn, active ? s.actionBtnActive : null]}
    focusedStyle={BTN_FOCUSED}
  >
    <Text style={s.actionIcon}>{icon}</Text>
    <Text style={s.actionLabel}>{label}</Text>
  </FocusableItem>
);

// ─── Main component ──────────────────────────────────────────────────────────

const EPGOverlay: React.FC<EPGOverlayProps> = ({
  onTogglePlayback,
  onBack,
  navigation,
  programs = [],
  epgLoading = false,
  epgError = null,
}) => {
  const channel        = usePlayerStore((st) => st.channel);
  const isPlaying      = usePlayerStore((st) => st.isPlaying);
  const resizeMode     = usePlayerStore((st) => st.resizeMode);
  const error          = usePlayerStore((st) => st.error);
  const cycleResizeMode = usePlayerStore((st) => st.cycleResizeMode);
  const showEPG        = useUIStore((st) => st.showEPG);
  const setShowEPG     = useUIStore((st) => st.setShowEPG);
  const currentProgram = useEPGStore((st) => st.currentProgram);

  const [imgErr, setImgErr] = useState(false);

  const close    = useCallback(() => setShowEPG(false), [setShowEPG]);
  const settings = useCallback(() => {
    setShowEPG(false);
    try { navigation?.navigate('Settings'); } catch {}
  }, [setShowEPG, navigation]);

  const upcoming = useMemo(() => {
    if (!programs.length) return [];
    const now = new Date();
    return programs
      .filter(p => p.end > now && (!currentProgram || p.id !== currentProgram.id))
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 5);
  }, [programs, currentProgram]);

  const progress = useMemo(
    () => progressPct(currentProgram?.start, currentProgram?.end),
    [currentProgram],
  );

  if (!showEPG || error || !channel) return null;

  const logoSz = TV ? 96 : 80;

  return (
    // Dark backdrop — tap outside panel to dismiss
    <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={close}>
      {/* Panel absorbs taps so backdrop doesn't fire inside */}
      <TouchableOpacity activeOpacity={1} onPress={() => {}} style={s.panel}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

          {/* ── Channel header ─────────────────────── */}
          <View style={s.chRow}>
            {channel.logo && !imgErr ? (
              <Image
                source={{ uri: channel.logo }}
                style={{ width: logoSz, height: logoSz, borderRadius: 12, backgroundColor: '#1a1a1a' }}
                resizeMode="contain"
                onError={() => setImgErr(true)}
              />
            ) : (
              <View style={[s.logoFallback, { width: logoSz, height: logoSz }]}>
                <Text style={s.logoInitials}>
                  {channel.name.substring(0, 2).toUpperCase()}
                </Text>
              </View>
            )}

            <View style={s.chMeta}>
              <Text style={s.chName} numberOfLines={2}>{channel.name}</Text>
              {channel.group ? (
                <Text style={s.chGroup} numberOfLines={1}>{channel.group}</Text>
              ) : null}
            </View>

            <FocusableItem onPress={close} style={s.closeBtn} focusedStyle={BTN_FOCUSED}>
              <Text style={s.closeBtnTxt}>✕</Text>
            </FocusableItem>
          </View>

          <View style={s.divider} />

          {/* ── Now Playing ────────────────────────── */}
          {currentProgram ? (
            <View style={{ gap: 8 }}>
              <Text style={s.sectionLabel}>NOW PLAYING</Text>
              <Text style={s.progTitle} numberOfLines={2}>{currentProgram.title}</Text>

              {(() => {
                const ts = fmtTime(currentProgram.start);
                const te = fmtTime(currentProgram.end);
                return ts && te ? (
                  <Text style={s.progTime}>{ts} – {te}</Text>
                ) : null;
              })()}

              {progress > 0 && (
                <View style={s.progressTrack}>
                  <View style={[s.progressFill, { width: `${progress}%` as any }]} />
                </View>
              )}

              {typeof currentProgram.description === 'string' &&
               currentProgram.description.trim().length > 0 && (
                <Text style={s.progDesc} numberOfLines={3}>
                  {currentProgram.description.trim()}
                </Text>
              )}
            </View>
          ) : epgLoading ? (
            <View style={s.statusRow}>
              <ActivityIndicator size="small" color="#555555" />
              <Text style={s.statusTxt}>Loading guide…</Text>
            </View>
          ) : epgError ? (
            <View style={s.errBox}>
              <Text style={s.errTitle}>Guide unavailable</Text>
              <Text style={s.errDesc} numberOfLines={2}>{epgError}</Text>
            </View>
          ) : (
            <View style={s.statusRow}>
              <Text style={s.statusTxt}>No program info available</Text>
            </View>
          )}

          {/* ── Upcoming ───────────────────────────── */}
          {upcoming.length > 0 && (
            <>
              <View style={s.divider} />
              <Text style={s.sectionLabel}>UP NEXT</Text>
              {upcoming.map(p => {
                const ts = fmtTime(p.start);
                const te = fmtTime(p.end);
                return (
                  <View key={p.id} style={s.upRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.upTitle} numberOfLines={1}>{p.title}</Text>
                      {typeof p.description === 'string' && p.description.trim() ? (
                        <Text style={s.upDesc} numberOfLines={1}>{p.description.trim()}</Text>
                      ) : null}
                    </View>
                    {ts && te ? (
                      <Text style={s.upTime}>{ts}–{te}</Text>
                    ) : null}
                  </View>
                );
              })}
            </>
          )}

          <View style={s.divider} />

          {/* ── Action buttons ─────────────────────── */}
          <View style={s.actions}>
            <ActionBtn
              onPress={onTogglePlayback}
              icon={isPlaying ? '⏸' : '▶'}
              label={isPlaying ? 'Pause' : 'Play'}
              active={isPlaying}
            />
            <ActionBtn
              onPress={cycleResizeMode}
              icon="▦"
              label={
                resizeMode === ResizeMode.COVER ? 'Cover'
                  : resizeMode === ResizeMode.CONTAIN ? 'Fit'
                  : 'Stretch'
              }
            />
            <ActionBtn onPress={settings} icon="⚙" label="Settings" />
            <ActionBtn onPress={close}    icon="←" label="Close" />
          </View>

        </ScrollView>
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

export default EPGOverlay;

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    zIndex: 5,
    elevation: 5,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  panel: {
    width: TV ? 560 : 460,
    backgroundColor: '#111111',
    borderLeftWidth: 1,
    borderLeftColor: '#1f1f1f',
    shadowColor: '#000',
    shadowOffset: { width: -16, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 40,
    elevation: 20,
  },
  scroll: {
    padding: TV ? 32 : 24,
    paddingBottom: 52,
  },

  // Channel header
  chRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 4 },
  logoFallback: {
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#272727',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoInitials: { color: '#f5f5f5', fontSize: TV ? 26 : 22, fontWeight: '800' },
  chMeta: { flex: 1 },
  chName: {
    color: '#f5f5f5',
    fontSize: TV ? 26 : 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: TV ? 32 : 28,
    marginBottom: 4,
  },
  chGroup: { color: '#4a4a4a', fontSize: TV ? 14 : 12, fontWeight: '500' },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#272727',
    justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-start',
  },
  closeBtnTxt: { color: '#4a4a4a', fontSize: 16, fontWeight: '700' },

  divider: { height: 1, backgroundColor: '#1a1a1a', marginVertical: 20 },

  // Now playing
  sectionLabel: {
    color: '#3d3d3d',
    fontSize: TV ? 11 : 10,
    fontWeight: '700',
    letterSpacing: 2.5,
    marginBottom: 10,
  },
  progTitle: {
    color: '#f5f5f5',
    fontSize: TV ? 22 : 18,
    fontWeight: '700',
    lineHeight: TV ? 28 : 24,
    marginBottom: 4,
  },
  progTime: { color: '#4a4a4a', fontSize: TV ? 14 : 12, fontWeight: '500', marginBottom: 4 },
  progressTrack: {
    height: 3, backgroundColor: '#1f1f1f', borderRadius: 2, overflow: 'hidden', marginBottom: 4,
  },
  progressFill: { height: '100%', backgroundColor: '#e5e5e5', borderRadius: 2 },
  progDesc: { color: '#4a4a4a', fontSize: TV ? 13 : 11, lineHeight: TV ? 19 : 17 },

  // Status / error
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  statusTxt: { color: '#3d3d3d', fontSize: TV ? 14 : 12 },
  errBox: {
    backgroundColor: 'rgba(239,68,68,0.07)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.18)',
    borderRadius: 10, padding: 14,
  },
  errTitle: { color: '#f87171', fontSize: TV ? 14 : 12, fontWeight: '600', marginBottom: 4 },
  errDesc:  { color: '#f87171', fontSize: TV ? 12 : 11, opacity: 0.7 },

  // Upcoming
  upRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#191919', gap: 12,
  },
  upTitle: { color: '#8a8a8a', fontSize: TV ? 15 : 13, fontWeight: '600' },
  upDesc:  { color: '#3d3d3d', fontSize: TV ? 12 : 10, marginTop: 2 },
  upTime:  { color: '#555555', fontSize: TV ? 13 : 11, fontWeight: '600', minWidth: 90, textAlign: 'right' },

  // Actions
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBtn: {
    flex: 1, minWidth: 80, alignItems: 'center',
    paddingVertical: TV ? 16 : 12, paddingHorizontal: 8,
    borderRadius: 12, backgroundColor: '#161616',
    borderWidth: 1, borderColor: '#222222', gap: 5,
  },
  actionBtnActive: { backgroundColor: '#1c1c1c', borderColor: '#303030' },
  actionIcon:  { color: '#f5f5f5', fontSize: TV ? 22 : 18 },
  actionLabel: { color: '#555555', fontSize: TV ? 13 : 11, fontWeight: '600' },
});
