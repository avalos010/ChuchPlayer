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
import { Channel, EPGProgram } from '../../types';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useUIStore } from '../../store/useUIStore';
import { useFavorites } from '../../hooks/useFavorites';
import { useRecentChannels } from '../../hooks/useRecentChannels';
import { isTvLikePlatform } from '../../utils/platform';
import { formatClockTime } from '../../utils/time';

interface ChannelListPanelProps {
  onChannelSelect: (channel: Channel) => void;
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
const SLIDE_DUR = 220;

const TABS: { id: TabId; label: string }[] = [
  { id: 'all',    label: 'All' },
  { id: 'fav',    label: '★ Fav' },
  { id: 'recent', label: '🕒 Recent' },
];

const TAB_FOCUSED     = { backgroundColor: 'rgba(30,41,59,0.9)', borderColor: '#334155', borderWidth: 1.5, transform: [] as any[], elevation: 3 };
const TAB_ACT_FOCUSED = { backgroundColor: 'rgba(2,132,199,0.9)', borderColor: '#0ea5e9', borderWidth: 1.5, transform: [] as any[], elevation: 4 };
const GRP_FOCUSED     = { backgroundColor: 'rgba(30,41,59,0.9)', borderColor: '#334155', borderWidth: 1.5, transform: [] as any[], elevation: 3 };

// ─── Focused-channel EPG panel ────────────────────────────────────────────────
interface EpgDetailPanelProps {
  channel: Channel | null;
  programs: EPGProgram[];
  now: number;
  clockFormat: '12h' | '24h';
}

const EPG_ROW_H = TV ? 72 : 60;

const ROW_FOCUSED = {
  backgroundColor: 'rgba(14,165,233,0.15)',
  borderColor: 'rgba(14,165,233,0.5)',
  borderWidth: 1,
  transform: [] as any[],
  elevation: 4,
};

const EpgDetailPanelInner = React.forwardRef<ScrollView, EpgDetailPanelProps>(
  ({ channel, programs, now, clockFormat }, ref) => {
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
                  onPress={() => {/* catchup play handled by parent */}}
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
  prev.channel?.id === next.channel?.id &&
  prev.programs    === next.programs    &&
  prev.clockFormat === next.clockFormat &&
  Math.abs(prev.now - next.now) < 60_000,
);

// ─── Main component ──────────────────────────────────────────────────────────
const ChannelListPanel: React.FC<ChannelListPanelProps> = ({
  onChannelSelect,
  getCurrentProgram,
  getProgramsForChannel,
  epgLastUpdated,
  showChannelNumbers = false,
  clockFormat = '24h',
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
  const listRef   = useRef<FlashList<Channel>>(null);
  const slideAnim = useRef(new Animated.Value(-TOTAL_W)).current;

  // Focus tracking — refs only, no state changes on D-pad nav (prevents FlashList re-renders)
  const focusTargetIdRef = useRef<string | null>(null);
  const focusGivenRef    = useRef(false);
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
      return;
    }
    focusTargetIdRef.current = currentChannelId || null;
    focusGivenRef.current = false;
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

  const initialScrollIndex = useMemo(() => {
    if (!showChannelList) return undefined;
    const idx = filteredChannels.findIndex((c) => c.id === currentChannelId);
    return idx > 0 ? idx : undefined;
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
    setFocusedChannelId(channelId);
  }, [setFocusedChannelId]);

  const openGroups = useCallback(() => {
    if (!showGroupsPlaylists) setShowGroupsPlaylists(true);
  }, [showGroupsPlaylists, setShowGroupsPlaylists]);

  useEffect(() => {
    if (!showChannelList || !KeyEvent) return;
    KeyEvent.onKeyDownListener((e: { keyCode: number }) => {
      if (e.keyCode === 21) openGroups(); // DPAD_LEFT → open groups
    });
    return () => KeyEvent.removeKeyDownListener();
  }, [showChannelList, openGroups]);

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
  const groupsOffset = showGroupsPlaylists ? (TV ? 260 : 220) : 0;

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
              placeholderTextColor="#475569"
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
                <Text style={st.groupsBtnTxt}>≡ Groups</Text>
              </FocusableItem>
            )}
          </View>
        </View>

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
              />
            )}
          </View>

          {/* Focused-channel EPG panel */}
          {getProgramsForChannel && (
            <View style={st.epgCol}>
              <EpgDetailPanel
                channel={focusedChannel}
                programs={focusedPrograms}
                now={nowMs}
                clockFormat={clockFormat}
              />
            </View>
          )}
        </View>
      </Animated.View>
    </>
  );
};

export default ChannelListPanel;

// ─── Panel styles ─────────────────────────────────────────────────────────────
const st = StyleSheet.create({
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
    backgroundColor: 'rgba(8,12,20,0.93)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(30,41,59,0.7)',
    zIndex: 20,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,41,59,0.8)',
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
    borderLeftColor: 'rgba(30,41,59,0.6)',
    backgroundColor: 'rgba(6,10,16,0.5)',
  },
  headerEpgTxt: {
    color: '#334155',
    fontSize: TV ? 10 : 9,
    fontWeight: '800',
    letterSpacing: 2,
  },
  groupsArrow: {
    width: TV ? 34 : 28,
    height: TV ? 34 : 28,
    borderRadius: 8,
    backgroundColor: 'rgba(13,17,23,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(30,41,59,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupsArrowTxt: {
    color: '#64748b',
    fontSize: TV ? 22 : 18,
    fontWeight: '700',
    lineHeight: TV ? 26 : 22,
  },
  headerTitle: {
    color: '#e2e8f0',
    fontSize: TV ? 16 : 14,
    fontWeight: '800',
    flex: 1,
    letterSpacing: -0.3,
  },
  headerCount: {
    color: '#475569',
    fontSize: TV ? 12 : 10,
    fontWeight: '700',
  },
  searchArea: {
    width: PANEL_W,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13,17,23,0.8)',
    borderRadius: 8,
    marginHorizontal: TV ? 10 : 8,
    marginTop: TV ? 8 : 6,
    marginBottom: TV ? 4 : 3,
    paddingHorizontal: 10,
    gap: 6,
    height: TV ? 36 : 30,
    borderWidth: 1,
    borderColor: 'rgba(30,41,59,0.9)',
  },
  searchIcon: { fontSize: 12 },
  searchInput: {
    flex: 1,
    color: '#94a3b8',
    fontSize: TV ? 13 : 11,
    fontWeight: '500',
    paddingVertical: 0,
  },
  clearBtn: { color: '#475569', fontSize: 11, fontWeight: '700', padding: 4 },
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
    backgroundColor: 'rgba(13,17,23,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(30,41,59,0.9)',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: 'rgba(12,34,64,0.95)',
    borderColor: '#0ea5e9',
  },
  tabTxt: { color: '#475569', fontSize: TV ? 11 : 9, fontWeight: '700' },
  tabTxtActive: { color: '#38bdf8' },
  groupsBtn: {
    paddingVertical: TV ? 6 : 4,
    paddingHorizontal: TV ? 8 : 6,
    borderRadius: 6,
    backgroundColor: 'rgba(13,17,23,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(30,41,59,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupsBtnTxt: { color: '#475569', fontSize: TV ? 11 : 9, fontWeight: '700' },
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
    borderLeftColor: 'rgba(30,41,59,0.6)',
    backgroundColor: 'rgba(6,10,16,0.5)',
    overflow: 'hidden',
  },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTxt: {
    color: '#475569',
    fontSize: TV ? 13 : 11,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
  },
});

// ─── EpgDetailPanel styles ────────────────────────────────────────────────────
const ep = StyleSheet.create({
  root: {
    flex: 1,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTxt: {
    color: '#1e293b',
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
    borderBottomColor: 'rgba(30,41,59,0.6)',
    backgroundColor: 'rgba(6,10,16,0.4)',
  },
  chName: {
    flex: 1,
    color: '#94a3b8',
    fontSize: TV ? 14 : 12,
    fontWeight: '700',
  },
  catchupBadge: {
    backgroundColor: 'rgba(14,116,144,0.3)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.3)',
  },
  catchupTxt: {
    color: '#38bdf8',
    fontSize: TV ? 9 : 8,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  noProg: {
    color: '#1e293b',
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
    borderBottomColor: 'rgba(15,23,42,0.6)',
    minHeight: 72,
    alignItems: 'flex-start',
  },
  rowCurrent: {
    backgroundColor: 'rgba(14,165,233,0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#0ea5e9',
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
    color: '#475569',
    fontSize: TV ? 10 : 9,
    fontWeight: '700',
    textAlign: 'center',
  },
  timeCurrent: { color: '#0ea5e9' },
  timeGray: { color: '#1e293b' },
  catchupDot: {
    fontSize: TV ? 9 : 8,
    color: '#38bdf8',
  },
  nowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0ea5e9',
  },
  rowRight: {
    flex: 1,
    gap: 3,
    paddingLeft: TV ? 6 : 4,
  },
  title: {
    color: '#64748b',
    fontSize: TV ? 13 : 11,
    fontWeight: '600',
    lineHeight: TV ? 17 : 15,
  },
  titleCurrent: { color: '#e2e8f0' },
  titleGray: { color: '#1e293b' },
  dur: {
    color: '#1e293b',
    fontSize: TV ? 10 : 9,
    fontWeight: '500',
  },
  durCurrent: { color: '#475569' },
});
