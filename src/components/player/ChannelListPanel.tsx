import React, {
  useRef, useEffect, useState, useCallback, useMemo,
} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Platform, Animated,
} from 'react-native';

const KeyEvent = Platform.OS === 'android'
  ? (require('react-native-keyevent').default ?? require('react-native-keyevent'))
  : null;

import { FlashList } from '@shopify/flash-list';
import FocusableItem from '../FocusableItem';
import ChannelListItem from '../ChannelListItem';
import NativeChannelList, { isNativeChannelListAvailable } from './NativeChannelList';
import NativeSideEpg, { isNativeSideEpgAvailable } from './NativeSideEpg';
import ChannelSideEpg from './ChannelSideEpg';
import { Channel, EPGProgram } from '../../types';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useUIStore } from '../../store/useUIStore';
import { useFavorites } from '../../hooks/useFavorites';
import { useRecentChannels } from '../../hooks/useRecentChannels';
import { useThemeStore } from '../../store/useThemeStore';
import { withAlphaAndroid } from '../../theme/themes';
import {
  GROUPS_PANEL_W, NAVIGATION_PANEL_W, SLIDE_DUR, TABS, TOTAL_W, TV, TabId,
} from './ChannelListPanel.constants';
import { createChannelListPanelStyles } from './ChannelListPanel.styles';

interface ChannelListPanelProps {
  onChannelSelect: (channel: Channel) => void;
  onCatchupSelect?: (channelId: string, startMs: number, endMs: number, programTitle: string) => void;
  getCurrentProgram?: (channelId: string) => EPGProgram | null;
  getProgramsForChannel?: (channelId: string) => EPGProgram[];
  epgLastUpdated?: number;
  showChannelNumbers?: boolean;
  clockFormat?: '12h' | '24h';
}

// ─── Main component ──────────────────────────────────────────────────────────
const ChannelListPanelInner: React.FC<ChannelListPanelProps> = ({
  onChannelSelect,
  onCatchupSelect,
  getCurrentProgram,
  getProgramsForChannel,
  epgLastUpdated,
  showChannelNumbers = false,
  clockFormat = '24h',
}) => {
  const theme = useThemeStore((s) => s.theme);
  const st    = useMemo(() => createChannelListPanelStyles(theme), [theme]);
  const TAB_FOCUSED     = useMemo(() => ({ backgroundColor: theme.card, borderColor: theme.focused, borderWidth: 1.5, transform: [] as any[], elevation: 3 }), [theme]);
  const TAB_ACT_FOCUSED = useMemo(() => ({ backgroundColor: theme.cardActive, borderColor: theme.accent, borderWidth: 1.5, transform: [] as any[], elevation: 4 }), [theme]);
  const GRP_FOCUSED     = useMemo(() => ({ backgroundColor: theme.card, borderColor: theme.focused, borderWidth: 1.5, transform: [] as any[], elevation: 3 }), [theme]);

  const showGroupsPlaylists    = useUIStore((s) => s.showGroupsPlaylists);
  const showPrimaryNavigation = useUIStore((s) => s.showPrimaryNavigation);
  const setShowGroupsPlaylists = useUIStore((s) => s.setShowGroupsPlaylists);
  const selectedGroup          = useUIStore((s) => s.selectedGroup);
  const setSelectedGroup       = useUIStore((s) => s.setSelectedGroup);
  const showChannelList        = useUIStore((s) => s.showChannelList);
  const setShowChannelList     = useUIStore((s) => s.setShowChannelList);
  const channels               = usePlayerStore((s) => s.channels);
  const channel                = usePlayerStore((s) => s.channel);

  const { favoriteChannels, toggleFavorite, isFavorite } = useFavorites(channels);
  const { recentChannels } = useRecentChannels(channels);

  const currentChannelId = channel?.id ?? '';
  const listRef   = useRef<FlashList<Channel>>(null);
  const slideAnim = useRef(new Animated.Value(-TOTAL_W)).current;

  // Focus tracking — refs only, no state changes on D-pad nav (prevents FlashList re-renders)
  const focusTargetIdRef = useRef<string | null>(null);
  const focusGivenRef    = useRef(false);
  const hasInitialScrolledRef = useRef(false);
  const focusedChannelIdRef = useRef<string | null>(null);
  const filteredChannelsRef = useRef<Channel[]>([]);
  const [renderKey, setRenderKey] = useState(0);

  const [activeTab,        setActiveTab]        = useState<TabId>('all');
  const [searchQuery,      setSearchQuery]       = useState('');
  const [focusedChannelId, setFocusedChannelId]  = useState<string | null>(null);
  const [nativeListFocusTrigger, setNativeListFocusTrigger] = useState(0);
  const [nativeSideEpgFocusTrigger, setNativeSideEpgFocusTrigger] = useState(0);

  // ── Slide animation ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (showChannelList) {
      slideAnim.setValue(-TOTAL_W);
      Animated.timing(slideAnim, {
        toValue: 0, duration: SLIDE_DUR, useNativeDriver: true,
      }).start();
    }
  }, [showChannelList]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Re-focus native channel list when groups panel closes ───────────────────
  const prevShowGroupsPlaylists = useRef(showGroupsPlaylists);
  useEffect(() => {
    if (prevShowGroupsPlaylists.current && !showGroupsPlaylists && showChannelList) {
      setNativeListFocusTrigger((t) => t + 1);
    }
    prevShowGroupsPlaylists.current = showGroupsPlaylists;
  }, [showGroupsPlaylists, showChannelList]);

  // ── Reset when panel opens/closes ───────────────────────────────────────────
  useEffect(() => {
    if (!showChannelList) {
      setSearchQuery('');
      focusGivenRef.current = false;
      hasInitialScrolledRef.current = false;
      return;
    }
    setActiveTab('all');
    setSelectedGroup(channel?.group?.split(';')[0]?.trim() || null);
    focusTargetIdRef.current = currentChannelId || null;
    focusGivenRef.current = false;
    hasInitialScrolledRef.current = false;
    setFocusedChannelId(currentChannelId || null);
    setRenderKey((k) => k + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showChannelList]);

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
    if (activeTab === 'all' && channel && !searchQuery.trim() && !base.some((ch) => ch.id === channel.id)) {
      return [channel, ...base];
    }
    return base;
  }, [channels, selectedGroup, channel, activeTab, favoriteChannels, recentChannels, searchQuery]);

  useEffect(() => {
    filteredChannelsRef.current = filteredChannels;
  }, [filteredChannels]);

  useEffect(() => {
    if (!showChannelList || hasInitialScrolledRef.current || !currentChannelId) return;
    const idx = filteredChannels.findIndex((c) => c.id === currentChannelId);
    if (idx <= 0) return;
    hasInitialScrolledRef.current = true;
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index: idx, animated: false, viewPosition: 0.35 });
    }, 80);
    return () => clearTimeout(timer);
  }, [showChannelList, filteredChannels, currentChannelId]);

  // ── Focused channel EPG — only the focused channel's programs ────────────────
  const focusedChannel = useMemo(
    () => channels.find((ch) => ch.id === focusedChannelId) ?? null,
    [channels, focusedChannelId],
  );

  const nowMs = useMemo(() => Date.now(), [focusedChannelId, epgLastUpdated]); // eslint-disable-line react-hooks/exhaustive-deps

  const focusedPrograms = useMemo(() => {
    if (!getProgramsForChannel || !focusedChannelId) return [];
    const hasCatchup = focusedChannel?.catchupAvailable ?? false;
    const progs = getProgramsForChannel(focusedChannelId);
    const sorted = [...progs].sort((a, b) => a.start.getTime() - b.start.getTime());
    const now = new Date(nowMs);
    // Filter: show past 24h (if catchup) or just current+future
    return sorted.filter((p) => {
      if (p.end <= now) return hasCatchup; // only show past if catchup available
      return true;
    });
  }, [focusedChannelId, focusedChannel, getProgramsForChannel, nowMs, epgLastUpdated]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Callbacks ───────────────────────────────────────────────────────────────
  const handleToggleFavorite = useCallback((ch: Channel) => toggleFavorite(ch), [toggleFavorite]);

  // Stable callback — setFocusedChannelId setter is stable, so no re-renders
  const handleChannelFocus = useCallback((channelId: string) => {
    if (!focusGivenRef.current) {
      focusGivenRef.current = true;
      focusTargetIdRef.current = null;
    }
    focusedChannelIdRef.current = channelId;
    setFocusedChannelId(channelId);
  }, [setFocusedChannelId]);

  const useNativeList = Platform.OS === 'android' && TV && isNativeChannelListAvailable;
  const useNativeSideGuide = Platform.OS === 'android' && TV && isNativeSideEpgAvailable;

  const openGroups = useCallback(() => {
    if (!showGroupsPlaylists) setShowGroupsPlaylists(true);
  }, [showGroupsPlaylists, setShowGroupsPlaylists]);

  const handleNativeTabSelect = useCallback((tabId: string) => {
    if (tabId === 'all' || tabId === 'fav' || tabId === 'recent') {
      setActiveTab(tabId);
    }
  }, []);

  const handleNativeOpenCatchup = useCallback((channelId: string) => {
    focusedChannelIdRef.current = channelId;
    setFocusedChannelId(channelId);
    setNativeSideEpgFocusTrigger((trigger) => trigger + 1);
  }, []);

  const handleNativeReturnToChannels = useCallback(() => {
    setNativeListFocusTrigger((trigger) => trigger + 1);
  }, []);

  const handleCatchupSelect = useCallback((channelId: string, startMs: number, endMs: number, programTitle: string) => {
    setShowChannelList(false);
    onCatchupSelect?.(channelId, startMs, endMs, programTitle);
  }, [setShowChannelList, onCatchupSelect]);

  useEffect(() => {
    // Native channel list handles its own UP/DOWN/CENTER/LEFT key events internally.
    // The JS listener only needs to run for the JS FlashList fallback path.
    if (!showChannelList || !KeyEvent || useNativeList) return;
    KeyEvent.onKeyDownListener((e: { keyCode: number }) => {
      if (showGroupsPlaylists) return;
      const list = filteredChannelsRef.current;
      if (!list.length) return;
      const currentFocusId = focusedChannelIdRef.current || currentChannelId;
      const currentIndex = Math.max(0, list.findIndex((item) => item.id === currentFocusId));

      if (e.keyCode === 21) {
        openGroups();
        return;
      }

      if (e.keyCode === 19 || e.keyCode === 20) {
        const nextIndex = e.keyCode === 19
          ? Math.max(0, currentIndex - 1)
          : Math.min(list.length - 1, currentIndex + 1);
        const next = list[nextIndex];
        if (next) handleChannelFocus(next.id);
        return;
      }

      if (e.keyCode === 23 || e.keyCode === 66) {
        const target = list[currentIndex] || list.find((item) => item.id === currentChannelId) || list[0];
        if (target) onChannelSelect(target);
      }
    });
    return () => KeyEvent.removeKeyDownListener();
  }, [showChannelList, showGroupsPlaylists, openGroups, currentChannelId, handleChannelFocus, onChannelSelect, useNativeList]);

  const extraData = useMemo(() => ({
    currentChannelId,
    isFavorite,
    epgLastUpdated,
    renderKey,
  }), [currentChannelId, isFavorite, epgLastUpdated, renderKey]);

  const renderChannelItem = useCallback(
    ({ item, index }: { item: Channel; index: number }) => {
      const isTarget = !focusGivenRef.current && focusTargetIdRef.current === item.id;
      return (
        <ChannelListItem
          channel={item}
          onPress={onChannelSelect}
          onFocus={handleChannelFocus}
          hasTVPreferredFocus={isTarget}
          isCurrentChannel={item.id === currentChannelId}
          isFavorite={isFavorite(item.id)}
          onToggleFavorite={handleToggleFavorite}
          showNumbers={showChannelNumbers}
          clockFormat={clockFormat}
          index={index}
          currentProgram={getCurrentProgram?.(item.id) ?? null}
        />
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentChannelId, onChannelSelect, handleChannelFocus, isFavorite, handleToggleFavorite, getCurrentProgram],
  );

  const keyExtractor = useCallback((item: Channel) => item.id, []);

  if (!showChannelList) return null;

  const groupLabel   = selectedGroup && selectedGroup !== 'All Channels' ? selectedGroup : 'All Channels';
  const groupsOffset = showGroupsPlaylists
    ? GROUPS_PANEL_W + (showPrimaryNavigation ? NAVIGATION_PANEL_W : 0)
    : 0;
  const focusedGuideLabel = focusedChannel?.name || 'Focused channel';

  return (
    <>
      <TouchableOpacity
        style={st.backdrop}
        activeOpacity={1}
        focusable={false}
        onPress={() => setShowChannelList(false)}
      />

      <Animated.View
        style={[st.panel, { left: groupsOffset, transform: [{ translateX: slideAnim }] }]}
      >
        {!useNativeList && (
          <>
            {/* ── Header ──────────────────────────────────────────────────────── */}
            <View style={st.header}>
              <View style={st.headerLeft}>
                <FocusableItem onPress={openGroups} style={st.groupsArrow} focusedStyle={GRP_FOCUSED}>
                  <Text style={st.groupsArrowTxt}>‹</Text>
                </FocusableItem>
                <Text style={st.headerTitle} numberOfLines={1}>
                  {activeTab === 'fav' ? 'Favorites' : activeTab === 'recent' ? 'Recent' : groupLabel}
                </Text>
                <Text style={st.headerCount}>{filteredChannels.length}</Text>
              </View>
              {getProgramsForChannel && (
                <View style={st.headerEpg}>
                  <Text style={st.headerEpgTxt}>GUIDE</Text>
                </View>
              )}
            </View>

            {/* ── Search (channel col only) ────────────────────────────────────── */}
            <View style={st.searchArea}>
              <View style={st.searchWrap}>
                <Text style={st.searchIcon}>🔍</Text>
                <TextInput
                  style={st.searchInput}
                  placeholder="Search channels..."
                  placeholderTextColor={theme.textMuted}
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
            </View>

            {/* ── Tabs (channel col only) ──────────────────────────────────────── */}
            <View style={st.tabsArea}>
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
                {activeTab === 'all' && (
                  <FocusableItem onPress={openGroups} style={st.groupsBtn} focusedStyle={GRP_FOCUSED}>
                    <Text style={st.groupsBtnTxt}>Groups</Text>
                  </FocusableItem>
                )}
              </View>
            </View>

            <View style={st.columnHeadings}>
              <View style={st.channelHeading}>
                <Text style={st.columnEyebrow}>Channels</Text>
                <Text style={st.columnTitle} numberOfLines={1}>{groupLabel}</Text>
              </View>
              {getProgramsForChannel && (
                <View style={st.guideHeading}>
                  <Text style={st.columnEyebrow}>Side Guide</Text>
                  <Text style={st.columnTitle} numberOfLines={1}>{focusedGuideLabel}</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* ── Content: channel list + EPG panel side by side ──────────────── */}
        <View style={st.content}>
          {/* Channel list */}
          <View style={st.channelCol}>
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
            ) : useNativeList ? (
              <NativeChannelList
                style={{ flex: 1 }}
                channels={filteredChannels}
                currentChannelId={currentChannelId}
                focusedChannelId={focusedChannelId ?? currentChannelId}
                showNumbers={showChannelNumbers}
                title={activeTab === 'fav' ? 'Favorites' : activeTab === 'recent' ? 'Recent' : groupLabel}
                activeTab={activeTab}
                searchQuery={searchQuery}
                accentColor={theme.accent}
                bgColor={withAlphaAndroid(theme.bg, 0)}
                focusTrigger={nativeListFocusTrigger}
                getCurrentProgram={getCurrentProgram}
                onChannelSelect={onChannelSelect}
                onChannelFocus={handleChannelFocus}
                onOpenGroups={openGroups}
                onOpenCatchup={handleNativeOpenCatchup}
                onTabSelect={handleNativeTabSelect}
                onSearchPress={() => setSearchQuery('')}
              />
            ) : (
              <FlashList
                ref={listRef}
                data={filteredChannels}
                keyExtractor={keyExtractor}
                renderItem={renderChannelItem}
                estimatedItemSize={TV ? 80 : 66}
                contentContainerStyle={{ paddingVertical: 6 }}
                keyboardShouldPersistTaps="handled"
                extraData={extraData}
              />
            )}
          </View>

          {/* Focused-channel EPG panel */}
          {getProgramsForChannel && (
            <View style={st.epgCol}>
              {useNativeSideGuide ? (
                <NativeSideEpg
                  style={{ flex: 1 }}
                  channel={focusedChannel}
                  programs={focusedPrograms}
                  now={nowMs}
                  clockFormat={clockFormat}
                  accentColor={theme.accent}
                  bgColor={withAlphaAndroid(theme.bg, 0)}
                  onCatchupSelect={handleCatchupSelect}
                  onOpenGroups={openGroups}
                  onReturnToChannels={handleNativeReturnToChannels}
                  focusTrigger={nativeSideEpgFocusTrigger}
                />
              ) : (
                <ChannelSideEpg
                  channel={focusedChannel}
                  programs={focusedPrograms}
                  now={nowMs}
                  clockFormat={clockFormat}
                  onCatchupSelect={handleCatchupSelect}
                />
              )}
            </View>
          )}
        </View>
      </Animated.View>
    </>
  );
};

const ChannelListPanel: React.FC<ChannelListPanelProps> = (props) => {
  const showChannelList = useUIStore((s) => s.showChannelList);
  if (!showChannelList) return null;
  return <ChannelListPanelInner {...props} />;
};

export default ChannelListPanel;
