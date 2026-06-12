import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Modal, ScrollView, Platform,
} from 'react-native';
import { ResizeMode } from 'expo-av';
import { Channel } from '../../types';
import type { PlayerPlaybackStatus, PlayerVideoHandle } from '../../types/video';
import { useMultiScreenStore, type MultiScreen } from '../../store/useMultiScreenStore';
import { useThemeStore } from '../../store/useThemeStore';
import { Theme } from '../../theme/themes';
import FocusableItem from '../FocusableItem';
import { showError } from '../../utils/toast';
import AppVideo from './AppVideo';

const KeyEvent = Platform.OS === 'android'
  ? (require('react-native-keyevent').default ?? require('react-native-keyevent'))
  : null;

interface MultiScreenPlayerProps {
  screen: MultiScreen;
  onOpenMenu: (screenId: string) => void;
  theme: Theme;
}

const MultiScreenPlayer: React.FC<MultiScreenPlayerProps> = ({ screen, onOpenMenu, theme }) => {
  const videoRef = useRef<PlayerVideoHandle>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { updateScreen, setFocusedScreen } = useMultiScreenStore();

  useEffect(() => {
    if (videoRef.current && screen.channel.url) {
      setError(null);
      setLoading(true);
      videoRef.current
        .loadAsync({ uri: screen.channel.url })
        .then(() => { if (screen.isPlaying) videoRef.current?.playAsync(); })
        .catch((err) => {
          setError('Failed to load stream');
          showError('Failed to load stream', String(err));
        });
    }
  }, [screen.channel.url]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!videoRef.current) return;
    if (screen.isPlaying) videoRef.current.playAsync();
    else videoRef.current.pauseAsync();
  }, [screen.isPlaying]);

  const handlePlaybackStatusUpdate = useCallback((status: PlayerPlaybackStatus) => {
    if (!status.isLoaded) {
      if (status.error) { setError('Playback error'); setLoading(false); }
      return;
    }
    setLoading(status.isBuffering);
    updateScreen(screen.id, { isPlaying: status.isPlaying });
  }, [screen.id, updateScreen]);

  const handlePress = useCallback(() => {
    setFocusedScreen(screen.id);
    onOpenMenu(screen.id);
  }, [screen.id, setFocusedScreen, onOpenMenu]);

  const isFocused = screen.isFocused;

  return (
    <FocusableItem
      onPress={handlePress}
      onFocus={() => setFocusedScreen(screen.id)}
      style={[
        msp.tile,
        { borderColor: isFocused ? theme.accent : theme.border, borderWidth: isFocused ? 3 : 1 },
      ]}
      focusedStyle={{ borderColor: theme.focused, borderWidth: 3, transform: [] as any[] }}
    >
      <AppVideo
        ref={videoRef}
        source={{ uri: screen.channel.url }}
        style={msp.video}
        resizeMode={ResizeMode.COVER}
        shouldPlay={screen.isPlaying}
        onLoad={() => setLoading(false)}
        onError={(err) => { setLoading(false); setError('Failed to load'); showError('Video load error', String(err)); }}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        useNativeControls={false}
        isLooping={false}
        volume={screen.isMuted ? 0 : screen.volume}
      />

      {loading && !error && (
        <View style={msp.overlayCenter}>
          <ActivityIndicator size="small" color={theme.accent} />
        </View>
      )}
      {error && (
        <View style={msp.overlayCenter}>
          <Text style={[msp.errorTxt, { color: theme.text }]}>{error}</Text>
        </View>
      )}

      <View style={[msp.nameTag, { backgroundColor: 'rgba(0,0,0,0.65)' }]}>
        <Text style={[msp.nameTxt, { color: theme.text }]} numberOfLines={1}>{screen.channel.name}</Text>
      </View>
    </FocusableItem>
  );
};

const msp = StyleSheet.create({
  tile: { flex: 1, backgroundColor: '#000', position: 'relative', borderRadius: 6, overflow: 'hidden' },
  video: { width: '100%', height: '100%' },
  overlayCenter: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  errorTxt: { fontSize: 12, textAlign: 'center', paddingHorizontal: 8 },
  nameTag: { position: 'absolute', top: 6, left: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5, maxWidth: '80%' },
  nameTxt: { fontSize: 12, fontWeight: '700' },
});

interface MultiScreenViewProps {
  channels: Channel[];
  onChannelSelect: (channel: Channel) => void;
}

const MultiScreenView: React.FC<MultiScreenViewProps> = ({ channels }) => {
  const theme = useThemeStore((s) => s.theme);
  const st = useMemo(() => createStyles(theme), [theme]);
  const focusedStyle = useMemo(() => ({ borderColor: theme.focused, borderWidth: 2, transform: [] as any[] }), [theme]);

  const {
    screens, layout, isMultiScreenMode, featuredScreenId, fullscreenScreenId,
    addScreen, removeScreen, setLayout, setFeaturedScreen, setFullscreenScreen,
    setScreenChannel, cycleFullscreen, clearAllScreens, canAddScreen, maxScreens,
  } = useMultiScreenStore();

  const [menuScreenId, setMenuScreenId] = useState<string | null>(null);
  const [pickerScreenId, setPickerScreenId] = useState<string | null>(null);

  // Android D-pad: right cycles the next screen to fullscreen; left exits fullscreen.
  useEffect(() => {
    if (!KeyEvent || !isMultiScreenMode) return;
    KeyEvent.onKeyDownListener((e: { keyCode: number }) => {
      if (menuScreenId || pickerScreenId) return;
      if (e.keyCode === 22) cycleFullscreen();           // DPAD_RIGHT
      else if (e.keyCode === 21) setFullscreenScreen(null); // DPAD_LEFT
    });
    return () => KeyEvent.removeKeyDownListener();
  }, [isMultiScreenMode, menuScreenId, pickerScreenId, cycleFullscreen, setFullscreenScreen]);

  const availableChannels = useMemo(
    () => channels.filter((ch) => !screens.some((sc) => sc.channel.id === ch.id)),
    [channels, screens],
  );

  const handleAddScreen = useCallback(() => {
    if (availableChannels.length > 0) addScreen(availableChannels[0]);
  }, [availableChannels, addScreen]);

  if (!isMultiScreenMode || screens.length === 0) return null;

  const menuScreen = screens.find((s) => s.id === menuScreenId) ?? null;
  const fullscreenScreen = fullscreenScreenId ? screens.find((s) => s.id === fullscreenScreenId) : null;

  // ── Layout selection ────────────────────────────────────────────────────────
  let body: React.ReactNode;
  if (fullscreenScreen) {
    body = (
      <View style={st.fullWrap}>
        <MultiScreenPlayer screen={fullscreenScreen} onOpenMenu={setMenuScreenId} theme={theme} />
        <View style={st.fsHint}>
          <Text style={st.fsHintTxt}>► next  ·  ◄ back to grid</Text>
        </View>
      </View>
    );
  } else if (featuredScreenId && screens.length > 1) {
    const featured = screens.find((s) => s.id === featuredScreenId);
    const rest = screens.filter((s) => s.id !== featuredScreenId);
    body = (
      <View style={st.featuredWrap}>
        <View style={st.featuredMain}>
          {featured && <MultiScreenPlayer screen={featured} onOpenMenu={setMenuScreenId} theme={theme} />}
        </View>
        <View style={st.featuredSide}>
          {rest.map((screen) => (
            <View key={screen.id} style={st.featuredSideItem}>
              <MultiScreenPlayer screen={screen} onOpenMenu={setMenuScreenId} theme={theme} />
            </View>
          ))}
        </View>
      </View>
    );
  } else if (screens.length === 2 && layout !== 'grid') {
    // Side-by-side filling the whole width
    body = (
      <View style={st.rowWrap}>
        {screens.map((screen) => (
          <View key={screen.id} style={st.rowItem}>
            <MultiScreenPlayer screen={screen} onOpenMenu={setMenuScreenId} theme={theme} />
          </View>
        ))}
      </View>
    );
  } else {
    // Grid 2x2
    body = (
      <View style={st.gridWrap}>
        {screens.map((screen) => (
          <View key={screen.id} style={st.gridItem}>
            <MultiScreenPlayer screen={screen} onOpenMenu={setMenuScreenId} theme={theme} />
          </View>
        ))}
        {canAddScreen() && availableChannels.length > 0 && (
          <TouchableOpacity onPress={handleAddScreen} activeOpacity={0.7} style={[st.gridItem, st.addTile]}>
            <Text style={[st.addPlus, { color: theme.textSub }]}>＋</Text>
            <Text style={[st.addTxt, { color: theme.textMuted }]}>Add Screen</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={st.root}>
      {/* Top bar */}
      {!fullscreenScreen && (
        <View style={st.topBar}>
          <FocusableItem
            onPress={() => setLayout(layout === 'grid' ? 'split' : 'grid')}
            style={st.topBtn}
            focusedStyle={focusedStyle}
          >
            <Text style={st.topBtnTxt}>{layout === 'grid' ? '▦ Grid' : '▤ Split'}</Text>
          </FocusableItem>
          <View style={st.topCount}><Text style={st.topCountTxt}>{screens.length}/{maxScreens}</Text></View>
          <FocusableItem onPress={() => { clearAllScreens(); }} style={st.topBtnDanger} focusedStyle={focusedStyle}>
            <Text style={st.topBtnDangerTxt}>Exit</Text>
          </FocusableItem>
        </View>
      )}

      {body}

      {/* ── Per-screen context menu ─────────────────────────────────────────── */}
      <Modal visible={!!menuScreen} transparent animationType="fade" onRequestClose={() => setMenuScreenId(null)}>
        <View style={st.backdrop}>
          <View style={st.menuCard}>
            <Text style={st.menuTitle} numberOfLines={1}>{menuScreen?.channel.name}</Text>

            <FocusableItem
              onPress={() => { if (menuScreen) setPickerScreenId(menuScreen.id); setMenuScreenId(null); }}
              hasTVPreferredFocus
              style={st.menuItem}
              focusedStyle={focusedStyle}
            >
              <Text style={st.menuItemTxt}>Change channel</Text>
            </FocusableItem>

            <FocusableItem
              onPress={() => {
                if (!menuScreen) return;
                setFeaturedScreen(featuredScreenId === menuScreen.id ? null : menuScreen.id);
                setMenuScreenId(null);
              }}
              style={st.menuItem}
              focusedStyle={focusedStyle}
            >
              <Text style={st.menuItemTxt}>
                {menuScreen && featuredScreenId === menuScreen.id ? 'Reset size' : 'Make bigger'}
              </Text>
            </FocusableItem>

            <FocusableItem
              onPress={() => { if (menuScreen) setFullscreenScreen(menuScreen.id); setMenuScreenId(null); }}
              style={st.menuItem}
              focusedStyle={focusedStyle}
            >
              <Text style={st.menuItemTxt}>Fullscreen</Text>
            </FocusableItem>

            <FocusableItem
              onPress={() => { if (menuScreen) removeScreen(menuScreen.id); setMenuScreenId(null); }}
              style={[st.menuItem, st.menuItemDanger]}
              focusedStyle={focusedStyle}
            >
              <Text style={st.menuItemDangerTxt}>Remove screen</Text>
            </FocusableItem>

            <FocusableItem onPress={() => setMenuScreenId(null)} style={st.menuClose} focusedStyle={focusedStyle}>
              <Text style={st.menuCloseTxt}>Close</Text>
            </FocusableItem>
          </View>
        </View>
      </Modal>

      {/* ── Channel picker (change channel) ─────────────────────────────────── */}
      <Modal visible={!!pickerScreenId} transparent animationType="fade" onRequestClose={() => setPickerScreenId(null)}>
        <View style={st.backdrop}>
          <View style={st.pickerCard}>
            <Text style={st.menuTitle}>Pick a channel</Text>
            <ScrollView style={st.pickerList} keyboardShouldPersistTaps="handled">
              {channels.slice(0, 200).map((ch) => (
                <FocusableItem
                  key={ch.id}
                  onPress={() => {
                    if (pickerScreenId) setScreenChannel(pickerScreenId, ch);
                    setPickerScreenId(null);
                  }}
                  style={st.pickerRow}
                  focusedStyle={focusedStyle}
                >
                  <Text style={st.pickerRowTxt} numberOfLines={1}>{ch.name}</Text>
                </FocusableItem>
              ))}
            </ScrollView>
            <FocusableItem onPress={() => setPickerScreenId(null)} style={st.menuClose} focusedStyle={focusedStyle}>
              <Text style={st.menuCloseTxt}>Cancel</Text>
            </FocusableItem>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default MultiScreenView;

const createStyles = (theme: Theme) => StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  topBar: {
    position: 'absolute', top: 8, right: 8, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  topBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border,
  },
  topBtnTxt: { color: theme.textSub, fontSize: 13, fontWeight: '700' },
  topCount: {
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8,
    backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border,
  },
  topCountTxt: { color: theme.textMuted, fontSize: 12, fontWeight: '700' },
  topBtnDanger: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: theme.card, borderWidth: 1, borderColor: theme.live,
  },
  topBtnDangerTxt: { color: theme.live, fontSize: 13, fontWeight: '700' },

  // 2-up full width
  rowWrap: { flex: 1, flexDirection: 'row', padding: 6, gap: 6 },
  rowItem: { flex: 1 },

  // grid 2x2
  gridWrap: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', padding: 6, gap: 6 },
  gridItem: { width: '49%', height: '49%' },
  addTile: {
    backgroundColor: theme.surface, borderWidth: 2, borderColor: theme.border,
    borderStyle: 'dashed', borderRadius: 6, justifyContent: 'center', alignItems: 'center',
  },
  addPlus: { fontSize: 30, fontWeight: '300' },
  addTxt: { fontSize: 12, marginTop: 4, fontWeight: '600' },

  // featured (make bigger)
  featuredWrap: { flex: 1, flexDirection: 'row', padding: 6, gap: 6 },
  featuredMain: { flex: 2 },
  featuredSide: { flex: 1, gap: 6 },
  featuredSideItem: { flex: 1 },

  // fullscreen
  fullWrap: { flex: 1, padding: 6 },
  fsHint: {
    position: 'absolute', bottom: 14, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
  },
  fsHintTxt: { color: theme.textSub, fontSize: 12, fontWeight: '600' },

  // modals
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  menuCard: {
    width: '80%', maxWidth: 420, backgroundColor: theme.surface, borderRadius: 16,
    borderWidth: 1, borderColor: theme.border, padding: 18, gap: 10,
  },
  menuTitle: { color: theme.text, fontSize: 18, fontWeight: '800', marginBottom: 4 },
  menuItem: {
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10,
    backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border,
  },
  menuItemTxt: { color: theme.text, fontSize: 15, fontWeight: '600' },
  menuItemDanger: { borderColor: theme.live },
  menuItemDangerTxt: { color: theme.live, fontSize: 15, fontWeight: '700' },
  menuClose: {
    paddingVertical: 12, borderRadius: 10, alignItems: 'center',
    backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, marginTop: 2,
  },
  menuCloseTxt: { color: theme.textSub, fontSize: 14, fontWeight: '700' },

  pickerCard: {
    width: '85%', maxWidth: 480, backgroundColor: theme.surface, borderRadius: 16,
    borderWidth: 1, borderColor: theme.border, padding: 18, gap: 10,
  },
  pickerList: { maxHeight: 360 },
  pickerRow: {
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 8, marginBottom: 6,
    backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border,
  },
  pickerRowTxt: { color: theme.textSub, fontSize: 14, fontWeight: '600' },
});
