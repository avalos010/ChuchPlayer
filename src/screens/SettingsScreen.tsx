import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
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
import { useSleepTimer } from '../hooks/useSleepTimer';

interface SettingsScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'>;
}

const TV = Platform.OS === 'android';

const BTN_FOCUSED = {
  backgroundColor: '#ffffff',
  borderColor: '#ffffff',
  borderWidth: 2,
  transform: [] as any[],
  elevation: 6,
  shadowColor: '#ffffff',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.2,
  shadowRadius: 8,
};

const DANGER_FOCUSED = {
  backgroundColor: '#ef4444',
  borderColor: '#ef4444',
  borderWidth: 2,
  transform: [] as any[],
  elevation: 6,
};

// ─── Reusable components ──────────────────────────────────────────────────────

const SectionTitle: React.FC<{ label: string }> = ({ label }) => (
  <Text style={s.sectionTitle}>{label}</Text>
);

const Card: React.FC<{ children: React.ReactNode; style?: any }> = ({ children, style }) => (
  <View style={[s.card, style]}>{children}</View>
);

const Divider = () => <View style={s.divider} />;

const RowBetween: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={s.rowBetween}>{children}</View>
);

const SettingRow: React.FC<{
  title: string;
  desc?: string;
  right: React.ReactNode;
  top?: boolean;
}> = ({ title, desc, right, top }) => (
  <View style={[s.settingRow, top && s.settingRowTop]}>
    <View style={{ flex: 1 }}>
      <Text style={s.settingTitle}>{title}</Text>
      {desc && <Text style={s.settingDesc}>{desc}</Text>}
    </View>
    {right}
  </View>
);

// ─── Main screen ─────────────────────────────────────────────────────────────

const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const [settings, setSettings] = useState<Settings>({
    autoPlay: true,
    showEPG: false,
    theme: 'dark',
    multiScreenEnabled: true,
    maxMultiScreens: 4,
    epgRefreshIntervalMinutes: 60,
    channelRefreshIntervalMinutes: 15,
    bufferMode: 'balanced',
    hardwareDecoder: true,
    infoBarTimeoutSeconds: 6,
    showChannelNumbers: false,
    clockFormat: '24h',
    parentalPinEnabled: false,
    parentalPinHash: '',
  });
  const [loading,            setLoading]            = useState(true);
  const [playlists,          setPlaylists]          = useState<Playlist[]>([]);
  const [loadingPlaylists,   setLoadingPlaylists]   = useState(true);
  const [modalVisible,       setModalVisible]       = useState(false);
  const [sourceType,         setSourceType]         = useState<PlaylistSourceType>('m3u');
  const [newPlaylistUrl,     setNewPlaylistUrl]     = useState('');
  const [newPlaylistName,    setNewPlaylistName]    = useState('');
  const [xtreamServerUrl,    setXtreamServerUrl]    = useState('');
  const [xtreamUsername,     setXtreamUsername]    = useState('');
  const [xtreamPassword,     setXtreamPassword]    = useState('');
  const [addingPlaylist,     setAddingPlaylist]     = useState(false);
  const [manualRefreshing,   setManualRefreshing]   = useState(false);
  const [pinModalVisible,    setPinModalVisible]    = useState(false);
  const [pinInput,           setPinInput]           = useState('');
  const [pinConfirm,         setPinConfirm]         = useState('');

  const { setTimer: setSleepTimer } = useSleepTimer();
  const hasPlayer = !!usePlayerStore.getState().channel;

  const loadPlaylists = useCallback(async () => {
    setLoadingPlaylists(true);
    try {
      setPlaylists(await getPlaylists());
    } catch (err) {
      setTimeout(() => showError('Failed to load playlists.', String(err)), 100);
    } finally {
      setLoadingPlaylists(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setSettings(await getSettings());
      } catch (err) {
        setTimeout(() => showError('Failed to load settings.', String(err)), 100);
      } finally {
        setLoading(false);
      }
    })();
    loadPlaylists();
  }, [loadPlaylists]);

  useEffect(() => {
    if (!loadingPlaylists && playlists.length === 0) setModalVisible(true);
  }, [loadingPlaylists, playlists.length]);

  const updateSetting = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const prev = settings;
    try {
      const updated = { ...settings, [key]: value };
      setSettings(updated);
      await saveSettings(updated);
    } catch (err) {
      setSettings(prev);
      setTimeout(() => showError('Could not save settings.', String(err)), 100);
    }
  };

  // ── Add playlist ────────────────────────────────────────────────────────────
  const handleAddPlaylist = async () => {
    if (!newPlaylistName.trim()) { setTimeout(() => showError('Enter a playlist name.'), 100); return; }
    if (sourceType === 'm3u' && !newPlaylistUrl.trim()) { setTimeout(() => showError('Enter an M3U URL.'), 100); return; }
    if (sourceType === 'xtream' && (!xtreamServerUrl.trim() || !xtreamUsername.trim() || !xtreamPassword.trim())) {
      setTimeout(() => showError('Enter all Xtream credentials.'), 100); return;
    }

    setAddingPlaylist(true);
    try {
      let channels: Playlist['channels'] = [];
      let playlistUrl = '';
      let epgUrls: string[] = [];
      let xtreamCredentials;

      if (sourceType === 'm3u') {
        const data = await fetchM3UPlaylist(newPlaylistUrl.trim());
        channels = data.channels; epgUrls = data.epgUrls; playlistUrl = newPlaylistUrl.trim();
      } else {
        const creds = { serverUrl: xtreamServerUrl.trim(), username: xtreamUsername.trim(), password: xtreamPassword.trim() };
        const data = await fetchXtreamPlaylist(creds);
        channels = data.channels; epgUrls = data.epgUrls;
        playlistUrl = `${creds.serverUrl}/player_api.php`; xtreamCredentials = creds;
      }

      if (!channels.length) { setTimeout(() => showError('No channels found in this playlist.'), 100); return; }

      const now = new Date();
      const playlist: Playlist = {
        id: Date.now().toString(), name: newPlaylistName.trim(), url: playlistUrl,
        sourceType, channels, epgUrls, createdAt: now, updatedAt: now, xtreamCredentials,
      };

      await savePlaylist(playlist);
      setPlaylists(prev => [...prev, playlist]);
      setModalVisible(false);
      setNewPlaylistName(''); setNewPlaylistUrl(''); setXtreamServerUrl('');
      setXtreamUsername(''); setXtreamPassword(''); setSourceType('m3u');

      usePlayerStore.getState().setPlaylist(playlist);
      usePlayerStore.getState().setChannels(channels);
      useUIStore.getState().setShowEPGGrid(true);
      navigation.navigate('Player', {});
      setTimeout(() => showSuccess(`Added ${channels.length} channels.`), 100);
    } catch (err) {
      const msg = sourceType === 'm3u' ? 'Check the URL and try again.' : 'Check credentials and try again.';
      setTimeout(() => showError(msg, err instanceof Error ? err.message : String(err)), 100);
    } finally {
      setAddingPlaylist(false);
    }
  };

  // ── Delete playlist ─────────────────────────────────────────────────────────
  const confirmDeletePlaylist = (pl: Playlist) => {
    Alert.alert('Delete Playlist', `Delete "${pl.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deletePlaylist(pl.id);
            setPlaylists(prev => {
              const updated = prev.filter(p => p.id !== pl.id);
              const ps = usePlayerStore.getState();
              if (ps.playlist?.id === pl.id) {
                if (updated.length > 0) {
                  ps.setPlaylist(updated[0]); ps.setChannels(updated[0].channels);
                  ps.setChannel(updated[0].channels[0] ?? null);
                } else {
                  ps.setChannel(null); ps.setChannels([]); ps.setPlaylist(null);
                }
              }
              return updated;
            });
            setTimeout(() => showSuccess(`Deleted "${pl.name}"`), 100);
          } catch (err) {
            setTimeout(() => showError('Failed to delete.', String(err)), 100);
          }
        },
      },
    ]);
  };

  // ── Manual refresh ──────────────────────────────────────────────────────────
  const handleManualRefresh = async () => {
    if (manualRefreshing) return;
    setManualRefreshing(true);
    try {
      const ps = usePlayerStore.getState();
      if (!playlists.length) { setTimeout(() => showError('No playlists.', 'Add a playlist first.'), 100); return; }
      if (!ps.playlist) { ps.setPlaylist(playlists[0]); ps.setChannels(playlists[0].channels); ps.setChannel(playlists[0].channels[0] ?? null); }

      const updated: Playlist[] = [];
      const errors: string[] = [];

      for (const pl of playlists) {
        try {
          let refreshed: Playlist | null = null;
          if (pl.sourceType === 'm3u') {
            const { channels, epgUrls } = await fetchM3UPlaylist(pl.url);
            if (!channels.length) throw new Error('No channels.');
            refreshed = { ...pl, channels, epgUrls, updatedAt: new Date() };
          } else if (pl.sourceType === 'xtream' && pl.xtreamCredentials) {
            const { channels, epgUrls } = await fetchXtreamPlaylist(pl.xtreamCredentials);
            if (!channels.length) throw new Error('No channels.');
            refreshed = { ...pl, channels, epgUrls, updatedAt: new Date() };
          }
          if (!refreshed) throw new Error('Unsupported type.');
          await savePlaylist(refreshed);
          updated.push(refreshed);
          if (ps.playlist?.id === refreshed.id) {
            ps.setPlaylist(refreshed); ps.setChannels(refreshed.channels);
            const match = refreshed.channels.find(c => c.id === ps.channel?.id);
            ps.setChannel(match ?? refreshed.channels[0] ?? null);
          }
        } catch (err) {
          errors.push(`${pl.name}: ${err instanceof Error ? err.message : 'Unknown'}`);
          updated.push(pl);
        }
      }

      setPlaylists(updated);
      if (updated.some((u, i) => u !== playlists[i])) setTimeout(() => showSuccess('Playlists refreshed.'), 100);
      if (errors.length) setTimeout(() => showError('Some playlists failed.', errors.join('\n')), 100);
    } catch (err) {
      setTimeout(() => showError('Refresh failed.', String(err)), 100);
    } finally {
      setManualRefreshing(false);
    }
  };

  // ── PIN modal ────────────────────────────────────────────────────────────────
  const handleSavePin = () => {
    if (pinInput.length !== 4 || !/^\d{4}$/.test(pinInput)) {
      setTimeout(() => showError('PIN must be exactly 4 digits.'), 100); return;
    }
    if (pinInput !== pinConfirm) {
      setTimeout(() => showError('PINs do not match.'), 100); return;
    }
    // Simple hash: just store as-is for now (in production use crypto hash)
    updateSetting('parentalPinHash', pinInput);
    updateSetting('parentalPinEnabled', true);
    setPinModalVisible(false);
    setPinInput('');
    setPinConfirm('');
    setTimeout(() => showSuccess('Parental PIN set.'), 100);
  };

  // ── Render playlist row ─────────────────────────────────────────────────────
  const renderPlaylistItem = useCallback(({ item }: { item: Playlist }) => (
    <View style={s.playlistRow}>
      <View style={{ flex: 1 }}>
        <Text style={s.playlistName} numberOfLines={1}>{item.name}</Text>
        <Text style={s.playlistMeta}>{item.channels.length} channels · {item.sourceType.toUpperCase()}</Text>
      </View>
      <FocusableItem
        onPress={() => confirmDeletePlaylist(item)}
        style={s.deleteBtn}
        focusedStyle={DANGER_FOCUSED}
      >
        <Text style={s.deleteBtnTxt}>Delete</Text>
      </FocusableItem>
    </View>
  ), []);

  const closeModal = () => {
    setModalVisible(false);
    setNewPlaylistName(''); setNewPlaylistUrl(''); setXtreamServerUrl('');
    setXtreamUsername(''); setXtreamPassword(''); setSourceType('m3u');
  };

  const infoBarOptions: { label: string; value: number }[] = [
    { label: '3s', value: 3 },
    { label: '6s', value: 6 },
    { label: '10s', value: 10 },
    { label: 'Never', value: 0 },
  ];

  return (
    <View style={s.root}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll}>

        {/* ── Back to player ───────────────────────────── */}
        {hasPlayer && (
          <FocusableItem
            onPress={() => navigation.navigate('Player', {})}
            hasTVPreferredFocus={TV && hasPlayer && !modalVisible}
            style={s.backBtn}
            focusedStyle={BTN_FOCUSED}
          >
            <Text style={s.backBtnTxt}>← Back to Player</Text>
          </FocusableItem>
        )}

        {/* ══ PLAYLISTS ═══════════════════════════════════ */}
        <SectionTitle label="Playlists" />

        {loadingPlaylists ? (
          <Card style={s.centered}>
            <ActivityIndicator size="large" color="#555555" />
          </Card>
        ) : playlists.length === 0 ? (
          <Card>
            <Text style={s.emptyTitle}>No playlists yet</Text>
            <Text style={s.emptyBody}>Add an M3U playlist or Xtream Codes account to get started.</Text>
          </Card>
        ) : (
          <FlatList
            data={playlists}
            renderItem={renderPlaylistItem}
            keyExtractor={item => item.id}
            scrollEnabled={false}
            style={{ marginBottom: 4 }}
          />
        )}

        <FocusableItem
          onPress={() => setModalVisible(true)}
          hasTVPreferredFocus={TV && !hasPlayer && !modalVisible}
          style={s.addBtn}
          focusedStyle={BTN_FOCUSED}
        >
          <Text style={s.addBtnTxt}>+ Add Playlist</Text>
        </FocusableItem>

        <Divider />

        {/* ══ PLAYBACK ════════════════════════════════════ */}
        <SectionTitle label="Playback" />
        <Card>
          <SettingRow
            title="Auto Play"
            desc="Start playing automatically when opening a channel"
            right={
              <Switch
                value={settings.autoPlay}
                onValueChange={v => updateSetting('autoPlay', v)}
                trackColor={{ false: '#2a2a2a', true: '#e5e5e5' }}
                thumbColor={settings.autoPlay ? '#0a0a0a' : '#555555'}
                disabled={loading}
              />
            }
          />
          <SettingRow
            title="Hardware Decoder"
            desc="Use device GPU for video decoding (recommended for 4K)"
            top
            right={
              <Switch
                value={settings.hardwareDecoder ?? true}
                onValueChange={v => updateSetting('hardwareDecoder', v)}
                trackColor={{ false: '#2a2a2a', true: '#e5e5e5' }}
                thumbColor={(settings.hardwareDecoder ?? true) ? '#0a0a0a' : '#555555'}
                disabled={loading}
              />
            }
          />
          <View style={s.settingRowTop}>
            <Text style={s.settingTitle}>Buffer Mode</Text>
            <Text style={[s.settingDesc, { marginBottom: 14 }]}>
              Low Latency = fastest start · Smooth = most stable
            </Text>
            <View style={s.chipRow}>
              {([
                { id: 'low', label: 'Low Latency' },
                { id: 'balanced', label: 'Balanced' },
                { id: 'smooth', label: 'Smooth' },
              ] as { id: Settings['bufferMode']; label: string }[]).map(opt => (
                <FocusableItem
                  key={opt.id}
                  onPress={() => updateSetting('bufferMode', opt.id)}
                  style={[s.chip, settings.bufferMode === opt.id && s.chipActive]}
                  focusedStyle={BTN_FOCUSED}
                >
                  <Text style={[s.chipTxt, settings.bufferMode === opt.id && s.chipTxtActive]}>
                    {opt.label}
                  </Text>
                </FocusableItem>
              ))}
            </View>
          </View>
        </Card>

        <Divider />

        {/* ══ INTERFACE ═══════════════════════════════════ */}
        <SectionTitle label="Interface" />
        <Card>
          <View>
            <Text style={s.settingTitle}>Info Bar Timeout</Text>
            <Text style={[s.settingDesc, { marginBottom: 14 }]}>
              How long the channel info bar stays visible
            </Text>
            <View style={s.chipRow}>
              {infoBarOptions.map(opt => (
                <FocusableItem
                  key={opt.value}
                  onPress={() => updateSetting('infoBarTimeoutSeconds', opt.value)}
                  style={[s.chip, (settings.infoBarTimeoutSeconds ?? 6) === opt.value && s.chipActive]}
                  focusedStyle={BTN_FOCUSED}
                >
                  <Text style={[s.chipTxt, (settings.infoBarTimeoutSeconds ?? 6) === opt.value && s.chipTxtActive]}>
                    {opt.label}
                  </Text>
                </FocusableItem>
              ))}
            </View>
          </View>
          <SettingRow
            title="Show Channel Numbers"
            desc="Display channel numbers in the sidebar"
            top
            right={
              <Switch
                value={settings.showChannelNumbers ?? false}
                onValueChange={v => updateSetting('showChannelNumbers', v)}
                trackColor={{ false: '#2a2a2a', true: '#e5e5e5' }}
                thumbColor={(settings.showChannelNumbers) ? '#0a0a0a' : '#555555'}
                disabled={loading}
              />
            }
          />
          <View style={s.settingRowTop}>
            <Text style={s.settingTitle}>Clock Format</Text>
            <View style={[s.chipRow, { marginTop: 10 }]}>
              {(['12h', '24h'] as const).map(fmt => (
                <FocusableItem
                  key={fmt}
                  onPress={() => updateSetting('clockFormat', fmt)}
                  style={[s.chip, (settings.clockFormat ?? '24h') === fmt && s.chipActive]}
                  focusedStyle={BTN_FOCUSED}
                >
                  <Text style={[s.chipTxt, (settings.clockFormat ?? '24h') === fmt && s.chipTxtActive]}>
                    {fmt}
                  </Text>
                </FocusableItem>
              ))}
            </View>
          </View>
          <SettingRow
            title="Show EPG Guide"
            desc="Display the program guide when available"
            top
            right={
              <Switch
                value={settings.showEPG}
                onValueChange={v => updateSetting('showEPG', v)}
                trackColor={{ false: '#2a2a2a', true: '#e5e5e5' }}
                thumbColor={settings.showEPG ? '#0a0a0a' : '#555555'}
                disabled={loading}
              />
            }
          />
        </Card>

        <Divider />

        {/* ══ SLEEP TIMER ══════════════════════════════════ */}
        <SectionTitle label="Sleep Timer" />
        <Card>
          <Text style={s.settingDesc} numberOfLines={2}>
            Playback will automatically stop after the selected duration.
          </Text>
          <View style={[s.chipRow, { marginTop: 14 }]}>
            {[
              { label: 'Off', min: 0 },
              { label: '15 min', min: 15 },
              { label: '30 min', min: 30 },
              { label: '45 min', min: 45 },
              { label: '1 hour', min: 60 },
              { label: '90 min', min: 90 },
            ].map(opt => (
              <FocusableItem
                key={opt.min}
                onPress={() => {
                  setSleepTimer(opt.min);
                  if (hasPlayer) navigation.navigate('Player', {});
                  setTimeout(() => showSuccess(opt.min === 0 ? 'Sleep timer off.' : `Sleep timer set: ${opt.label}`), 100);
                }}
                style={s.chip}
                focusedStyle={BTN_FOCUSED}
              >
                <Text style={s.chipTxt}>{opt.label}</Text>
              </FocusableItem>
            ))}
          </View>
        </Card>

        <Divider />

        {/* ══ MULTI-SCREEN ════════════════════════════════ */}
        <SectionTitle label="Multi-Screen" />
        <Card>
          <SettingRow
            title="Multi-Screen Mode"
            desc="Watch up to 4 channels at once"
            right={
              <Switch
                value={settings.multiScreenEnabled}
                onValueChange={v => updateSetting('multiScreenEnabled', v)}
                trackColor={{ false: '#2a2a2a', true: '#e5e5e5' }}
                thumbColor={settings.multiScreenEnabled ? '#0a0a0a' : '#555555'}
                disabled={loading}
              />
            }
          />
          <View style={s.settingRowTop}>
            <Text style={s.settingTitle}>Max Screens</Text>
            <View style={[s.chipRow, { marginTop: 10 }]}>
              {[2, 3, 4].map(n => (
                <FocusableItem
                  key={n}
                  onPress={() => updateSetting('maxMultiScreens', n)}
                  style={[s.chip, settings.maxMultiScreens === n && s.chipActive]}
                  focusedStyle={BTN_FOCUSED}
                >
                  <Text style={[s.chipTxt, settings.maxMultiScreens === n && s.chipTxtActive]}>{n}</Text>
                </FocusableItem>
              ))}
            </View>
          </View>
        </Card>

        <Divider />

        {/* ══ EPG ═════════════════════════════════════════ */}
        <SectionTitle label="EPG" />

        <Card style={{ marginBottom: 10 }}>
          <RowBetween>
            <Text style={s.settingTitle}>EPG Refresh</Text>
            <Text style={s.valueLabel}>{settings.epgRefreshIntervalMinutes / 60}h</Text>
          </RowBetween>
          <Text style={[s.settingDesc, { marginBottom: 14 }]}>How often to refresh the program guide</Text>
          <View style={s.chipRow}>
            {[120, 180, 240, 360, 480].map(min => (
              <FocusableItem
                key={`epg-${min}`}
                onPress={() => updateSetting('epgRefreshIntervalMinutes', min)}
                style={[s.chip, settings.epgRefreshIntervalMinutes === min && s.chipActive]}
                focusedStyle={BTN_FOCUSED}
              >
                <Text style={[s.chipTxt, settings.epgRefreshIntervalMinutes === min && s.chipTxtActive]}>
                  {min / 60}h
                </Text>
              </FocusableItem>
            ))}
          </View>
        </Card>

        <Card style={{ marginBottom: 10 }}>
          <RowBetween>
            <Text style={s.settingTitle}>Channel Refresh</Text>
            <Text style={s.valueLabel}>{settings.channelRefreshIntervalMinutes / 60}h</Text>
          </RowBetween>
          <Text style={[s.settingDesc, { marginBottom: 14 }]}>How often to refresh your channel lists</Text>
          <View style={s.chipRow}>
            {[120, 240, 360, 480].map(min => (
              <FocusableItem
                key={`ch-${min}`}
                onPress={() => updateSetting('channelRefreshIntervalMinutes', min)}
                style={[s.chip, settings.channelRefreshIntervalMinutes === min && s.chipActive]}
                focusedStyle={BTN_FOCUSED}
              >
                <Text style={[s.chipTxt, settings.channelRefreshIntervalMinutes === min && s.chipTxtActive]}>
                  {min / 60}h
                </Text>
              </FocusableItem>
            ))}
          </View>
        </Card>

        <FocusableItem
          onPress={handleManualRefresh}
          style={[s.refreshBtn, manualRefreshing && s.refreshBtnDisabled]}
          focusedStyle={BTN_FOCUSED}
          disabled={manualRefreshing}
        >
          {manualRefreshing
            ? <ActivityIndicator size="small" color="#f5f5f5" style={{ marginRight: 10 }} />
            : null}
          <Text style={s.refreshBtnTxt}>{manualRefreshing ? 'Refreshing…' : 'Refresh Now'}</Text>
        </FocusableItem>

        <Divider />

        {/* ══ PARENTAL LOCK ════════════════════════════════ */}
        <SectionTitle label="Parental Lock" />
        <Card>
          <SettingRow
            title="Enable Parental PIN"
            desc="Require a 4-digit PIN to access protected content"
            right={
              <Switch
                value={settings.parentalPinEnabled ?? false}
                onValueChange={v => {
                  if (v) {
                    setPinModalVisible(true);
                  } else {
                    updateSetting('parentalPinEnabled', false);
                    updateSetting('parentalPinHash', '');
                    setTimeout(() => showSuccess('Parental lock disabled.'), 100);
                  }
                }}
                trackColor={{ false: '#2a2a2a', true: '#e5e5e5' }}
                thumbColor={(settings.parentalPinEnabled) ? '#0a0a0a' : '#555555'}
                disabled={loading}
              />
            }
          />
          {settings.parentalPinEnabled && (
            <View style={s.settingRowTop}>
              <FocusableItem
                onPress={() => setPinModalVisible(true)}
                style={s.changePinBtn}
                focusedStyle={BTN_FOCUSED}
              >
                <Text style={s.changePinTxt}>Change PIN</Text>
              </FocusableItem>
            </View>
          )}
        </Card>

        <Divider />

        {/* ══ HELP ════════════════════════════════════════ */}
        <SectionTitle label="Help" />

        <FocusableItem
          onPress={() => Alert.alert(
            'How to Add Playlists',
            'M3U Playlists:\n1. Get an M3U URL from your IPTV provider\n2. Tap "Add Playlist"\n3. Choose M3U, enter a name and paste the URL\n\nXtream Codes:\n1. Choose "Xtream Codes"\n2. Enter server URL, username, and password',
          )}
          style={[s.card, s.helpBtn]}
          focusedStyle={BTN_FOCUSED}
        >
          <Text style={s.helpTitle}>How to Add Playlists</Text>
          <Text style={s.helpArrow}>›</Text>
        </FocusableItem>

        <FocusableItem
          onPress={() => Alert.alert(
            'TV Remote Controls',
            'Navigation:\n• D-Pad: Move between items\n• Center/OK: Select\n• Back: Previous screen\n\nPlayer:\n• Center/OK: Play / Pause\n• D-Pad Up/Down: Switch channel\n• D-Pad Left: Open channel list\n• INFO key: Program details\n• Long press EPG block: Program details\n• Back: Open program guide',
          )}
          style={[s.card, s.helpBtn]}
          focusedStyle={BTN_FOCUSED}
        >
          <Text style={s.helpTitle}>TV Remote Controls</Text>
          <Text style={s.helpArrow}>›</Text>
        </FocusableItem>

        <Divider />

        {/* ══ ABOUT ═══════════════════════════════════════ */}
        <SectionTitle label="About" />
        <Card>
          {[
            { label: 'App', value: 'ChuchPlayer' },
            { label: 'Version', value: '1.0.0' },
            { label: 'Platform', value: 'Android TV / IPTV' },
            { label: 'EPG', value: 'XMLTV + Xtream' },
          ].map((row, i, arr) => (
            <View key={row.label} style={[
              s.aboutRow,
              i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
            ]}>
              <Text style={s.aboutLabel}>{row.label}</Text>
              <Text style={s.aboutValue}>{row.value}</Text>
            </View>
          ))}
        </Card>

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ══ ADD PLAYLIST MODAL ══════════════════════════ */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={closeModal} focusable={false}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={s.modalBox} focusable={false}>
            <Text style={s.modalTitle}>Add Playlist</Text>

            <View style={s.tabRow}>
              {(['m3u', 'xtream'] as PlaylistSourceType[]).map((t, idx) => (
                <FocusableItem
                  key={t}
                  onPress={() => setSourceType(t)}
                  hasTVPreferredFocus={modalVisible && idx === 0}
                  style={[s.tab, sourceType === t && s.tabActive]}
                  focusedStyle={BTN_FOCUSED}
                >
                  <Text style={[s.tabTxt, sourceType === t && s.tabTxtActive]}>
                    {t === 'm3u' ? 'M3U' : 'Xtream Codes'}
                  </Text>
                </FocusableItem>
              ))}
            </View>

            <TextInput
              style={s.input}
              placeholder="Playlist name"
              placeholderTextColor="#3d3d3d"
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
            />

            {sourceType === 'm3u' ? (
              <TextInput
                style={s.input}
                placeholder="M3U URL"
                placeholderTextColor="#3d3d3d"
                value={newPlaylistUrl}
                onChangeText={setNewPlaylistUrl}
                autoCapitalize="none"
                keyboardType="url"
              />
            ) : (
              <>
                <TextInput style={s.input} placeholder="Server URL (https://...)" placeholderTextColor="#3d3d3d"
                  value={xtreamServerUrl} onChangeText={setXtreamServerUrl} autoCapitalize="none" keyboardType="url" />
                <TextInput style={s.input} placeholder="Username" placeholderTextColor="#3d3d3d"
                  value={xtreamUsername} onChangeText={setXtreamUsername} autoCapitalize="none" />
                <TextInput style={s.input} placeholder="Password" placeholderTextColor="#3d3d3d"
                  value={xtreamPassword} onChangeText={setXtreamPassword} secureTextEntry autoCapitalize="none" />
              </>
            )}

            <View style={s.modalActions}>
              <FocusableItem onPress={closeModal} style={s.cancelBtn} focusedStyle={BTN_FOCUSED} disabled={addingPlaylist}>
                <Text style={s.cancelBtnTxt}>Cancel</Text>
              </FocusableItem>
              <FocusableItem onPress={handleAddPlaylist} style={s.confirmBtn} focusedStyle={BTN_FOCUSED} disabled={addingPlaylist}>
                {addingPlaylist
                  ? <ActivityIndicator color="#0a0a0a" size="small" />
                  : <Text style={s.confirmBtnTxt}>Add</Text>}
              </FocusableItem>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ══ PIN MODAL ════════════════════════════════════ */}
      <Modal visible={pinModalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={s.modalBackdrop}
          activeOpacity={1}
          onPress={() => { setPinModalVisible(false); setPinInput(''); setPinConfirm(''); }}
          focusable={false}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={[s.modalBox, { maxWidth: 400 }]} focusable={false}>
            <Text style={s.modalTitle}>Set PIN</Text>
            <Text style={s.settingDesc}>Enter a 4-digit PIN to protect content.</Text>
            <TextInput
              style={s.input}
              placeholder="New 4-digit PIN"
              placeholderTextColor="#3d3d3d"
              value={pinInput}
              onChangeText={t => setPinInput(t.replace(/\D/g, '').slice(0, 4))}
              keyboardType="numeric"
              secureTextEntry
              maxLength={4}
            />
            <TextInput
              style={s.input}
              placeholder="Confirm PIN"
              placeholderTextColor="#3d3d3d"
              value={pinConfirm}
              onChangeText={t => setPinConfirm(t.replace(/\D/g, '').slice(0, 4))}
              keyboardType="numeric"
              secureTextEntry
              maxLength={4}
            />
            <View style={s.modalActions}>
              <FocusableItem
                onPress={() => { setPinModalVisible(false); setPinInput(''); setPinConfirm(''); }}
                style={s.cancelBtn}
                focusedStyle={BTN_FOCUSED}
              >
                <Text style={s.cancelBtnTxt}>Cancel</Text>
              </FocusableItem>
              <FocusableItem onPress={handleSavePin} style={s.confirmBtn} focusedStyle={BTN_FOCUSED}>
                <Text style={s.confirmBtnTxt}>Save</Text>
              </FocusableItem>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export default SettingsScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  scroll: { paddingHorizontal: TV ? 48 : 24, paddingTop: TV ? 32 : 24 },

  backBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: TV ? 20 : 16,
    paddingVertical: TV ? 12 : 9,
    borderRadius: 10,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#222222',
    marginBottom: TV ? 32 : 24,
  },
  backBtnTxt: { color: '#8a8a8a', fontSize: TV ? 16 : 14, fontWeight: '600' },

  sectionTitle: {
    color: '#3d3d3d',
    fontSize: TV ? 11 : 10,
    fontWeight: '800',
    letterSpacing: 2.5,
    marginBottom: TV ? 14 : 10,
    marginTop: 4,
  },

  card: {
    backgroundColor: '#111111',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    padding: TV ? 24 : 18,
    marginBottom: 10,
  },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },

  divider: { height: 1, backgroundColor: '#141414', marginVertical: TV ? 28 : 22 },

  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  settingRowTop: { paddingTop: 18, marginTop: 18, borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 20 },
  settingTitle: { color: '#e5e5e5', fontSize: TV ? 17 : 15, fontWeight: '700', marginBottom: 4 },
  settingDesc: { color: '#3d3d3d', fontSize: TV ? 13 : 11, lineHeight: TV ? 20 : 17 },
  valueLabel: { color: '#555555', fontSize: TV ? 15 : 13, fontWeight: '600' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: TV ? 20 : 14, paddingVertical: TV ? 10 : 7,
    borderRadius: 10,
    backgroundColor: '#161616',
    borderWidth: 1, borderColor: '#222222',
  },
  chipActive: { backgroundColor: '#f5f5f5', borderColor: '#f5f5f5' },
  chipTxt: { color: '#555555', fontSize: TV ? 14 : 12, fontWeight: '700' },
  chipTxtActive: { color: '#0a0a0a' },

  // Playlist rows
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    padding: TV ? 22 : 16,
    marginBottom: 8,
    gap: 16,
  },
  playlistName: { color: '#f5f5f5', fontSize: TV ? 19 : 16, fontWeight: '700', marginBottom: 4 },
  playlistMeta: { color: '#3d3d3d', fontSize: TV ? 14 : 12, fontWeight: '500' },
  deleteBtn: {
    paddingHorizontal: TV ? 20 : 16, paddingVertical: TV ? 12 : 9,
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
  },
  deleteBtnTxt: { color: '#f87171', fontSize: TV ? 14 : 13, fontWeight: '700' },

  addBtn: {
    alignItems: 'center',
    paddingVertical: TV ? 18 : 14,
    borderRadius: 14,
    backgroundColor: '#161616',
    borderWidth: 1, borderColor: '#2a2a2a',
    marginBottom: 4,
  },
  addBtnTxt: { color: '#f5f5f5', fontSize: TV ? 17 : 15, fontWeight: '700' },

  emptyTitle: { color: '#f5f5f5', fontSize: TV ? 18 : 15, fontWeight: '700', marginBottom: 6 },
  emptyBody: { color: '#3d3d3d', fontSize: TV ? 14 : 12, lineHeight: TV ? 22 : 18 },

  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: TV ? 18 : 14, borderRadius: 14,
    backgroundColor: '#161616', borderWidth: 1, borderColor: '#2a2a2a',
  },
  refreshBtnDisabled: { opacity: 0.5 },
  refreshBtnTxt: { color: '#f5f5f5', fontSize: TV ? 17 : 15, fontWeight: '700' },

  changePinBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: TV ? 20 : 16,
    paddingVertical: TV ? 12 : 9,
    borderRadius: 10,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  changePinTxt: { color: '#8a8a8a', fontSize: TV ? 14 : 13, fontWeight: '600' },

  helpBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  helpTitle: { color: '#8a8a8a', fontSize: TV ? 16 : 14, fontWeight: '600' },
  helpArrow: { color: '#3d3d3d', fontSize: TV ? 22 : 18, fontWeight: '300' },

  aboutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  aboutLabel: { color: '#3d3d3d', fontSize: TV ? 14 : 12, fontWeight: '500' },
  aboutValue: { color: '#8a8a8a', fontSize: TV ? 15 : 13, fontWeight: '600' },

  // Modal
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center', alignItems: 'center', padding: TV ? 40 : 24,
  },
  modalBox: {
    backgroundColor: '#111111',
    borderRadius: 20,
    borderWidth: 1, borderColor: '#1e1e1e',
    padding: TV ? 36 : 24,
    width: '100%', maxWidth: 680,
    gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.8, shadowRadius: 40, elevation: 30,
  },
  modalTitle: { color: '#f5f5f5', fontSize: TV ? 24 : 20, fontWeight: '800', marginBottom: 4 },
  tabRow: { flexDirection: 'row', gap: 10 },
  tab: {
    flex: 1, paddingVertical: TV ? 14 : 10, borderRadius: 12,
    backgroundColor: '#161616', borderWidth: 1, borderColor: '#222222',
    alignItems: 'center',
  },
  tabActive: { backgroundColor: '#f5f5f5', borderColor: '#f5f5f5' },
  tabTxt: { color: '#555555', fontSize: TV ? 15 : 13, fontWeight: '700' },
  tabTxtActive: { color: '#0a0a0a' },
  input: {
    backgroundColor: '#161616',
    color: '#f5f5f5',
    borderRadius: 12, borderWidth: 1, borderColor: '#222222',
    paddingHorizontal: TV ? 18 : 14, paddingVertical: TV ? 16 : 12,
    fontSize: TV ? 16 : 14,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  cancelBtn: {
    paddingHorizontal: TV ? 24 : 18, paddingVertical: TV ? 14 : 10,
    borderRadius: 12, backgroundColor: '#161616',
    borderWidth: 1, borderColor: '#222222', alignItems: 'center', minWidth: 110,
  },
  cancelBtnTxt: { color: '#555555', fontSize: TV ? 15 : 13, fontWeight: '700' },
  confirmBtn: {
    paddingHorizontal: TV ? 24 : 18, paddingVertical: TV ? 14 : 10,
    borderRadius: 12, backgroundColor: '#f5f5f5',
    alignItems: 'center', minWidth: 110,
  },
  confirmBtnTxt: { color: '#0a0a0a', fontSize: TV ? 15 : 13, fontWeight: '800' },
});
