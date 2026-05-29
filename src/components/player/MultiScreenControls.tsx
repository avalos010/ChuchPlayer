import React, { useMemo, useState } from 'react';
import { View, Text, Modal, ScrollView, StyleSheet } from 'react-native';
import FocusableItem from '../FocusableItem';
import { Channel } from '../../types';
import { useMultiScreenStore } from '../../store/useMultiScreenStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useThemeStore } from '../../store/useThemeStore';
import { Theme } from '../../theme/themes';
import { isTvLikePlatform } from '../../utils/platform';

interface MultiScreenControlsProps {
  channels: Channel[];
  onChannelSelect: (channel: Channel) => void;
  isVisible: boolean;
  onClose: () => void;
}

const TV = isTvLikePlatform;

const MultiScreenControls: React.FC<MultiScreenControlsProps> = ({
  channels,
  onChannelSelect,
  isVisible,
  onClose,
}) => {
  const theme = useThemeStore((s) => s.theme);
  const s = useMemo(() => createStyles(theme), [theme]);
  const focusedStyle = useMemo(() => ({
    borderColor: theme.focused,
    borderWidth: 2,
    transform: [] as any[],
    elevation: 6,
  }), [theme]);

  const currentChannel = usePlayerStore((st) => st.channel);

  const {
    screens,
    addScreen,
    removeScreen,
    setLayout,
    layout,
    clearAllScreens,
    toggleMultiScreenMode,
    isMultiScreenMode,
    maxScreens,
  } = useMultiScreenStore();

  const [count, setCount] = useState(2);

  const availableChannels = useMemo(
    () => channels.filter((ch) => !screens.some((sc) => sc.channel.id === ch.id)),
    [channels, screens],
  );

  // How many screens the user can choose to open (2..maxScreens, capped by channel count)
  const countOptions = useMemo(() => {
    const max = Math.min(maxScreens, Math.max(2, channels.length));
    const opts: number[] = [];
    for (let n = 2; n <= max; n++) opts.push(n);
    return opts;
  }, [maxScreens, channels.length]);

  if (!isVisible) return null;

  const startMultiScreen = () => {
    clearAllScreens();
    const ordered = currentChannel
      ? [currentChannel, ...channels.filter((c) => c.id !== currentChannel.id)]
      : channels;
    ordered.slice(0, count).forEach(addScreen);
    setLayout(layout);
    onClose();
  };

  const handleAddScreen = (channel: Channel) => {
    addScreen(channel);
    onChannelSelect(channel);
  };

  const handleExit = () => {
    clearAllScreens();
    onClose();
  };

  const LayoutRow = (
    <View style={s.section}>
      <Text style={s.sectionLabel}>LAYOUT</Text>
      <View style={s.row}>
        <FocusableItem
          onPress={() => setLayout('grid')}
          hasTVPreferredFocus={!isMultiScreenMode}
          style={[s.chip, layout === 'grid' && s.chipActive]}
          focusedStyle={focusedStyle}
        >
          <Text style={[s.chipTxt, layout === 'grid' && s.chipTxtActive]}>▦  Grid</Text>
        </FocusableItem>
        <FocusableItem
          onPress={() => setLayout('split')}
          style={[s.chip, layout === 'split' && s.chipActive]}
          focusedStyle={focusedStyle}
        >
          <Text style={[s.chipTxt, layout === 'split' && s.chipTxtActive]}>▤  Split</Text>
        </FocusableItem>
      </View>
    </View>
  );

  return (
    <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <Text style={s.title}>Multi-Screen</Text>

          {!isMultiScreenMode ? (
            <>
              <Text style={s.subtitle}>
                Watch several channels at once. Pick a layout and how many screens to open.
              </Text>

              {LayoutRow}

              <View style={s.section}>
                <Text style={s.sectionLabel}>SCREENS</Text>
                <View style={s.row}>
                  {countOptions.map((n) => (
                    <FocusableItem
                      key={n}
                      onPress={() => setCount(n)}
                      style={[s.chip, s.countChip, count === n && s.chipActive]}
                      focusedStyle={focusedStyle}
                    >
                      <Text style={[s.chipTxt, count === n && s.chipTxtActive]}>{n}</Text>
                    </FocusableItem>
                  ))}
                </View>
              </View>

              <FocusableItem onPress={startMultiScreen} style={[s.btn, s.btnPrimary]} focusedStyle={focusedStyle}>
                <Text style={s.btnPrimaryTxt}>Start {count}-Screen {layout === 'grid' ? 'Grid' : 'Split'}</Text>
              </FocusableItem>
            </>
          ) : (
            <>
              {LayoutRow}

              <View style={s.section}>
                <Text style={s.sectionLabel}>ACTIVE ({screens.length}/{maxScreens})</Text>
                {screens.map((screen) => (
                  <View key={screen.id} style={s.activeRow}>
                    <Text style={s.activeName} numberOfLines={1}>{screen.channel.name}</Text>
                    <FocusableItem onPress={() => removeScreen(screen.id)} style={s.removeBtn} focusedStyle={focusedStyle}>
                      <Text style={s.removeTxt}>Remove</Text>
                    </FocusableItem>
                  </View>
                ))}
              </View>

              {screens.length < maxScreens && availableChannels.length > 0 && (
                <View style={s.section}>
                  <Text style={s.sectionLabel}>ADD CHANNEL</Text>
                  <ScrollView style={s.addList} keyboardShouldPersistTaps="handled">
                    {availableChannels.slice(0, 50).map((item) => (
                      <FocusableItem
                        key={item.id}
                        onPress={() => handleAddScreen(item)}
                        style={s.addRow}
                        focusedStyle={focusedStyle}
                      >
                        <Text style={s.addName} numberOfLines={1}>{item.name}</Text>
                      </FocusableItem>
                    ))}
                  </ScrollView>
                </View>
              )}

              <FocusableItem onPress={handleExit} style={[s.btn, s.btnDanger]} focusedStyle={focusedStyle}>
                <Text style={s.btnDangerTxt}>Exit Multi-Screen</Text>
              </FocusableItem>
            </>
          )}

          <FocusableItem onPress={onClose} style={[s.btn, s.btnGhost]} focusedStyle={focusedStyle}>
            <Text style={s.btnGhostTxt}>Close</Text>
          </FocusableItem>
        </View>
      </View>
    </Modal>
  );
};

export default MultiScreenControls;

const createStyles = (theme: Theme) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '90%',
    maxWidth: 620,
    backgroundColor: theme.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    padding: TV ? 28 : 20,
    gap: TV ? 18 : 14,
  },
  title: {
    color: theme.text,
    fontSize: TV ? 26 : 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: theme.textSub,
    fontSize: TV ? 15 : 13,
    fontWeight: '500',
    lineHeight: TV ? 22 : 19,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    color: theme.textMuted,
    fontSize: TV ? 12 : 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  chip: {
    flex: 1,
    paddingVertical: TV ? 14 : 11,
    borderRadius: 10,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countChip: {
    flex: 0,
    minWidth: TV ? 64 : 52,
  },
  chipActive: {
    backgroundColor: theme.cardActive,
    borderColor: theme.accent,
  },
  chipTxt: {
    color: theme.textSub,
    fontSize: TV ? 16 : 13,
    fontWeight: '700',
  },
  chipTxtActive: {
    color: theme.accent,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 8,
  },
  activeName: {
    flex: 1,
    color: theme.text,
    fontSize: TV ? 15 : 13,
    fontWeight: '600',
  },
  removeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.live,
  },
  removeTxt: {
    color: theme.live,
    fontSize: TV ? 13 : 11,
    fontWeight: '700',
  },
  addList: {
    maxHeight: TV ? 240 : 180,
  },
  addRow: {
    paddingHorizontal: 12,
    paddingVertical: TV ? 12 : 10,
    borderRadius: 8,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 6,
  },
  addName: {
    color: theme.textSub,
    fontSize: TV ? 15 : 13,
    fontWeight: '600',
  },
  btn: {
    paddingVertical: TV ? 16 : 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  btnPrimary: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  btnPrimaryTxt: {
    color: theme.accentText,
    fontSize: TV ? 17 : 14,
    fontWeight: '800',
  },
  btnDanger: {
    backgroundColor: theme.card,
    borderColor: theme.live,
  },
  btnDangerTxt: {
    color: theme.live,
    fontSize: TV ? 16 : 13,
    fontWeight: '700',
  },
  btnGhost: {
    backgroundColor: theme.card,
    borderColor: theme.border,
  },
  btnGhostTxt: {
    color: theme.textSub,
    fontSize: TV ? 15 : 13,
    fontWeight: '700',
  },
});
