import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import FocusableItem from '../FocusableItem';
import { ResizeMode } from 'expo-av';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useUIStore } from '../../store/useUIStore';
import { useEPGStore } from '../../store/useEPGStore';
import { RootStackParamList, EPGProgram, Channel } from '../../types';
import { isTvLikePlatform } from '../../utils/platform';
import { formatClockTime } from '../../utils/time';

interface EPGOverlayProps {
  onTogglePlayback: () => void;
  onBack: () => void;
  navigation?: NativeStackNavigationProp<RootStackParamList>;
  programs?: EPGProgram[];
  epgLoading?: boolean;
  epgError?: string | null;
  clockFormat?: '12h' | '24h';
  recentChannels?: Channel[];
  onChannelSelect?: (channel: Channel) => void;
  onMultiScreen?: () => void;
  onSleepTimer?: () => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TV = isTvLikePlatform;
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
  hasTVPreferredFocus?: boolean;
}> = ({ onPress, icon, label, active, hasTVPreferredFocus }) => (
  <FocusableItem
    onPress={onPress}
    hasTVPreferredFocus={hasTVPreferredFocus}
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
  clockFormat = '24h',
  recentChannels = [],
  onChannelSelect,
  onMultiScreen,
  onSleepTimer,
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
  const [ccEnabled, setCcEnabled] = useState(false);

  const close    = useCallback(() => setShowEPG(false), [setShowEPG]);
  const settings = useCallback(() => {
    setShowEPG(false);
    try { navigation?.navigate('Settings', { focusTarget: 'interface' }); } catch {}
  }, [setShowEPG, navigation]);
  const openGuide = useCallback(() => {
    setShowEPG(false);
    useUIStore.getState().setShowEPGGrid(true);
  }, [setShowEPG]);

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
                contentFit="contain"
                cachePolicy="disk"
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

          <FocusableItem
            onPress={openGuide}
            hasTVPreferredFocus={TV}
            style={s.guideFirst}
            focusedStyle={BTN_FOCUSED}
          >
            <View style={s.guideIconBox}>
              <Text style={s.guideIconTxt}>EPG</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.guideFirstTitle}>TV Guide</Text>
              <Text style={s.guideFirstSub}>Browse channels, catchup, and upcoming programs</Text>
            </View>
            <Text style={s.guideFirstArrow}>›</Text>
          </FocusableItem>

          <View style={s.quickActions}>
            {onMultiScreen ? (
              <ActionBtn
                onPress={() => {
                  setShowEPG(false);
                  onMultiScreen();
                }}
                icon="▣"
                label="MultiView"
              />
            ) : null}
            <ActionBtn
              onPress={() => setCcEnabled((value) => !value)}
              icon="CC"
              label={ccEnabled ? 'CC On' : 'CC Off'}
              active={ccEnabled}
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
            {onSleepTimer ? (
              <ActionBtn
                onPress={() => {
                  setShowEPG(false);
                  onSleepTimer();
                }}
                icon="☾"
                label="Sleep"
              />
            ) : null}
          </View>

          {recentChannels.length > 0 ? (
            <>
              <View style={s.divider} />
              <Text style={s.sectionLabel}>HISTORY</Text>
              <View style={s.recentList}>
                {recentChannels.slice(0, 6).map((recentChannel) => (
                  <FocusableItem
                    key={recentChannel.id}
                    onPress={() => {
                      setShowEPG(false);
                      onChannelSelect?.(recentChannel);
                    }}
                    style={s.recentRow}
                    focusedStyle={BTN_FOCUSED}
                  >
                    <Text style={s.recentName} numberOfLines={1}>{recentChannel.name}</Text>
                    <Text style={s.recentGroup} numberOfLines={1}>{recentChannel.group ?? 'Live TV'}</Text>
                  </FocusableItem>
                ))}
              </View>
            </>
          ) : null}

          <View style={s.divider} />

          {/* ── Now Playing ────────────────────────── */}
          {currentProgram ? (
            <View style={{ gap: 8 }}>
              <Text style={s.sectionLabel}>NOW PLAYING</Text>
              <Text style={s.progTitle} numberOfLines={2}>{currentProgram.title}</Text>

              {(() => {
                const ts = formatClockTime(currentProgram.start, clockFormat);
                const te = formatClockTime(currentProgram.end, clockFormat);
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
                const ts = formatClockTime(p.start, clockFormat);
                const te = formatClockTime(p.end, clockFormat);
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

          {/* ── Secondary buttons ───────────────────── */}
          <View style={s.actions}>
            <ActionBtn
              onPress={onTogglePlayback}
              icon={isPlaying ? '⏸' : '▶'}
              label={isPlaying ? 'Pause' : 'Play'}
              active={isPlaying}
            />
            <ActionBtn
              onPress={settings}
              icon="⚙"
              label="Settings"
            />
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
    backgroundColor: 'rgba(0,0,0,0.28)',
    zIndex: 5,
    elevation: 5,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  panel: {
    width: TV ? 620 : 460,
    backgroundColor: 'rgba(8, 12, 20, 0.88)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: -16, height: 0 },
    shadowOpacity: 0.55,
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
  chGroup: { color: '#8fb9e8', fontSize: TV ? 14 : 12, fontWeight: '600' },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-start',
  },
  closeBtnTxt: { color: '#dbeafe', fontSize: 16, fontWeight: '700' },

  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 18 },

  guideFirst: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.36)',
    backgroundColor: 'rgba(31,162,255,0.16)',
    paddingHorizontal: TV ? 18 : 14,
    paddingVertical: TV ? 16 : 12,
  },
  guideIconBox: {
    width: TV ? 58 : 48,
    height: TV ? 48 : 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eaf5ff',
  },
  guideIconTxt: {
    color: '#061225',
    fontSize: TV ? 13 : 11,
    fontWeight: '900',
  },
  guideFirstTitle: {
    color: '#f8fafc',
    fontSize: TV ? 19 : 16,
    fontWeight: '900',
  },
  guideFirstSub: {
    color: '#93c5fd',
    fontSize: TV ? 12 : 10,
    fontWeight: '600',
    marginTop: 3,
  },
  guideFirstArrow: {
    color: '#dbeafe',
    fontSize: TV ? 28 : 22,
    fontWeight: '500',
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  recentList: {
    gap: 8,
  },
  recentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(255,255,255,0.055)',
    paddingHorizontal: TV ? 16 : 12,
    paddingVertical: TV ? 12 : 9,
  },
  recentName: {
    flex: 1,
    color: '#f8fafc',
    fontSize: TV ? 15 : 13,
    fontWeight: '800',
  },
  recentGroup: {
    maxWidth: TV ? 170 : 120,
    color: '#93c5fd',
    fontSize: TV ? 12 : 10,
    fontWeight: '600',
    textAlign: 'right',
  },

  // Now playing
  sectionLabel: {
    color: '#93c5fd',
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
  progTime: { color: '#93c5fd', fontSize: TV ? 14 : 12, fontWeight: '600', marginBottom: 4 },
  progressTrack: {
    height: 3, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 2, overflow: 'hidden', marginBottom: 4,
  },
  progressFill: { height: '100%', backgroundColor: '#e5e5e5', borderRadius: 2 },
  progDesc: { color: '#cbd5e1', fontSize: TV ? 13 : 11, lineHeight: TV ? 19 : 17 },

  // Status / error
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  statusTxt: { color: '#93c5fd', fontSize: TV ? 14 : 12 },
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
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', gap: 12,
  },
  upTitle: { color: '#e2e8f0', fontSize: TV ? 15 : 13, fontWeight: '700' },
  upDesc:  { color: '#94a3b8', fontSize: TV ? 12 : 10, marginTop: 2 },
  upTime:  { color: '#93c5fd', fontSize: TV ? 13 : 11, fontWeight: '700', minWidth: 90, textAlign: 'right' },

  // Actions
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBtn: {
    flex: 1, minWidth: 80, alignItems: 'center',
    paddingVertical: TV ? 16 : 12, paddingHorizontal: 8,
    borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', gap: 5,
  },
  actionBtnActive: { backgroundColor: 'rgba(31,162,255,0.2)', borderColor: 'rgba(125,211,252,0.46)' },
  actionIcon:  { color: '#f5f5f5', fontSize: TV ? 22 : 18 },
  actionLabel: { color: '#cbd5e1', fontSize: TV ? 13 : 11, fontWeight: '700' },
});
