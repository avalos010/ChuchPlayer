import React, { useCallback, memo } from 'react';
import {
  View, Text, StyleSheet, Platform, TouchableOpacity,
} from 'react-native';
import FocusableItem from '../FocusableItem';
import { useUIStore } from '../../store/useUIStore';
import { useSleepTimer } from '../../hooks/useSleepTimer';

const TV = Platform.OS === 'android';

const OPTIONS = [
  { label: 'Off', minutes: 0 },
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '1 hour', minutes: 60 },
  { label: '90 min', minutes: 90 },
];

const BTN_FOCUSED = {
  backgroundColor: '#ffffff',
  borderColor: '#ffffff',
  borderWidth: 2,
  transform: [] as any[],
  elevation: 6,
};
const ACTIVE_FOCUSED = {
  backgroundColor: '#d97706',
  borderColor: '#f59e0b',
  borderWidth: 2,
  transform: [] as any[],
  elevation: 6,
};

const fmtCountdown = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const SleepTimerModal: React.FC = () => {
  const showSleepTimer   = useUIStore((s) => s.showSleepTimer);
  const setShowSleepTimer = useUIStore((s) => s.setShowSleepTimer);
  const { remainingSeconds, isActive, setTimer, clearTimer } = useSleepTimer();

  const onClose = useCallback(() => setShowSleepTimer(false), [setShowSleepTimer]);

  const onSelect = useCallback((minutes: number) => {
    if (minutes === 0) {
      clearTimer();
    } else {
      setTimer(minutes);
    }
    setShowSleepTimer(false);
  }, [setTimer, clearTimer, setShowSleepTimer]);

  if (!showSleepTimer) return null;

  const activeMinutes = isActive ? Math.ceil(remainingSeconds / 60) : 0;

  return (
    <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} focusable={false}>
      <TouchableOpacity activeOpacity={1} onPress={() => {}} style={s.modal} focusable={false}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>💤  Sleep Timer</Text>
          <FocusableItem onPress={onClose} style={s.closeBtn} focusedStyle={BTN_FOCUSED}>
            <Text style={s.closeTxt}>✕</Text>
          </FocusableItem>
        </View>

        {/* Countdown display when active */}
        {isActive && (
          <View style={s.countdownWrap}>
            <Text style={s.countdownLabel}>Playback stops in</Text>
            <Text style={s.countdown}>{fmtCountdown(remainingSeconds)}</Text>
          </View>
        )}

        <View style={s.divider} />

        {/* Option grid */}
        <View style={s.grid}>
          {OPTIONS.map((opt, idx) => {
            const isSelected = opt.minutes === 0 ? !isActive : (
              isActive && Math.ceil(remainingSeconds / 60) === opt.minutes
            );
            return (
              <FocusableItem
                key={opt.minutes}
                onPress={() => onSelect(opt.minutes)}
                hasTVPreferredFocus={idx === 0}
                style={[s.optBtn, isSelected && s.optBtnActive]}
                focusedStyle={isSelected ? ACTIVE_FOCUSED : BTN_FOCUSED}
              >
                <Text style={[s.optTxt, isSelected && s.optTxtActive]}>{opt.label}</Text>
                {isSelected && opt.minutes > 0 && (
                  <Text style={s.optCountdown}>{fmtCountdown(remainingSeconds)}</Text>
                )}
              </FocusableItem>
            );
          })}
        </View>

        <View style={s.divider} />

        <Text style={s.hint}>Playback will automatically pause when the timer ends.</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

export default memo(SleepTimerModal);

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
    maxWidth: TV ? 560 : 400,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.9,
    shadowRadius: 48,
    elevation: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: '#f5f5f5',
    fontSize: TV ? 22 : 18,
    fontWeight: '800',
  },
  closeBtn: {
    width: TV ? 42 : 36,
    height: TV ? 42 : 36,
    borderRadius: 10,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeTxt: { color: '#555', fontSize: TV ? 17 : 15, fontWeight: '700' },
  countdownWrap: {
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#1a1a00',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3d3000',
  },
  countdownLabel: { color: '#888', fontSize: TV ? 13 : 11, fontWeight: '500', marginBottom: 4 },
  countdown: { color: '#f59e0b', fontSize: TV ? 40 : 32, fontWeight: '800', letterSpacing: 2 },
  divider: { height: 1, backgroundColor: '#1a1a1a' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optBtn: {
    flex: 1,
    minWidth: TV ? 130 : 100,
    paddingVertical: TV ? 18 : 14,
    paddingHorizontal: 12,
    backgroundColor: '#161616',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optBtnActive: {
    backgroundColor: '#1c1400',
    borderColor: '#f59e0b',
  },
  optTxt: {
    color: '#888',
    fontSize: TV ? 16 : 14,
    fontWeight: '700',
  },
  optTxtActive: {
    color: '#f59e0b',
  },
  optCountdown: {
    color: '#d97706',
    fontSize: TV ? 12 : 10,
    fontWeight: '600',
    marginTop: 4,
  },
  hint: {
    color: '#333',
    fontSize: TV ? 13 : 11,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
