import React, { useState } from 'react';
import { View, Text, Image } from 'react-native';
import FocusableItem from './FocusableItem';
import { Channel } from '../types';

interface ChannelListItemProps {
  channel: Channel;
  onPress: (channel: Channel) => void;
  onFocus?: (channelId: string) => void;
  isFocused?: boolean;
  hasTVPreferredFocus?: boolean;
}

const ChannelListItem: React.FC<ChannelListItemProps> = ({ 
  channel, 
  onPress, 
  onFocus,
  isFocused = false,
  hasTVPreferredFocus = false,
}) => {
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
          <View className="w-[70px] h-[70px] rounded-xl bg-subtle border border-border justify-center items-center">
            <Text className="text-text-primary text-xl font-bold tracking-wide">
              {channel.name.substring(0, 2).toUpperCase()}
            </Text>
          </View>
        )}

        <View className="flex-1">
          <Text className="text-text-primary text-lg font-semibold mb-1" numberOfLines={1}>
            {channel.name}
          </Text>
          {channel.group ? (
            <Text className="text-text-muted text-sm" numberOfLines={1}>
              {channel.group}
            </Text>
          ) : null}
        </View>
      </View>
    </FocusableItem>
  );
};

export default ChannelListItem;
