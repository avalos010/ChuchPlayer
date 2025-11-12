import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import FocusableItem from '../components/FocusableItem';
import { getSettings, saveSettings, getPlaylists, savePlaylist, deletePlaylist } from '../utils/storage';
import { RootStackParamList, Settings, Playlist, PlaylistSourceType } from '../types';
import { showError, showSuccess } from '../utils/toast';
import { fetchM3UPlaylist } from '../utils/m3uParser';
import { fetchXtreamPlaylist } from '../utils/xtreamParser';
import { usePlayerStore } from '../store/usePlayerStore';
import { useUIStore } from '../store/useUIStore';

interface SettingsScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'>;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const [settings, setSettings] = useState<Settings>({
    autoPlay: true,
    showEPG: false,
    theme: 'dark',
    multiScreenEnabled: true,
    maxMultiScreens: 4,
    epgRefreshIntervalMinutes: 60,
    channelRefreshIntervalMinutes: 15,
  });
  const [loading, setLoading] = useState(true);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [sourceType, setSourceType] = useState<PlaylistSourceType>('m3u');
  const [newPlaylistUrl, setNewPlaylistUrl] = useState('');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [xtreamServerUrl, setXtreamServerUrl] = useState('');
  const [xtreamUsername, setXtreamUsername] = useState('');
  const [xtreamPassword, setXtreamPassword] = useState('');
  const [addingPlaylist, setAddingPlaylist] = useState(false);
  const [manualRefreshing, setManualRefreshing] = useState(false);

  const loadPlaylists = useCallback(async () => {
    setLoadingPlaylists(true);
    try {
      const savedPlaylists = await getPlaylists();
      setPlaylists(savedPlaylists);
    } catch (error) {
      console.error('Error loading playlists:', error);
      // Delay error display to ensure navigation is ready
      setTimeout(() => {
        showError('Failed to load playlists. Please try again.', String(error));
      }, 100);
    } finally {
      setLoadingPlaylists(false);
    }
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedSettings = await getSettings();
        setSettings(storedSettings);
      } catch (error) {
        console.error('Error loading settings:', error);
        // Delay error display to ensure navigation is ready
        setTimeout(() => {
          showError('Failed to load settings.', String(error));
        }, 100);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
    loadPlaylists();
  }, [loadPlaylists]);

  // Auto-open add playlist modal when there are no playlists
  useEffect(() => {
    if (!loadingPlaylists && playlists.length === 0) {
      setModalVisible(true);
    }
  }, [loadingPlaylists, playlists.length]);

  const updateSetting = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const previousSettings = settings;
    try {
      const updated = { ...settings, [key]: value };
      setSettings(updated);
      await saveSettings(updated);
    } catch (error) {
      console.error('Error saving settings:', error);
      setTimeout(() => {
        showError('Could not save settings. Please try again.', String(error));
      }, 100);
      // Revert the state change on error
      setSettings(previousSettings);
    }
  };

  const handleAddPlaylist = async () => {
    if (!newPlaylistName.trim()) {
      setTimeout(() => showError('Please enter a playlist name.'), 100);
      return;
    }

    if (sourceType === 'm3u') {
      if (!newPlaylistUrl.trim()) {
        setTimeout(() => showError('Please enter an M3U playlist URL.'), 100);
        return;
      }
    } else {
      if (!xtreamServerUrl.trim() || !xtreamUsername.trim() || !xtreamPassword.trim()) {
        setTimeout(() => showError('Please enter all Xtream Codes credentials.'), 100);
        return;
      }
    }

    setAddingPlaylist(true);

    try {
      let channels: Playlist['channels'] = [];
      let playlistUrl: string;
      let epgUrls: string[] = [];
      let xtreamCredentials;

      if (sourceType === 'm3u') {
        const playlistData = await fetchM3UPlaylist(newPlaylistUrl.trim());
        channels = playlistData.channels;
        epgUrls = playlistData.epgUrls;
        playlistUrl = newPlaylistUrl.trim();
      } else {
        const credentials = {
          serverUrl: xtreamServerUrl.trim(),
          username: xtreamUsername.trim(),
          password: xtreamPassword.trim(),
        };
        const playlistData = await fetchXtreamPlaylist(credentials);
        channels = playlistData.channels;
        epgUrls = playlistData.epgUrls;
        playlistUrl = `${credentials.serverUrl}/player_api.php`;
        xtreamCredentials = credentials;
      }

      if (channels.length === 0) {
        setTimeout(() => showError('No channels were found in this playlist.'), 100);
        return;
      }

      const now = new Date();
      const playlist: Playlist = {
        id: Date.now().toString(),
        name: newPlaylistName.trim(),
        url: playlistUrl,
        sourceType,
        channels,
        epgUrls,
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

      // Update player store with new playlist and channels
      const setPlaylist = usePlayerStore.getState().setPlaylist;
      const setChannels = usePlayerStore.getState().setChannels;
      const setShowEPGGrid = useUIStore.getState().setShowEPGGrid;
      
      setPlaylist(playlist);
      setChannels(channels);
      setShowEPGGrid(true); // Show EPG grid
      
      // Navigate to Player screen (EPG grid will be visible)
      navigation.navigate('Player', {});

      setTimeout(() => showSuccess(`Added ${channels.length} channels from ${playlist.name}.`), 100);
    } catch (error) {
      console.error('Error adding playlist:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorPrefix = sourceType === 'm3u' 
        ? 'Failed to load the playlist. Please check the URL and try again.'
        : 'Failed to load the playlist. Please check your credentials and try again.';
      setTimeout(() => showError(errorPrefix, errorMessage), 100);
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
              setPlaylists(prev => {
                const updated = prev.filter(item => item.id !== playlist.id);

                const playerState = usePlayerStore.getState();
                if (playerState.playlist?.id === playlist.id) {
                  if (updated.length > 0) {
                    const fallback = updated[0];
                    playerState.setPlaylist(fallback);
                    playerState.setChannels(fallback.channels);
                    if (fallback.channels.length > 0) {
                      playerState.setChannel(fallback.channels[0]);
                    } else {
                      playerState.setChannel(null);
                    }
                  } else {
                    playerState.setChannel(null);
                    playerState.setChannels([]);
                    playerState.setPlaylist(null);
                  }
                }

                return updated;
              });

              setTimeout(() => showSuccess(`Deleted ${playlist.name}`), 100);
            } catch (error) {
              console.error('Error deleting playlist:', error);
              setTimeout(() => showError('Failed to delete the playlist.', String(error)), 100);
            }
          },
        },
      ]
    );
  };

  const renderPlaylistItem = ({ item }: { item: Playlist }) => (
    <View className="bg-card mb-3 rounded-lg">
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
    </View>
  );

  return (
    <ScrollView className="flex-1 bg-dark" contentContainerStyle={{ paddingBottom: 40 }}>
      <View className="mt-6 px-5">
        <Text className="text-accent text-lg font-bold mb-4 uppercase">Playlists</Text>
        {loadingPlaylists ? (
          <View className="justify-center items-center py-8">
            <ActivityIndicator size="large" color="#00aaff" />
          </View>
        ) : playlists.length === 0 ? (
          <View className="bg-card p-6 rounded-lg mb-3">
            <Text className="text-white text-base mb-2">No playlists yet</Text>
            <Text className="text-text-muted text-sm">
              Add an M3U playlist or Xtream Codes account to get started
            </Text>
          </View>
        ) : (
          <FlatList
            data={playlists}
            renderItem={renderPlaylistItem}
            keyExtractor={item => item.id}
            scrollEnabled={false}
            className="mb-3"
          />
        )}
        <FocusableItem 
          onPress={() => setModalVisible(true)} 
          className="bg-accent p-4 rounded-lg items-center mb-6"
        >
          <Text className="text-white text-lg font-bold">+ Add Playlist</Text>
        </FocusableItem>
      </View>

      <View className="mt-6 px-5">
        <Text className="text-accent text-lg font-bold mb-4 uppercase">Playback</Text>
        <View className="flex-row justify-between items-center bg-card p-4 rounded-lg mb-3 gap-4">
          <View className="flex-1 gap-1">
            <Text className="text-white text-base font-semibold">Auto Play</Text>
            <Text className="text-text-muted text-sm">
              Automatically start playing when opening a channel
            </Text>
          </View>
          <Switch
            value={settings.autoPlay}
            onValueChange={value => updateSetting('autoPlay', value)}
            trackColor={{ false: '#3a3a3a', true: '#00aaff' }}
            thumbColor="#fff"
            disabled={loading}
          />
        </View>
      </View>

      <View className="mt-6 px-5">
        <Text className="text-accent text-lg font-bold mb-4 uppercase">Display</Text>
        <View className="flex-row justify-between items-center bg-card p-4 rounded-lg mb-3 gap-4">
          <View className="flex-1 gap-1">
            <Text className="text-white text-base font-semibold">Show EPG</Text>
            <Text className="text-text-muted text-sm">
              Display Electronic Program Guide when available
            </Text>
          </View>
          <Switch
            value={settings.showEPG}
            onValueChange={value => updateSetting('showEPG', value)}
            trackColor={{ false: '#3a3a3a', true: '#00aaff' }}
            thumbColor="#fff"
            disabled={loading}
          />
        </View>

        <View className="flex-row justify-between items-center bg-card p-4 rounded-lg mb-3 gap-4">
          <View className="flex-1 gap-1">
            <Text className="text-white text-base font-semibold">Theme</Text>
            <Text className="text-text-muted text-sm">Choose the app theme</Text>
          </View>
          <View className="flex-row gap-2">
            <FocusableItem
              onPress={() => updateSetting('theme', 'dark')}
              className={`px-5 py-2 rounded-md ${settings.theme === 'dark' ? 'bg-accent' : 'bg-subtle'}`}
            >
              <Text className={`text-sm font-semibold ${settings.theme === 'dark' ? 'text-white' : 'text-text-muted'}`}>
                Dark
              </Text>
            </FocusableItem>
            <FocusableItem
              onPress={() => updateSetting('theme', 'light')}
              className={`px-5 py-2 rounded-md ${settings.theme === 'light' ? 'bg-accent' : 'bg-subtle'}`}
            >
              <Text className={`text-sm font-semibold ${settings.theme === 'light' ? 'text-white' : 'text-text-muted'}`}>
                Light
              </Text>
            </FocusableItem>
          </View>
        </View>
      </View>

      <View className="mt-6 px-5">
        <Text className="text-accent text-lg font-bold mb-4 uppercase">Multi-Screen</Text>
        <View className="flex-row justify-between items-center bg-card p-4 rounded-lg mb-3 gap-4">
          <View className="flex-1 gap-1">
            <Text className="text-white text-base font-semibold">Multi-Screen Mode</Text>
            <Text className="text-text-muted text-sm">
              Watch multiple channels simultaneously (up to 4 screens)
            </Text>
          </View>
          <Switch
            value={settings.multiScreenEnabled}
            onValueChange={value => updateSetting('multiScreenEnabled', value)}
            trackColor={{ false: '#3a3a3a', true: '#00aaff' }}
            thumbColor="#fff"
            disabled={loading}
          />
        </View>
        <View className="bg-card p-4 rounded-lg mb-3 gap-2">
          <View className="flex-row justify-between items-center">
            <Text className="text-white text-base font-semibold">Max Screens</Text>
            <Text className="text-text-muted text-sm">{settings.maxMultiScreens}</Text>
          </View>
          <View className="flex-row gap-2 mt-2">
            {[2, 3, 4].map((num) => (
              <FocusableItem
                key={num}
                onPress={() => updateSetting('maxMultiScreens', num)}
                className={`px-4 py-2 rounded-md ${
                  settings.maxMultiScreens === num ? 'bg-accent' : 'bg-subtle'
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    settings.maxMultiScreens === num ? 'text-white' : 'text-text-muted'
                  }`}
                >
                  {num}
                </Text>
              </FocusableItem>
            ))}
          </View>
        </View>
      </View>

      <View className="mt-6 px-5">
        <Text className="text-accent text-lg font-bold mb-4 uppercase">Data Refresh</Text>
        <View className="bg-card p-4 rounded-lg mb-3 gap-3">
          <View className="flex-row justify-between items-center">
            <Text className="text-white text-base font-semibold">EPG Refresh Interval</Text>
            <Text className="text-text-muted text-sm">{settings.epgRefreshIntervalMinutes} min</Text>
          </View>
          <Text className="text-text-muted text-xs">
            How often to refresh the Electronic Program Guide in the background
          </Text>
          <View className="flex-row gap-2 mt-3 flex-wrap">
            {[120, 180, 240, 360, 480].map((minutes) => (
              <FocusableItem
                key={`epg-${minutes}`}
                onPress={() => updateSetting('epgRefreshIntervalMinutes', minutes)}
                className={`px-4 py-2 rounded-md ${
                  settings.epgRefreshIntervalMinutes === minutes ? 'bg-accent' : 'bg-subtle'
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    settings.epgRefreshIntervalMinutes === minutes ? 'text-white' : 'text-text-muted'
                  }`}
                >
                  {`${minutes / 60}h`}
                </Text>
              </FocusableItem>
            ))}
          </View>
        </View>

        <View className="bg-card p-4 rounded-lg mb-3 gap-3">
          <View className="flex-row justify-between items-center">
            <Text className="text-white text-base font-semibold">Channel Data Refresh</Text>
            <Text className="text-text-muted text-sm">{settings.channelRefreshIntervalMinutes / 60} h</Text>
          </View>
          <Text className="text-text-muted text-xs">
            How often to refresh channel lists from your playlists
          </Text>
          <View className="flex-row gap-2 mt-3 flex-wrap">
            {[120, 240, 360, 480].map((minutes) => (
              <FocusableItem
                key={`channel-${minutes}`}
                onPress={() => updateSetting('channelRefreshIntervalMinutes', minutes)}
                className={`px-4 py-2 rounded-md ${
                  settings.channelRefreshIntervalMinutes === minutes ? 'bg-accent' : 'bg-subtle'
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    settings.channelRefreshIntervalMinutes === minutes ? 'text-white' : 'text-text-muted'
                  }`}
                >
                  {`${minutes / 60}h`}
                </Text>
              </FocusableItem>
            ))}
          </View>
        </View>
        <FocusableItem
          onPress={async () => {
            if (manualRefreshing) {
              return;
            }
            try {
              setManualRefreshing(true);
              const playerState = usePlayerStore.getState();
              let playlistsToRefresh = playlists;
              if (playlistsToRefresh.length === 0) {
                setTimeout(() => showError('No playlists available.', 'Add a playlist first.'), 100);
                return;
              }

              // Ensure we have an active playlist to keep player state consistent
              if (!playerState.playlist) {
                const fallback = playlistsToRefresh[0];
                playerState.setPlaylist(fallback);
                playerState.setChannels(fallback.channels);
                playerState.setChannel(fallback.channels[0] ?? null);
              }

              const updatedPlaylists: Playlist[] = [];
              const errors: string[] = [];
              let refreshedAny = false;

              for (const playlist of playlistsToRefresh) {
                try {
                  let refreshed: Playlist | null = null;
                  if (playlist.sourceType === 'm3u') {
                    const { channels, epgUrls } = await fetchM3UPlaylist(playlist.url);
                    if (!channels.length) {
                      throw new Error('Playlist returned no channels.');
                    }
                    refreshed = {
                      ...playlist,
                      channels,
                      epgUrls,
                      updatedAt: new Date(),
                    };
                  } else if (playlist.sourceType === 'xtream' && playlist.xtreamCredentials) {
                    const { channels, epgUrls } = await fetchXtreamPlaylist(playlist.xtreamCredentials);
                    if (!channels.length) {
                      throw new Error('Playlist returned no channels.');
                    }
                    refreshed = {
                      ...playlist,
                      channels,
                      epgUrls,
                      updatedAt: new Date(),
                    };
                  }

                  if (!refreshed) {
                    throw new Error('Unsupported playlist type.');
                  }

                  // Persist and update local state
                  await savePlaylist(refreshed);
                  updatedPlaylists.push(refreshed);
                  refreshedAny = true;

                  // Update player state if this playlist is active
                  if (playerState.playlist?.id === refreshed.id) {
                    const currentChannelId = playerState.channel?.id;
                    playerState.setPlaylist(refreshed);
                    playerState.setChannels(refreshed.channels);

                    if (refreshed.channels.length > 0) {
                      const matchingChannel = refreshed.channels.find((channel) => channel.id === currentChannelId);
                      playerState.setChannel(matchingChannel ?? refreshed.channels[0]);
                    } else {
                      playerState.setChannel(null);
                    }
                  }
                } catch (error) {
                  console.error(`Manual refresh failed for ${playlist.name}:`, error);
                  errors.push(`${playlist.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                  updatedPlaylists.push(playlist);
                }
              }

              setPlaylists(updatedPlaylists);

              if (refreshedAny) {
                setTimeout(() => showSuccess('Playlists refreshed.'), 100);
              }

              if (errors.length > 0) {
                setTimeout(() => showError('Some playlists failed to refresh.', errors.join('\n')), 100);
              }
            } catch (error) {
              console.error('Manual refresh failed:', error);
              setTimeout(() => showError('Manual refresh failed.', String(error)), 100);
            } finally {
              setManualRefreshing(false);
            }
          }}
          className="mt-3 flex-row items-center justify-center gap-3"
          style={{
            backgroundColor: manualRefreshing ? '#3a3a3a' : '#00aaff',
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            opacity: manualRefreshing ? 0.8 : 1,
          }}
          disabled={manualRefreshing}
        >
          {manualRefreshing && <ActivityIndicator size="small" color="#fff" />}
          <Text className="text-white text-base font-semibold">Refresh Now</Text>
        </FocusableItem>
      </View>

      <View className="mt-6 px-5">
        <Text className="text-accent text-lg font-bold mb-4 uppercase">Help</Text>
        <FocusableItem
          onPress={() =>
            Alert.alert(
              'How to Add Playlists',
              'M3U Playlists:\n'
                + '1. Get an M3U playlist URL from your IPTV provider\n'
                + '2. Go to Settings\n'
                + '3. Select "Add Playlist"\n'
                + '4. Choose "M3U" as source type\n'
                + '5. Enter a name and paste the URL\n'
                + '6. Wait for the channels to load\n\n'
                + 'Xtream Codes:\n'
                + '1. Get your Xtream Codes credentials from your provider\n'
                + '2. Select "Xtream Codes" as source type\n'
                + '3. Enter server URL, username, and password\n'
                + '4. Wait for the channels to load'
            )
          }
          className="bg-card p-4 rounded-lg mb-3"
        >
          <Text className="text-accent text-base font-semibold">How to Add Playlists</Text>
        </FocusableItem>

        <FocusableItem
          onPress={() =>
            Alert.alert(
              'TV Remote Controls',
              'Navigation:\n'
                + '• D-Pad: Navigate between items\n'
                + '• Center/OK: Select item\n'
                + '• Back: Go to previous screen\n\n'
                + 'Video Player:\n'
                + '• Center/OK: Play/Pause\n'
                + '• Back: Exit player\n'
                + '• D-Pad Up: Show controls'
            )
          }
          className="bg-card p-4 rounded-lg mb-3"
        >
          <Text className="text-accent text-base font-semibold">TV Remote Controls</Text>
        </FocusableItem>
      </View>

      <View className="mt-6 px-5">
        <Text className="text-accent text-lg font-bold mb-4 uppercase">About</Text>
        <View className="bg-card p-4 rounded-lg mb-3 gap-1">
          <Text className="text-text-muted text-xs">Version</Text>
          <Text className="text-white text-base">1.0.0</Text>
        </View>
        <View className="bg-card p-4 rounded-lg mb-3 gap-1">
          <Text className="text-text-muted text-xs">App Name</Text>
          <Text className="text-white text-base">chuchPlayer</Text>
        </View>
        <View className="bg-card p-4 rounded-lg mb-3 gap-1">
          <Text className="text-text-muted text-xs">Description</Text>
          <Text className="text-white text-base">IPTV Player for Android TV</Text>
        </View>
      </View>

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
    </ScrollView>
  );
};

export default SettingsScreen;

