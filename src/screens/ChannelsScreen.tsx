import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList, Channel, Playlist } from '../types';
import { getPlaylists } from '../utils/storage';
import { groupChannelsByCategory } from '../utils/m3uParser';
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
      setPlaylist(found);
    } catch (error) {
      console.error('Error loading playlist:', error);
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
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#00aaff" />
      </View>
    );
  }

  if (!playlist) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Playlist not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search channels..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.categoriesContainer}>
        <FlatList
          horizontal
          data={categories}
          keyExtractor={item => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
          renderItem={({ item }) => (
            <FocusableItem
              onPress={() => setSelectedCategory(item)}
              style={[
                styles.categoryButton,
                selectedCategory === item && styles.categoryButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === item && styles.categoryTextActive,
                ]}
              >
                {item}
              </Text>
            </FocusableItem>
          )}
        />
      </View>

      {filteredChannels.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No channels found</Text>
        </View>
      ) : (
        <>
          <View style={styles.infoBar}>
            <Text style={styles.infoText}>
              {filteredChannels.length} channel{filteredChannels.length === 1 ? '' : 's'}
            </Text>
          </View>
          <FlatList
            data={filteredChannels}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <ChannelListItem channel={item} onPress={handleChannelPress} />
            )}
            contentContainerStyle={styles.listContent}
          />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
  },
  searchContainer: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2a2a2a',
  },
  searchInput: {
    backgroundColor: '#2a2a2a',
    color: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  categoriesContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2a2a2a',
  },
  categoriesList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  categoryButton: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  categoryButtonActive: {
    backgroundColor: '#00aaff',
  },
  categoryText: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: '#fff',
  },
  infoBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#0a0a0a',
  },
  infoText: {
    color: '#aaa',
    fontSize: 12,
  },
  listContent: {
    paddingVertical: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#aaa',
    fontSize: 18,
  },
});

export default ChannelsScreen;
