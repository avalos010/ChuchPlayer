import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useUIStore } from '../../store/useUIStore';
import { useThemeStore } from '../../store/useThemeStore';
import { Theme } from '../../theme/themes';

const TV = Platform.OS === 'android';

const VolumeIndicator: React.FC = () => {
  const theme  = useThemeStore((s) => s.theme);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const volume                 = usePlayerStore((s) => s.volume);
  const showVolumeIndicator    = useUIStore((s) => s.showVolumeIndicator);
  const setShowVolumeIndicator = useUIStore((s) => s.setShowVolumeIndicator);

  useEffect(() => {
    if (!showVolumeIndicator) return;
    const t = setTimeout(() => setShowVolumeIndicator(false), 1500);
    return () => clearTimeout(t);
  }, [showVolumeIndicator, setShowVolumeIndicator, volume]);

  if (!showVolumeIndicator) return null;

  const icon = volume === 0 ? '🔇' : volume < 0.4 ? '🔉' : '🔊';

  return (
    <View style={styles.pill}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${volume * 100}%` as any }]} />
      </View>
      <Text style={styles.pct}>{Math.round(volume * 100)}%</Text>
    </View>
  );
};

export default VolumeIndicator;

function createStyles(theme: Theme) {
  return StyleSheet.create({
    pill: {
      position: 'absolute',
      top: TV ? 24 : 16,
      alignSelf: 'center',
      left: 0, right: 0,
      marginHorizontal: 'auto' as any,
      width: TV ? 220 : 180,
      alignItems: 'center',
      flexDirection: 'row',
      gap: TV ? 10 : 8,
      backgroundColor: theme.surface + 'F0',
      borderRadius: 100,
      paddingVertical: TV ? 10 : 8,
      paddingHorizontal: TV ? 16 : 12,
      borderWidth: 1,
      borderColor: theme.border,
      zIndex: 40,
      elevation: 40,
      // center horizontally
      alignSelf: 'center',
    },
    icon: { fontSize: TV ? 18 : 14 },
    track: {
      flex: 1,
      height: TV ? 3 : 2,
      backgroundColor: theme.card,
      borderRadius: 2,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      backgroundColor: theme.accent,
      borderRadius: 2,
    },
    pct: {
      color: theme.text,
      fontSize: TV ? 13 : 11,
      fontWeight: '700',
      minWidth: TV ? 36 : 30,
      textAlign: 'right',
    },
  });
}
