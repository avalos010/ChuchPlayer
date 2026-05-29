import React, { useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
  View, Text, StyleSheet, Platform, Animated, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { ResizeMode } from 'expo-av';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import FocusableItem from '../FocusableItem';
import { Channel, EPGProgram, RootStackParamList } from '../../types';
import { useUIStore } from '../../store/useUIStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { isTvLikePlatform } from '../../utils/platform';

interface ChannelInfoBarProps {
  channel: Channel | null;
  currentProgram: EPGProgram | null;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onTogglePlayback: () => void;
  onMultiScreen?: () => void;
  onSleepTimer: () => void;
  sleepLabel: string | null;
  navigation?: NativeStackNavigationProp<RootStackParamList>;
  timeoutSeconds?: number;
}

const TV = isTvLikePlatform;
const LOGO_SZ = TV ? 56 : 42;

const fmt = (d: Date) =>
  d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const aspectLabel = (m: ResizeMode) =>
  m === ResizeMode.COVER ? 'Cover' : m === ResizeMode.CONTAIN ? 'Fit' : 'Fill';

// ─── Focused style for every button ──────────────────────────────────────────
const BTN_FOCUSED = {
  backgroundColor: '#0ea5e9',
  borderColor: '#0ea5e9',
  borderWidth: 2,
  transform: [] as any[],
  elevation: 8,
};

// ─── Single control button ────────────────────────────────────────────────────
const Ctrl: React.FC<{
  icon: string;
  label: string;
  onPress: () => void;
  onFocus: () => void;
  onBlur: () => void;
  active?: boolean;
  iconStyle?: object;
}> = ({ icon, label, onPress, onFocus, onBlur, active, iconStyle }) => (
  <FocusableItem
    onPress={onPress}
    onFocus={onFocus}
    onBlur={onBlur}
    style={[s.ctrlBtn, active ? s.ctrlBtnActive : null]}
    focusedStyle={BTN_FOCUSED}
  >
    <Text style={[s.ctrlIcon, iconStyle]}>{icon}</Text>
    <Text style={s.ctrlLabel}>{label}</Text>
  </FocusableItem>
);

// ─── Main component ───────────────────────────────────────────────────────────
const ChannelInfoBar: React.FC<ChannelInfoBarProps> = ({
  channel,
  currentProgram,
  isFavorite,
  onToggleFavorite,
  onTogglePlayback,
  onMultiScreen,
  onSleepTimer,
  sleepLabel,
  navigation,
  timeoutSeconds = 6,
}) => {
  const isPlaying       = usePlayerStore((st) => st.isPlaying);
  const resizeMode      = usePlayerStore((st) => st.resizeMode);
  const cycleResizeMode = usePlayerStore((st) => st.cycleResizeMode);

  const showInfoBar    = useUIStore((st) => st.showInfoBar);
  const setShowInfoBar = useUIStore((st) => st.setShowInfoBar);

  const slideAnim   = useRef(new Animated.Value(200)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const hideTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [progress,      setProgress]      = React.useState(0);
  const [focused,       setFocused]        = React.useState(false);
  const [imgErr,        setImgErr]         = React.useState(false);

  React.useEffect(() => { setImgErr(false); }, [channel?.id]);

  // ── auto-hide ──────────────────────────────────────────────────────────────
  const cancelHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const scheduleHide = useCallback(() => {
    cancelHide();
    if (timeoutSeconds === 0 || focused) return;
    hideTimer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideAnim,   { toValue: 200, duration: 350, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0,   duration: 350, useNativeDriver: true }),
      ]).start(() => setShowInfoBar(false));
    }, timeoutSeconds * 1000);
  }, [focused, timeoutSeconds, cancelHide, slideAnim, opacityAnim, setShowInfoBar]);

  useEffect(() => {
    if (!showInfoBar) {
      cancelHide();
      return;
    }
    Animated.parallel([
      Animated.spring(slideAnim,   { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    scheduleHide();
    return cancelHide;
  }, [showInfoBar]); // eslint-disable-line react-hooks/exhaustive-deps

  // restart hide timer when focus leaves buttons
  useEffect(() => {
    if (!focused) scheduleHide();
    else cancelHide();
  }, [focused]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── progress bar ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentProgram) { setProgress(0); return; }
    const tick = () => {
      const now = Date.now();
      const s   = currentProgram.start.getTime();
      const e   = currentProgram.end.getTime();
      setProgress(Math.min(1, Math.max(0, (now - s) / (e - s))));
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [currentProgram]);

  const onFocus = useCallback(() => { setFocused(true);  }, []);
  const onBlur  = useCallback(() => { setFocused(false); }, []);

  if (!showInfoBar || !channel) return null;

  return (
    <Animated.View
      style={[s.container, { transform: [{ translateY: slideAnim }], opacity: opacityAnim }]}
      pointerEvents="box-none"
    >
      {/* ── Info row ──────────────────────────────────────────────────────── */}
      <View style={s.infoRow}>
        {/* Logo */}
        <View style={s.logoWrap}>
          {channel.logo && !imgErr ? (
            <Image
              source={{ uri: channel.logo }}
              style={s.logo}
              contentFit="contain"
              cachePolicy="disk"
              onError={() => setImgErr(true)}
            />
          ) : (
            <View style={s.logoFallback}>
              <Text style={s.logoInitials}>{channel.name.substring(0, 2).toUpperCase()}</Text>
            </View>
          )}
        </View>

        {/* Channel + program text */}
        <View style={s.textBlock}>
          <Text style={s.chName} numberOfLines={1}>{channel.name}</Text>
          {currentProgram ? (
            <Text style={s.progName} numberOfLines={1}>{currentProgram.title}</Text>
          ) : null}
        </View>

        {/* Right side — time + sleep badge */}
        <View style={s.rightBlock}>
          {currentProgram ? (
            <Text style={s.timeRange}>{fmt(currentProgram.start)} – {fmt(currentProgram.end)}</Text>
          ) : null}
          {sleepLabel ? (
            <View style={s.sleepPill}>
              <Text style={s.sleepPillTxt}>💤 {sleepLabel}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* ── Progress bar ──────────────────────────────────────────────────── */}
      <View style={s.progressBg} pointerEvents="none">
        <View style={[s.progressFg, { width: `${progress * 100}%` as any }]} />
      </View>

      {/* ── Separator ─────────────────────────────────────────────────────── */}
      <View style={s.sep} />

      {/* ── Controls row ──────────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.ctrlsRow}
        pointerEvents="box-none"
      >
        <Ctrl icon={isPlaying ? '⏸' : '▶'} label={isPlaying ? 'Pause' : 'Play'}
          onPress={onTogglePlayback} onFocus={onFocus} onBlur={onBlur} active={isPlaying} />

        <Ctrl icon="▦" label={aspectLabel(resizeMode)}
          onPress={cycleResizeMode} onFocus={onFocus} onBlur={onBlur} />

        <Ctrl icon="CC" label="Captions"
          onPress={() => { setShowInfoBar(false); setTimeout(() => navigation?.navigate('Settings', { focusTarget: 'interface' }), 80); }}
          onFocus={onFocus} onBlur={onBlur} />

        {onMultiScreen ? (
          <Ctrl icon="📺" label="Multi" onPress={onMultiScreen} onFocus={onFocus} onBlur={onBlur} />
        ) : null}

        <Ctrl
          icon={isFavorite ? '★' : '☆'}
          label="Fav"
          onPress={onToggleFavorite}
          onFocus={onFocus}
          onBlur={onBlur}
          active={isFavorite}
          iconStyle={isFavorite ? s.favIcon : undefined}
        />

        <Ctrl icon="💤" label="Sleep" onPress={onSleepTimer} onFocus={onFocus} onBlur={onBlur} />

        <Ctrl icon="📅" label="Guide"
          onPress={() => { setShowInfoBar(false); useUIStore.getState().setShowEPGGrid(true); }}
          onFocus={onFocus} onBlur={onBlur} />

        <Ctrl icon="⚙" label="Settings"
          onPress={() => { setShowInfoBar(false); setTimeout(() => navigation?.navigate('Settings', { focusTarget: 'interface' }), 80); }}
          onFocus={onFocus} onBlur={onBlur} />
      </ScrollView>
    </Animated.View>
  );
};

export default memo(ChannelInfoBar);

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(6, 8, 18, 0.97)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    zIndex: 30,
    elevation: 30,
  },

  // Info row
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: TV ? 28 : 16,
    paddingTop: TV ? 18 : 12,
    paddingBottom: TV ? 12 : 8,
    gap: TV ? 16 : 10,
  },
  logoWrap: {
    width: LOGO_SZ,
    height: LOGO_SZ,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#111827',
  },
  logo: { width: '100%', height: '100%' },
  logoFallback: {
    flex: 1,
    backgroundColor: '#1e2130',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoInitials: {
    color: '#94a3b8',
    fontSize: TV ? 18 : 14,
    fontWeight: '800',
  },
  textBlock: { flex: 1, gap: 3 },
  chName: {
    color: '#f1f5f9',
    fontSize: TV ? 22 : 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  progName: {
    color: '#64748b',
    fontSize: TV ? 14 : 11,
    fontWeight: '500',
  },
  rightBlock: {
    alignItems: 'flex-end',
    gap: 5,
  },
  timeRange: {
    color: '#475569',
    fontSize: TV ? 14 : 11,
    fontWeight: '600',
  },
  sleepPill: {
    backgroundColor: '#1e2130',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#0ea5e9',
  },
  sleepPillTxt: {
    color: '#0ea5e9',
    fontSize: TV ? 11 : 9,
    fontWeight: '700',
  },

  // Progress
  progressBg: {
    height: 3,
    backgroundColor: '#1e293b',
    marginHorizontal: TV ? 28 : 16,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFg: {
    height: '100%',
    backgroundColor: '#0ea5e9',
    borderRadius: 2,
  },

  // Separator
  sep: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginTop: TV ? 14 : 10,
  },

  // Controls row
  ctrlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: TV ? 20 : 12,
    paddingVertical: TV ? 14 : 10,
    gap: TV ? 10 : 7,
  },
  ctrlBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: TV ? 12 : 8,
    paddingHorizontal: TV ? 20 : 14,
    minWidth: TV ? 84 : 62,
    borderRadius: 10,
    backgroundColor: '#0d1117',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: TV ? 5 : 3,
  },
  ctrlBtnActive: {
    backgroundColor: '#0c1829',
    borderColor: 'rgba(14,165,233,0.35)',
  },
  ctrlIcon: {
    color: '#cbd5e1',
    fontSize: TV ? 20 : 16,
    fontWeight: '700',
  },
  ctrlLabel: {
    color: '#475569',
    fontSize: TV ? 11 : 9,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  favIcon: { color: '#f59e0b' },
});
