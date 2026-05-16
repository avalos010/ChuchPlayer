import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useUIStore } from '../../store/useUIStore';
import { useThemeStore } from '../../store/useThemeStore';
import { Theme } from '../../theme/themes';

const TV = Platform.OS === 'android';

const ChannelNumberPad: React.FC = () => {
  const theme  = useThemeStore((s) => s.theme);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const channelNumberInput    = usePlayerStore((s) => s.channelNumberInput);
  const setChannelNumberInput = usePlayerStore((s) => s.setChannelNumberInput);
  const channels              = usePlayerStore((s) => s.channels);
  const showChannelNumberPad    = useUIStore((s) => s.showChannelNumberPad);
  const setShowChannelNumberPad = useUIStore((s) => s.setShowChannelNumberPad);

  useEffect(() => {
    if (!showChannelNumberPad) return;
    const t = setTimeout(() => {
      setShowChannelNumberPad(false);
      setChannelNumberInput('');
    }, 3000);
    return () => clearTimeout(t);
  }, [showChannelNumberPad, channelNumberInput, setShowChannelNumberPad, setChannelNumberInput]);

  if (!showChannelNumberPad) return null;

  const num        = channelNumberInput ? parseInt(channelNumberInput, 10) : null;
  const matchedCh  = num != null && num > 0 && num <= channels.length ? channels[num - 1] : null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>CH</Text>
      <Text style={styles.digits}>{channelNumberInput || '---'}</Text>
      {matchedCh && (
        <Text style={styles.chName} numberOfLines={1}>{matchedCh.name}</Text>
      )}
    </View>
  );
};

export default ChannelNumberPad;

function createStyles(theme: Theme) {
  return StyleSheet.create({
    wrap: {
      position: 'absolute',
      top: '40%' as any,
      alignSelf: 'center',
      left: 0, right: 0,
      width: TV ? 200 : 160,
      alignSelf: 'center',
      alignItems: 'center',
      backgroundColor: theme.surface + 'F0',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: TV ? 18 : 14,
      paddingHorizontal: TV ? 20 : 16,
      zIndex: 40,
      elevation: 40,
      gap: 4,
    },
    label: {
      color: theme.textMuted,
      fontSize: TV ? 11 : 10,
      fontWeight: '700',
      letterSpacing: 2,
    },
    digits: {
      color: theme.accent,
      fontSize: TV ? 48 : 36,
      fontWeight: '800',
      fontFamily: 'monospace',
      letterSpacing: 4,
    },
    chName: {
      color: theme.textSub,
      fontSize: TV ? 13 : 11,
      fontWeight: '600',
      marginTop: 4,
      maxWidth: TV ? 180 : 140,
      textAlign: 'center',
    },
  });
}
