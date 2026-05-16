import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import FocusableItem from '../FocusableItem';
import ChannelListItem from '../ChannelListItem';
import { Channel } from '../../types';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useUIStore } from '../../store/useUIStore';
import { useFavorites } from '../../hooks/useFavorites';
import { useRecentChannels } from '../../hooks/useRecentChannels';

interface ChannelListPanelProps {
  onChannelSelect: (channel: Channel) => void;
}

type TabId = 'all' | 'fav' | 'recent';

const TV = Platform.OS === 'android';

const BTN_FOCUSED = {
  backgroundColor: '#ffffff',
  borderColor: '#ffffff',
  borderWidth: 2,
  transform: [] as any[],
  elevation: 6,
};
const TAB_FOCUSED = {
  backgroundColor: '#1c1c1c',
  borderColor: '#ffffff',
  borderWidth: 1.5,
  transform: [] as any[],
  elevation: 4,
};

const TABS: { id: TabId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'fav', label: '★ Fav' },
  { id: 'recent', label: '🕒 Recent' },
];

const ChannelListPanel: React.FC<ChannelListPanelProps> = ({ onChannelSelect }) => {
  const showGroupsPlaylists    = useUIStore((s) => s.showGroupsPlaylists);
  const setShowGroupsPlaylists = useUIStore((s) => s.setShowGroupsPlaylists);
  const selectedGroup          = useUIStore((s) => s.selectedGroup);
  const showChannelList        = useUIStore((s) => s.showChannelList);
  const setShowChannelList     = useUIStore((s) => s.setShowChannelList);
  const channels               = usePlayerStore((s) => s.channels);
  const channel                = usePlayerStore((s) => s.channel);

  const { favoriteChannels, toggleFavorite, isFavorite } = useFavorites(channels);
  const { recentChannels } = useRecentChannels(channels);

  const currentChannelId = channel?.id ?? '';
  const listRef          = useRef<FlashList<Channel>>(null);
  const [isLoading, setIsLoading]       = useState(true);
  const [preferredFocusId, setPreferredFocusId] = useState<string | null>(null);
  const preferredFocusIdRef = useRef(preferredFocusId);
  const [activeTab, setActiveTab]       = useState<TabId>('all');
  const [searchQuery, setSearchQuery]   = useState('');

  useEffect(() => {
    preferredFocusIdRef.current = preferredFocusId;
  }, [preferredFocusId]);

  // Build the list based on active tab + group filter + search
  const filteredChannels = useMemo(() => {
    let base: Channel[];

    if (activeTab === 'fav') {
      base = favoriteChannels;
    } else if (activeTab === 'recent') {
      base = recentChannels;
    } else {
      // All tab — apply group filter
      if (selectedGroup && selectedGroup !== 'All Channels') {
        base = channels.filter((ch) => ch.group === selectedGroup);
      } else {
        base = channels;
      }
    }

    // Apply search (searches across base for this tab)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      base = base.filter((ch) => ch.name.toLowerCase().includes(q));
    }

    // Ensure currently playing channel is visible when on All tab
    if (activeTab === 'all' && channel && !base.some((ch) => ch.id === channel.id) && !searchQuery.trim()) {
      return [channel, ...base];
    }
    return base;
  }, [channels, selectedGroup, channel, activeTab, favoriteChannels, recentChannels, searchQuery]);

  useEffect(() => {
    if (!showChannelList) {
      setIsLoading(true);
      setPreferredFocusId(null);
      return;
    }
    setIsLoading(false);
    const hasCurrent = filteredChannels.some((ch) => ch.id === currentChannelId);
    const defaultId = hasCurrent ? currentChannelId : filteredChannels[0]?.id ?? null;
    setPreferredFocusId((prev) => prev ?? defaultId);
  }, [showChannelList, filteredChannels, currentChannelId]);

  // Reset search when tab changes
  useEffect(() => { setSearchQuery(''); }, [activeTab]);

  const handleChannelFocus = useCallback((channelId: string) => {
    if (preferredFocusId) setPreferredFocusId(null);
  }, [preferredFocusId]);

  const initialScrollIndex = useMemo(() => {
    if (!showChannelList) return undefined;
    const idx = filteredChannels.findIndex((c) => c.id === currentChannelId);
    return idx >= 0 ? idx : undefined;
  }, [showChannelList, filteredChannels, currentChannelId]);

  const handleToggleFavorite = useCallback((ch: Channel) => {
    toggleFavorite(ch);
  }, [toggleFavorite]);

  const renderChannelItem = useCallback(
    ({ item }: { item: Channel }) => (
      <ChannelListItem
        channel={item}
        onPress={onChannelSelect}
        onFocus={handleChannelFocus}
        hasTVPreferredFocus={preferredFocusIdRef.current === item.id}
        isCurrentChannel={item.id === currentChannelId}
        isFavorite={isFavorite(item.id)}
        onToggleFavorite={handleToggleFavorite}
      />
    ),
    [currentChannelId, onChannelSelect, handleChannelFocus, isFavorite, handleToggleFavorite],
  );

  const keyExtractor = useCallback((item: Channel) => item.id, []);

  if (!showChannelList) return null;

  const groupLabel = selectedGroup && selectedGroup !== 'All Channels'
    ? selectedGroup
    : 'All Channels';

  return (
    <>
      {/* Dim backdrop */}
      <TouchableOpacity
        style={s.backdrop}
        activeOpacity={1}
        onPress={() => setShowChannelList(false)}
      />

      {/* Panel */}
      <View style={s.panel}>
        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle} numberOfLines={1}>
              {activeTab === 'fav' ? 'Favorites' : activeTab === 'recent' ? 'Recent' : groupLabel}
            </Text>
            <Text style={s.headerSub}>
              {filteredChannels.length} channel{filteredChannels.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={s.headerBtns}>
            {activeTab === 'all' && (
              <FocusableItem
                onPress={() => { setShowChannelList(false); setShowGroupsPlaylists(true); }}
                style={s.hBtn}
                focusedStyle={BTN_FOCUSED}
              >
                <Text style={s.hBtnIcon}>☰</Text>
              </FocusableItem>
            )}
            <FocusableItem
              onPress={() => setShowChannelList(false)}
              style={s.hBtn}
              focusedStyle={BTN_FOCUSED}
            >
              <Text style={s.hBtnIcon}>✕</Text>
            </FocusableItem>
          </View>
        </View>

        {/* Search bar */}
        <View style={s.searchRow}>
          <View style={s.searchWrap}>
            <Text style={s.searchIcon}>🔍</Text>
            <TextInput
              style={s.searchInput}
              placeholder="Search channels..."
              placeholderTextColor="#3d3d3d"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={s.clearBtn}>
                <Text style={s.clearTxt}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Tabs */}
        <View style={s.tabsRow}>
          {TABS.map((tab, idx) => (
            <FocusableItem
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              hasTVPreferredFocus={TV && idx === 0 && showChannelList}
              style={[s.tab, activeTab === tab.id && s.tabActive]}
              focusedStyle={TAB_FOCUSED}
            >
              <Text style={[s.tabTxt, activeTab === tab.id && s.tabTxtActive]}>
                {tab.label}
              </Text>
            </FocusableItem>
          ))}
        </View>

        {/* Content */}
        {isLoading ? (
          <View style={s.skeletonWrap}>
            {Array.from({ length: 7 }).map((_, i) => (
              <View key={i} style={s.skeletonItem}>
                <View style={s.skeletonLogo} />
                <View style={{ flex: 1, gap: 8 }}>
                  <View style={[s.skeletonLine, { width: '65%' }]} />
                  <View style={[s.skeletonLine, { width: '40%' }]} />
                </View>
              </View>
            ))}
          </View>
        ) : filteredChannels.length === 0 ? (
          <View style={s.emptyWrap}>
            <Text style={s.emptyTxt}>
              {searchQuery.trim()
                ? `No results for "${searchQuery}"`
                : activeTab === 'fav'
                ? 'No favorites yet.\nStar a channel to add it here.'
                : activeTab === 'recent'
                ? 'No recently watched channels.'
                : selectedGroup && selectedGroup !== 'All Channels'
                ? `No channels in "${selectedGroup}"`
                : 'No channels available'}
            </Text>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            {/* Hidden left-edge zone to trigger groups panel */}
            {!showGroupsPlaylists && activeTab === 'all' && (
              <FocusableItem
                onFocus={() => { if (showChannelList) setShowGroupsPlaylists(true); }}
                onPress={() => { if (!showGroupsPlaylists) setShowGroupsPlaylists(true); }}
                style={s.leftEdgeZone}
                focusedStyle={{ backgroundColor: 'transparent' }}
              >
                <View style={{ flex: 1 }} />
              </FocusableItem>
            )}
            <FlashList
              ref={listRef}
              data={filteredChannels}
              keyExtractor={keyExtractor}
              renderItem={renderChannelItem}
              initialScrollIndex={initialScrollIndex}
              estimatedItemSize={TV ? 100 : 86}
              contentContainerStyle={{ paddingVertical: 8 }}
              keyboardShouldPersistTaps="handled"
              extraData={isFavorite}
            />
          </View>
        )}
      </View>
    </>
  );
};

export default ChannelListPanel;

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 15,
    elevation: 15,
  },
  panel: {
    position: 'absolute',
    top: 0, left: 0, bottom: 0,
    width: TV ? 480 : 400,
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
    paddingTop: TV ? 20 : 16,
    paddingBottom: TV ? 12 : 10,
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
  headerBtns: { flexDirection: 'row', gap: 8 },
  hBtn: {
    width: TV ? 46 : 40,
    height: TV ? 46 : 40,
    borderRadius: TV ? 12 : 10,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#222222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hBtnIcon: { color: '#555555', fontSize: TV ? 18 : 16, fontWeight: '700' },

  searchRow: {
    paddingHorizontal: TV ? 16 : 12,
    paddingVertical: TV ? 10 : 8,
    backgroundColor: '#0a0a0a',
    borderBottomWidth: 1,
    borderBottomColor: '#111',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    paddingHorizontal: 12,
    gap: 8,
    height: TV ? 42 : 36,
  },
  searchIcon: { fontSize: TV ? 15 : 13 },
  searchInput: {
    flex: 1,
    color: '#ccc',
    fontSize: TV ? 15 : 13,
    fontWeight: '500',
    paddingVertical: 0,
  },
  clearBtn: { padding: 4 },
  clearTxt: { color: '#555', fontSize: 13, fontWeight: '700' },

  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: TV ? 16 : 12,
    paddingVertical: TV ? 10 : 8,
    gap: 8,
    backgroundColor: '#0a0a0a',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  tab: {
    flex: 1,
    paddingVertical: TV ? 10 : 8,
    borderRadius: 8,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#1e1e1e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: '#1a1a1a',
    borderColor: '#333',
  },
  tabTxt: {
    color: '#555',
    fontSize: TV ? 14 : 12,
    fontWeight: '700',
  },
  tabTxtActive: {
    color: '#f5f5f5',
  },

  skeletonWrap: { padding: 12, gap: 8 },
  skeletonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#111111',
  },
  skeletonLogo: {
    width: TV ? 64 : 52,
    height: TV ? 64 : 52,
    borderRadius: 10,
    backgroundColor: '#181818',
  },
  skeletonLine: {
    height: TV ? 14 : 12,
    borderRadius: 6,
    backgroundColor: '#181818',
  },

  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTxt: { color: '#333333', fontSize: TV ? 15 : 13, fontWeight: '500', textAlign: 'center', lineHeight: 22 },

  leftEdgeZone: {
    position: 'absolute',
    top: 0, bottom: 0, left: -20, width: 20,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
});
