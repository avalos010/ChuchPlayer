import React, {
  useRef, useEffect, useState, useCallback, useMemo, useImperativeHandle,
} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Platform, Animated, ScrollView,
} from 'react-native';

const KeyEvent = Platform.OS === 'android'
  ? (require('react-native-keyevent').default ?? require('react-native-keyevent'))
  : null;

import { FlashList } from '@shopify/flash-list';
import FocusableItem from '../FocusableItem';
import ChannelListItem from '../ChannelListItem';
import NativeChannelList, { isNativeChannelListAvailable } from './NativeChannelList';
import NativeSideEpg, { isNativeSideEpgAvailable } from './NativeSideEpg';
import { Channel, EPGProgram } from '../../types';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useUIStore } from '../../store/useUIStore';
import { useFavorites } from '../../hooks/useFavorites';
import { useRecentChannels } from '../../hooks/useRecentChannels';
import { isTvLikePlatform } from '../../utils/platform';
import { formatClockTime } from '../../utils/time';
import { useThemeStore } from '../../store/useThemeStore';
import { Theme } from '../../theme/themes';

interface ChannelListPanelProps {
  onChannelSelect: (channel: Channel) => void;
  onCatchupSelect?: (channelId: string, startMs: number, endMs: number, programTitle: string) => void;
  getCurrentProgram?: (channelId: string) => EPGProgram | null;
  getProgramsForChannel?: (channelId: string) => EPGProgram[];
  epgLastUpdated?: number;
  showChannelNumbers?: boolean;
  clockFormat?: '12h' | '24h';
}

type TabId = 'all' | 'fav' | 'recent';

const TV = isTvLikePlatform;
const PANEL_W  = TV ? 340 : 300;
const EPG_W    = TV ? 400 : 290;
const TOTAL_W  = PANEL_W + EPG_W;
const GROUPS_PANEL_W = TV ? 300 : 240;
const SLIDE_DUR = 120;

const TABS: { id: TabId; label: string }[] = [
  { id: 'all',    label: 'All' },
  { id: 'fav',    label: '★ Fav' },
  { id: 'recent', label: '🕒 Recent' },
];

// ─── Focused-channel EPG panel ────────────────────────────────────────────────
interface EpgDetailPanelProps {
  channel: Channel | null;
  programs: EPGProgram[];
  now: number;
  clockFormat: '12h' | '24h';
  onCatchupSelect?: (channelId: string, startMs: number, endMs: number, programTitle: string) => void;
}

const EPG_ROW_H = TV ? 72 : 60;

const EpgDetailPanelInner = React.forwardRef<ScrollView, EpgDetailPanelProps>(
  ({ channel, programs, now, clockFormat, onCatchupSelect }, ref) => {
    const theme = useThemeStore((s) => s.theme);
    const ep = useMemo(() => createEpgStyles(theme), [theme]);
    const ROW_FOCUSED = useMemo(() => ({
      backgroundColor: theme.card,
      borderColor: theme.focused,
      borderWidth: 1,
      transform: [] as any[],
      elevation: 4,
    }), [theme]);
    const scrollRef = useRef<ScrollView>(null);

    // Expose the scroll ref so ChannelListPanel can forward it
    useImperativeHandle(ref, () => scrollRef.current as ScrollView, []);

    // Auto-scroll so current program is near the top when channel changes
    useEffect(() => {
      if (!programs.length) return;
      const idx = programs.findIndex((p) => p.start.getTime() <= now && p.end.getTime() > now);
      if (idx > 1) {
        const t = setTimeout(
          () => scrollRef.current?.scrollTo({ y: (idx - 1) * EPG_ROW_H, animated: false }),
          50,
        );
        return () => clearTimeout(t);
      }
    }, [channel?.id, programs]); // eslint-disable-line react-hooks/exhaustive-deps

    // Scroll focused row into view
    const handleRowFocus = useCallback((index: number) => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, (index - 1) * EPG_ROW_H),
        animated: true,
      });
    }, []);

    if (!channel) {
      return (
        <View style={ep.empty}>
          <Text style={ep.emptyTxt}>Focus a channel</Text>
        </View>
      );
    }

    const hasCatchup = channel.catchupAvailable;

    return (
      <View style={ep.root}>
        {/* Header */}
        <View style={ep.chHeader}>
          <Text style={ep.chName} numberOfLines={1}>{channel.name}</Text>
          {hasCatchup && (
            <View style={ep.catchupBadge}><Text style={ep.catchupTxt}>⏮ catchup</Text></View>
          )}
        </View>

        <ScrollView
          ref={scrollRef}
          scrollEnabled
          showsVerticalScrollIndicator={false}
          style={ep.scroll}
        >
          {programs.length === 0 ? (
            <Text style={ep.noProg}>No guide data</Text>
          ) : (
            programs.map((p, index) => {
              const isCurrent  = p.start.getTime() <= now && p.end.getTime() > now;
              const isPast     = p.end.getTime() <= now;
              const canCatchup = isPast && hasCatchup;
              return (
                <FocusableItem
                  key={p.id}
                  onPress={() => { if (canCatchup && channel) onCatchupSelect?.(channel.id, p.start.getTime(), p.end.getTime(), p.title); }}
                  onFocus={() => handleRowFocus(index)}
                  style={[
                    ep.row,
                    isCurrent && ep.rowCurrent,
                    isPast && !canCatchup && ep.rowPastNoCatchup,
                  ]}
                  focusedStyle={ROW_FOCUSED}
                >
                  <View style={ep.rowLeft}>
                    <Text style={[ep.time, isCurrent && ep.timeCurrent, isPast && !canCatchup && ep.timeGray]}>
                      {formatClockTime(p.start, clockFormat, { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                    {canCatchup && <Text style={ep.catchupDot}>⏮</Text>}
                    {isCurrent && <View style={ep.nowDot} />}
                  </View>
                  <View style={ep.rowRight}>
                    <Text
                      style={[ep.title, isCurrent && ep.titleCurrent, isPast && !canCatchup && ep.titleGray]}
                      numberOfLines={2}
                    >
                      {p.title}
                    </Text>
                    <Text style={[ep.dur, isCurrent && ep.durCurrent]}>
                      {formatClockTime(p.start, clockFormat, { hour: 'numeric', minute: '2-digit' })} – {formatClockTime(p.end, clockFormat, { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                  </View>
                </FocusableItem>
              );
            })
          )}
        </ScrollView>
      </View>
    );
  },
);

EpgDetailPanelInner.displayName = 'EpgDetailPanel';

const EpgDetailPanel = React.memo(EpgDetailPanelInner, (prev, next) =>
  prev.channel?.id        === next.channel?.id        &&
  prev.programs           === next.programs           &&
  prev.clockFormat        === next.clockFormat        &&
  prev.onCatchupSelect    === next.onCatchupSelect    &&
  Math.abs(prev.now - next.now) < 60_000,
);

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
  const st    = useMemo(() => createStyles(theme), [theme]);
  const TAB_FOCUSED     = useMemo(() => ({ backgroundColor: theme.card, borderColor: theme.focused, borderWidth: 1.5, transform: [] as any[], elevation: 3 }), [theme]);
  const TAB_ACT_FOCUSED = useMemo(() => ({ backgroundColor: theme.cardActive, borderColor: theme.accent, borderWidth: 1.5, transform: [] as any[], elevation: 4 }), [theme]);
  const GRP_FOCUSED     = useMemo(() => ({ backgroundColor: theme.card, borderColor: theme.focused, borderWidth: 1.5, transform: [] as any[], elevation: 3 }), [theme]);

  const showGroupsPlaylists    = useUIStore((s) => s.showGroupsPlaylists);
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

  // ── Slide animation ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (showChannelList) {
      slideAnim.setValue(-TOTAL_W);
      Animated.timing(slideAnim, {
        toValue: 0, duration: SLIDE_DUR, useNativeDriver: true,
      }).start();
    }
  }, [showChannelList]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const openGroups = useCallback(() => {
    if (!showGroupsPlaylists) setShowGroupsPlaylists(true);
  }, [showGroupsPlaylists, setShowGroupsPlaylists]);

  const handleNativeTabSelect = useCallback((tabId: string) => {
    if (tabId === 'all' || tabId === 'fav' || tabId === 'recent') {
      setActiveTab(tabId);
    }
  }, []);

  const handleCatchupSelect = useCallback((channelId: string, startMs: number, endMs: number, programTitle: string) => {
    setShowChannelList(false);
    onCatchupSelect?.(channelId, startMs, endMs, programTitle);
  }, [setShowChannelList, onCatchupSelect]);

  useEffect(() => {
    if (!showChannelList || !KeyEvent) return;
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
  }, [showChannelList, showGroupsPlaylists, openGroups, currentChannelId, handleChannelFocus, onChannelSelect]);

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
  const useNativeList = Platform.OS === 'android' && TV && isNativeChannelListAvailable;
  const useNativeSideGuide = Platform.OS === 'android' && TV && isNativeSideEpgAvailable;

  if (!showChannelList) return null;

  const groupLabel   = selectedGroup && selectedGroup !== 'All Channels' ? selectedGroup : 'All Channels';
  const groupsOffset = showGroupsPlaylists ? GROUPS_PANEL_W : 0;
  const focusedGuideLabel = focusedChannel?.name || 'Focused channel';

  return (
    <>
      <TouchableOpacity
        style={st.backdrop}
        activeOpacity={1}
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
                bgColor={theme.bg}
                onChannelSelect={onChannelSelect}
                onChannelFocus={handleChannelFocus}
                onOpenGroups={openGroups}
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
                  bgColor={theme.bg}
                  onCatchupSelect={handleCatchupSelect}
                  onOpenGroups={openGroups}
                />
              ) : (
                <EpgDetailPanel
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

// ─── Panel styles ─────────────────────────────────────────────────────────────
const createStyles = (theme: Theme) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    zIndex: 15,
    elevation: 15,
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: TOTAL_W,
    backgroundColor: theme.bg,
    borderRightWidth: 1,
    borderRightColor: theme.border,
    zIndex: 20,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerLeft: {
    width: PANEL_W,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: TV ? 10 : 8,
    paddingTop: TV ? 16 : 12,
    paddingBottom: TV ? 8 : 6,
  },
  headerEpg: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: TV ? 12 : 10,
    paddingBottom: TV ? 10 : 8,
    borderLeftWidth: 1,
    borderLeftColor: theme.border,
    backgroundColor: theme.surface,
  },
  headerEpgTxt: {
    color: theme.textMuted,
    fontSize: TV ? 10 : 9,
    fontWeight: '800',
    letterSpacing: 2,
  },
  groupsArrow: {
    width: TV ? 34 : 28,
    height: TV ? 34 : 28,
    borderRadius: 8,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupsArrowTxt: {
    color: theme.textSub,
    fontSize: TV ? 22 : 18,
    fontWeight: '700',
    lineHeight: TV ? 26 : 22,
  },
  headerTitle: {
    color: theme.text,
    fontSize: TV ? 16 : 14,
    fontWeight: '800',
    flex: 1,
    letterSpacing: -0.3,
  },
  headerCount: {
    color: theme.textMuted,
    fontSize: TV ? 12 : 10,
    fontWeight: '700',
  },
  searchArea: {
    width: PANEL_W,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 8,
    marginHorizontal: TV ? 10 : 8,
    marginTop: TV ? 8 : 6,
    marginBottom: TV ? 4 : 3,
    paddingHorizontal: 10,
    gap: 6,
    height: TV ? 36 : 30,
    borderWidth: 1,
    borderColor: theme.border,
  },
  searchIcon: { fontSize: 12 },
  searchInput: {
    flex: 1,
    color: theme.textSub,
    fontSize: TV ? 13 : 11,
    fontWeight: '500',
    paddingVertical: 0,
  },
  clearBtn: { color: theme.textMuted, fontSize: 11, fontWeight: '700', padding: 4 },
  tabsArea: {
    width: PANEL_W,
  },
  tabsRow: {
    flexDirection: 'row',
    marginHorizontal: TV ? 10 : 8,
    marginBottom: TV ? 6 : 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: TV ? 6 : 4,
    borderRadius: 6,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: theme.cardActive,
    borderColor: theme.accent,
  },
  tabTxt: { color: theme.textMuted, fontSize: TV ? 11 : 9, fontWeight: '700' },
  tabTxtActive: { color: theme.accent },
  groupsBtn: {
    paddingVertical: TV ? 6 : 4,
    paddingHorizontal: TV ? 12 : 8,
    borderRadius: 6,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupsBtnTxt: { color: theme.textMuted, fontSize: TV ? 11 : 9, fontWeight: '700' },
  columnHeadings: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: theme.border,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    backgroundColor: theme.surface,
  },
  channelHeading: {
    width: PANEL_W,
    paddingHorizontal: TV ? 12 : 10,
    paddingVertical: TV ? 8 : 6,
  },
  guideHeading: {
    flex: 1,
    paddingHorizontal: TV ? 12 : 10,
    paddingVertical: TV ? 8 : 6,
    borderLeftWidth: 1,
    borderLeftColor: theme.border,
  },
  columnEyebrow: {
    color: theme.textMuted,
    fontSize: TV ? 9 : 8,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  columnTitle: {
    color: theme.textSub,
    fontSize: TV ? 13 : 11,
    fontWeight: '800',
    marginTop: 2,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  channelCol: {
    width: PANEL_W,
    flex: 0,
  },
  epgCol: {
    flex: 1,
    borderLeftWidth: 1,
    borderLeftColor: theme.border,
    backgroundColor: theme.surface,
    overflow: 'hidden',
  },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTxt: {
    color: theme.textMuted,
    fontSize: TV ? 13 : 11,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
  },
});

// ─── EpgDetailPanel styles ────────────────────────────────────────────────────
const createEpgStyles = (theme: Theme) => StyleSheet.create({
  root: {
    flex: 1,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTxt: {
    color: theme.textMuted,
    fontSize: TV ? 11 : 9,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: TV ? 18 : 15,
  },
  chHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: TV ? 12 : 10,
    paddingVertical: TV ? 10 : 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    backgroundColor: theme.surface,
  },
  chName: {
    flex: 1,
    color: theme.textSub,
    fontSize: TV ? 14 : 12,
    fontWeight: '700',
  },
  catchupBadge: {
    backgroundColor: theme.card,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: theme.accent,
  },
  catchupTxt: {
    color: theme.accent,
    fontSize: TV ? 9 : 8,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  noProg: {
    color: theme.textMuted,
    fontSize: TV ? 11 : 9,
    fontWeight: '500',
    padding: 16,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: TV ? 10 : 8,
    paddingVertical: TV ? 8 : 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    minHeight: 72,
    alignItems: 'flex-start',
  },
  rowCurrent: {
    backgroundColor: theme.cardActive,
    borderLeftWidth: 3,
    borderLeftColor: theme.accent,
  },
  rowPastNoCatchup: {
    opacity: 0.35,
  },
  rowLeft: {
    width: TV ? 44 : 38,
    alignItems: 'center',
    gap: 4,
    paddingTop: 2,
  },
  time: {
    color: theme.textMuted,
    fontSize: TV ? 10 : 9,
    fontWeight: '700',
    textAlign: 'center',
  },
  timeCurrent: { color: theme.accent },
  timeGray: { color: theme.textMuted },
  catchupDot: {
    fontSize: TV ? 9 : 8,
    color: theme.accent,
  },
  nowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.accent,
  },
  rowRight: {
    flex: 1,
    gap: 3,
    paddingLeft: TV ? 6 : 4,
  },
  title: {
    color: theme.textSub,
    fontSize: TV ? 13 : 11,
    fontWeight: '600',
    lineHeight: TV ? 17 : 15,
  },
  titleCurrent: { color: theme.text },
  titleGray: { color: theme.textMuted },
  dur: {
    color: theme.textMuted,
    fontSize: TV ? 10 : 9,
    fontWeight: '500',
  },
  durCurrent: { color: theme.textSub },
});
