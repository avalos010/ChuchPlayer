import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList, Playlist, PlaylistSourceType } from '../types';
import { fetchM3UPlaylist } from '../utils/m3uParser';
import { fetchXtreamPlaylist } from '../utils/xtreamParser';
import { deletePlaylist, getPlaylists, savePlaylist } from '../utils/storage';
import { showError, showSuccess } from '../utils/toast';
import FocusableItem from '../components/FocusableItem';

interface HomeScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [sourceType, setSourceType] = useState<PlaylistSourceType>('m3u');
  const [newPlaylistUrl, setNewPlaylistUrl] = useState('');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [xtreamServerUrl, setXtreamServerUrl] = useState('');
  const [xtreamUsername, setXtreamUsername] = useState('');
  const [xtreamPassword, setXtreamPassword] = useState('');
  const [addingPlaylist, setAddingPlaylist] = useState(false);

  const loadPlaylists = useCallback(async () => {
    setLoading(true);
    try {
      const savedPlaylists = await getPlaylists();
      setPlaylists(savedPlaylists);
    } catch (error) {
      console.error('Error loading playlists:', error);
      showError('Failed to load playlists. Please try again.', String(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  useFocusEffect(
    useCallback(() => {
      loadPlaylists();
    }, [loadPlaylists])
  );

  const handleAddPlaylist = async () => {
    if (!newPlaylistName.trim()) {
      showError('Please enter a playlist name.');
      return;
    }

    if (sourceType === 'm3u') {
      if (!newPlaylistUrl.trim()) {
        showError('Please enter an M3U playlist URL.');
        return;
      }
    } else {
      if (!xtreamServerUrl.trim() || !xtreamUsername.trim() || !xtreamPassword.trim()) {
        showError('Please enter all Xtream Codes credentials.');
        return;
      }
    }

    setAddingPlaylist(true);

    try {
      let channels;
      let playlistUrl: string;
      let xtreamCredentials;

      if (sourceType === 'm3u') {
        channels = await fetchM3UPlaylist(newPlaylistUrl.trim());
        playlistUrl = newPlaylistUrl.trim();
      } else {
        const credentials = {
          serverUrl: xtreamServerUrl.trim(),
          username: xtreamUsername.trim(),
          password: xtreamPassword.trim(),
        };
        channels = await fetchXtreamPlaylist(credentials);
        playlistUrl = `${credentials.serverUrl}/player_api.php`;
        xtreamCredentials = credentials;
      }

      if (channels.length === 0) {
        showError('No channels were found in this playlist.');
        return;
      }

      const now = new Date();
      const playlist: Playlist = {
        id: Date.now().toString(),
        name: newPlaylistName.trim(),
        url: playlistUrl,
        sourceType,
        channels,
        createdAt: now,
        updatedAt: now,
        xtreamCredentials,
      };

      await savePlaylist(playlist);
      setPlaylists(prev => [...prev, playlist]);
      setModalVisible(false);
      setNewPlaylistName('');
      setNewPlaylistUrl('');
      setXtreamServerUrl('');
      setXtreamUsername('');
      setXtreamPassword('');
      setSourceType('m3u');

      showSuccess(`Added ${channels.length} channels from ${playlist.name}.`);
    } catch (error) {
      console.error('Error adding playlist:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorPrefix = sourceType === 'm3u' 
        ? 'Failed to load the playlist. Please check the URL and try again.'
        : 'Failed to load the playlist. Please check your credentials and try again.';
      showError(errorPrefix, errorMessage);
    } finally {
      setAddingPlaylist(false);
    }
  };

  const confirmDeletePlaylist = (playlist: Playlist) => {
    Alert.alert(
      'Delete Playlist',
      `Are you sure you want to delete "${playlist.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePlaylist(playlist.id);
              setPlaylists(prev => prev.filter(item => item.id !== playlist.id));
              showSuccess(`Deleted ${playlist.name}`);
            } catch (error) {
              console.error('Error deleting playlist:', error);
              showError('Failed to delete the playlist.', String(error));
            }
          },
        },
      ]
    );
  };

  const renderPlaylistItem = ({ item }: { item: Playlist }) => (
    <FocusableItem
      onPress={() => navigation.navigate('Channels', { playlistId: item.id })}
      className="bg-card mb-3 rounded-lg"
    >
      <View className="flex-row justify-between items-center p-5 gap-4">
        <View className="flex-1">
          <Text className="text-white text-xl font-semibold mb-1">{item.name}</Text>
          <Text className="text-text-muted text-sm">{item.channels.length} channels</Text>
        </View>
        <FocusableItem
          onPress={() => confirmDeletePlaylist(item)}
          className="bg-[#d32f2f] px-4 py-2.5 rounded-lg min-w-[90px] items-center"
        >
          <Text className="text-white font-semibold">Delete</Text>
        </FocusableItem>
      </View>
    </FocusableItem>
  );

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-dark">
        <ActivityIndicator size="large" color="#00aaff" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-dark">
      <View className="flex-row justify-between items-center p-5 border-b border-card">
        <Text className="text-white text-[28px] font-bold">My Playlists</Text>
        <FocusableItem
          onPress={() => navigation.navigate('Settings')}
          className="bg-card p-3 rounded-lg"
        >
          <Text className="text-white text-base font-semibold">⚙️ Settings</Text>
        </FocusableItem>
      </View>

      {playlists.length === 0 ? (
        <View className="flex-1 justify-center items-center p-10">
          <Text className="text-white text-2xl font-semibold mb-2">No playlists yet</Text>
          <Text className="text-text-muted text-base text-center">
            Add an M3U playlist or Xtream Codes account to get started
          </Text>
        </View>
      ) : (
        <FlatList
          data={playlists}
          renderItem={renderPlaylistItem}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16 }}
        />
      )}

      <FocusableItem 
        onPress={() => setModalVisible(true)} 
        className="bg-accent m-4 p-4 rounded-lg items-center"
      >
        <Text className="text-white text-lg font-bold">+ Add Playlist</Text>
      </FocusableItem>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View className="flex-1 bg-black/80 justify-center items-center p-4">
          <View className="bg-card rounded-xl p-6 w-[80%] max-w-[500px] gap-4">
            <Text className="text-white text-2xl font-bold">Add New Playlist</Text>

            {/* Source Type Selection */}
            <View className="gap-2">
              <Text className="text-text-muted text-sm mb-2">Source Type</Text>
              <View className="flex-row gap-2">
                <FocusableItem
                  onPress={() => setSourceType('m3u')}
                  className={`flex-1 py-3 rounded-lg items-center ${
                    sourceType === 'm3u' ? 'bg-accent' : 'bg-subtle'
                  }`}
                >
                  <Text
                    className={`text-base font-semibold ${
                      sourceType === 'm3u' ? 'text-white' : 'text-text-muted'
                    }`}
                  >
                    M3U
                  </Text>
                </FocusableItem>
                <FocusableItem
                  onPress={() => setSourceType('xtream')}
                  className={`flex-1 py-3 rounded-lg items-center ${
                    sourceType === 'xtream' ? 'bg-accent' : 'bg-subtle'
                  }`}
                >
                  <Text
                    className={`text-base font-semibold ${
                      sourceType === 'xtream' ? 'text-white' : 'text-text-muted'
                    }`}
                  >
                    Xtream Codes
                  </Text>
                </FocusableItem>
              </View>
            </View>

            <TextInput
              className="bg-subtle text-white rounded-lg p-3 text-base"
              placeholder="Playlist Name"
              placeholderTextColor="#666"
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
            />

            {sourceType === 'm3u' ? (
              <TextInput
                className="bg-subtle text-white rounded-lg p-3 text-base"
                placeholder="M3U Playlist URL"
                placeholderTextColor="#666"
                value={newPlaylistUrl}
                onChangeText={setNewPlaylistUrl}
                autoCapitalize="none"
                keyboardType="url"
              />
            ) : (
              <>
                <TextInput
                  className="bg-subtle text-white rounded-lg p-3 text-base"
                  placeholder="Server URL (e.g., https://example.com:8080)"
                  placeholderTextColor="#666"
                  value={xtreamServerUrl}
                  onChangeText={setXtreamServerUrl}
                  autoCapitalize="none"
                  keyboardType="url"
                />
                <TextInput
                  className="bg-subtle text-white rounded-lg p-3 text-base"
                  placeholder="Username"
                  placeholderTextColor="#666"
                  value={xtreamUsername}
                  onChangeText={setXtreamUsername}
                  autoCapitalize="none"
                />
                <TextInput
                  className="bg-subtle text-white rounded-lg p-3 text-base"
                  placeholder="Password"
                  placeholderTextColor="#666"
                  value={xtreamPassword}
                  onChangeText={setXtreamPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </>
            )}

            <View className="flex-row justify-end gap-3">
              <FocusableItem
                onPress={() => {
                  setModalVisible(false);
                  setNewPlaylistName('');
                  setNewPlaylistUrl('');
                  setXtreamServerUrl('');
                  setXtreamUsername('');
                  setXtreamPassword('');
                  setSourceType('m3u');
                }}
                className="px-4 py-3 rounded-lg min-w-[110px] items-center bg-[#4a4a4a]"
                disabled={addingPlaylist}
              >
                <Text className="text-white text-base font-semibold">Cancel</Text>
              </FocusableItem>
              <FocusableItem
                onPress={handleAddPlaylist}
                className="px-4 py-3 rounded-lg min-w-[110px] items-center bg-accent"
                disabled={addingPlaylist}
              >
                {addingPlaylist ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white text-base font-semibold">Add</Text>
                )}
              </FocusableItem>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default HomeScreen;
