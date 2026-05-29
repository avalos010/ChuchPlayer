import React, { useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
  View, Text, StyleSheet, Platform, Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { ResizeMode } from 'expo-av';
import { MaterialCommunityIcons as MCI } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import FocusableItem from '../FocusableItem';
import { Channel, EPGProgram, RootStackParamList } from '../../types';
import { useUIStore } from '../../store/useUIStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { isTvLikePlatform } from '../../utils/platform';
import { formatClockTime } from '../../utils/time';
import { useThemeStore } from '../../store/useThemeStore';
import { Theme } from '../../theme/themes';

interface ChannelInfoBarProps {
  channel: Channel | null;
  currentProgram: EPGProgram | null;
  nextProgram?: EPGProgram | null;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onTogglePlayback: () => void;
  onMultiScreen?: () => void;
  onSleepTimer: () => void;
  sleepLabel: string | null;
  navigation?: NativeStackNavigationProp<RootStackParamList>;
  timeoutSeconds?: number;
  clockFormat?: '12h' | '24h';
}

const TV = isTvLikePlatform;
const LOGO_SZ = TV ? 60 : 44;

const aspectLabel = (m: ResizeMode) =>
  m === ResizeMode.COVER ? 'Cover' : m === ResizeMode.CONTAIN ? 'Fit' : 'Fill';

// ─── Control button ───────────────────────────────────────────────────────────
const ICON_SZ = TV ? 22 : 18;

const Ctrl: React.FC<{
  icon: React.ComponentProps<typeof MCI>['name'];
  label: string;
  onPress: () => void;
  onFocus: () => void;
  onBlur: () => void;
  active?: boolean;
  hasTVPreferredFocus?: boolean;
}> = ({ icon, label, onPress, onFocus, onBlur, active, hasTVPreferredFocus }) => {
  const theme = useThemeStore((st) => st.theme);
  const s = useMemo(() => createStyles(theme), [theme]);
  const focusedStyle = useMemo(() => ({
    backgroundColor: theme.cardActive,
    borderColor: theme.accent,
    borderWidth: 2,
    transform: [] as any[],
    elevation: 8,
  }), [theme]);
  return (
    <FocusableItem
      onPress={onPress}
      onFocus={onFocus}
      onBlur={onBlur}
      hasTVPreferredFocus={hasTVPreferredFocus}
      style={[s.btn, active && s.btnActive]}
      focusedStyle={focusedStyle}
    >
      <View style={s.btnIconWrap}>
        <MCI name={icon} size={ICON_SZ} color={active ? theme.accent : theme.textSub} />
      </View>
      <Text style={[s.btnLabel, active && s.btnLabelActive]}>{label}</Text>
    </FocusableItem>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const ChannelInfoBar: React.FC<ChannelInfoBarProps> = ({
  channel,
  currentProgram,
  nextProgram,
  isFavorite,
  onToggleFavorite,
  onTogglePlayback,
  onMultiScreen,
  onSleepTimer,
  sleepLabel,
  navigation,
  timeoutSeconds = 6,
  clockFormat = '24h',
}) => {
  const theme = useThemeStore((st) => st.theme);
  const s     = useMemo(() => createStyles(theme), [theme]);

  const isPlaying       = usePlayerStore((st) => st.isPlaying);
  const resizeMode      = usePlayerStore((st) => st.resizeMode);
  const cycleResizeMode = usePlayerStore((st) => st.cycleResizeMode);
  const showInfoBar     = useUIStore((st) => st.showInfoBar);
  const setShowInfoBar  = useUIStore((st) => st.setShowInfoBar);

  const slideAnim    = useRef(new Animated.Value(300)).current;
  const opacityAnim  = useRef(new Animated.Value(0)).current;
  const hideTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const [progress, setProgress] = React.useState(0);
  const [focused, setFocused]   = React.useState(false);
  const [imgErr, setImgErr]     = React.useState(false);

  React.useEffect(() => { setImgErr(false); }, [channel?.id]);

  const cancelHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const scheduleHide = useCallback(() => {
    cancelHide();
    if (timeoutSeconds === 0 || focused) return;
    hideTimer.current = setTimeout(() => {
      animationRef.current?.stop();
      animationRef.current = Animated.parallel([
        Animated.timing(slideAnim,   { toValue: 300, duration: 300, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0,   duration: 300, useNativeDriver: true }),
      ]);
      animationRef.current.start(() => {
        animationRef.current = null;
        setShowInfoBar(false);
      });
    }, timeoutSeconds * 1000);
  }, [focused, timeoutSeconds, cancelHide, slideAnim, opacityAnim, setShowInfoBar]);

  useEffect(() => {
    if (!showInfoBar) { cancelHide(); animationRef.current?.stop(); return; }
    animationRef.current?.stop();
    animationRef.current = Animated.parallel([
      Animated.spring(slideAnim,   { toValue: 0, tension: 55, friction: 11, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]);
    animationRef.current.start(() => { animationRef.current = null; });
    scheduleHide();
    return () => { cancelHide(); animationRef.current?.stop(); };
  }, [showInfoBar]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!focused) scheduleHide(); else cancelHide();
  }, [focused]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const onFocus = useCallback(() => setFocused(true),  []);
  const onBlur  = useCallback(() => setFocused(false), []);

  if (!showInfoBar || !channel) return null;

  const initials = channel.name.substring(0, 2).toUpperCase();
  const pct = Math.round(progress * 100);
  const minsLeft = currentProgram
    ? Math.max(0, Math.round((currentProgram.end.getTime() - Date.now()) / 60_000))
    : null;

  return (
    <Animated.View
      style={[s.container, { transform: [{ translateY: slideAnim }], opacity: opacityAnim }]}
      pointerEvents="box-none"
    >
      {/* ── Main content ─────────────────────────────────────────────────── */}
      <View style={s.main}>
        {/* ── Info row ─────────────────────────────────────────────────── */}
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
                <Text style={s.initials}>{initials}</Text>
              </View>
            )}
          </View>

          {/* Text */}
          <View style={s.textBlock}>
            <View style={s.nameRow}>
              <View style={s.liveDot} />
              <Text style={s.chName} numberOfLines={1}>{channel.name}</Text>
              {channel.catchupAvailable && (
                <View style={s.catchupBadge}><Text style={s.catchupTxt}>⏮</Text></View>
              )}
              {sleepLabel && (
                <View style={s.sleepBadge}><Text style={s.sleepTxt}>💤 {sleepLabel}</Text></View>
              )}
            </View>

            {currentProgram ? (
              <Text style={s.progName} numberOfLines={1}>{currentProgram.title}</Text>
            ) : (
              <Text style={s.progName}>Live TV</Text>
            )}

            {nextProgram ? (
                <Text style={s.nextProg} numberOfLines={1}>
                Next · {formatClockTime(nextProgram.start, clockFormat)} · {nextProgram.title}
                </Text>
            ) : null}
          </View>

          {/* Time + progress % */}
          <View style={s.rightBlock}>
            {currentProgram ? (
              <>
                <Text style={s.timeRange}>
                  {formatClockTime(currentProgram.start, clockFormat)} – {formatClockTime(currentProgram.end, clockFormat)}
                </Text>
                {minsLeft !== null && (
                  <Text style={s.pct}>{minsLeft}m left</Text>
                )}
              </>
            ) : null}
          </View>
        </View>

        {/* ── Progress bar ─────────────────────────────────────────────── */}
        <View style={s.progressWrap} pointerEvents="none">
          <View style={s.progressBg}>
            <View style={[s.progressFg, { width: `${pct}%` as any }]} />
          </View>
        </View>

        {/* ── Divider ──────────────────────────────────────────────────── */}
        <View style={s.divider} />

        {/* ── Controls ─────────────────────────────────────────────────── */}
        <View style={s.controls}>
          <Ctrl
            icon={isPlaying ? 'pause' : 'play'}
            label={isPlaying ? 'Pause' : 'Play'}
            onPress={onTogglePlayback}
            onFocus={onFocus}
            onBlur={onBlur}
            active={isPlaying}
            hasTVPreferredFocus={TV}
          />

          <Ctrl
            icon="aspect-ratio"
            label={aspectLabel(resizeMode)}
            onPress={cycleResizeMode}
            onFocus={onFocus}
            onBlur={onBlur}
          />

          <Ctrl
            icon={isFavorite ? 'star' : 'star-outline'}
            label="Favorite"
            onPress={onToggleFavorite}
            onFocus={onFocus}
            onBlur={onBlur}
            active={isFavorite}
          />

          {onMultiScreen && (
            <Ctrl
              icon="picture-in-picture-top-right"
              label="Multi"
              onPress={onMultiScreen}
              onFocus={onFocus}
              onBlur={onBlur}
            />
          )}

          <Ctrl
            icon="television-guide"
            label="Guide"
            onPress={() => {
              setShowInfoBar(false);
              useUIStore.getState().setShowEPGGrid(true);
            }}
            onFocus={onFocus}
            onBlur={onBlur}
          />

          <Ctrl
            icon="sleep"
            label="Sleep"
            onPress={onSleepTimer}
            onFocus={onFocus}
            onBlur={onBlur}
          />

          <Ctrl
            icon="cog-outline"
            label="Settings"
            onPress={() => {
              setShowInfoBar(false);
              setTimeout(() => navigation?.navigate('Settings', { focusTarget: 'interface' }), 80);
            }}
            onFocus={onFocus}
            onBlur={onBlur}
          />
        </View>
      </View>
    </Animated.View>
  );
};

export default memo(ChannelInfoBar);

// ─── Styles ───────────────────────────────────────────────────────────────────
const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    elevation: 30,
  },

  // Single card that rises from the bottom
  main: {
    backgroundColor: theme.bg,
    borderTopLeftRadius: TV ? 18 : 12,
    borderTopRightRadius: TV ? 18 : 12,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
  },

  // ── Info row ──────────────────────────────────────────────────────────────
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: TV ? 32 : 16,
    paddingTop: TV ? 20 : 12,
    paddingBottom: TV ? 10 : 6,
    gap: TV ? 18 : 12,
  },
  logoWrap: {
    width: LOGO_SZ,
    height: LOGO_SZ,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  logo: { width: '100%', height: '100%' },
  logoFallback: {
    flex: 1,
    backgroundColor: theme.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: theme.textMuted,
    fontSize: TV ? 20 : 15,
    fontWeight: '800',
  },
  textBlock: {
    flex: 1,
    gap: TV ? 4 : 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: TV ? 7 : 6,
    height: TV ? 7 : 6,
    borderRadius: 4,
    backgroundColor: theme.live,
  },
  chName: {
    flex: 1,
    color: theme.text,
    fontSize: TV ? 26 : 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  catchupBadge: {
    backgroundColor: theme.card,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: theme.accent,
  },
  catchupTxt: {
    color: theme.accent,
    fontSize: TV ? 11 : 9,
    fontWeight: '700',
  },
  sleepBadge: {
    backgroundColor: theme.card,
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: theme.accent,
  },
  sleepTxt: {
    color: theme.accent,
    fontSize: TV ? 11 : 9,
    fontWeight: '700',
  },
  progName: {
    color: theme.textSub,
    fontSize: TV ? 16 : 12,
    fontWeight: '500',
  },
  nextProg: {
    color: theme.textMuted,
    fontSize: TV ? 12 : 10,
    fontWeight: '500',
  },
  rightBlock: {
    alignItems: 'flex-end',
    gap: 4,
    minWidth: TV ? 110 : 80,
  },
  timeRange: {
    color: theme.textSub,
    fontSize: TV ? 14 : 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  pct: {
    color: theme.accent,
    fontSize: TV ? 13 : 10,
    fontWeight: '700',
  },

  // ── Progress bar ──────────────────────────────────────────────────────────
  progressWrap: {
    paddingHorizontal: TV ? 32 : 16,
    paddingBottom: TV ? 6 : 4,
  },
  progressBg: {
    height: TV ? 4 : 3,
    backgroundColor: theme.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFg: {
    height: '100%',
    backgroundColor: theme.accent,
    borderRadius: 3,
    shadowColor: theme.accent,
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },

  // ── Divider ───────────────────────────────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: theme.border,
    marginHorizontal: TV ? 24 : 12,
  },

  // ── Controls ──────────────────────────────────────────────────────────────
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: TV ? 24 : 12,
    paddingVertical: TV ? 12 : 8,
    gap: TV ? 10 : 7,
  },
  btn: {
    width: TV ? 88 : 68,
    height: TV ? 72 : 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: TV ? 5 : 3,
    borderRadius: TV ? 14 : 10,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  btnActive: {
    backgroundColor: theme.cardActive,
    borderColor: theme.accent,
  },
  btnIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLabel: {
    color: theme.textMuted,
    fontSize: TV ? 11 : 9,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  btnLabelActive: { color: theme.accent },
});
