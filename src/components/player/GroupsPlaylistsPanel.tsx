import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import FocusableItem from '../FocusableItem';
import { Playlist } from '../../types';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useUIStore } from '../../store/useUIStore';
import { getPlaylists } from '../../utils/storage';
import { groupChannelsByCategory } from '../../utils/m3uParser';

interface GroupsPlaylistsPanelProps {
  onGroupSelect?: (group: string | null) => void;
  onPlaylistSelect?: (playlist: Playlist) => void;
}

const TV = Platform.OS === 'android';

const BTN_FOCUSED = {
  backgroundColor: '#ffffff',
  borderColor: '#ffffff',
  borderWidth: 2,
  transform: [] as any[],
  elevation: 6,
};

const ITEM_FOCUSED = {
  backgroundColor: '#1c1c1c',
  borderColor: '#ffffff',
  borderWidth: 2,
  transform: [] as any[],
  elevation: 4,
};

type ListItem =
  | { type: 'section'; title: string; id: string }
  | { type: 'group'; name: string; id: string }
  | { type: 'playlist'; playlist: Playlist; id: string };

const GroupsPlaylistsPanel: React.FC<GroupsPlaylistsPanelProps> = ({
  onGroupSelect,
  onPlaylistSelect,
}) => {
  const showGroupsPlaylists    = useUIStore((s) => s.showGroupsPlaylists);
  const setShowGroupsPlaylists = useUIStore((s) => s.setShowGroupsPlaylists);
  const setShowChannelList     = useUIStore((s) => s.setShowChannelList);
  const selectedGroup          = useUIStore((s) => s.selectedGroup);
  const setSelectedGroup       = useUIStore((s) => s.setSelectedGroup);
  const channels               = usePlayerStore((s) => s.channels);
  const playlist               = usePlayerStore((s) => s.playlist);
  const setPlaylist            = usePlayerStore((s) => s.setPlaylist);

  const [playlists, setPlaylists]             = useState<Playlist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const hasSetInitialFocusRef                 = useRef(false);
  const listRef                               = useRef<FlatList<ListItem>>(null);

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

  const renderItem = useCallback(({ item, index }: { item: ListItem; index: number }) => {
    if (item.type === 'section') {
      return (
        <View style={s.sectionHeader}>
          <Text style={s.sectionTxt}>{item.title.toUpperCase()}</Text>
        </View>
      );
    }

    if (item.type === 'group') {
      const isAll     = item.name === 'All Channels';
      const isActive  = (isAll && !selectedGroup) || selectedGroup === item.name;
      const chCount   = isAll ? channels.length : channels.filter((c) => c.group === item.name).length;
      const wantFocus = !hasSetInitialFocusRef.current && index === 1;

      return (
        <FocusableItem
          onPress={() => handleGroupPress(isAll ? null : item.name)}
          style={[s.item, isActive && s.itemActive]}
          focusedStyle={ITEM_FOCUSED}
          hasTVPreferredFocus={wantFocus}
          onFocus={() => { hasSetInitialFocusRef.current = true; }}
        >
          <View style={s.itemInner}>
            <View style={{ flex: 1 }}>
              <Text style={[s.itemName, isActive && s.itemNameActive]}>{item.name}</Text>
              <Text style={[s.itemSub, isActive && s.itemSubActive]}>
                {chCount} channel{chCount !== 1 ? 's' : ''}
              </Text>
            </View>
            {isActive && (
              <View style={s.activeBadge}>
                <Text style={s.activeBadgeTxt}>ACTIVE</Text>
              </View>
            )}
          </View>
        </FocusableItem>
      );
    }

    if (item.type === 'playlist') {
      const p           = item.playlist;
      const isActive    = playlist?.id === p.id;
      const firstPIdx   = groups.length + 2;
      const wantFocus   = !hasSetInitialFocusRef.current && index === firstPIdx;

      return (
        <FocusableItem
          onPress={() => handlePlaylistPress(p)}
          style={[s.item, isActive && s.itemActive]}
          focusedStyle={ITEM_FOCUSED}
          hasTVPreferredFocus={wantFocus}
          onFocus={() => { hasSetInitialFocusRef.current = true; }}
        >
          <View style={s.itemInner}>
            <View style={{ flex: 1 }}>
              <Text style={[s.itemName, isActive && s.itemNameActive]}>{p.name}</Text>
              <Text style={[s.itemSub, isActive && s.itemSubActive]}>
                {p.channels.length} channels · {p.sourceType.toUpperCase()}
              </Text>
            </View>
            {isActive && (
              <View style={s.activeBadge}>
                <Text style={s.activeBadgeTxt}>ACTIVE</Text>
              </View>
            )}
          </View>
        </FocusableItem>
      );
    }

    return null;
  }, [selectedGroup, playlist, channels, groups.length, handleGroupPress, handlePlaylistPress]);

  const keyExtractor = useCallback((item: ListItem) => item.id, []);

  if (!showGroupsPlaylists) return null;

  return (
    <>
      {/* Dim backdrop */}
      <TouchableOpacity
        style={s.backdrop}
        activeOpacity={1}
        onPress={() => setShowGroupsPlaylists(false)}
      />

      {/* Panel */}
      <View style={s.panel}>
        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Groups & Playlists</Text>
            <Text style={s.headerSub}>
              {groups.length} groups · {playlists.length} playlist{playlists.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <FocusableItem
            onPress={() => setShowGroupsPlaylists(false)}
            style={s.closeBtn}
            focusedStyle={BTN_FOCUSED}
          >
            <Text style={s.closeBtnTxt}>✕</Text>
          </FocusableItem>
        </View>

        {/* Content */}
        {loadingPlaylists ? (
          <View style={s.skeletonWrap}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View key={i} style={s.skeletonItem}>
                <View style={[s.skeletonLine, { width: '60%' }]} />
                <View style={[s.skeletonLine, { width: '40%', marginTop: 8 }]} />
              </View>
            ))}
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={listData}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={{ paddingVertical: 10 }}
            initialNumToRender={20}
            removeClippedSubviews
          />
        )}
      </View>
    </>
  );
};

export default GroupsPlaylistsPanel;

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
    zIndex: 15,
    elevation: 15,
  },
  panel: {
    position: 'absolute',
    top: 0, left: 0, bottom: 0,
    width: TV ? 460 : 380,
    backgroundColor: '#0d0d0d',
    borderRightWidth: 1,
    borderRightColor: '#1a1a1a',
    zIndex: 20,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 8, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: TV ? 24 : 18,
    paddingVertical: TV ? 20 : 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    backgroundColor: '#0a0a0a',
    gap: 12,
  },
  headerTitle: {
    color: '#f5f5f5',
    fontSize: TV ? 24 : 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSub: {
    color: '#3d3d3d',
    fontSize: TV ? 13 : 11,
    fontWeight: '500',
    marginTop: 3,
  },
  closeBtn: {
    width: TV ? 46 : 40,
    height: TV ? 46 : 40,
    borderRadius: TV ? 12 : 10,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#222222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnTxt: { color: '#555555', fontSize: TV ? 18 : 16, fontWeight: '700' },

  sectionHeader: {
    paddingHorizontal: TV ? 20 : 16,
    paddingTop: TV ? 18 : 14,
    paddingBottom: TV ? 8 : 6,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
  },
  sectionTxt: {
    color: '#2a2a2a',
    fontSize: TV ? 11 : 10,
    fontWeight: '700',
    letterSpacing: 2,
  },

  item: {
    marginHorizontal: TV ? 10 : 8,
    marginVertical: 3,
    borderRadius: TV ? 14 : 12,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  itemActive: {
    backgroundColor: '#161616',
    borderColor: '#333333',
    borderLeftWidth: 3,
    borderLeftColor: '#e5e5e5',
  },
  itemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: TV ? 18 : 14,
    paddingVertical: TV ? 16 : 13,
    gap: 10,
  },
  itemName: {
    color: '#8a8a8a',
    fontSize: TV ? 17 : 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  itemNameActive: { color: '#f5f5f5' },
  itemSub: { color: '#333333', fontSize: TV ? 13 : 11, fontWeight: '500' },
  itemSubActive: { color: '#555555' },

  activeBadge: {
    backgroundColor: '#e5e5e5',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  activeBadgeTxt: {
    color: '#0a0a0a',
    fontSize: TV ? 10 : 9,
    fontWeight: '800',
    letterSpacing: 1,
  },

  skeletonWrap: { padding: 12, gap: 8 },
  skeletonItem: {
    padding: TV ? 18 : 14,
    borderRadius: 12,
    backgroundColor: '#111111',
    marginHorizontal: 8,
    marginVertical: 3,
  },
  skeletonLine: {
    height: TV ? 14 : 12,
    borderRadius: 6,
    backgroundColor: '#181818',
  },
});
