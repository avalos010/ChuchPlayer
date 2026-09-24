import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MaterialCommunityIcons as MCI } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Platform, StyleSheet, Text, View } from 'react-native';
import FocusableItem from '../FocusableItem';
import { RootStackParamList } from '../../types';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useUIStore } from '../../store/useUIStore';
import { useThemeStore } from '../../store/useThemeStore';
import { Theme, withAlpha } from '../../theme/themes';
import { NAVIGATION_PANEL_W, TV } from './ChannelListPanel.constants';

const KeyEvent = Platform.OS === 'android'
  ? (require('react-native-keyevent').default ?? require('react-native-keyevent'))
  : null;

interface PlayerNavigationSidebarProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Player'>;
}

type SidebarItem = {
  id: 'live' | 'movies' | 'series' | 'settings';
  label: string;
  icon: 'television-classic' | 'movie-open-outline' | 'cog-outline';
  onPress: () => void;
};

const PlayerNavigationSidebar: React.FC<PlayerNavigationSidebarProps> = ({ navigation }) => {
  const theme = useThemeStore((state) => state.theme);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const visible = useUIStore((state) => state.showPrimaryNavigation);
  const setShowPrimaryNavigation = useUIStore((state) => state.setShowPrimaryNavigation);
  const setShowGroupsPlaylists = useUIStore((state) => state.setShowGroupsPlaylists);
  const setShowChannelList = useUIStore((state) => state.setShowChannelList);
  const playlist = usePlayerStore((state) => state.playlist);
  const [preferInitialFocus, setPreferInitialFocus] = useState(true);

  useEffect(() => {
    setPreferInitialFocus(true);
  }, [visible]);

  useEffect(() => {
    if (!visible || !KeyEvent) return undefined;
    KeyEvent.onKeyDownListener((event: { keyCode: number }) => {
      if (event.keyCode === 22) setShowPrimaryNavigation(false);
    });
    return () => KeyEvent.removeKeyDownListener();
  }, [visible, setShowPrimaryNavigation]);

  const closeSidebar = useCallback(() => {
    setShowPrimaryNavigation(false);
    setShowGroupsPlaylists(false);
    setShowChannelList(false);
  }, [setShowChannelList, setShowGroupsPlaylists, setShowPrimaryNavigation]);

  const openLiveTv = useCallback(() => {
    closeSidebar();
    if (!playlist?.channels.length) navigation.navigate('Settings');
  }, [closeSidebar, navigation, playlist?.channels.length]);

  const openMovies = useCallback(() => {
    closeSidebar();
    navigation.navigate('VodCatalog', { catalog: 'movies' });
  }, [closeSidebar, navigation]);

  const openSeries = useCallback(() => {
    closeSidebar();
    navigation.navigate('VodCatalog', { catalog: 'series' });
  }, [closeSidebar, navigation]);

  const openSettings = useCallback(() => {
    closeSidebar();
    navigation.navigate('Settings');
  }, [closeSidebar, navigation]);

  const items: SidebarItem[] = [
    { id: 'live', label: 'Live TV', icon: 'television-classic', onPress: openLiveTv },
    ...(playlist?.vodItems?.length
      ? [{ id: 'movies' as const, label: 'Movies', icon: 'movie-open-outline' as const, onPress: openMovies }]
      : []),
    ...(playlist?.seriesItems?.length
      ? [{ id: 'series' as const, label: 'TV Series', icon: 'television-classic' as const, onPress: openSeries }]
      : []),
    { id: 'settings', label: 'Settings', icon: 'cog-outline', onPress: openSettings },
  ];

  if (!visible) return null;

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>CHUCHPLAYER</Text>
        <Text style={styles.title}>Browse</Text>
      </View>
      <View style={styles.items}>
        {items.map((item, index) => (
          <FocusableItem
            key={item.id}
            onPress={item.onPress}
            onFocus={index === 0 ? () => setPreferInitialFocus(false) : undefined}
            hasTVPreferredFocus={index === 0 && preferInitialFocus}
            style={styles.item}
            focusedStyle={styles.itemFocused}
          >
            <MCI name={item.icon} size={TV ? 22 : 20} color={theme.text} />
            <Text style={styles.itemText}>{item.label}</Text>
          </FocusableItem>
        ))}
      </View>
    </View>
  );
};

export default PlayerNavigationSidebar;

const createStyles = (theme: Theme) => StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: NAVIGATION_PANEL_W,
    backgroundColor: withAlpha(theme.bg, 0.96),
    borderRightWidth: 1,
    borderRightColor: theme.border,
    zIndex: 75,
    elevation: 75,
  },
  header: {
    paddingHorizontal: TV ? 22 : 16,
    paddingTop: TV ? 28 : 20,
    paddingBottom: TV ? 20 : 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  eyebrow: {
    color: theme.accent,
    fontSize: TV ? 9 : 8,
    fontWeight: '800',
    letterSpacing: 2,
  },
  title: {
    color: theme.text,
    fontSize: TV ? 22 : 18,
    fontWeight: '800',
    marginTop: 6,
  },
  items: {
    paddingHorizontal: TV ? 12 : 10,
    paddingTop: TV ? 18 : 14,
    gap: TV ? 8 : 6,
  },
  item: {
    minHeight: TV ? 54 : 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: TV ? 14 : 12,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: theme.card,
  },
  itemFocused: {
    backgroundColor: theme.cardActive,
    borderColor: theme.focused,
    borderWidth: 1.5,
    transform: [] as any[],
    elevation: 4,
  },
  itemText: {
    color: theme.text,
    fontSize: TV ? 15 : 13,
    fontWeight: '700',
  },
});
