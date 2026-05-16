import React, { useCallback, useMemo, memo } from 'react';
import {
  View, Text, StyleSheet, Platform, TouchableOpacity,
} from 'react-native';
import FocusableItem from '../FocusableItem';
import { useUIStore } from '../../store/useUIStore';
import { useThemeStore } from '../../store/useThemeStore';
import { Theme } from '../../theme/themes';
import { useSleepTimer } from '../../hooks/useSleepTimer';

const TV = Platform.OS === 'android';

const OPTIONS = [
  { label: 'Off',    minutes: 0  },
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '1 hour', minutes: 60 },
  { label: '90 min', minutes: 90 },
];

const fmtCountdown = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const SleepTimerModal: React.FC = () => {
  const theme  = useThemeStore((s) => s.theme);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const showSleepTimer    = useUIStore((s) => s.showSleepTimer);
  const setShowSleepTimer = useUIStore((s) => s.setShowSleepTimer);
  const { remainingSeconds, isActive, setTimer, clearTimer } = useSleepTimer();

  const onClose = useCallback(() => setShowSleepTimer(false), [setShowSleepTimer]);

  const onSelect = useCallback((minutes: number) => {
    if (minutes === 0) clearTimer();
    else setTimer(minutes);
    setShowSleepTimer(false);
  }, [setTimer, clearTimer, setShowSleepTimer]);

  const optActiveFocused = useMemo(() => ({
    backgroundColor: theme.accent + '33',
    borderColor: theme.accent,
    borderWidth: 2,
    transform: [] as any[],
    elevation: 6,
  }), [theme]);

  const optFocused = useMemo(() => ({
    backgroundColor: theme.card,
    borderColor: theme.focused,
    borderWidth: 2,
    transform: [] as any[],
    elevation: 4,
  }), [theme]);

  const closeFocused = useMemo(() => ({
    backgroundColor: theme.card,
    borderColor: theme.focused,
    borderWidth: 2,
    transform: [] as any[],
    elevation: 4,
  }), [theme]);

  if (!showSleepTimer) return null;

  return (
    <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} focusable={false}>
      <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.modal} focusable={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Sleep Timer</Text>
          <FocusableItem onPress={onClose} style={styles.closeBtn} focusedStyle={closeFocused}>
            <Text style={styles.closeTxt}>✕</Text>
          </FocusableItem>
        </View>

        {/* Countdown when active */}
        {isActive && (
          <View style={styles.countdownWrap}>
            <Text style={styles.countdownLabel}>Playback stops in</Text>
            <Text style={styles.countdown}>{fmtCountdown(remainingSeconds)}</Text>
          </View>
        )}

        <View style={styles.divider} />

        {/* 3×2 option grid */}
        <View style={styles.grid}>
          {OPTIONS.map((opt, idx) => {
            const isSelected = opt.minutes === 0
              ? !isActive
              : (isActive && Math.ceil(remainingSeconds / 60) === opt.minutes);
            return (
              <FocusableItem
                key={opt.minutes}
                onPress={() => onSelect(opt.minutes)}
                hasTVPreferredFocus={idx === 0}
                style={[styles.optBtn, isSelected && styles.optBtnActive]}
                focusedStyle={isSelected ? optActiveFocused : optFocused}
              >
                <Text style={[styles.optTxt, isSelected && styles.optTxtActive]}>{opt.label}</Text>
                {isSelected && opt.minutes > 0 && (
                  <Text style={styles.optCountdown}>{fmtCountdown(remainingSeconds)}</Text>
                )}
              </FocusableItem>
            );
          })}
        </View>

        <View style={styles.divider} />

        <Text style={styles.hint}>Playback will pause when the timer ends.</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

export default memo(SleepTimerModal);

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
      maxWidth: TV ? 480 : 360,
      gap: 14,
      elevation: 50,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      color: theme.text,
      fontSize: TV ? 20 : 17,
      fontWeight: '800',
    },
    closeBtn: {
      width: TV ? 36 : 30,
      height: TV ? 36 : 30,
      borderRadius: 8,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeTxt: { color: theme.textMuted, fontSize: TV ? 15 : 13, fontWeight: '700' },
    countdownWrap: {
      alignItems: 'center',
      paddingVertical: TV ? 14 : 10,
      backgroundColor: theme.accent + '11',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.accent + '44',
    },
    countdownLabel: {
      color: theme.textMuted,
      fontSize: TV ? 12 : 10,
      fontWeight: '500',
      marginBottom: 4,
    },
    countdown: {
      color: theme.accent,
      fontSize: TV ? 36 : 28,
      fontWeight: '800',
      letterSpacing: 2,
    },
    divider: { height: 1, backgroundColor: theme.border },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    optBtn: {
      flex: 1,
      minWidth: TV ? 120 : 90,
      paddingVertical: TV ? 16 : 12,
      paddingHorizontal: 8,
      backgroundColor: theme.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optBtnActive: {
      backgroundColor: theme.accent + '11',
      borderColor: theme.accent,
    },
    optTxt: {
      color: theme.textSub,
      fontSize: TV ? 15 : 13,
      fontWeight: '700',
    },
    optTxtActive: { color: theme.accent },
    optCountdown: {
      color: theme.accent,
      fontSize: TV ? 11 : 10,
      fontWeight: '600',
      marginTop: 3,
      opacity: 0.8,
    },
    hint: {
      color: theme.textMuted,
      fontSize: TV ? 12 : 11,
      textAlign: 'center',
      fontStyle: 'italic',
    },
  });
}
