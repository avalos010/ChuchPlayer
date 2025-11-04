import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList, Playlist } from '../types';
import { fetchM3UPlaylist } from '../utils/m3uParser';
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
  const [newPlaylistUrl, setNewPlaylistUrl] = useState('');
  const [newPlaylistName, setNewPlaylistName] = useState('');
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
    if (!newPlaylistName.trim() || !newPlaylistUrl.trim()) {
      showError('Please enter both playlist name and URL.');
      return;
    }

    setAddingPlaylist(true);

    try {
      const channels = await fetchM3UPlaylist(newPlaylistUrl.trim());
      if (channels.length === 0) {
        showError('No channels were found in this playlist.');
        return;
      }

      const now = new Date();
      const playlist: Playlist = {
        id: Date.now().toString(),
        name: newPlaylistName.trim(),
        url: newPlaylistUrl.trim(),
        channels,
        createdAt: now,
        updatedAt: now,
      };

      await savePlaylist(playlist);
      setPlaylists(prev => [...prev, playlist]);
      setModalVisible(false);
      setNewPlaylistName('');
      setNewPlaylistUrl('');

      showSuccess(`Added ${channels.length} channels from ${playlist.name}.`);
    } catch (error) {
      console.error('Error adding playlist:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showError('Failed to load the playlist. Please check the URL and try again.', errorMessage);
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
      style={styles.playlistItem}
    >
      <View style={styles.playlistContent}>
        <View style={styles.playlistInfo}>
          <Text style={styles.playlistName}>{item.name}</Text>
          <Text style={styles.playlistDetails}>{item.channels.length} channels</Text>
        </View>
        <FocusableItem
          onPress={() => confirmDeletePlaylist(item)}
          style={styles.deleteButton}
        >
          <Text style={styles.deleteButtonText}>Delete</Text>
        </FocusableItem>
      </View>
    </FocusableItem>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#00aaff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Playlists</Text>
        <FocusableItem
          onPress={() => navigation.navigate('Settings')}
          style={styles.settingsButton}
        >
          <Text style={styles.buttonText}>⚙️ Settings</Text>
        </FocusableItem>
      </View>

      {playlists.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No playlists yet</Text>
          <Text style={styles.emptySubtext}>Add an M3U playlist to get started</Text>
        </View>
      ) : (
        <FlatList
          data={playlists}
          renderItem={renderPlaylistItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}

      <FocusableItem onPress={() => setModalVisible(true)} style={styles.addButton}>
        <Text style={styles.addButtonText}>+ Add Playlist</Text>
      </FocusableItem>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Playlist</Text>

            <TextInput
              style={styles.input}
              placeholder="Playlist Name"
              placeholderTextColor="#666"
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
            />

            <TextInput
              style={styles.input}
              placeholder="M3U Playlist URL"
              placeholderTextColor="#666"
              value={newPlaylistUrl}
              onChangeText={setNewPlaylistUrl}
              autoCapitalize="none"
              keyboardType="url"
            />

            <View style={styles.modalButtons}>
              <FocusableItem
                onPress={() => setModalVisible(false)}
                style={[styles.modalButton, styles.cancelButton]}
                disabled={addingPlaylist}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </FocusableItem>
              <FocusableItem
                onPress={handleAddPlaylist}
                style={[styles.modalButton, styles.confirmButton]}
                disabled={addingPlaylist}
              >
                {addingPlaylist ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Add</Text>
                )}
              </FocusableItem>
            </View>
          </View>
        </View>
      </Modal>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2a2a2a',
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  settingsButton: {
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#aaa',
    fontSize: 16,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
  },
  playlistItem: {
    backgroundColor: '#2a2a2a',
    marginBottom: 12,
    borderRadius: 8,
  },
  playlistContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  playlistInfo: {
    flex: 1,
  },
  playlistName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  playlistDetails: {
    color: '#aaa',
    fontSize: 14,
  },
  deleteButton: {
    backgroundColor: '#d32f2f',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 90,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#00aaff',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    maxWidth: 500,
    gap: 16,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: '#3a3a3a',
    color: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 110,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#4a4a4a',
  },
  confirmButton: {
    backgroundColor: '#00aaff',
  },
});

export default HomeScreen;
