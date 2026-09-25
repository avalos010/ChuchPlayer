import React, { useCallback, useEffect, useMemo, useState, memo } from 'react';
import {
  View, Text, TextInput, StyleSheet, Modal, Pressable,
} from 'react-native';
import FocusableItem from '../FocusableItem';
import { useUIStore } from '../../store/useUIStore';
import { useThemeStore } from '../../store/useThemeStore';
import { Theme } from '../../theme/themes';
import { useSleepTimer } from '../../hooks/useSleepTimer';
import { isTvLikePlatform } from '../../utils/platform';

const TV = isTvLikePlatform;

const OPTIONS = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '1 hour', minutes: 60 },
  { label: '90 min', minutes: 90 },
  { label: '2 hours', minutes: 120 },
];
const OPTION_ROWS = [OPTIONS.slice(0, 3), OPTIONS.slice(3)];

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
  const { remainingSeconds, isActive, endsAt, setTimer, clearTimer, extendTimer } = useSleepTimer();
  const [customOpen, setCustomOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');
  const [customError, setCustomError] = useState(false);

  useEffect(() => {
    if (!showSleepTimer) {
      setCustomOpen(false);
      setCustomMinutes('');
      setCustomError(false);
    }
  }, [showSleepTimer]);

  const onClose = useCallback(() => setShowSleepTimer(false), [setShowSleepTimer]);

  const onSelect = useCallback((minutes: number) => {
    setTimer(minutes);
  }, [setTimer]);

  const onSetCustom = useCallback(() => {
    const minutes = Number(customMinutes);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
      setCustomError(true);
      return;
    }
    setTimer(minutes);
    setCustomOpen(false);
    setCustomMinutes('');
    setCustomError(false);
  }, [customMinutes, setTimer]);

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

  return (
    <Modal visible={showSleepTimer} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} focusable={false} />
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Sleep Timer</Text>
            <FocusableItem onPress={onClose} hasTVPreferredFocus={isActive && !customOpen} style={styles.closeBtn} focusedStyle={closeFocused}>
              <Text style={styles.closeTxt}>Close</Text>
            </FocusableItem>
          </View>

          <View style={styles.countdownWrap}>
            <Text style={styles.countdownLabel}>{isActive ? 'Playback pauses in' : 'Timer is off'}</Text>
            <Text style={styles.countdown}>{isActive ? fmtCountdown(remainingSeconds) : '—'}</Text>
            {endsAt !== null && (
              <Text style={styles.endTime}>Until {new Date(endsAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</Text>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>{isActive ? 'REPLACE TIMER' : 'START TIMER'}</Text>
            <FocusableItem
              onPress={() => { setCustomOpen((open) => !open); setCustomError(false); }}
              style={styles.customToggle}
              focusedStyle={optFocused}
            >
              <Text style={styles.customToggleText}>{customOpen ? 'Presets' : 'Custom minutes'}</Text>
            </FocusableItem>
          </View>

          {customOpen ? (
            <View style={styles.customPanel}>
              <View style={styles.customRow}>
                <TextInput
                  autoFocus
                  value={customMinutes}
                  onChangeText={(value) => { setCustomMinutes(value.replace(/\D/g, '')); setCustomError(false); }}
                  onSubmitEditing={onSetCustom}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  maxLength={4}
                  placeholder="Minutes"
                  placeholderTextColor={theme.textMuted}
                  selectionColor={theme.accent}
                  style={[styles.customInput, customError && styles.customInputError]}
                />
                <FocusableItem onPress={onSetCustom} style={styles.customSetBtn} focusedStyle={optFocused}>
                  <Text style={styles.customSetText}>Set timer</Text>
                </FocusableItem>
              </View>
              <Text style={[styles.customHint, customError && styles.customError]}>
                {customError ? 'Enter a duration from 1 to 1440 minutes.' : 'Choose 1–1440 minutes (up to 24 hours).'}
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.grid}>
                {OPTION_ROWS.map((row, rowIndex) => (
                  <View key={rowIndex} style={styles.optionRow}>
                    {row.map((opt, columnIndex) => (
                      <FocusableItem
                        key={opt.minutes}
                        onPress={() => onSelect(opt.minutes)}
                        hasTVPreferredFocus={!isActive && rowIndex === 0 && columnIndex === 1}
                        style={styles.optBtn}
                        focusedStyle={optFocused}
                      >
                        <Text style={styles.optTxt}>{opt.label}</Text>
                      </FocusableItem>
                    ))}
                  </View>
                ))}
              </View>

              {isActive && (
                <View style={styles.actions}>
                  <FocusableItem onPress={() => extendTimer(15)} style={styles.actionBtn} focusedStyle={optFocused}>
                    <Text style={styles.optTxt}>+15 min</Text>
                  </FocusableItem>
                  <FocusableItem onPress={clearTimer} style={styles.actionBtn} focusedStyle={optFocused}>
                    <Text style={styles.cancelTxt}>Cancel timer</Text>
                  </FocusableItem>
                </View>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default memo(SleepTimerModal);

function createStyles(theme: Theme) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
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
      padding: TV ? 20 : 16,
      width: '100%',
      maxWidth: TV ? 500 : 360,
      gap: 10,
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
      minWidth: TV ? 72 : 60,
      height: TV ? 36 : 30,
      borderRadius: 8,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeTxt: { color: theme.text, fontSize: TV ? 14 : 12, fontWeight: '700' },
    countdownWrap: {
      alignItems: 'center',
      paddingVertical: TV ? 9 : 8,
      backgroundColor: theme.accent + '11',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.accent + '44',
    },
    countdownLabel: {
      color: theme.textSub,
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
    endTime: { color: theme.textSub, fontSize: TV ? 13 : 11, marginTop: 4 },
    divider: { height: 1, backgroundColor: theme.border },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionLabel: { color: theme.textSub, fontSize: TV ? 11 : 10, fontWeight: '700' },
    customToggle: {
      minWidth: TV ? 122 : 112,
      height: TV ? 32 : 30,
      paddingHorizontal: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    customToggleText: { color: theme.text, fontSize: TV ? 12 : 11, fontWeight: '700' },
    customPanel: { gap: 8 },
    customRow: { flexDirection: 'row', gap: 8 },
    customInput: {
      flex: 1,
      minWidth: 0,
      height: TV ? 48 : 44,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: theme.focused,
      borderRadius: 10,
      backgroundColor: theme.card,
      color: theme.text,
      fontSize: TV ? 16 : 14,
    },
    customInputError: { borderColor: theme.live },
    customSetBtn: {
      minWidth: TV ? 110 : 96,
      height: TV ? 48 : 44,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    customSetText: { color: theme.text, fontSize: TV ? 14 : 12, fontWeight: '700' },
    customHint: { color: theme.textSub, fontSize: TV ? 12 : 11 },
    customError: { color: theme.live },
    grid: {
      gap: 8,
    },
    optionRow: {
      flexDirection: 'row',
      gap: 8,
    },
    optBtn: {
      flex: 1,
      height: TV ? 48 : 44,
      minWidth: 0,
      paddingHorizontal: 6,
      backgroundColor: theme.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optTxt: {
      color: theme.textSub,
      fontSize: TV ? 15 : 13,
      fontWeight: '700',
    },
    actions: { flexDirection: 'row', gap: 8 },
    actionBtn: {
      flex: 1,
      paddingVertical: TV ? 10 : 9,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      alignItems: 'center',
    },
    cancelTxt: { color: theme.live, fontSize: TV ? 14 : 12, fontWeight: '700' },
  });
}
