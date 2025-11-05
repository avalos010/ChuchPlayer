import React, { useRef, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Platform } from 'react-native';
import FocusableItem from '../FocusableItem';
import ChannelListItem from '../ChannelListItem';
import { Channel } from '../../types';
import { usePlayerStore } from '../../store/usePlayerStore';

interface ChannelListPanelProps {
  onChannelSelect: (channel: Channel) => void;
}

const ChannelListPanel: React.FC<ChannelListPanelProps> = ({
  onChannelSelect,
}) => {
  const showChannelList = usePlayerStore((state) => state.showChannelList);
  const setShowChannelList = usePlayerStore((state) => state.setShowChannelList);
  const setShowGroupsPlaylists = usePlayerStore((state) => state.setShowGroupsPlaylists);
  const channels = usePlayerStore((state) => state.channels);
  const channel = usePlayerStore((state) => state.channel);
  const playlist = usePlayerStore((state) => state.playlist);

  const currentChannelId = channel?.id || '';
  
  const channelListRef = useRef<FlatList>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Mark as loaded when channels are available
  useEffect(() => {
    if (showChannelList && channels.length > 0) {
      setIsLoading(false);
      // Scroll to current channel
      setTimeout(() => {
        const currentIndex = channels.findIndex((c) => c.id === currentChannelId);
        if (currentIndex >= 0 && channelListRef.current) {
          try {
            channelListRef.current.scrollToIndex({
              index: currentIndex,
              animated: false, // No animation for instant feel
              viewPosition: 0.5,
            });
          } catch (e) {
            console.log('ScrollToIndex failed, using fallback');
          }
        }
      }, 50);
    } else if (showChannelList) {
      setIsLoading(true);
    }
  }, [showChannelList, currentChannelId, channels]);

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
              {playlist?.name || 'Channels'}
            </Text>
            <Text className="text-text-muted text-sm mt-1">
              {channels.length} channel{channels.length !== 1 ? 's' : ''}
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
        {isLoading || channels.length === 0 ? (
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
                  No channels available
                </Text>
              </View>
            )}
          </View>
        ) : (
          <FlatList
            ref={channelListRef}
            data={channels}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isCurrentChannel = item.id === currentChannelId;
              return (
                <View 
                  className={isCurrentChannel ? 'mx-2 my-1 rounded-xl border-2 border-accent bg-accent/15' : ''}
                >
                  <ChannelListItem channel={item} onPress={onChannelSelect} />
                </View>
              );
            }}
            contentContainerStyle={{ paddingVertical: 12 }}
            initialNumToRender={20}
            removeClippedSubviews={true}
            onScrollToIndexFailed={(info) => {
              // Fallback if scroll to index fails
              setTimeout(() => {
                if (channelListRef.current) {
                  channelListRef.current.scrollToIndex({
                    index: info.index,
                    animated: false,
                  });
                }
              }, 50);
            }}
          />
        )}
      </View>
    </>
  );
};

export default ChannelListPanel;
