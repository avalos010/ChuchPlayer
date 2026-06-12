import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import FocusableItem from '../FocusableItem';
import { Playlist } from '../../types';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useUIStore } from '../../store/useUIStore';
import { useThemeStore } from '../../store/useThemeStore';
import { Theme, withAlpha, withAlphaAndroid } from '../../theme/themes';

const PANEL_ALPHA = 0.8;
import { getPlaylists } from '../../utils/storage';
import { groupChannelsByCategory } from '../../utils/m3uParser';
import { isTvLikePlatform } from '../../utils/platform';
import NativeGroupsRail, { isNativeGroupsRailAvailable } from './NativeGroupsRail';

interface GroupsPlaylistsPanelProps {
  onGroupSelect?: (group: string | null) => void;
  onPlaylistSelect?: (playlist: Playlist) => void;
}

const TV = isTvLikePlatform;
const PANEL_W = TV ? 300 : 240;

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

  const groupCounts = useMemo(() => {
    const counts = new Map<string, number>();
    channels.forEach((ch) => {
      const name = ch.group || 'Uncategorized';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    });
    return counts;
  }, [channels]);

  const groupModels = useMemo(
    () => groups.map((name) => ({
      name,
      count: name === 'All Channels' ? channels.length : groupCounts.get(name) ?? 0,
    })),
    [channels.length, groupCounts, groups],
  );

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

  const handleNativePlaylistSelect = useCallback((playlistId: string) => {
    const selected = playlists.find((item) => item.id === playlistId);
    if (selected) handlePlaylistPress(selected);
  }, [handlePlaylistPress, playlists]);

  const handleNativeClose = useCallback(() => {
    setShowGroupsPlaylists(false);
    setShowChannelList(true);
  }, [setShowChannelList, setShowGroupsPlaylists]);

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
      const chCount  = isAll ? channels.length : groupCounts.get(item.name) ?? 0;
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
  }, [styles, selectedGroup, playlist, channels.length, groupCounts, groups.length, handleGroupPress, handlePlaylistPress, itemFocusedStyle]);

  const keyExtractor = useCallback((item: ListItem) => item.id, []);

  useEffect(() => {
    if (!showGroupsPlaylists || !listData.length) return;
    const activeIndex = listData.findIndex((item) =>
      item.type === 'group' &&
      ((item.name === 'All Channels' && !selectedGroup) || item.name === selectedGroup),
    );
    if (activeIndex <= 0) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index: activeIndex, animated: false, viewPosition: 0.22 });
    }, 80);
    return () => clearTimeout(timer);
  }, [showGroupsPlaylists, listData, selectedGroup]);

  if (!showGroupsPlaylists) return null;

  const activeGroupLabel = selectedGroup || 'All Channels';
  const useNativeRail = Platform.OS === 'android' && TV && isNativeGroupsRailAvailable;

  if (useNativeRail) {
    return (
      <>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          focusable={false}
          onPress={() => setShowGroupsPlaylists(false)}
        />
        <View style={styles.panel}>
          <NativeGroupsRail
            style={{ flex: 1 }}
            groups={groupModels}
            playlists={playlists}
            selectedGroup={selectedGroup}
            currentPlaylistId={playlist?.id}
            accentColor={theme.accent}
            bgColor={withAlphaAndroid(theme.surface, 0)}
            onGroupSelect={handleGroupPress}
            onPlaylistSelect={handleNativePlaylistSelect}
            onClose={handleNativeClose}
          />
        </View>
      </>
    );
  }

  return (
    <>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        focusable={false}
        onPress={() => setShowGroupsPlaylists(false)}
      />
      <View style={styles.panel}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle} numberOfLines={1}>Groups & Playlists</Text>
            <Text style={styles.headerSub} numberOfLines={1}>{activeGroupLabel}</Text>
          </View>
          <Text style={styles.headerCount}>
            {groups.length}G / {playlists.length}P
          </Text>
        </View>

        <FlatList
          ref={listRef}
          data={listData}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={{ paddingVertical: 6 }}
          initialNumToRender={20}
          removeClippedSubviews
          onScrollToIndexFailed={() => {}}
          ListFooterComponent={loadingPlaylists ? (
            <View style={styles.loadingPlaylists}>
              <Text style={styles.loadingPlaylistsTxt}>Loading playlists...</Text>
            </View>
          ) : null}
        />
      </View>
    </>
  );
};

export default GroupsPlaylistsPanel;

function createStyles(theme: Theme) {
  return StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'transparent',
      zIndex: 55,
      elevation: 55,
    },
    panel: {
      position: 'absolute',
      top: 0, left: 0, bottom: 0,
      width: PANEL_W,
      backgroundColor: withAlpha(theme.surface, PANEL_ALPHA),
      borderRightWidth: 1,
      borderRightColor: theme.border,
      zIndex: 60,
      elevation: 60,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: TV ? 14 : 12,
      paddingTop: TV ? 18 : 14,
      paddingBottom: TV ? 10 : 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerText: {
      flex: 1,
      paddingRight: 10,
    },
    headerTitle: {
      color: theme.text,
      fontSize: TV ? 17 : 15,
      fontWeight: '800',
    },
    headerSub: {
      color: theme.textMuted,
      fontSize: TV ? 11 : 10,
      fontWeight: '600',
      marginTop: 2,
    },
    headerCount: {
      color: theme.accent,
      fontSize: TV ? 11 : 10,
      fontWeight: '800',
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
    loadingPlaylists: {
      paddingHorizontal: TV ? 14 : 12,
      paddingTop: TV ? 10 : 8,
      paddingBottom: TV ? 18 : 14,
    },
    loadingPlaylistsTxt: {
      color: theme.textMuted,
      fontSize: TV ? 11 : 9,
      fontWeight: '600',
    },
  });
}
