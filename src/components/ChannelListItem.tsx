import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import FocusableItem from './FocusableItem';
import { Channel } from '../types';

interface ChannelListItemProps {
  channel: Channel;
  onPress: (channel: Channel) => void;
}

const ChannelListItem: React.FC<ChannelListItemProps> = ({ channel, onPress }) => {
  return (
    <FocusableItem onPress={() => onPress(channel)} style={styles.container}>
      <View style={styles.content}>
        {channel.logo ? (
          <Image source={{ uri: channel.logo }} style={styles.logo} resizeMode="contain" />
        ) : (
          <View style={[styles.logo, styles.placeholderLogo]}>
            <Text style={styles.placeholderText}>
              {channel.name.substring(0, 2).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {channel.name}
          </Text>
          {channel.group ? (
            <Text style={styles.group} numberOfLines={1}>
              {channel.group}
            </Text>
          ) : null}
        </View>
      </View>
    </FocusableItem>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#2a2a2a',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 16,
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#000',
  },
  placeholderLogo: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  info: {
    flex: 1,
  },
  name: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  group: {
    color: '#aaa',
    fontSize: 14,
  },
});

export default ChannelListItem;
