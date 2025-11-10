import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import FocusableItem from '../FocusableItem';
import ChannelListItem from '../ChannelListItem';
import { Channel } from '../../types';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useUIStore } from '../../store/useUIStore';

interface ChannelListPanelProps {
  onChannelSelect: (channel: Channel) => void;
}

const ChannelListPanel: React.FC<ChannelListPanelProps> = ({
  onChannelSelect,
}) => {
  const showGroupsPlaylists = useUIStore((state) => state.showGroupsPlaylists);
  const setShowGroupsPlaylists = useUIStore((state) => state.setShowGroupsPlaylists);
  const selectedGroup = useUIStore((state) => state.selectedGroup);
  
  // UI state
  const showChannelList = useUIStore((state) => state.showChannelList);
  const setShowChannelList = useUIStore((state) => state.setShowChannelList);
  const channels = usePlayerStore((state) => state.channels);
  const channel = usePlayerStore((state) => state.channel);
  const playlist = usePlayerStore((state) => state.playlist);

  const currentChannelId = channel?.id || '';
  
  const channelListRef = useRef<FlashList<Channel>>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [preferredFocusChannelId, setPreferredFocusChannelId] = useState<string | null>(null);

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
      setPreferredFocusChannelId(null);
      return;
    }

    setIsLoading(false);
    const hasCurrent = filteredChannels.some((ch) => ch.id === currentChannelId);
    const defaultId = hasCurrent ? currentChannelId : filteredChannels[0]?.id ?? null;
    setPreferredFocusChannelId((prev) => prev ?? defaultId);
  }, [showChannelList, filteredChannels, currentChannelId]);

  // Handle focus change for navigation
  const handleChannelFocus = useCallback((channelId: string) => {
    if (preferredFocusChannelId) {
      setPreferredFocusChannelId(null);
      return; // Only auto-center on initial focus
    }
  }, [preferredFocusChannelId]);

  const initialScrollIndex = useMemo(() => {
    if (!showChannelList) return undefined;
    const idx = filteredChannels.findIndex(c => c.id === currentChannelId);
    return idx >= 0 ? idx : undefined;
  }, [showChannelList, filteredChannels, currentChannelId]);

  const renderChannelItem = useCallback(
    ({ item }: { item: Channel }) => {
      const isCurrentChannel = item.id === currentChannelId;
      const hasTVPreferredFocus = preferredFocusChannelId === item.id;
 
      return (
        <View className="mx-2 my-1 rounded-xl">
          <ChannelListItem
            channel={item}
            onPress={onChannelSelect}
            onFocus={handleChannelFocus}
            hasTVPreferredFocus={hasTVPreferredFocus}
            isCurrentChannel={isCurrentChannel}
          />
        </View>
      );
    },
    [currentChannelId, preferredFocusChannelId, onChannelSelect, handleChannelFocus]
  );

  const keyExtractor = useCallback((item: Channel) => item.id, []);

  // Don't render anything when hidden to avoid blocking video
  if (!showChannelList) {
    return null;
  }

  // Skeleton loader component
  const SkeletonItem = () => (
    <View className="mx-4 my-2 p-4 rounded-xl bg-subtle border border-border">
      <View className="flex-row items-center gap-3">
        <View className="w-16 h-16 rounded-lg bg-dark" />
        <View className="flex-1">
          <View className="h-5 bg-dark rounded mb-2" style={{ width: '70%' }} />
          <View className="h-4 bg-dark rounded" style={{ width: '40%' }} />
        </View>
      </View>
    </View>
  );

  return (
    <>
      {/* Dark overlay - TiviMate Style */}
      <TouchableOpacity
        className="absolute inset-0 bg-darker/85 z-[15]"
        style={{ 
          elevation: 15,
          zIndex: 15,
        }}
        activeOpacity={1}
        onPress={() => setShowChannelList(false)}
      />

      {/* Panel - TiviMate Style */}
      <View
        className="absolute top-0 left-0 bottom-0 w-[420px] border-r border-border bg-card shadow-xl z-[20]"
        style={{
          elevation: 20,
          zIndex: 20,
          backgroundColor: '#161b22',
        }}
      >
        {/* Header - TiviMate Style */}
        <View className="flex-row justify-between items-center px-6 py-5 border-b border-border bg-dark">
          <View>
            <Text className="text-text-primary text-[24px] font-bold tracking-tight">
              {selectedGroup && selectedGroup !== 'All Channels' ? selectedGroup : 'All Channels'}
            </Text>
            <Text className="text-text-muted text-sm mt-1">
              {filteredChannels.length} channel{filteredChannels.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <View className="flex-row gap-2">
            <FocusableItem 
              onPress={() => {
                setShowChannelList(false);
                setShowGroupsPlaylists(true);
              }} 
              className="w-11 h-11 rounded-full bg-subtle border border-border justify-center items-center"
            >
              <Text className="text-text-secondary text-base font-bold">
                ☰
              </Text>
            </FocusableItem>
            <FocusableItem 
              onPress={() => setShowChannelList(false)} 
              className="w-11 h-11 rounded-full bg-subtle border border-border justify-center items-center"
            >
              <Text className="text-text-secondary text-lg font-bold">
                ✕
              </Text>
            </FocusableItem>
          </View>
        </View>

        {/* Channel List */}
        {isLoading || filteredChannels.length === 0 ? (
          <View className="flex-1 p-2">
            {isLoading ? (
              // Show skeleton loaders while loading
              <>
                {Array.from({ length: 8 }).map((_, i) => (
                  <SkeletonItem key={i} />
                ))}
              </>
            ) : (
              <View className="flex-1 justify-center items-center p-5">
                <Text className="text-text-muted text-base">
                  {selectedGroup && selectedGroup !== 'All Channels'
                    ? `No channels under ${selectedGroup}`
                    : 'No channels available'}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            {!showGroupsPlaylists && (
              <FocusableItem
                onFocus={() => {
                  if (showChannelList && !showGroupsPlaylists) {
                    setShowGroupsPlaylists(true);
                  }
                }}
                onPress={() => {
                  if (!showGroupsPlaylists) {
                    setShowGroupsPlaylists(true);
                  }
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: -20,
                  width: 20,
                  backgroundColor: 'transparent',
                  zIndex: 1,
                }}
                focusedStyle={{ backgroundColor: 'transparent' }}
              >
                <View className="flex-1" />
              </FocusableItem>
            )}
            <FlashList
              ref={channelListRef}
              data={filteredChannels}
              keyExtractor={keyExtractor}
              renderItem={renderChannelItem}
              initialScrollIndex={initialScrollIndex}
              estimatedItemSize={120}
              contentContainerStyle={{ paddingVertical: 12 }}
              keyboardShouldPersistTaps="handled"
              onScrollToIndexFailed={(info) => {
                setTimeout(() => {
                  channelListRef.current?.scrollToIndex({
                    index: info.index,
                    animated: false,
                  });
                }, 50);
              }}
            />
          </View>
        )}
      </View>
    </>
  );
};

export default ChannelListPanel;
