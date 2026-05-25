import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { RouteProp } from '@react-navigation/native';
import FocusableItem from '../components/FocusableItem';
import { getSettings, saveSettings, getPlaylists, savePlaylist, deletePlaylist } from '../utils/storage';
import { RootStackParamList, Settings, Playlist, PlaylistSourceType, SettingsFocusTarget } from '../types';
import { showError, showSuccess } from '../utils/toast';
import { fetchM3UPlaylist } from '../utils/m3uParser';
import { fetchXtreamPlaylist } from '../utils/xtreamParser';
import { usePlayerStore } from '../store/usePlayerStore';
import { useUIStore } from '../store/useUIStore';
import { useThemeStore } from '../store/useThemeStore';
import { Theme, THEME_LIST } from '../theme/themes';
import { useSleepTimer } from '../hooks/useSleepTimer';

interface SettingsScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'>;
  route: RouteProp<RootStackParamList, 'Settings'>;
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

const ROW_FOCUSED = {
  backgroundColor: '#161616',
  borderColor: '#ffffff',
  borderWidth: 1.5,
  transform: [] as any[],
  elevation: 4,
};

// ─── Main screen ─────────────────────────────────────────────────────────────

const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation, route }) => {
  const theme = useThemeStore((state) => state.theme);
  const styles = useMemo(() => createStyles(theme), [theme]);
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
  const [editingPlaylistId,  setEditingPlaylistId]  = useState<string | null>(null);
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
  const [landingFocusConsumed, setLandingFocusConsumed] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const backBtnRef = useRef<any>(null);
  const addPlaylistRef = useRef<any>(null);
  const infoBarTimeoutRef = useRef<any>(null);
  const epgRefreshRef = useRef<any>(null);
  const helpRemoteRef = useRef<any>(null);
  // Modal TextInput refs for TV D-pad chaining
  const nameInputRef = useRef<any>(null);
  const urlInputRef = useRef<any>(null);
  const xtreamServerRef = useRef<any>(null);
  const xtreamUsernameRef = useRef<any>(null);
  const xtreamPasswordRef = useRef<any>(null);
  const modalSaveBtnRef = useRef<any>(null);
  const sectionOffsetsRef = useRef<Partial<Record<SettingsFocusTarget | 'top', number>>>({});

  const { themeId, customAccent, customBg, setTheme, setCustom, resetTheme } = useThemeStore();
  const [customAccentInput, setCustomAccentInput] = useState(customAccent);
  const [customBgInput,     setCustomBgInput]     = useState(customBg);

  const { setTimer: setSleepTimer } = useSleepTimer();
  const hasPlayer = !!usePlayerStore.getState().channel;
  const focusTarget = route.params?.focusTarget;

  const setSectionOffset = useCallback(
    (key: SettingsFocusTarget | 'top', y: number) => {
      sectionOffsetsRef.current[key] = y;
    },
    []
  );

  const scrollToSection = useCallback((key: SettingsFocusTarget | 'top') => {
    const y = sectionOffsetsRef.current[key] ?? 0;
    scrollRef.current?.scrollTo({
      y: Math.max(0, y - (TV ? 20 : 12)),
      animated: true,
    });
  }, []);

  const focusLandingTarget = useCallback((target?: SettingsFocusTarget) => {
    if (!TV || modalVisible || pinModalVisible) return;

    const resolvedTarget = target ?? (hasPlayer ? 'back' : 'addPlaylist');
    const targetMap: Record<SettingsFocusTarget | 'backFallback', { section: SettingsFocusTarget | 'top'; ref: React.RefObject<any> }> = {
      back: { section: 'top', ref: backBtnRef },
      addPlaylist: { section: 'addPlaylist', ref: addPlaylistRef },
      interface: { section: 'interface', ref: infoBarTimeoutRef },
      epg: { section: 'epg', ref: epgRefreshRef },
      help: { section: 'help', ref: helpRemoteRef },
      backFallback: { section: 'addPlaylist', ref: addPlaylistRef },
    };

    const config = resolvedTarget === 'back' && !hasPlayer
      ? targetMap.backFallback
      : targetMap[resolvedTarget];

    setTimeout(() => {
      scrollToSection(config.section);
      config.ref.current?.focus?.();
      setLandingFocusConsumed(true);
    }, 220);
  }, [hasPlayer, modalVisible, pinModalVisible, scrollToSection]);

  const shouldPreferFocus = useCallback((target: SettingsFocusTarget) => {
    if (!TV || modalVisible || pinModalVisible || landingFocusConsumed) return false;
    const resolvedTarget = focusTarget ?? (hasPlayer ? 'back' : 'addPlaylist');
    if (resolvedTarget === 'back' && !hasPlayer) return target === 'addPlaylist';
    return resolvedTarget === target;
  }, [focusTarget, hasPlayer, landingFocusConsumed, modalVisible, pinModalVisible]);

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

  useEffect(() => {
    setLandingFocusConsumed(false);
    focusLandingTarget(focusTarget);
  }, [focusLandingTarget, focusTarget]);

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

  const resetPlaylistForm = useCallback(() => {
    setEditingPlaylistId(null);
    setNewPlaylistName('');
    setNewPlaylistUrl('');
    setXtreamServerUrl('');
    setXtreamUsername('');
    setXtreamPassword('');
    setSourceType('m3u');
  }, []);

  const openCreatePlaylistModal = useCallback(() => {
    resetPlaylistForm();
    setModalVisible(true);
  }, [resetPlaylistForm]);

  const openEditPlaylistModal = useCallback((playlist: Playlist) => {
    setEditingPlaylistId(playlist.id);
    setNewPlaylistName(playlist.name);
    setSourceType(playlist.sourceType);

    if (playlist.sourceType === 'm3u') {
      setNewPlaylistUrl(playlist.url);
      setXtreamServerUrl('');
      setXtreamUsername('');
      setXtreamPassword('');
    } else {
      setNewPlaylistUrl('');
      setXtreamServerUrl(playlist.xtreamCredentials?.serverUrl ?? '');
      setXtreamUsername(playlist.xtreamCredentials?.username ?? '');
      setXtreamPassword(playlist.xtreamCredentials?.password ?? '');
    }

    setModalVisible(true);
  }, []);

  // ── Add playlist ────────────────────────────────────────────────────────────
  const handleAddPlaylist = async () => {
    if (!newPlaylistName.trim()) { setTimeout(() => showError('Enter a playlist name.'), 100); return; }
    if (sourceType === 'm3u' && !newPlaylistUrl.trim()) { setTimeout(() => showError('Enter an M3U URL.'), 100); return; }
    if (sourceType === 'xtream' && (!xtreamServerUrl.trim() || !xtreamUsername.trim() || !xtreamPassword.trim())) {
      setTimeout(() => showError('Enter all Xtream credentials.'), 100); return;
    }

    setAddingPlaylist(true);
    try {
      const existingPlaylist = editingPlaylistId
        ? playlists.find((playlist) => playlist.id === editingPlaylistId) ?? null
        : null;
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
        id: existingPlaylist?.id ?? Date.now().toString(),
        name: newPlaylistName.trim(),
        url: playlistUrl,
        sourceType,
        channels,
        epgUrls,
        createdAt: existingPlaylist?.createdAt ?? now,
        updatedAt: now,
        xtreamCredentials,
      };

      await savePlaylist(playlist);
      setPlaylists(prev => {
        const idx = prev.findIndex((item) => item.id === playlist.id);
        if (idx === -1) return [...prev, playlist];
        const updated = [...prev];
        updated[idx] = playlist;
        return updated;
      });
      setModalVisible(false);
      resetPlaylistForm();

      const playerState = usePlayerStore.getState();
      if (!existingPlaylist || playerState.playlist?.id === playlist.id) {
        playerState.setPlaylist(playlist);
        playerState.setChannels(channels);
        const matchingChannel = channels.find((channelItem) => channelItem.id === playerState.channel?.id);
        playerState.setChannel(matchingChannel ?? channels[0] ?? null);
      }

      if (!existingPlaylist) {
        useUIStore.getState().setShowEPGGrid(true);
        navigation.navigate('Player', {});
        setTimeout(() => showSuccess(`Added ${channels.length} channels.`), 100);
      } else {
        setTimeout(() => showSuccess(`Updated "${playlist.name}".`), 100);
      }
    } catch (err) {
      const msg = sourceType === 'm3u'
        ? `Check the URL and try again.`
        : 'Check credentials and try again.';
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
    <View style={styles.playlistRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.playlistName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.playlistMeta}>{item.channels.length} channels · {item.sourceType.toUpperCase()}</Text>
      </View>
      <FocusableItem
        onPress={() => openEditPlaylistModal(item)}
        style={styles.editBtn}
        focusedStyle={BTN_FOCUSED}
      >
        <Text style={styles.editBtnTxt}>Edit</Text>
      </FocusableItem>
      <FocusableItem
        onPress={() => confirmDeletePlaylist(item)}
        style={styles.deleteBtn}
        focusedStyle={DANGER_FOCUSED}
      >
        <Text style={styles.deleteBtnTxt}>Delete</Text>
      </FocusableItem>
    </View>
  ), [openEditPlaylistModal]);

  const closeModal = () => {
    setModalVisible(false);
    resetPlaylistForm();
  };

  const infoBarOptions: { label: string; value: number }[] = [
    { label: '3s', value: 3 },
    { label: '6s', value: 6 },
    { label: '10s', value: 10 },
    { label: 'Never', value: 0 },
  ];

  const SectionTitle: React.FC<{ label: string }> = ({ label }) => (
    <Text style={styles.sectionTitle}>{label}</Text>
  );

  const Card: React.FC<{ children: React.ReactNode; style?: any }> = ({ children, style }) => (
    <View style={[styles.card, style]}>{children}</View>
  );

  const Divider = () => <View style={styles.divider} />;

  const RowBetween: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <View style={styles.rowBetween}>{children}</View>
  );

  const SettingRow: React.FC<{
    title: string;
    desc?: string;
    right: React.ReactNode;
    top?: boolean;
    onPress?: () => void;
  }> = ({ title, desc, right, top, onPress }) => {
    const content = (
      <View style={[styles.settingRow, top && !onPress && styles.settingRowTop]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.settingTitle}>{title}</Text>
          {desc && <Text style={styles.settingDesc}>{desc}</Text>}
        </View>
        <View pointerEvents={TV && onPress ? 'none' : 'auto'}>
          {right}
        </View>
      </View>
    );

    if (TV && onPress) {
      return (
        <FocusableItem onPress={onPress} style={[styles.settingRowFocusWrap, top && styles.settingRowTop]} focusedStyle={ROW_FOCUSED}>
          {content}
        </FocusableItem>
      );
    }

    return content;
  };

  return (
    <View style={styles.root}>
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.scroll}>

        <View onLayout={(e) => setSectionOffset('top', e.nativeEvent.layout.y)} />

        {/* ── Back to player ───────────────────────────── */}
        {hasPlayer && (
          <FocusableItem
            ref={backBtnRef}
            onPress={() => navigation.navigate('Player', {})}
            hasTVPreferredFocus={shouldPreferFocus('back')}
            style={styles.backBtn}
            focusedStyle={BTN_FOCUSED}
          >
            <Text style={styles.backBtnTxt}>← Back to Player</Text>
          </FocusableItem>
        )}

        {/* ══ PLAYLISTS ═══════════════════════════════════ */}
        <SectionTitle label="Playlists" />

        {loadingPlaylists ? (
          <Card style={styles.centered}>
            <ActivityIndicator size="large" color="#555555" />
          </Card>
        ) : playlists.length === 0 ? (
          <Card>
            <Text style={styles.emptyTitle}>No playlists yet</Text>
            <Text style={styles.emptyBody}>Add an M3U playlist or Xtream Codes account to get started.</Text>
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

        <View onLayout={(e) => setSectionOffset('addPlaylist', e.nativeEvent.layout.y)}>
          <FocusableItem
            ref={addPlaylistRef}
            onPress={openCreatePlaylistModal}
            hasTVPreferredFocus={shouldPreferFocus('addPlaylist')}
            style={styles.addBtn}
            focusedStyle={BTN_FOCUSED}
          >
            <Text style={styles.addBtnTxt}>+ Add Playlist</Text>
          </FocusableItem>
        </View>

        <Divider />

        {/* ══ APPEARANCE ══════════════════════════════════ */}
        <SectionTitle label="Appearance" />
        <Card>
          <Text style={styles.settingTitle}>Theme</Text>
          <Text style={[styles.settingDesc, { marginBottom: 14 }]}>
            Select a color preset or configure custom colors below
          </Text>
          <View style={styles.swatchGrid}>
            {THEME_LIST.map((t) => (
              <FocusableItem
                key={t.id}
                onPress={() => { setTheme(t.id); setCustomAccentInput(t.accent); setCustomBgInput(t.bg); }}
                style={[
                  styles.swatchBtn,
                  themeId === t.id && styles.swatchBtnActive,
                  { backgroundColor: t.bg, borderColor: themeId === t.id ? t.accent : '#333' },
                ]}
                focusedStyle={{ backgroundColor: t.bg, borderColor: t.accent, borderWidth: 2.5, transform: [], elevation: 6 }}
              >
                <View style={[styles.swatchDot, { backgroundColor: t.accent }]} />
                <Text style={[styles.swatchLabel, { color: t.accent }]} numberOfLines={1}>{t.name}</Text>
              </FocusableItem>
            ))}
          </View>
        </Card>

        <Card style={{ marginTop: 0 }}>
          <Text style={styles.settingTitle}>Custom Colors</Text>
          <Text style={[styles.settingDesc, { marginBottom: 16 }]}>
            Set your own accent and background colors (hex format, e.g. #ff6f00)
          </Text>

          {/* Accent color */}
          <View style={styles.colorRow}>
            <View style={[styles.colorSwatch, { backgroundColor: customAccentInput }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.colorLabel}>Accent Color</Text>
              <TextInput
                style={styles.colorInput}
                value={customAccentInput}
                onChangeText={setCustomAccentInput}
                placeholder="#ffffff"
                placeholderTextColor="#3d3d3d"
                autoCorrect={false}
                autoCapitalize="none"
                maxLength={7}
              />
            </View>
          </View>

          {/* Background color */}
          <View style={[styles.colorRow, { marginTop: 12 }]}>
            <View style={[styles.colorSwatch, { backgroundColor: customBgInput }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.colorLabel}>Background</Text>
              <TextInput
                style={styles.colorInput}
                value={customBgInput}
                onChangeText={setCustomBgInput}
                placeholder="#0a0a0a"
                placeholderTextColor="#3d3d3d"
                autoCorrect={false}
                autoCapitalize="none"
                maxLength={7}
              />
            </View>
          </View>

          <View style={[styles.chipRow, { marginTop: 18 }]}>
            <FocusableItem
              onPress={() => {
                if (/^#[0-9a-fA-F]{6}$/.test(customBgInput) && /^#[0-9a-fA-F]{6}$/.test(customAccentInput)) {
                  setCustom(customBgInput, customAccentInput);
                  setTimeout(() => showSuccess('Custom theme applied.'), 100);
                } else {
                  setTimeout(() => showError('Enter valid hex colors (e.g. #ff6f00).'), 100);
                }
              }}
              style={[styles.chip, { flex: 1, alignItems: 'center' }]}
              focusedStyle={BTN_FOCUSED}
            >
              <Text style={styles.chipTxt}>Apply Custom</Text>
            </FocusableItem>
            <FocusableItem
              onPress={() => {
                resetTheme();
                setCustomAccentInput('#ffffff');
                setCustomBgInput('#0a0a0a');
                setTimeout(() => showSuccess('Theme reset to default.'), 100);
              }}
              style={[styles.chip, { alignItems: 'center' }]}
              focusedStyle={BTN_FOCUSED}
            >
              <Text style={styles.chipTxt}>Reset</Text>
            </FocusableItem>
          </View>
        </Card>

        <Divider />

        {/* ══ PLAYBACK ════════════════════════════════════ */}
        <SectionTitle label="Playback" />
        <Card>
          <SettingRow
            title="Auto Play"
            desc="Start playing automatically when opening a channel"
            onPress={() => updateSetting('autoPlay', !settings.autoPlay)}
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
            onPress={() => updateSetting('hardwareDecoder', !(settings.hardwareDecoder ?? true))}
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
          <View style={styles.settingRowTop}>
            <Text style={styles.settingTitle}>Buffer Mode</Text>
            <Text style={[styles.settingDesc, { marginBottom: 14 }]}>
              Low Latency = fastest start · Smooth = most stable
            </Text>
            <View style={styles.chipRow}>
              {([
                { id: 'low', label: 'Low Latency' },
                { id: 'balanced', label: 'Balanced' },
                { id: 'smooth', label: 'Smooth' },
              ] as { id: Settings['bufferMode']; label: string }[]).map(opt => (
                <FocusableItem
                  key={opt.id}
                  onPress={() => updateSetting('bufferMode', opt.id)}
                  style={[styles.chip, settings.bufferMode === opt.id && styles.chipActive]}
                  focusedStyle={BTN_FOCUSED}
                >
                  <Text style={[styles.chipTxt, settings.bufferMode === opt.id && styles.chipTxtActive]}>
                    {opt.label}
                  </Text>
                </FocusableItem>
              ))}
            </View>
          </View>
        </Card>

        <Divider />

        {/* ══ INTERFACE ═══════════════════════════════════ */}
        <View onLayout={(e) => setSectionOffset('interface', e.nativeEvent.layout.y)} />
        <SectionTitle label="Interface" />
        <Card>
          <View>
            <Text style={styles.settingTitle}>Info Bar Timeout</Text>
            <Text style={[styles.settingDesc, { marginBottom: 14 }]}>
              How long the channel info bar stays visible
            </Text>
            <View style={styles.chipRow}>
              {infoBarOptions.map((opt, idx) => (
                <FocusableItem
                  key={opt.value}
                  ref={idx === 0 ? infoBarTimeoutRef : undefined}
                  onPress={() => updateSetting('infoBarTimeoutSeconds', opt.value)}
                  style={[styles.chip, (settings.infoBarTimeoutSeconds ?? 6) === opt.value && styles.chipActive]}
                  hasTVPreferredFocus={idx === 0 && shouldPreferFocus('interface')}
                  focusedStyle={BTN_FOCUSED}
                >
                  <Text style={[styles.chipTxt, (settings.infoBarTimeoutSeconds ?? 6) === opt.value && styles.chipTxtActive]}>
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
            onPress={() => updateSetting('showChannelNumbers', !(settings.showChannelNumbers ?? false))}
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
          <View style={styles.settingRowTop}>
            <Text style={styles.settingTitle}>Clock Format</Text>
            <View style={[styles.chipRow, { marginTop: 10 }]}>
              {(['12h', '24h'] as const).map(fmt => (
                <FocusableItem
                  key={fmt}
                  onPress={() => updateSetting('clockFormat', fmt)}
                  style={[styles.chip, (settings.clockFormat ?? '24h') === fmt && styles.chipActive]}
                  focusedStyle={BTN_FOCUSED}
                >
                  <Text style={[styles.chipTxt, (settings.clockFormat ?? '24h') === fmt && styles.chipTxtActive]}>
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
            onPress={() => updateSetting('showEPG', !settings.showEPG)}
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
          <Text style={styles.settingDesc} numberOfLines={2}>
            Playback will automatically stop after the selected duration.
          </Text>
          <View style={[styles.chipRow, { marginTop: 14 }]}>
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
                style={styles.chip}
                focusedStyle={BTN_FOCUSED}
              >
                <Text style={styles.chipTxt}>{opt.label}</Text>
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
            onPress={() => updateSetting('multiScreenEnabled', !settings.multiScreenEnabled)}
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
          <View style={styles.settingRowTop}>
            <Text style={styles.settingTitle}>Max Screens</Text>
            <View style={[styles.chipRow, { marginTop: 10 }]}>
              {[2, 3, 4].map(n => (
                <FocusableItem
                  key={n}
                  onPress={() => updateSetting('maxMultiScreens', n)}
                  style={[styles.chip, settings.maxMultiScreens === n && styles.chipActive]}
                  focusedStyle={BTN_FOCUSED}
                >
                  <Text style={[styles.chipTxt, settings.maxMultiScreens === n && styles.chipTxtActive]}>{n}</Text>
                </FocusableItem>
              ))}
            </View>
          </View>
        </Card>

        <Divider />

        {/* ══ EPG ═════════════════════════════════════════ */}
        <View onLayout={(e) => setSectionOffset('epg', e.nativeEvent.layout.y)} />
        <SectionTitle label="EPG" />

        <Card style={{ marginBottom: 10 }}>
          <RowBetween>
            <Text style={styles.settingTitle}>EPG Refresh</Text>
            <Text style={styles.valueLabel}>{settings.epgRefreshIntervalMinutes / 60}h</Text>
          </RowBetween>
          <Text style={[styles.settingDesc, { marginBottom: 14 }]}>How often to refresh the program guide</Text>
          <View style={styles.chipRow}>
            {[120, 180, 240, 360, 480].map((min, idx) => (
              <FocusableItem
                key={`epg-${min}`}
                ref={idx === 0 ? epgRefreshRef : undefined}
                onPress={() => updateSetting('epgRefreshIntervalMinutes', min)}
                style={[styles.chip, settings.epgRefreshIntervalMinutes === min && styles.chipActive]}
                hasTVPreferredFocus={idx === 0 && shouldPreferFocus('epg')}
                focusedStyle={BTN_FOCUSED}
              >
                <Text style={[styles.chipTxt, settings.epgRefreshIntervalMinutes === min && styles.chipTxtActive]}>
                  {min / 60}h
                </Text>
              </FocusableItem>
            ))}
          </View>
        </Card>

        <Card style={{ marginBottom: 10 }}>
          <RowBetween>
            <Text style={styles.settingTitle}>Channel Refresh</Text>
            <Text style={styles.valueLabel}>{settings.channelRefreshIntervalMinutes / 60}h</Text>
          </RowBetween>
          <Text style={[styles.settingDesc, { marginBottom: 14 }]}>How often to refresh your channel lists</Text>
          <View style={styles.chipRow}>
            {[120, 240, 360, 480].map(min => (
              <FocusableItem
                key={`ch-${min}`}
                onPress={() => updateSetting('channelRefreshIntervalMinutes', min)}
                style={[styles.chip, settings.channelRefreshIntervalMinutes === min && styles.chipActive]}
                focusedStyle={BTN_FOCUSED}
              >
                <Text style={[styles.chipTxt, settings.channelRefreshIntervalMinutes === min && styles.chipTxtActive]}>
                  {min / 60}h
                </Text>
              </FocusableItem>
            ))}
          </View>
        </Card>

        <FocusableItem
          onPress={handleManualRefresh}
          style={[styles.refreshBtn, manualRefreshing && styles.refreshBtnDisabled]}
          focusedStyle={BTN_FOCUSED}
          disabled={manualRefreshing}
        >
          {manualRefreshing
            ? <ActivityIndicator size="small" color="#f5f5f5" style={{ marginRight: 10 }} />
            : null}
          <Text style={styles.refreshBtnTxt}>{manualRefreshing ? 'Refreshing…' : 'Refresh Now'}</Text>
        </FocusableItem>

        <Divider />

        {/* ══ PARENTAL LOCK ════════════════════════════════ */}
        <SectionTitle label="Parental Lock" />
        <Card>
          <SettingRow
            title="Enable Parental PIN"
            desc="Require a 4-digit PIN to access protected content"
            onPress={() => {
              if (settings.parentalPinEnabled ?? false) {
                updateSetting('parentalPinEnabled', false);
                updateSetting('parentalPinHash', '');
                setTimeout(() => showSuccess('Parental lock disabled.'), 100);
              } else {
                setPinModalVisible(true);
              }
            }}
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
            <View style={styles.settingRowTop}>
              <FocusableItem
                onPress={() => setPinModalVisible(true)}
                style={styles.changePinBtn}
                focusedStyle={BTN_FOCUSED}
              >
                <Text style={styles.changePinTxt}>Change PIN</Text>
              </FocusableItem>
            </View>
          )}
        </Card>

        <Divider />

        {/* ══ HELP ════════════════════════════════════════ */}
        <View onLayout={(e) => setSectionOffset('help', e.nativeEvent.layout.y)} />
        <SectionTitle label="Help" />

        <FocusableItem
          onPress={() => Alert.alert(
            'How to Add Playlists',
            'M3U Playlists:\n1. Get an M3U URL from your IPTV provider\n2. Tap "Add Playlist"\n3. Choose M3U, enter a name and paste the URL\n\nXtream Codes:\n1. Choose "Xtream Codes"\n2. Enter server URL, username, and password',
          )}
          style={[styles.card, styles.helpBtn]}
          focusedStyle={BTN_FOCUSED}
        >
          <Text style={styles.helpTitle}>How to Add Playlists</Text>
          <Text style={styles.helpArrow}>›</Text>
        </FocusableItem>

        <FocusableItem
          ref={helpRemoteRef}
          onPress={() => Alert.alert(
            'TV Remote Controls',
            'Navigation:\n• D-Pad: Move between items\n• Center/OK: Select\n• Back: Previous screen\n\nPlayer:\n• Center/OK: Play / Pause\n• D-Pad Up/Down: Switch channel\n• D-Pad Left: Open channel list\n• INFO key: Program details\n• Long press EPG block: Program details\n• Back: Open program guide',
          )}
          hasTVPreferredFocus={shouldPreferFocus('help')}
          style={[styles.card, styles.helpBtn]}
          focusedStyle={BTN_FOCUSED}
        >
          <Text style={styles.helpTitle}>TV Remote Controls</Text>
          <Text style={styles.helpArrow}>›</Text>
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
              styles.aboutRow,
              i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
            ]}>
              <Text style={styles.aboutLabel}>{row.label}</Text>
              <Text style={styles.aboutValue}>{row.value}</Text>
            </View>
          ))}
        </Card>

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ══ ADD PLAYLIST MODAL ══════════════════════════ */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closeModal} focusable={false}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.modalBox} focusable={false}>
            <Text style={styles.modalTitle}>{editingPlaylistId ? 'Edit Playlist' : 'Add Playlist'}</Text>

            <View style={styles.tabRow}>
              {(['m3u', 'xtream'] as PlaylistSourceType[]).map((t, idx) => (
                <FocusableItem
                  key={t}
                  onPress={() => setSourceType(t)}
                  hasTVPreferredFocus={modalVisible && idx === 0}
                  style={[styles.tab, sourceType === t && styles.tabActive]}
                  focusedStyle={BTN_FOCUSED}
                >
                  <Text style={[styles.tabTxt, sourceType === t && styles.tabTxtActive]}>
                    {t === 'm3u' ? 'M3U' : 'Xtream Codes'}
                  </Text>
                </FocusableItem>
              ))}
            </View>

            <TextInput
              ref={nameInputRef}
              style={styles.input}
              placeholder="Playlist name"
              placeholderTextColor="#3d3d3d"
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => {
                if (sourceType === 'm3u') urlInputRef.current?.focus();
                else xtreamServerRef.current?.focus();
              }}
            />

            {sourceType === 'm3u' ? (
              <TextInput
                ref={urlInputRef}
                style={styles.input}
                placeholder="M3U URL"
                placeholderTextColor="#3d3d3d"
                value={newPlaylistUrl}
                onChangeText={setNewPlaylistUrl}
                autoCapitalize="none"
                keyboardType="url"
                returnKeyType="done"
                submitBehavior="blurAndSubmit"
                onSubmitEditing={() => modalSaveBtnRef.current?.focus()}
              />
            ) : (
              <>
                <TextInput
                  ref={xtreamServerRef}
                  style={styles.input}
                  placeholder="Server URL (https://...)"
                  placeholderTextColor="#3d3d3d"
                  value={xtreamServerUrl}
                  onChangeText={setXtreamServerUrl}
                  autoCapitalize="none"
                  keyboardType="url"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => xtreamUsernameRef.current?.focus()}
                />
                <TextInput
                  ref={xtreamUsernameRef}
                  style={styles.input}
                  placeholder="Username"
                  placeholderTextColor="#3d3d3d"
                  value={xtreamUsername}
                  onChangeText={setXtreamUsername}
                  autoCapitalize="none"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => xtreamPasswordRef.current?.focus()}
                />
                <TextInput
                  ref={xtreamPasswordRef}
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#3d3d3d"
                  value={xtreamPassword}
                  onChangeText={setXtreamPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  returnKeyType="done"
                  submitBehavior="blurAndSubmit"
                  onSubmitEditing={() => modalSaveBtnRef.current?.focus()}
                />
              </>
            )}

            <View style={styles.modalActions}>
              <FocusableItem onPress={closeModal} style={styles.cancelBtn} focusedStyle={BTN_FOCUSED} disabled={addingPlaylist}>
                <Text style={styles.cancelBtnTxt}>Cancel</Text>
              </FocusableItem>
              <FocusableItem
                ref={modalSaveBtnRef}
                onPress={handleAddPlaylist}
                style={styles.confirmBtn}
                focusedStyle={BTN_FOCUSED}
                disabled={addingPlaylist}
              >
                {addingPlaylist
                  ? <ActivityIndicator color="#0a0a0a" size="small" />
                  : <Text style={styles.confirmBtnTxt}>{editingPlaylistId ? 'Save' : 'Add'}</Text>}
              </FocusableItem>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ══ PIN MODAL ════════════════════════════════════ */}
      <Modal visible={pinModalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => { setPinModalVisible(false); setPinInput(''); setPinConfirm(''); }}
          focusable={false}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={[styles.modalBox, { maxWidth: 400 }]} focusable={false}>
            <Text style={styles.modalTitle}>Set PIN</Text>
            <Text style={styles.settingDesc}>Enter a 4-digit PIN to protect content.</Text>
            <TextInput
              style={styles.input}
              placeholder="New 4-digit PIN"
              placeholderTextColor="#3d3d3d"
              value={pinInput}
              onChangeText={t => setPinInput(t.replace(/\D/g, '').slice(0, 4))}
              keyboardType="numeric"
              secureTextEntry
              maxLength={4}
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm PIN"
              placeholderTextColor="#3d3d3d"
              value={pinConfirm}
              onChangeText={t => setPinConfirm(t.replace(/\D/g, '').slice(0, 4))}
              keyboardType="numeric"
              secureTextEntry
              maxLength={4}
            />
            <View style={styles.modalActions}>
              <FocusableItem
                onPress={() => { setPinModalVisible(false); setPinInput(''); setPinConfirm(''); }}
                style={styles.cancelBtn}
                focusedStyle={BTN_FOCUSED}
              >
                <Text style={styles.cancelBtnTxt}>Cancel</Text>
              </FocusableItem>
              <FocusableItem onPress={handleSavePin} style={styles.confirmBtn} focusedStyle={BTN_FOCUSED}>
                <Text style={styles.confirmBtnTxt}>Save</Text>
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

function createStyles(theme: Theme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.bg },
    scroll: { paddingHorizontal: TV ? 48 : 24, paddingTop: TV ? 32 : 24 },

    backBtn: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: TV ? 20 : 16,
      paddingVertical: TV ? 12 : 9,
      borderRadius: 10,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: TV ? 32 : 24,
    },
    backBtnTxt: { color: theme.textSub, fontSize: TV ? 16 : 14, fontWeight: '600' },

    sectionTitle: {
      color: theme.textMuted,
      fontSize: TV ? 11 : 10,
      fontWeight: '800',
      letterSpacing: 2.5,
      marginBottom: TV ? 14 : 10,
      marginTop: 4,
    },

    card: {
      backgroundColor: theme.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      padding: TV ? 24 : 18,
      marginBottom: 10,
    },
    centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },

    divider: { height: 1, backgroundColor: theme.border, marginVertical: TV ? 28 : 22 },

    settingRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
    settingRowFocusWrap: {
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginHorizontal: -12,
      marginVertical: -10,
    },
    settingRowTop: { paddingTop: 18, marginTop: 18, borderTopWidth: 1, borderTopColor: theme.border },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 20 },
    settingTitle: { color: theme.text, fontSize: TV ? 17 : 15, fontWeight: '700', marginBottom: 4 },
    settingDesc: { color: theme.textMuted, fontSize: TV ? 13 : 11, lineHeight: TV ? 20 : 17 },
    valueLabel: { color: theme.textSub, fontSize: TV ? 15 : 13, fontWeight: '600' },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: TV ? 20 : 14, paddingVertical: TV ? 10 : 7,
      borderRadius: 10,
      backgroundColor: theme.card,
      borderWidth: 1, borderColor: theme.border,
    },
    chipActive: { backgroundColor: theme.accent, borderColor: theme.accent },
    chipTxt: { color: theme.textSub, fontSize: TV ? 14 : 12, fontWeight: '700' },
    chipTxtActive: { color: theme.accentText, fontSize: TV ? 14 : 12, fontWeight: '700' },

    playlistRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      padding: TV ? 22 : 16,
      marginBottom: 8,
      gap: 16,
    },
    playlistName: { color: theme.text, fontSize: TV ? 19 : 16, fontWeight: '700', marginBottom: 4 },
    playlistMeta: { color: theme.textMuted, fontSize: TV ? 14 : 12, fontWeight: '500' },
    editBtn: {
      paddingHorizontal: TV ? 20 : 16, paddingVertical: TV ? 12 : 9,
      borderRadius: 10,
      backgroundColor: theme.card,
      borderWidth: 1, borderColor: theme.border,
    },
    editBtnTxt: { color: theme.text, fontSize: TV ? 14 : 13, fontWeight: '700' },
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
      backgroundColor: theme.card,
      borderWidth: 1, borderColor: theme.border,
      marginBottom: 4,
    },
    addBtnTxt: { color: theme.text, fontSize: TV ? 17 : 15, fontWeight: '700' },

    emptyTitle: { color: theme.text, fontSize: TV ? 18 : 15, fontWeight: '700', marginBottom: 6 },
    emptyBody: { color: theme.textMuted, fontSize: TV ? 14 : 12, lineHeight: TV ? 22 : 18 },

    refreshBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      paddingVertical: TV ? 18 : 14, borderRadius: 14,
      backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border,
    },
    refreshBtnDisabled: { opacity: 0.5 },
    refreshBtnTxt: { color: theme.text, fontSize: TV ? 17 : 15, fontWeight: '700' },

    changePinBtn: {
      alignSelf: 'flex-start',
      paddingHorizontal: TV ? 20 : 16,
      paddingVertical: TV ? 12 : 9,
      borderRadius: 10,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    changePinTxt: { color: theme.textSub, fontSize: TV ? 14 : 13, fontWeight: '600' },

    swatchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    swatchBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: TV ? 12 : 10,
      paddingVertical: TV ? 9 : 7,
      borderRadius: 10,
      borderWidth: 1.5,
      gap: 7,
      minWidth: TV ? 110 : 90,
    },
    swatchBtnActive: { borderWidth: 2.5 },
    swatchDot: { width: TV ? 12 : 10, height: TV ? 12 : 10, borderRadius: 6 },
    swatchLabel: { fontSize: TV ? 12 : 11, fontWeight: '700' },
    colorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    colorSwatch: { width: TV ? 44 : 36, height: TV ? 44 : 36, borderRadius: 8, borderWidth: 1, borderColor: theme.border },
    colorLabel: { color: theme.textSub, fontSize: TV ? 12 : 10, fontWeight: '600', marginBottom: 5, letterSpacing: 0.5 },
    colorInput: {
      backgroundColor: theme.card,
      color: theme.text,
      borderRadius: 8, borderWidth: 1, borderColor: theme.border,
      paddingHorizontal: TV ? 14 : 10, paddingVertical: TV ? 10 : 8,
      fontSize: TV ? 15 : 13, fontFamily: 'monospace',
    },

    helpBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    helpTitle: { color: theme.textSub, fontSize: TV ? 16 : 14, fontWeight: '600' },
    helpArrow: { color: theme.textMuted, fontSize: TV ? 22 : 18, fontWeight: '300' },

    aboutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
    aboutLabel: { color: theme.textMuted, fontSize: TV ? 14 : 12, fontWeight: '500' },
    aboutValue: { color: theme.textSub, fontSize: TV ? 15 : 13, fontWeight: '600' },

    modalBackdrop: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.8)',
      justifyContent: 'center', alignItems: 'center', padding: TV ? 40 : 24,
    },
    modalBox: {
      backgroundColor: theme.surface,
      borderRadius: 20,
      borderWidth: 1, borderColor: theme.border,
      padding: TV ? 36 : 24,
      width: '100%', maxWidth: 680,
      gap: 14,
      shadowColor: '#000', shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.8, shadowRadius: 40, elevation: 30,
    },
    modalTitle: { color: theme.text, fontSize: TV ? 24 : 20, fontWeight: '800', marginBottom: 4 },
    tabRow: { flexDirection: 'row', gap: 10 },
    tab: {
      flex: 1, paddingVertical: TV ? 14 : 10, borderRadius: 12,
      backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border,
      alignItems: 'center',
    },
    tabActive: { backgroundColor: theme.accent, borderColor: theme.accent },
    tabTxt: { color: theme.textSub, fontSize: TV ? 15 : 13, fontWeight: '700' },
    tabTxtActive: { color: theme.accentText },
    input: {
      backgroundColor: theme.card,
      color: theme.text,
      borderRadius: 12, borderWidth: 1, borderColor: theme.border,
      paddingHorizontal: TV ? 18 : 14, paddingVertical: TV ? 16 : 12,
      fontSize: TV ? 16 : 14,
    },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
    cancelBtn: {
      paddingHorizontal: TV ? 24 : 18, paddingVertical: TV ? 14 : 10,
      borderRadius: 12, backgroundColor: theme.card,
      borderWidth: 1, borderColor: theme.border, alignItems: 'center', minWidth: 110,
    },
    cancelBtnTxt: { color: theme.textSub, fontSize: TV ? 15 : 13, fontWeight: '700' },
    confirmBtn: {
      paddingHorizontal: TV ? 24 : 18, paddingVertical: TV ? 14 : 10,
      borderRadius: 12, backgroundColor: theme.accent,
      alignItems: 'center', minWidth: 110,
    },
    confirmBtnTxt: { color: theme.accentText, fontSize: TV ? 15 : 13, fontWeight: '800' },
  });
}
