import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import FocusableItem from '../components/FocusableItem';
import { getSettings, saveSettings } from '../utils/storage';
import { RootStackParamList, Settings } from '../types';
import { showError } from '../utils/toast';

interface SettingsScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'>;
}

const SettingsScreen: React.FC<SettingsScreenProps> = () => {
  const [settings, setSettings] = useState<Settings>({
    autoPlay: true,
    showEPG: false,
    theme: 'dark',
    multiScreenEnabled: true,
    maxMultiScreens: 4,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedSettings = await getSettings();
        setSettings(storedSettings);
      } catch (error) {
        console.error('Error loading settings:', error);
        showError('Failed to load settings.', String(error));
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const updateSetting = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const previousSettings = settings;
    try {
      const updated = { ...settings, [key]: value };
      setSettings(updated);
      await saveSettings(updated);
    } catch (error) {
      console.error('Error saving settings:', error);
      showError('Could not save settings. Please try again.', String(error));
      // Revert the state change on error
      setSettings(previousSettings);
    }
  };

  return (
    <ScrollView className="flex-1 bg-dark" contentContainerStyle={{ paddingBottom: 40 }}>
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
        <Text className="text-accent text-lg font-bold mb-4 uppercase">Help</Text>
        <FocusableItem
          onPress={() =>
            Alert.alert(
              'How to Add Playlists',
              'M3U Playlists:\n'
                + '1. Get an M3U playlist URL from your IPTV provider\n'
                + '2. Go to the home screen\n'
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
    </ScrollView>
  );
};

export default SettingsScreen;
