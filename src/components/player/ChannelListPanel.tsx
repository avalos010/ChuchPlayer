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
import { useThemeStore } from '../../store/useThemeStore';
import { Theme } from '../../theme/themes';
import { useFavorites } from '../../hooks/useFavorites';
import { useRecentChannels } from '../../hooks/useRecentChannels';

interface ChannelListPanelProps {
  onChannelSelect: (channel: Channel) => void;
}

type TabId = 'all' | 'fav' | 'recent';
const TV = Platform.OS === 'android';
const PANEL_W = TV ? 340 : 300;

const TABS: { id: TabId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'fav', label: '★ Fav' },
  { id: 'recent', label: '🕒 Recent' },
];

const ChannelListPanel: React.FC<ChannelListPanelProps> = ({ onChannelSelect }) => {
  const theme  = useThemeStore((s) => s.theme);
  const styles = useMemo(() => createStyles(theme), [theme]);

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
  const listRef = useRef<FlashList<Channel>>(null);
  const [isLoading, setIsLoading]     = useState(true);
  const [preferredFocusId, setPreferredFocusId] = useState<string | null>(null);
  const preferredFocusIdRef = useRef(preferredFocusId);
  const [activeTab, setActiveTab]     = useState<TabId>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { preferredFocusIdRef.current = preferredFocusId; }, [preferredFocusId]);

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
    if (activeTab === 'all' && channel && !searchQuery.trim() && !base.some((ch) => ch.id === channel.id)) {
      return [channel, ...base];
    }
    return base;
  }, [channels, selectedGroup, channel, activeTab, favoriteChannels, recentChannels, searchQuery]);

  useEffect(() => {
    if (!showChannelList) { setIsLoading(true); setPreferredFocusId(null); return; }
    setIsLoading(false);
    const hasCurrent = filteredChannels.some((ch) => ch.id === currentChannelId);
    const defaultId = hasCurrent ? currentChannelId : filteredChannels[0]?.id ?? null;
    setPreferredFocusId((prev) => prev ?? defaultId);
  }, [showChannelList, filteredChannels, currentChannelId]);

  useEffect(() => { setSearchQuery(''); }, [activeTab]);

  const handleChannelFocus = useCallback((channelId: string) => {
    if (preferredFocusId) setPreferredFocusId(null);
  }, [preferredFocusId]);

  const initialScrollIndex = useMemo(() => {
    if (!showChannelList) return undefined;
    const idx = filteredChannels.findIndex((c) => c.id === currentChannelId);
    return idx >= 0 ? idx : undefined;
  }, [showChannelList, filteredChannels, currentChannelId]);

  const handleToggleFavorite = useCallback((ch: Channel) => toggleFavorite(ch), [toggleFavorite]);

  const tabFocusedStyle = useMemo(() => ({
    backgroundColor: theme.card,
    borderColor: theme.focused,
    borderWidth: 1.5,
    transform: [] as any[],
    elevation: 4,
  }), [theme]);

  const tabActiveFocusedStyle = useMemo(() => ({
    backgroundColor: theme.accent,
    borderColor: theme.focused,
    borderWidth: 1.5,
    transform: [] as any[],
    elevation: 4,
  }), [theme]);

  const renderChannelItem = useCallback(
    ({ item, index }: { item: Channel; index: number }) => (
      <ChannelListItem
        channel={item}
        onPress={onChannelSelect}
        onFocus={handleChannelFocus}
        hasTVPreferredFocus={preferredFocusIdRef.current === item.id}
        isCurrentChannel={item.id === currentChannelId}
        isFavorite={isFavorite(item.id)}
        onToggleFavorite={handleToggleFavorite}
        index={index}
      />
    ),
    [currentChannelId, onChannelSelect, handleChannelFocus, isFavorite, handleToggleFavorite],
  );

  const keyExtractor = useCallback((item: Channel) => item.id, []);

  if (!showChannelList) return null;

  const groupLabel = selectedGroup && selectedGroup !== 'All Channels' ? selectedGroup : 'All Channels';

  return (
    <>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={() => setShowChannelList(false)}
      />
      <View style={[styles.panel, { left: showGroupsPlaylists ? (TV ? 260 : 220) : 0 }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {activeTab === 'fav' ? 'Favorites' : activeTab === 'recent' ? 'Recent' : groupLabel}
          </Text>
          <Text style={styles.headerCount}>
            {filteredChannels.length}
          </Text>
        </View>

        {/* Search bar */}
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search..."
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearTxt}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tabs */}
        <View style={styles.tabsRow}>
          {TABS.map((tab, idx) => (
            <FocusableItem
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              hasTVPreferredFocus={TV && idx === 0 && showChannelList}
              style={[styles.tab, activeTab === tab.id && styles.tabActive]}
              focusedStyle={activeTab === tab.id ? tabActiveFocusedStyle : tabFocusedStyle}
            >
              <Text style={[styles.tabTxt, activeTab === tab.id && styles.tabTxtActive]}>
                {tab.label}
              </Text>
            </FocusableItem>
          ))}
        </View>

        {/* Content */}
        {isLoading ? (
          <View style={styles.skeletonWrap}>
            {Array.from({ length: 8 }).map((_, i) => (
              <View key={i} style={styles.skeletonItem}>
                <View style={styles.skeletonLogo} />
                <View style={[styles.skeletonLine, { width: '60%' }]} />
              </View>
            ))}
          </View>
        ) : filteredChannels.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTxt}>
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
          <View style={{ flex: 1 }}>
            {!showGroupsPlaylists && activeTab === 'all' && (
              <FocusableItem
                onFocus={() => { if (showChannelList) setShowGroupsPlaylists(true); }}
                onPress={() => { if (!showGroupsPlaylists) setShowGroupsPlaylists(true); }}
                style={styles.leftEdgeZone}
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
              estimatedItemSize={TV ? 76 : 62}
              contentContainerStyle={{ paddingVertical: 6 }}
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

function createStyles(theme: Theme) {
  return StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: 15,
      elevation: 15,
    },
    panel: {
      position: 'absolute',
      top: 0, bottom: 0,
      width: PANEL_W,
      backgroundColor: theme.surface,
      borderRightWidth: 1,
      borderRightColor: theme.border,
      zIndex: 20,
      elevation: 20,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: TV ? 16 : 12,
      paddingTop: TV ? 18 : 14,
      paddingBottom: TV ? 10 : 8,
    },
    headerTitle: {
      color: theme.text,
      fontSize: TV ? 20 : 17,
      fontWeight: '800',
      flex: 1,
    },
    headerCount: {
      color: theme.textMuted,
      fontSize: TV ? 13 : 11,
      fontWeight: '600',
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      borderRadius: 8,
      marginHorizontal: TV ? 10 : 8,
      marginBottom: TV ? 8 : 6,
      paddingHorizontal: 10,
      gap: 6,
      height: TV ? 38 : 32,
      borderWidth: 1,
      borderColor: theme.border,
    },
    searchIcon: { fontSize: 13 },
    searchInput: {
      flex: 1,
      color: theme.text,
      fontSize: TV ? 14 : 12,
      fontWeight: '500',
      paddingVertical: 0,
    },
    clearTxt: { color: theme.textMuted, fontSize: 12, fontWeight: '700', padding: 2 },
    tabsRow: {
      flexDirection: 'row',
      marginHorizontal: TV ? 10 : 8,
      marginBottom: TV ? 8 : 6,
      gap: 6,
    },
    tab: {
      flex: 1,
      paddingVertical: TV ? 8 : 6,
      borderRadius: 6,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
    },
    tabActive: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    tabTxt: { color: theme.textMuted, fontSize: TV ? 13 : 11, fontWeight: '700' },
    tabTxtActive: { color: theme.accentText },
    skeletonWrap: { padding: 8, gap: 4 },
    skeletonItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      height: TV ? 72 : 58,
    },
    skeletonLogo: {
      width: TV ? 48 : 40,
      height: TV ? 48 : 40,
      borderRadius: 8,
      backgroundColor: theme.card,
    },
    skeletonLine: {
      height: TV ? 14 : 12,
      borderRadius: 4,
      backgroundColor: theme.card,
    },
    emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    emptyTxt: {
      color: theme.textMuted,
      fontSize: TV ? 14 : 12,
      fontWeight: '500',
      textAlign: 'center',
      lineHeight: 22,
    },
    leftEdgeZone: {
      position: 'absolute',
      top: 0, bottom: 0, left: -20, width: 20,
      backgroundColor: 'transparent',
      zIndex: 1,
    },
  });
}
