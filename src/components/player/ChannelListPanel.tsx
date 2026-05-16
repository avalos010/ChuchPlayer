import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import FocusableItem from '../FocusableItem';
import ChannelListItem from '../ChannelListItem';
import { Channel } from '../../types';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useUIStore } from '../../store/useUIStore';

interface ChannelListPanelProps {
  onChannelSelect: (channel: Channel) => void;
}

const TV = Platform.OS === 'android';

const BTN_FOCUSED = {
  backgroundColor: '#ffffff',
  borderColor: '#ffffff',
  borderWidth: 2,
  transform: [] as any[],
  elevation: 6,
};

const ChannelListPanel: React.FC<ChannelListPanelProps> = ({ onChannelSelect }) => {
  const showGroupsPlaylists    = useUIStore((s) => s.showGroupsPlaylists);
  const setShowGroupsPlaylists = useUIStore((s) => s.setShowGroupsPlaylists);
  const selectedGroup          = useUIStore((s) => s.selectedGroup);
  const showChannelList        = useUIStore((s) => s.showChannelList);
  const setShowChannelList     = useUIStore((s) => s.setShowChannelList);
  const channels               = usePlayerStore((s) => s.channels);
  const channel                = usePlayerStore((s) => s.channel);
  const playlist               = usePlayerStore((s) => s.playlist);

  const currentChannelId = channel?.id ?? '';
  const listRef = useRef<FlashList<Channel>>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [preferredFocusId, setPreferredFocusId] = useState<string | null>(null);
  const preferredFocusIdRef = useRef(preferredFocusId);

  // Keep ref in sync with state so renderChannelItem can read it without taking it as a dependency
  useEffect(() => {
    preferredFocusIdRef.current = preferredFocusId;
  }, [preferredFocusId]);

  const filteredChannels = useMemo(() => {
    let base: Channel[];
    if (selectedGroup && selectedGroup !== 'All Channels') {
      base = channels.filter((ch) => ch.group === selectedGroup);
    } else {
      base = channels;
    }
    if (channel && !base.some((ch) => ch.id === channel.id)) {
      return [channel, ...base];
    }
    return base;
  }, [channels, selectedGroup, channel]);

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

  const handleChannelFocus = useCallback((channelId: string) => {
    if (preferredFocusId) setPreferredFocusId(null);
  }, [preferredFocusId]);

  const initialScrollIndex = useMemo(() => {
    if (!showChannelList) return undefined;
    const idx = filteredChannels.findIndex((c) => c.id === currentChannelId);
    return idx >= 0 ? idx : undefined;
  }, [showChannelList, filteredChannels, currentChannelId]);

  const renderChannelItem = useCallback(
    ({ item }: { item: Channel }) => (
      <ChannelListItem
        channel={item}
        onPress={onChannelSelect}
        onFocus={handleChannelFocus}
        hasTVPreferredFocus={preferredFocusIdRef.current === item.id}
        isCurrentChannel={item.id === currentChannelId}
      />
    ),
    [currentChannelId, onChannelSelect, handleChannelFocus],
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
            <Text style={s.headerTitle} numberOfLines={1}>{groupLabel}</Text>
            <Text style={s.headerSub}>
              {filteredChannels.length} channel{filteredChannels.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={s.headerBtns}>
            <FocusableItem
              onPress={() => { setShowChannelList(false); setShowGroupsPlaylists(true); }}
              style={s.hBtn}
              focusedStyle={BTN_FOCUSED}
            >
              <Text style={s.hBtnIcon}>☰</Text>
            </FocusableItem>
            <FocusableItem
              onPress={() => setShowChannelList(false)}
              style={s.hBtn}
              focusedStyle={BTN_FOCUSED}
            >
              <Text style={s.hBtnIcon}>✕</Text>
            </FocusableItem>
          </View>
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
              {selectedGroup && selectedGroup !== 'All Channels'
                ? `No channels in "${selectedGroup}"`
                : 'No channels available'}
            </Text>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            {/* Hidden left-edge zone to trigger groups panel */}
            {!showGroupsPlaylists && (
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
  emptyTxt: { color: '#333333', fontSize: TV ? 15 : 13, fontWeight: '500', textAlign: 'center' },

  leftEdgeZone: {
    position: 'absolute',
    top: 0, bottom: 0, left: -20, width: 20,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
});
