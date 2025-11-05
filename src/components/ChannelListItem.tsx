import React, { useState } from 'react';
import { View, Text, Image } from 'react-native';
import FocusableItem from './FocusableItem';
import { Channel } from '../types';

interface ChannelListItemProps {
  channel: Channel;
  onPress: (channel: Channel) => void;
}

const ChannelListItem: React.FC<ChannelListItemProps> = ({ channel, onPress }) => {
  const [imageError, setImageError] = useState(false);

  return (
    <FocusableItem 
      onPress={() => onPress(channel)} 
      className="bg-card mx-4 my-2 rounded-lg"
    >
      <View className="flex-row items-center p-3 gap-4">
        {channel.logo && !imageError ? (
          <Image 
            source={{ uri: channel.logo }} 
            className="w-[60px] h-[60px] rounded-lg bg-black" 
            resizeMode="contain"
            onError={() => setImageError(true)}
          />
        ) : (
          <View className="w-[60px] h-[60px] rounded-lg bg-subtle justify-center items-center">
            <Text className="text-white text-lg font-bold">
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
