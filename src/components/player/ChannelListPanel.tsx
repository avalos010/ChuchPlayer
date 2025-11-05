import React, { useRef, useEffect } from 'react';
import { View, Text, FlatList, Animated, TouchableOpacity, Platform } from 'react-native';
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
  const channels = usePlayerStore((state) => state.channels);
  const channel = usePlayerStore((state) => state.channel);
  const playlist = usePlayerStore((state) => state.playlist);

  const currentChannelId = channel?.id || '';
  
  const slideAnim = useRef(new Animated.Value(-420)).current;
  const channelListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (showChannelList) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
      // Scroll to current channel after animation
      setTimeout(() => {
        const currentIndex = channels.findIndex((c) => c.id === currentChannelId);
        if (currentIndex >= 0 && channelListRef.current) {
          channelListRef.current.scrollToIndex({
            index: currentIndex,
            animated: true,
            viewPosition: 0.5,
          });
        }
      }, 350);
    } else {
      Animated.timing(slideAnim, {
        toValue: -420,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }
  }, [showChannelList, slideAnim, channels, currentChannelId]);

  return (
    <>
      {/* Dark overlay */}
      {showChannelList && (
        <TouchableOpacity
          className="absolute inset-0 bg-black/70"
          style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            zIndex: 15,
            elevation: 15,
          }}
          activeOpacity={1}
          onPress={() => setShowChannelList(false)}
        />
      )}

      {/* Panel */}
      <Animated.View
        className="absolute top-0 left-0 bottom-0 w-[420px] bg-[#0f0f0f] border-r-2 border-accent"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: 420,
          backgroundColor: '#0f0f0f',
          zIndex: 20,
          transform: [{ translateX: slideAnim }],
          elevation: 20,
          shadowColor: '#000',
          shadowOffset: { width: 4, height: 0 },
          shadowOpacity: 0.5,
          shadowRadius: 8,
        }}
      >
        <View className="flex-row justify-between items-center p-5 bg-dark border-b-2 border-accent">
          <Text className="text-white text-[22px] font-bold tracking-wide">
            {playlist?.name || 'Channels'}
          </Text>
          <FocusableItem 
            onPress={() => setShowChannelList(false)} 
            className="w-10 h-10 rounded-full bg-card justify-center items-center border border-subtle"
          >
            <Text className="text-white text-lg font-bold">✕</Text>
          </FocusableItem>
        </View>
        <FlatList
          ref={channelListRef}
          data={channels}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isCurrentChannel = item.id === currentChannelId;
            return (
              <View 
                className={isCurrentChannel ? 'bg-accent/20 rounded-lg mb-2 border-2 border-accent' : ''}
              >
                <ChannelListItem channel={item} onPress={onChannelSelect} />
              </View>
            );
          }}
          contentContainerStyle={{ padding: 16 }}
          initialNumToRender={20}
          removeClippedSubviews={true}
          onScrollToIndexFailed={(info) => {
            // Fallback if scroll to index fails
            setTimeout(() => {
              if (channelListRef.current) {
                channelListRef.current.scrollToIndex({
                  index: info.index,
                  animated: true,
                });
              }
            }, 100);
          }}
        />
      </Animated.View>
    </>
  );
};

export default ChannelListPanel;
