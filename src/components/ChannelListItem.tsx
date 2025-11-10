import React, { useState, forwardRef } from 'react';
import { View, Text, Image } from 'react-native';
import FocusableItem from './FocusableItem';
import { Channel } from '../types';

interface ChannelListItemProps {
  channel: Channel;
  onPress: (channel: Channel) => void;
  onFocus?: (channelId: string) => void;
  hasTVPreferredFocus?: boolean;
  isCurrentChannel?: boolean;
}

const ChannelListItem = forwardRef<any, ChannelListItemProps>(({ 
  channel, 
  onPress, 
  onFocus,
  hasTVPreferredFocus = false,
  isCurrentChannel = false,
}, ref) => {
  const [imageError, setImageError] = useState(false);

  const handlePress = () => {
    console.log('ChannelListItem pressed:', channel.name, channel.url);
    onPress(channel);
  };

  const handleFocus = () => {
    onFocus?.(channel.id);
  };

  return (
    <FocusableItem 
      ref={ref}
      onPress={handlePress}
      onFocus={handleFocus}
      hasTVPreferredFocus={hasTVPreferredFocus}
      className="bg-card rounded-xl border border-border"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
        borderWidth: isCurrentChannel ? 2 : undefined,
        borderColor: isCurrentChannel ? '#00aaff' : undefined,
        backgroundColor: isCurrentChannel ? 'rgba(0, 170, 255, 0.12)' : undefined,
      }}
      focusedStyle={{
        backgroundColor: 'rgba(0, 170, 255, 0.15)',
        borderColor: '#00aaff',
        borderWidth: 2,
      }}
    >
      <View className="flex-row items-center p-4 gap-4">
        {channel.logo && !imageError ? (
          <Image 
            source={{ uri: channel.logo }} 
            className="w-[70px] h-[70px] rounded-xl bg-subtle border border-border" 
            resizeMode="contain"
            onError={() => setImageError(true)}
          />
        ) : (
          <View className={`w-[70px] h-[70px] rounded-xl border border-border justify-center items-center ${isCurrentChannel ? 'bg-accent/30' : 'bg-subtle'}`}>
            <Text className={`text-xl font-bold tracking-wide ${isCurrentChannel ? 'text-white' : 'text-text-primary'}`}>
              {channel.name.substring(0, 2).toUpperCase()}
            </Text>
          </View>
        )}

        <View className="flex-1">
          <Text className={`text-lg font-semibold mb-1 ${isCurrentChannel ? 'text-white' : 'text-text-primary'}`} numberOfLines={1}>
            {channel.name}
          </Text>
          {channel.group ? (
            <Text className={`${isCurrentChannel ? 'text-white/70' : 'text-text-muted'} text-sm`} numberOfLines={1}>
              {channel.group}
            </Text>
          ) : null}
        </View>

        {isCurrentChannel && (
          <View className="px-3 py-1 rounded-full bg-accent/60 border border-accent">
            <Text className="text-white text-xs font-bold">LIVE</Text>
          </View>
        )}
      </View>
    </FocusableItem>
  );
});

ChannelListItem.displayName = 'ChannelListItem';

export default ChannelListItem;

