import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NativeModules, Platform, ScrollView, Text, View } from 'react-native';
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
import { useSleepTimer } from '../hooks/useSleepTimer';
import { syncInterfacePreferences } from '../hooks/interfacePreferences/useInterfacePreferences';
import { confirmAction } from '../utils/platform';
import PlaylistModal from './settings/PlaylistModal';
import PinModal from './settings/PinModal';
import { createStyles } from './settings/styles';
import { SettingsPrimarySections } from './settings/SettingsPrimarySections';
import { SettingsAdvancedSections } from './settings/SettingsAdvancedSections';
import { BTN_FOCUSED, DANGER_FOCUSED, ROW_FOCUSED } from './settings/focusStyles';
interface SettingsScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'>;
  route: RouteProp<RootStackParamList, 'Settings'>;
}
const TV = Platform.OS === 'android';
// ─── Main screen ─────────────────────────────────────────────────────────────
const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation, route }) => {
  const theme = useThemeStore((state) => state.theme);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [settings, setSettings] = useState<Settings>({
    autoPlay: true,
    theme: 'dark',
    multiScreenEnabled: true,
    maxMultiScreens: 4,
    epgRefreshIntervalMinutes: 60,
    channelRefreshIntervalMinutes: 15,
    bufferMode: 'balanced',
    hardwareDecoder: true,
    autoFrameRate: false,
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
        const loadedSettings = await getSettings();
        setSettings(loadedSettings);
        syncInterfacePreferences(loadedSettings);
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
      syncInterfacePreferences(updated);
      if (key === 'autoFrameRate' && Platform.OS === 'android') {
        void NativeModules.ExoPlayerModule?.setAutoFrameRate(Boolean(value)).catch(() => undefined);
      }
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
      let vodItems: Playlist['vodItems'] = [];
      let seriesItems: Playlist['seriesItems'] = [];
      let playlistUrl = '';
      let epgUrls: string[] = [];
      let xtreamCredentials;
      if (sourceType === 'm3u') {
        const data = await fetchM3UPlaylist(newPlaylistUrl.trim());
        channels = data.channels; vodItems = data.vodItems; epgUrls = data.epgUrls; playlistUrl = newPlaylistUrl.trim();
      } else {
        const creds = { serverUrl: xtreamServerUrl.trim(), username: xtreamUsername.trim(), password: xtreamPassword.trim() };
        const data = await fetchXtreamPlaylist(creds);
        channels = data.channels; vodItems = data.vodItems; seriesItems = data.seriesItems; epgUrls = data.epgUrls;
        playlistUrl = `${creds.serverUrl}/player_api.php`; xtreamCredentials = creds;
      }
      if (!channels.length && !vodItems.length && !seriesItems.length) { setTimeout(() => showError('No live channels, movies, or TV shows found in this playlist.'), 100); return; }
      const now = new Date();
      const playlist: Playlist = {
        id: existingPlaylist?.id ?? Date.now().toString(),
        name: newPlaylistName.trim(),
        url: playlistUrl,
        sourceType,
        channels,
        vodItems,
        seriesItems,
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
        if (channels.length) {
          useUIStore.getState().setShowEPGGrid(true);
          navigation.navigate('Player', {});
        } else {
          navigation.navigate('VodCatalog');
        }
        setTimeout(() => showSuccess(`Added ${channels.length} channels, ${vodItems.length} movies, and ${seriesItems.length} TV shows.`), 100);
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
    confirmAction({
      title: 'Delete Playlist',
      message: `Delete "${pl.name}"?`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
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
    });
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
            const { channels, vodItems, epgUrls } = await fetchM3UPlaylist(pl.url);
            if (!channels.length && !vodItems.length) throw new Error('No content.');
            refreshed = { ...pl, channels, vodItems, seriesItems: [], epgUrls, updatedAt: new Date() };
          } else if (pl.sourceType === 'xtream' && pl.xtreamCredentials) {
            const { channels, vodItems, seriesItems, epgUrls } = await fetchXtreamPlaylist(pl.xtreamCredentials);
            if (!channels.length && !vodItems.length && !seriesItems.length) throw new Error('No content.');
            refreshed = { ...pl, channels, vodItems, seriesItems, epgUrls, updatedAt: new Date() };
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
        <Text style={styles.playlistMeta}>{item.channels.length} channels · {item.vodItems?.length ?? 0} movies · {item.seriesItems?.length ?? 0} shows · {item.sourceType.toUpperCase()}</Text>
      </View>
      {item.sourceType === 'xtream' || (item.vodItems?.length ?? 0) > 0 ? (
        <FocusableItem
          onPress={() => {
            usePlayerStore.getState().setPlaylist(item);
            navigation.navigate('VodCatalog');
          }}
          style={styles.editBtn}
          focusedStyle={BTN_FOCUSED}
        >
          <Text style={styles.editBtnTxt}>VOD</Text>
        </FocusableItem>
      ) : null}
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
  return (
    <View style={styles.root}>
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.scroll}>
        <View onLayout={(event) => setSectionOffset('top', event.nativeEvent.layout.y)} />
        {hasPlayer && <FocusableItem ref={backBtnRef} onPress={() => navigation.navigate('Player', {})} hasTVPreferredFocus={shouldPreferFocus('back')} style={styles.backBtn} focusedStyle={BTN_FOCUSED}><Text style={styles.backBtnTxt}>← Back to Player</Text></FocusableItem>}
        <View style={styles.settingsHero}>
          <View style={styles.settingsHeroText}><Text style={styles.settingsEyebrow}>CHUCHPLAYER</Text><Text style={styles.settingsTitle}>Settings</Text><Text style={styles.settingsSubtitle}>Manage playlists, playback, guide data, and the player interface.</Text></View>
          <View style={styles.settingsStats}>
            <View style={styles.statPill}><Text style={styles.statValue}>{playlists.length}</Text><Text style={styles.statLabel}>Playlists</Text></View>
            <View style={styles.statPill}><Text style={styles.statValue}>{settings.clockFormat ?? '24h'}</Text><Text style={styles.statLabel}>Clock</Text></View>
          </View>
        </View>
        <SettingsPrimarySections styles={styles} settings={settings} playlists={playlists} loadingPlaylists={loadingPlaylists} renderPlaylistItem={renderPlaylistItem} onAddPlaylist={openCreatePlaylistModal} addPlaylistRef={addPlaylistRef} shouldPreferFocus={shouldPreferFocus} setSectionOffset={setSectionOffset} themeId={themeId} setTheme={setTheme} setCustomAccentInput={setCustomAccentInput} setCustomBgInput={setCustomBgInput} customAccentInput={customAccentInput} customBgInput={customBgInput} setCustom={setCustom} resetTheme={resetTheme} updateSetting={updateSetting} loading={loading} focusedStyle={BTN_FOCUSED} rowFocusedStyle={ROW_FOCUSED} />
        <SettingsAdvancedSections styles={styles} settings={settings} updateSetting={updateSetting} loading={loading} infoBarTimeoutRef={infoBarTimeoutRef} epgRefreshRef={epgRefreshRef} helpRemoteRef={helpRemoteRef} shouldPreferFocus={shouldPreferFocus} setSectionOffset={setSectionOffset} setSleepTimer={setSleepTimer} hasPlayer={hasPlayer} navigateToPlayer={() => navigation.navigate('Player', {})} manualRefreshing={manualRefreshing} onManualRefresh={handleManualRefresh} setPinModalVisible={setPinModalVisible} focusedStyle={BTN_FOCUSED} rowFocusedStyle={ROW_FOCUSED} />
        <View style={{ height: 60 }} />
      </ScrollView>
      <PlaylistModal
        visible={modalVisible}
        editingPlaylistId={editingPlaylistId}
        sourceType={sourceType}
        setSourceType={setSourceType}
        newPlaylistName={newPlaylistName}
        setNewPlaylistName={setNewPlaylistName}
        newPlaylistUrl={newPlaylistUrl}
        setNewPlaylistUrl={setNewPlaylistUrl}
        xtreamServerUrl={xtreamServerUrl}
        setXtreamServerUrl={setXtreamServerUrl}
        xtreamUsername={xtreamUsername}
        setXtreamUsername={setXtreamUsername}
        xtreamPassword={xtreamPassword}
        setXtreamPassword={setXtreamPassword}
        addingPlaylist={addingPlaylist}
        onClose={closeModal}
        onSave={handleAddPlaylist}
        styles={styles}
        focusedStyle={BTN_FOCUSED}
        nameInputRef={nameInputRef}
        urlInputRef={urlInputRef}
        xtreamServerRef={xtreamServerRef}
        xtreamUsernameRef={xtreamUsernameRef}
        xtreamPasswordRef={xtreamPasswordRef}
        modalSaveBtnRef={modalSaveBtnRef}
      />
      <PinModal
        visible={pinModalVisible}
        pinInput={pinInput}
        pinConfirm={pinConfirm}
        setPinInput={setPinInput}
        setPinConfirm={setPinConfirm}
        onClose={() => { setPinModalVisible(false); setPinInput(''); setPinConfirm(''); }}
        onSave={handleSavePin}
        styles={styles}
        focusedStyle={BTN_FOCUSED}
      />
    </View>
  );
};
export default SettingsScreen;
