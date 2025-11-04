import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import FocusableItem from '../components/FocusableItem';
import { getSettings, saveSettings } from '../utils/storage';
import { RootStackParamList, Settings } from '../types';

interface SettingsScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'>;
}

const SettingsScreen: React.FC<SettingsScreenProps> = () => {
  const [settings, setSettings] = useState<Settings>({
    autoPlay: true,
    showEPG: false,
    theme: 'dark',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedSettings = await getSettings();
        setSettings(storedSettings);
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const updateSetting = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    try {
      const updated = { ...settings, [key]: value };
      setSettings(updated);
      await saveSettings(updated);
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Could not save settings. Please try again.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Playback</Text>
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Auto Play</Text>
            <Text style={styles.settingDescription}>
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Display</Text>
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Show EPG</Text>
            <Text style={styles.settingDescription}>
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

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Theme</Text>
            <Text style={styles.settingDescription}>Choose the app theme</Text>
          </View>
          <View style={styles.themeButtons}>
            <FocusableItem
              onPress={() => updateSetting('theme', 'dark')}
              style={[
                styles.themeButton,
                settings.theme === 'dark' && styles.themeButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.themeButtonText,
                  settings.theme === 'dark' && styles.themeButtonTextActive,
                ]}
              >
                Dark
              </Text>
            </FocusableItem>
            <FocusableItem
              onPress={() => updateSetting('theme', 'light')}
              style={[
                styles.themeButton,
                settings.theme === 'light' && styles.themeButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.themeButtonText,
                  settings.theme === 'light' && styles.themeButtonTextActive,
                ]}
              >
                Light
              </Text>
            </FocusableItem>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Help</Text>
        <FocusableItem
          onPress={() =>
            Alert.alert(
              'How to Add Playlists',
              '1. Get an M3U playlist URL from your IPTV provider\n'
                + '2. Go to the home screen\n'
                + '3. Select "Add Playlist"\n'
                + '4. Enter a name and paste the URL\n'
                + '5. Wait for the channels to load'
            )
          }
          style={styles.helpButton}
        >
          <Text style={styles.helpButtonText}>How to Add Playlists</Text>
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
          style={styles.helpButton}
        >
          <Text style={styles.helpButtonText}>TV Remote Controls</Text>
        </FocusableItem>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.aboutItem}>
          <Text style={styles.aboutLabel}>Version</Text>
          <Text style={styles.aboutValue}>1.0.0</Text>
        </View>
        <View style={styles.aboutItem}>
          <Text style={styles.aboutLabel}>App Name</Text>
          <Text style={styles.aboutValue}>chuchPlayer</Text>
        </View>
        <View style={styles.aboutItem}>
          <Text style={styles.aboutLabel}>Description</Text>
          <Text style={styles.aboutValue}>IPTV Player for Android TV</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  content: {
    paddingBottom: 40,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    color: '#00aaff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    gap: 16,
  },
  settingInfo: {
    flex: 1,
    gap: 4,
  },
  settingLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  settingDescription: {
    color: '#aaa',
    fontSize: 14,
  },
  themeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  themeButton: {
    backgroundColor: '#3a3a3a',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
  },
  themeButtonActive: {
    backgroundColor: '#00aaff',
  },
  themeButtonText: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '600',
  },
  themeButtonTextActive: {
    color: '#fff',
  },
  helpButton: {
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  helpButtonText: {
    color: '#00aaff',
    fontSize: 16,
    fontWeight: '600',
  },
  aboutItem: {
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    gap: 4,
  },
  aboutLabel: {
    color: '#aaa',
    fontSize: 12,
  },
  aboutValue: {
    color: '#fff',
    fontSize: 16,
  },
});

export default SettingsScreen;
