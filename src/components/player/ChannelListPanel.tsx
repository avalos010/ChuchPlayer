import React, {
  useRef, useEffect, useState, useCallback, useMemo,
} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Platform, Animated,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import FocusableItem from '../FocusableItem';
import ChannelListItem from '../ChannelListItem';
import { Channel, EPGProgram } from '../../types';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useUIStore } from '../../store/useUIStore';
import { useFavorites } from '../../hooks/useFavorites';
import { useRecentChannels } from '../../hooks/useRecentChannels';

interface ChannelListPanelProps {
  onChannelSelect: (channel: Channel) => void;
  getCurrentProgram?: (channelId: string) => EPGProgram | null;
  epgLastUpdated?: number;
}

type TabId = 'all' | 'fav' | 'recent';

const TV = Platform.OS === 'android';
const PANEL_W = TV ? 340 : 300;
const SLIDE_DURATION = 250;

const TABS: { id: TabId; label: string }[] = [
  { id: 'all',    label: 'All' },
  { id: 'fav',    label: '★ Fav' },
  { id: 'recent', label: '🕒 Recent' },
];

// ─── Focused styles (static — don't recreate per render) ─────────────────────
const TAB_FOCUSED      = { backgroundColor: '#1e293b', borderColor: '#334155', borderWidth: 1.5, transform: [] as any[], elevation: 3 };
const TAB_ACT_FOCUSED  = { backgroundColor: '#0284c7', borderColor: '#0ea5e9', borderWidth: 1.5, transform: [] as any[], elevation: 4 };

const ChannelListPanel: React.FC<ChannelListPanelProps> = ({
  onChannelSelect,
  getCurrentProgram,
  epgLastUpdated,
}) => {
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
  const listRef    = useRef<FlashList<Channel>>(null);
  const slideAnim  = useRef(new Animated.Value(-PANEL_W)).current;
  const didScrollRef = useRef(false);

  const [activeTab,    setActiveTab]    = useState<TabId>('all');
  const [searchQuery,  setSearchQuery]  = useState('');
  // Which item should get hasTVPreferredFocus on this open
  const [focusTargetId, setFocusTargetId] = useState<string | null>(null);
  const focusGivenRef = useRef(false); // cleared once one item takes focus

  // ── Slide animation ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (showChannelList) {
      slideAnim.setValue(-PANEL_W);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: SLIDE_DURATION,
        useNativeDriver: true,
      }).start();
    }
  }, [showChannelList]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset state when panel opens ────────────────────────────────────────────
  useEffect(() => {
    if (!showChannelList) {
      setSearchQuery('');
      didScrollRef.current   = false;
      focusGivenRef.current  = false;
      return;
    }
    // Set focus target to current channel (or first channel)
    const target = currentChannelId || filteredChannels[0]?.id || null;
    setFocusTargetId(target);
    focusGivenRef.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showChannelList]);

  // ── Reset search when tab changes ───────────────────────────────────────────
  useEffect(() => { setSearchQuery(''); }, [activeTab]);

  // ── Filtered channel list ───────────────────────────────────────────────────
  const filteredChannels = useMemo(() => {
    let base: Channel[];
    if (activeTab === 'fav') base = favoriteChannels;
    else if (activeTab === 'recent') base = recentChannels;
    else {
      base = selectedGroup && selectedGroup !== 'All Channels'
        ? channels.filter((ch) => ch.group === selectedGroup)
        : channels;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      base = base.filter((ch) => ch.name.toLowerCase().includes(q));
    }
    // Ensure current channel is visible in 'all' tab even if group-filtered out
    if (activeTab === 'all' && channel && !searchQuery.trim() && !base.some((ch) => ch.id === channel.id)) {
      return [channel, ...base];
    }
    return base;
  }, [channels, selectedGroup, channel, activeTab, favoriteChannels, recentChannels, searchQuery]);

  // ── Scroll to current channel after panel opens ─────────────────────────────
  const initialScrollIndex = useMemo(() => {
    if (!showChannelList) return undefined;
    const idx = filteredChannels.findIndex((c) => c.id === currentChannelId);
    return idx > 0 ? idx : undefined;
  }, [showChannelList, filteredChannels, currentChannelId]);

  // ── Callbacks ───────────────────────────────────────────────────────────────
  const handleToggleFavorite = useCallback((ch: Channel) => toggleFavorite(ch), [toggleFavorite]);

  const handleChannelFocus = useCallback((channelId: string) => {
    // Once any item naturally gets focus, stop forcing preferred focus
    if (!focusGivenRef.current) {
      focusGivenRef.current = true;
      setFocusTargetId(null);
    }
  }, []);

  // ── extraData: re-render items when EPG or favorites change ─────────────────
  const extraData = useMemo(() => ({
    currentChannelId,
    isFavorite,
    epgLastUpdated,
  }), [currentChannelId, isFavorite, epgLastUpdated]);

  // ── Render item ─────────────────────────────────────────────────────────────
  const renderChannelItem = useCallback(
    ({ item, index }: { item: Channel; index: number }) => {
      const isTarget = !focusGivenRef.current && focusTargetId === item.id;
      const prog = getCurrentProgram ? getCurrentProgram(item.id) : null;
      return (
        <ChannelListItem
          channel={item}
          onPress={onChannelSelect}
          onFocus={handleChannelFocus}
          hasTVPreferredFocus={isTarget}
          isCurrentChannel={item.id === currentChannelId}
          isFavorite={isFavorite(item.id)}
          onToggleFavorite={handleToggleFavorite}
          index={index}
          currentProgram={prog}
        />
      );
    },
    // focusTargetId in deps so preferred-focus updates when panel reopens
    [currentChannelId, onChannelSelect, handleChannelFocus, isFavorite, handleToggleFavorite, getCurrentProgram, focusTargetId],
  );

  const keyExtractor = useCallback((item: Channel) => item.id, []);

  if (!showChannelList) return null;

  const groupLabel = selectedGroup && selectedGroup !== 'All Channels'
    ? selectedGroup
    : 'All Channels';

  // Offset right when groups panel is also open
  const groupsOffset = showGroupsPlaylists ? (TV ? 260 : 220) : 0;

  return (
    <>
      {/* Backdrop */}
      <TouchableOpacity
        style={st.backdrop}
        activeOpacity={1}
        onPress={() => setShowChannelList(false)}
      />

      {/* Sliding panel */}
      <Animated.View
        style={[
          st.panel,
          { left: groupsOffset, transform: [{ translateX: slideAnim }] },
        ]}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={st.header}>
          <Text style={st.headerTitle} numberOfLines={1}>
            {activeTab === 'fav' ? 'Favorites' : activeTab === 'recent' ? 'Recent' : groupLabel}
          </Text>
          <Text style={st.headerCount}>{filteredChannels.length}</Text>
        </View>

        {/* ── Search ──────────────────────────────────────────────────────── */}
        <View style={st.searchWrap}>
          <Text style={st.searchIcon}>🔍</Text>
          <TextInput
            style={st.searchInput}
            placeholder="Search channels..."
            placeholderTextColor="#334155"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={st.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <View style={st.tabsRow}>
          {TABS.map((tab) => (
            <FocusableItem
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[st.tab, activeTab === tab.id && st.tabActive]}
              focusedStyle={activeTab === tab.id ? TAB_ACT_FOCUSED : TAB_FOCUSED}
            >
              <Text style={[st.tabTxt, activeTab === tab.id && st.tabTxtActive]}>
                {tab.label}
              </Text>
            </FocusableItem>
          ))}

          {/* Groups button — opens the groups/playlists panel */}
          {activeTab === 'all' && !showGroupsPlaylists && (
            <FocusableItem
              onPress={() => setShowGroupsPlaylists(true)}
              style={st.groupsBtn}
              focusedStyle={TAB_FOCUSED}
            >
              <Text style={st.groupsBtnTxt}>≡ Groups</Text>
            </FocusableItem>
          )}
        </View>

        {/* ── List ────────────────────────────────────────────────────────── */}
        {filteredChannels.length === 0 ? (
          <View style={st.emptyWrap}>
            <Text style={st.emptyTxt}>
              {searchQuery.trim()
                ? `No results for "${searchQuery}"`
                : activeTab === 'fav'
                ? 'No favorites yet.\nStar a channel to add it here.'
                : activeTab === 'recent'
                ? 'No recently watched channels.'
                : `No channels in "${groupLabel}"`}
            </Text>
          </View>
        ) : (
          <FlashList
            ref={listRef}
            data={filteredChannels}
            keyExtractor={keyExtractor}
            renderItem={renderChannelItem}
            estimatedItemSize={TV ? 80 : 66}
            initialScrollIndex={initialScrollIndex}
            contentContainerStyle={{ paddingVertical: 6 }}
            keyboardShouldPersistTaps="handled"
            extraData={extraData}
            scrollEventThrottle={16}
          />
        )}
      </Animated.View>
    </>
  );
};

export default ChannelListPanel;

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 15,
    elevation: 15,
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: PANEL_W,
    backgroundColor: '#080c14',
    borderRightWidth: 1,
    borderRightColor: '#1e293b',
    zIndex: 20,
    elevation: 20,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: TV ? 16 : 12,
    paddingTop: TV ? 20 : 14,
    paddingBottom: TV ? 10 : 8,
    borderBottomWidth: 1,
    borderBottomColor: '#0f172a',
  },
  headerTitle: {
    color: '#e2e8f0',
    fontSize: TV ? 18 : 15,
    fontWeight: '800',
    flex: 1,
    letterSpacing: -0.3,
  },
  headerCount: {
    color: '#334155',
    fontSize: TV ? 13 : 11,
    fontWeight: '700',
  },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d1117',
    borderRadius: 8,
    marginHorizontal: TV ? 10 : 8,
    marginTop: TV ? 10 : 8,
    marginBottom: TV ? 6 : 4,
    paddingHorizontal: 10,
    gap: 6,
    height: TV ? 38 : 32,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  searchIcon: { fontSize: 13 },
  searchInput: {
    flex: 1,
    color: '#94a3b8',
    fontSize: TV ? 14 : 12,
    fontWeight: '500',
    paddingVertical: 0,
  },
  clearBtn: { color: '#334155', fontSize: 12, fontWeight: '700', padding: 4 },

  // Tabs
  tabsRow: {
    flexDirection: 'row',
    marginHorizontal: TV ? 10 : 8,
    marginBottom: TV ? 8 : 6,
    gap: 5,
  },
  tab: {
    flex: 1,
    paddingVertical: TV ? 7 : 5,
    borderRadius: 6,
    backgroundColor: '#0d1117',
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#0c2240',
    borderColor: '#0ea5e9',
  },
  tabTxt: { color: '#334155', fontSize: TV ? 12 : 10, fontWeight: '700' },
  tabTxtActive: { color: '#38bdf8' },

  // Groups button
  groupsBtn: {
    paddingVertical: TV ? 7 : 5,
    paddingHorizontal: TV ? 10 : 8,
    borderRadius: 6,
    backgroundColor: '#0d1117',
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupsBtnTxt: { color: '#334155', fontSize: TV ? 12 : 10, fontWeight: '700' },

  // Empty
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTxt: {
    color: '#334155',
    fontSize: TV ? 13 : 11,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
  },
});
