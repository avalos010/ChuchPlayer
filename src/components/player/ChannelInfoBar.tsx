import React, { useEffect, useRef, useCallback, memo } from 'react';
import {
  View, Text, StyleSheet, Platform, Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import FocusableItem from '../FocusableItem';
import { Channel, EPGProgram } from '../../types';
import { RootStackParamList } from '../../types';
import { useUIStore } from '../../store/useUIStore';

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

const BTN_FOCUSED = {
  backgroundColor: '#ffffff',
  borderColor: '#ffffff',
  borderWidth: 2,
  transform: [] as any[],
  elevation: 6,
};

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
  const showInfoBar      = useUIStore((s) => s.showInfoBar);
  const setShowInfoBar   = useUIStore((s) => s.setShowInfoBar);
  const opacity          = useRef(new Animated.Value(1)).current;
  const hideTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [progress, setProgress] = React.useState(0);

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() =>
        setShowInfoBar(false)
      );
    }, timeoutSeconds * 1000);
  }, [opacity, setShowInfoBar, timeoutSeconds]);

  // Show bar and reset hide timer whenever bar becomes visible
  useEffect(() => {
    if (!showInfoBar) return;
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    scheduleHide();
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, [showInfoBar, scheduleHide, opacity]);

  // Update progress bar every 30 seconds
  useEffect(() => {
    if (!currentProgram) { setProgress(0); return; }
    const calc = () => {
      const now = Date.now();
      const start = currentProgram.start.getTime();
      const end = currentProgram.end.getTime();
      setProgress(Math.min(1, Math.max(0, (now - start) / (end - start))));
    };
    calc();
    const id = setInterval(calc, 30_000);
    return () => clearInterval(id);
  }, [currentProgram]);

  if (!showInfoBar || !channel) return null;

  const hasLogo = !!channel.logo;

  return (
    <Animated.View style={[s.bar, { opacity }]} pointerEvents="box-none">
      {/* Channel logo / initials */}
      <View style={s.logoWrap}>
        {hasLogo ? (
          <Image source={{ uri: channel.logo }} style={s.logo} contentFit="contain" cachePolicy="disk" />
        ) : (
          <View style={s.logoBg}>
            <Text style={s.logoInitials}>{channel.name.substring(0, 2).toUpperCase()}</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={s.info}>
        <View style={s.infoTop}>
          <Text style={s.chName} numberOfLines={1}>{channel.name}</Text>
          {currentProgram && (
            <Text style={s.timeRange}>
              {fmtTime(currentProgram.start)} – {fmtTime(currentProgram.end)}
            </Text>
          )}
        </View>
        {currentProgram && (
          <Text style={s.progTitle} numberOfLines={1}>{currentProgram.title}</Text>
        )}
        {/* Progress bar */}
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${progress * 100}%` as any }]} />
        </View>
      </View>

      {/* Actions */}
      <View style={s.actions}>
        {sleepLabel && (
          <View style={s.sleepBadge}>
            <Text style={s.sleepBadgeTxt}>💤 {sleepLabel}</Text>
          </View>
        )}
        <FocusableItem onPress={onToggleFavorite} style={s.actionBtn} focusedStyle={BTN_FOCUSED}>
          <Text style={[s.actionIcon, isFavorite && s.actionIconActive]}>
            {isFavorite ? '★' : '☆'}
          </Text>
        </FocusableItem>
        <FocusableItem onPress={onSleepTimer} style={s.actionBtn} focusedStyle={BTN_FOCUSED}>
          <Text style={s.actionIcon}>💤</Text>
        </FocusableItem>
        <FocusableItem
          onPress={() => {
            setShowInfoBar(false);
            setTimeout(() => navigation?.navigate('Settings'), 100);
          }}
          style={s.actionBtn}
          focusedStyle={BTN_FOCUSED}
        >
          <Text style={s.actionIcon}>⚙</Text>
        </FocusableItem>
      </View>
    </Animated.View>
  );
};

export default memo(ChannelInfoBar);

const BAR_H = TV ? 88 : 64;

const s = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: BAR_H,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(8,8,8,0.96)',
    borderTopWidth: 1,
    borderTopColor: '#1e1e1e',
    paddingHorizontal: TV ? 28 : 16,
    gap: TV ? 20 : 12,
    zIndex: 30,
    elevation: 30,
  },
  logoWrap: {
    width: TV ? 52 : 40,
    height: TV ? 52 : 40,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#161616',
  },
  logo: { width: '100%', height: '100%' },
  logoBg: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoInitials: {
    color: '#555',
    fontSize: TV ? 18 : 14,
    fontWeight: '800',
  },
  info: { flex: 1, gap: 2 },
  infoTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chName: {
    color: '#f5f5f5',
    fontSize: TV ? 18 : 14,
    fontWeight: '800',
    flex: 1,
  },
  timeRange: {
    color: '#555',
    fontSize: TV ? 14 : 12,
    fontWeight: '500',
  },
  progTitle: {
    color: '#888',
    fontSize: TV ? 15 : 12,
    fontWeight: '500',
  },
  progressTrack: {
    height: 2,
    backgroundColor: '#222',
    borderRadius: 1,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#f5f5f5',
    borderRadius: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: TV ? 8 : 6,
  },
  sleepBadge: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginRight: 4,
  },
  sleepBadgeTxt: {
    color: '#888',
    fontSize: TV ? 13 : 11,
    fontWeight: '600',
  },
  actionBtn: {
    width: TV ? 44 : 36,
    height: TV ? 44 : 36,
    borderRadius: 10,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIcon: {
    color: '#555',
    fontSize: TV ? 18 : 16,
  },
  actionIconActive: {
    color: '#f5b942',
  },
});
