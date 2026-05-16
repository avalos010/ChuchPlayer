import React, { useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
  View, Text, StyleSheet, Platform, Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import FocusableItem from '../FocusableItem';
import { Channel, EPGProgram, RootStackParamList } from '../../types';
import { useUIStore } from '../../store/useUIStore';
import { useThemeStore } from '../../store/useThemeStore';
import { Theme } from '../../theme/themes';

interface ChannelInfoBarProps {
  channel: Channel | null;
  currentProgram: EPGProgram | null;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onSleepTimer: () => void;
  sleepLabel: string | null;
  navigation?: NativeStackNavigationProp<RootStackParamList>;
  timeoutSeconds?: number;
}

const TV = Platform.OS === 'android';
const BAR_H = TV ? 68 : 52;
const LOGO_SZ = TV ? 44 : 34;

const fmtTime = (d: Date) =>
  d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const ChannelInfoBar: React.FC<ChannelInfoBarProps> = ({
  channel,
  currentProgram,
  isFavorite,
  onToggleFavorite,
  onSleepTimer,
  sleepLabel,
  navigation,
  timeoutSeconds = 6,
}) => {
  const theme  = useThemeStore((s) => s.theme);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const showInfoBar    = useUIStore((s) => s.showInfoBar);
  const setShowInfoBar = useUIStore((s) => s.setShowInfoBar);
  const opacity        = useRef(new Animated.Value(1)).current;
  const hideTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [progress, setProgress] = React.useState(0);

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() =>
        setShowInfoBar(false)
      );
    }, timeoutSeconds * 1000);
  }, [opacity, setShowInfoBar, timeoutSeconds]);

  useEffect(() => {
    if (!showInfoBar) return;
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    scheduleHide();
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, [showInfoBar, scheduleHide, opacity]);

  useEffect(() => {
    if (!currentProgram) { setProgress(0); return; }
    const calc = () => {
      const now   = Date.now();
      const start = currentProgram.start.getTime();
      const end   = currentProgram.end.getTime();
      setProgress(Math.min(1, Math.max(0, (now - start) / (end - start))));
    };
    calc();
    const id = setInterval(calc, 30_000);
    return () => clearInterval(id);
  }, [currentProgram]);

  const btnFocusedStyle = useMemo(() => ({
    backgroundColor: theme.focused,
    borderColor: theme.focused,
    borderWidth: 2,
    transform: [] as any[],
    elevation: 6,
  }), [theme]);

  if (!showInfoBar || !channel) return null;

  return (
    <Animated.View style={[styles.bar, { opacity }]} pointerEvents="box-none">
      {/* Logo */}
      <View style={styles.logoWrap}>
        {channel.logo ? (
          <Image
            source={{ uri: channel.logo }}
            style={styles.logo}
            contentFit="contain"
            cachePolicy="disk"
          />
        ) : (
          <View style={styles.logoBg}>
            <Text style={styles.logoInitials}>
              {channel.name.substring(0, 2).toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* Channel name + current program */}
      <View style={styles.info}>
        <Text style={styles.chName} numberOfLines={1}>{channel.name}</Text>
        {currentProgram && (
          <Text style={styles.progTitle} numberOfLines={1}>{currentProgram.title}</Text>
        )}
      </View>

      {/* Time */}
      {currentProgram && (
        <Text style={styles.timeRange}>
          {fmtTime(currentProgram.start)} – {fmtTime(currentProgram.end)}
        </Text>
      )}

      {/* Sleep badge */}
      {sleepLabel && (
        <View style={styles.sleepBadge}>
          <Text style={styles.sleepBadgeTxt}>💤 {sleepLabel}</Text>
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.actions}>
        <FocusableItem onPress={onToggleFavorite} style={styles.actionBtn} focusedStyle={btnFocusedStyle}>
          <Text style={[styles.actionIcon, isFavorite && styles.actionIconFav]}>
            {isFavorite ? '★' : '☆'}
          </Text>
        </FocusableItem>
        <FocusableItem onPress={onSleepTimer} style={styles.actionBtn} focusedStyle={btnFocusedStyle}>
          <Text style={styles.actionIcon}>💤</Text>
        </FocusableItem>
        <FocusableItem
          onPress={() => {
            setShowInfoBar(false);
            setTimeout(() => navigation?.navigate('Settings'), 100);
          }}
          style={styles.actionBtn}
          focusedStyle={btnFocusedStyle}
        >
          <Text style={styles.actionIcon}>⚙</Text>
        </FocusableItem>
      </View>

      {/* 2dp progress bar flush at bottom */}
      <View style={styles.progressTrack} pointerEvents="none">
        <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
      </View>
    </Animated.View>
  );
};

export default memo(ChannelInfoBar);

function createStyles(theme: Theme) {
  return StyleSheet.create({
    bar: {
      position: 'absolute',
      bottom: 0, left: 0, right: 0,
      height: BAR_H,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.bg + 'F5',
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingHorizontal: TV ? 20 : 12,
      gap: TV ? 14 : 8,
      zIndex: 30,
      elevation: 30,
    },
    logoWrap: {
      width: LOGO_SZ,
      height: LOGO_SZ,
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: theme.card,
    },
    logo: { width: '100%', height: '100%' },
    logoBg: {
      flex: 1,
      backgroundColor: theme.card,
      justifyContent: 'center',
      alignItems: 'center',
    },
    logoInitials: {
      color: theme.textMuted,
      fontSize: TV ? 15 : 12,
      fontWeight: '800',
    },
    info: { flex: 1 },
    chName: {
      color: theme.text,
      fontSize: TV ? 18 : 14,
      fontWeight: '800',
      lineHeight: TV ? 22 : 18,
    },
    progTitle: {
      color: theme.textSub,
      fontSize: TV ? 13 : 11,
      fontWeight: '500',
      lineHeight: TV ? 17 : 14,
      marginTop: 1,
    },
    timeRange: {
      color: theme.textMuted,
      fontSize: TV ? 13 : 11,
      fontWeight: '600',
    },
    sleepBadge: {
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: theme.accent,
      backgroundColor: theme.surface,
    },
    sleepBadgeTxt: {
      color: theme.accent,
      fontSize: TV ? 11 : 10,
      fontWeight: '700',
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: TV ? 6 : 4,
    },
    actionBtn: {
      width: TV ? 38 : 30,
      height: TV ? 38 : 30,
      borderRadius: 8,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionIcon: {
      color: theme.textMuted,
      fontSize: TV ? 16 : 14,
    },
    actionIconFav: { color: '#f5b942' },
    progressTrack: {
      position: 'absolute',
      bottom: 0, left: 0, right: 0,
      height: 2,
      backgroundColor: theme.card,
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.accent,
    },
  });
}
