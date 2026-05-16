import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import FocusableItem from '../FocusableItem';
import { Playlist } from '../../types';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useUIStore } from '../../store/useUIStore';
import { useThemeStore } from '../../store/useThemeStore';
import { Theme } from '../../theme/themes';
import { getPlaylists } from '../../utils/storage';
import { groupChannelsByCategory } from '../../utils/m3uParser';

interface GroupsPlaylistsPanelProps {
  onGroupSelect?: (group: string | null) => void;
  onPlaylistSelect?: (playlist: Playlist) => void;
}

const TV = Platform.OS === 'android';
const PANEL_W = TV ? 260 : 220;

type ListItem =
  | { type: 'section'; title: string; id: string }
  | { type: 'group'; name: string; id: string }
  | { type: 'playlist'; playlist: Playlist; id: string };

const GroupsPlaylistsPanel: React.FC<GroupsPlaylistsPanelProps> = ({
  onGroupSelect,
  onPlaylistSelect,
}) => {
  const theme  = useThemeStore((s) => s.theme);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const showGroupsPlaylists    = useUIStore((s) => s.showGroupsPlaylists);
  const setShowGroupsPlaylists = useUIStore((s) => s.setShowGroupsPlaylists);
  const setShowChannelList     = useUIStore((s) => s.setShowChannelList);
  const selectedGroup          = useUIStore((s) => s.selectedGroup);
  const setSelectedGroup       = useUIStore((s) => s.setSelectedGroup);
  const channels               = usePlayerStore((s) => s.channels);
  const playlist               = usePlayerStore((s) => s.playlist);
  const setPlaylist            = usePlayerStore((s) => s.setPlaylist);

  const [playlists, setPlaylists]               = useState<Playlist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const hasSetInitialFocusRef                   = useRef(false);
  const listRef                                 = useRef<FlatList<ListItem>>(null);

  useEffect(() => {
    getPlaylists()
      .then(setPlaylists)
      .catch(() => {})
      .finally(() => setLoadingPlaylists(false));
  }, []);

  useEffect(() => {
    if (!showGroupsPlaylists) hasSetInitialFocusRef.current = false;
  }, [showGroupsPlaylists]);

  const groups = useMemo(() => {
    if (!channels.length) return [];
    const grouped = groupChannelsByCategory(channels);
    return ['All Channels', ...Array.from(grouped.keys()).sort()];
  }, [channels]);

  const listData = useMemo<ListItem[]>(() => [
    { type: 'section', title: 'Groups', id: 'hdr-groups' },
    ...groups.map((g) => ({ type: 'group' as const, name: g, id: `g-${g}` })),
    { type: 'section', title: 'Playlists', id: 'hdr-playlists' },
    ...playlists.map((p) => ({ type: 'playlist' as const, playlist: p, id: `p-${p.id}` })),
  ], [groups, playlists]);

  const handleGroupPress = useCallback((group: string | null) => {
    setSelectedGroup(group);
    setShowGroupsPlaylists(false);
    setShowChannelList(true);
    onGroupSelect?.(group);
  }, [setSelectedGroup, setShowGroupsPlaylists, setShowChannelList, onGroupSelect]);

  const handlePlaylistPress = useCallback(async (selected: Playlist) => {
    setPlaylist(selected);
    setSelectedGroup(null);
    setShowGroupsPlaylists(false);
    setShowChannelList(true);
    onPlaylistSelect?.(selected);
  }, [setPlaylist, setSelectedGroup, setShowGroupsPlaylists, setShowChannelList, onPlaylistSelect]);

  const itemFocusedStyle = useMemo(() => ({
    backgroundColor: theme.card,
    borderColor: theme.focused,
    borderWidth: 1.5,
    borderLeftWidth: 3,
    borderLeftColor: theme.accent,
    transform: [] as any[],
    elevation: 4,
  }), [theme]);

  const renderItem = useCallback(({ item, index }: { item: ListItem; index: number }) => {
    if (item.type === 'section') {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTxt}>{item.title.toUpperCase()}</Text>
        </View>
      );
    }

    if (item.type === 'group') {
      const isAll    = item.name === 'All Channels';
      const isActive = (isAll && !selectedGroup) || selectedGroup === item.name;
      const chCount  = isAll ? channels.length : channels.filter((c) => c.group === item.name).length;
      const wantFocus = !hasSetInitialFocusRef.current && index === 1;

      return (
        <FocusableItem
          onPress={() => handleGroupPress(isAll ? null : item.name)}
          style={[styles.item, isActive && styles.itemActive]}
          focusedStyle={itemFocusedStyle}
          hasTVPreferredFocus={wantFocus}
          onFocus={() => { hasSetInitialFocusRef.current = true; }}
        >
          <View style={styles.itemInner}>
            <Text style={[styles.itemName, isActive && styles.itemNameActive]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.itemCount, isActive && styles.itemCountActive]}>
              {chCount}
            </Text>
          </View>
        </FocusableItem>
      );
    }

    if (item.type === 'playlist') {
      const p          = item.playlist;
      const isActive   = playlist?.id === p.id;
      const firstPIdx  = groups.length + 2;
      const wantFocus  = !hasSetInitialFocusRef.current && index === firstPIdx;

      return (
        <FocusableItem
          onPress={() => handlePlaylistPress(p)}
          style={[styles.item, isActive && styles.itemActive]}
          focusedStyle={itemFocusedStyle}
          hasTVPreferredFocus={wantFocus}
          onFocus={() => { hasSetInitialFocusRef.current = true; }}
        >
          <View style={styles.itemInner}>
            <Text style={[styles.itemName, isActive && styles.itemNameActive]} numberOfLines={1}>
              {p.name}
            </Text>
            <Text style={[styles.itemCount, isActive && styles.itemCountActive]}>
              {p.sourceType.toUpperCase()}
            </Text>
          </View>
        </FocusableItem>
      );
    }

    return null;
  }, [styles, selectedGroup, playlist, channels, groups.length, handleGroupPress, handlePlaylistPress, itemFocusedStyle]);

  const keyExtractor = useCallback((item: ListItem) => item.id, []);

  if (!showGroupsPlaylists) return null;

  return (
    <>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={() => setShowGroupsPlaylists(false)}
      />
      <View style={styles.panel}>
        <View style={styles.header}>
          <Text style={styles.headerTitle} numberOfLines={1}>Library</Text>
          <Text style={styles.headerSub}>
            {groups.length}G · {playlists.length}P
          </Text>
        </View>

        {loadingPlaylists ? (
          <View style={styles.skeletonWrap}>
            {Array.from({ length: 8 }).map((_, i) => (
              <View key={i} style={styles.skeletonItem}>
                <View style={[styles.skeletonLine, { width: '70%' }]} />
              </View>
            ))}
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={listData}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={{ paddingVertical: 6 }}
            initialNumToRender={20}
            removeClippedSubviews
          />
        )}
      </View>
    </>
  );
};

export default GroupsPlaylistsPanel;

function createStyles(theme: Theme) {
  return StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: 14,
      elevation: 14,
    },
    panel: {
      position: 'absolute',
      top: 0, left: 0, bottom: 0,
      width: PANEL_W,
      backgroundColor: theme.surface,
      borderRightWidth: 1,
      borderRightColor: theme.border,
      zIndex: 19,
      elevation: 19,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: TV ? 14 : 12,
      paddingTop: TV ? 18 : 14,
      paddingBottom: TV ? 10 : 8,
    },
    headerTitle: {
      color: theme.text,
      fontSize: TV ? 18 : 15,
      fontWeight: '800',
    },
    headerSub: {
      color: theme.textMuted,
      fontSize: TV ? 12 : 10,
      fontWeight: '600',
    },
    sectionHeader: {
      paddingHorizontal: TV ? 14 : 12,
      paddingTop: TV ? 14 : 10,
      paddingBottom: TV ? 4 : 3,
    },
    sectionTxt: {
      color: theme.textMuted,
      fontSize: TV ? 10 : 9,
      fontWeight: '700',
      letterSpacing: 1.5,
    },
    item: {
      marginHorizontal: 6,
      marginVertical: 1,
      borderRadius: 6,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: 'transparent',
      borderLeftWidth: 3,
      borderLeftColor: 'transparent',
    },
    itemActive: {
      backgroundColor: theme.cardActive,
      borderColor: theme.border,
      borderLeftColor: theme.accent,
    },
    itemInner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: TV ? 10 : 8,
      paddingVertical: TV ? 10 : 8,
      gap: 8,
    },
    itemName: {
      flex: 1,
      color: theme.textSub,
      fontSize: TV ? 14 : 13,
      fontWeight: '600',
    },
    itemNameActive: { color: theme.accent },
    itemCount: {
      color: theme.textMuted,
      fontSize: TV ? 11 : 10,
      fontWeight: '600',
    },
    itemCountActive: { color: theme.textMuted },
    skeletonWrap: { padding: 8, gap: 2 },
    skeletonItem: {
      paddingHorizontal: TV ? 14 : 12,
      paddingVertical: TV ? 12 : 10,
    },
    skeletonLine: {
      height: TV ? 13 : 11,
      borderRadius: 4,
      backgroundColor: theme.card,
    },
  });
}
