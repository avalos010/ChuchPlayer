import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList, Channel, Playlist } from '../types';
import { getPlaylists } from '../utils/storage';
import { groupChannelsByCategory } from '../utils/m3uParser';
import { showError } from '../utils/toast';
import ChannelListItem from '../components/ChannelListItem';
import FocusableItem from '../components/FocusableItem';

interface ChannelsScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Channels'>;
  route: RouteProp<RootStackParamList, 'Channels'>;
}

const ChannelsScreen: React.FC<ChannelsScreenProps> = ({ navigation, route }) => {
  const { playlistId } = route.params;
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const loadPlaylist = useCallback(async () => {
    setLoading(true);
    try {
      const playlists = await getPlaylists();
      const found = playlists.find(p => p.id === playlistId) ?? null;
      if (!found) {
        showError('Playlist not found. It may have been deleted.');
      }
      setPlaylist(found);
    } catch (error) {
      console.error('Error loading playlist:', error);
      showError('Failed to load playlist. Please try again.', String(error));
    } finally {
      setLoading(false);
    }
  }, [playlistId]);

  useEffect(() => {
    loadPlaylist();
  }, [loadPlaylist]);

  const categories = useMemo(() => {
    if (!playlist) {
      return [];
    }
    const grouped = groupChannelsByCategory(playlist.channels);
    return ['All', ...Array.from(grouped.keys())];
  }, [playlist]);

  const filteredChannels = useMemo(() => {
    if (!playlist) {
      return [];
    }

    let channels: Channel[] = [...playlist.channels];

    if (selectedCategory !== 'All') {
      channels = channels.filter(channel => channel.group === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      channels = channels.filter(channel => channel.name.toLowerCase().includes(query));
    }

    return channels;
  }, [playlist, selectedCategory, searchQuery]);

  const handleChannelPress = (channel: Channel) => {
    navigation.navigate('Player', { channel });
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-dark">
        <ActivityIndicator size="large" color="#00aaff" />
      </View>
    );
  }

  if (!playlist) {
    return (
      <View className="flex-1 justify-center items-center bg-dark">
        <Text className="text-white text-lg">Playlist not found</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-dark">
      <View className="p-4 border-b border-card">
        <TextInput
          className="bg-card text-white rounded-lg p-3 text-base"
          placeholder="Search channels..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View className="border-b border-card">
        <FlatList
          horizontal
          data={categories}
          keyExtractor={item => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}
          renderItem={({ item }) => (
            <FocusableItem
              onPress={() => setSelectedCategory(item)}
              className={`px-5 py-2.5 rounded-full ${selectedCategory === item ? 'bg-accent' : 'bg-card'}`}
            >
              <Text
                className={`text-sm font-semibold ${selectedCategory === item ? 'text-white' : 'text-text-muted'}`}
              >
                {item}
              </Text>
            </FocusableItem>
          )}
        />
      </View>

      {filteredChannels.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-text-muted text-lg">No channels found</Text>
        </View>
      ) : (
        <>
          <View className="px-4 py-2 bg-[#0a0a0a]">
            <Text className="text-text-muted text-xs">
              {filteredChannels.length} channel{filteredChannels.length === 1 ? '' : 's'}
            </Text>
          </View>
          <FlatList
            data={filteredChannels}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <ChannelListItem channel={item} onPress={handleChannelPress} />
            )}
            contentContainerStyle={{ paddingVertical: 8 }}
          />
        </>
      )}
    </View>
  );
};

export default ChannelsScreen;
