import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, ActivityIndicator, StyleSheet, Modal, ScrollView, TextInput, Platform,
} from 'react-native';
import { Channel } from '../../types';
import { useMultiScreenStore, type MultiScreen } from '../../store/useMultiScreenStore';
import { useThemeStore } from '../../store/useThemeStore';
import { Theme } from '../../theme/themes';
import FocusableItem, { type FocusableItemHandle } from '../FocusableItem';
import MultiScreenVideoView from './MultiScreenVideoView';

const KeyEvent = Platform.OS === 'android'
  ? (require('react-native-keyevent').default ?? require('react-native-keyevent'))
  : null;
const HEADER_HIDE_DELAY_MS = 4500;

interface MultiScreenPlayerProps {
  screen: MultiScreen;
  onOpenMenu: (screenId: string) => void;
  onTileFocus: () => void;
  theme: Theme;
  preferredFocus?: boolean;
}

const MultiScreenPlayer = React.memo(({ screen, onOpenMenu, onTileFocus, theme, preferredFocus }: MultiScreenPlayerProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setFocusedScreen = useMultiScreenStore((state) => state.setFocusedScreen);

  useEffect(() => {
    setLoading(true);
    setError(null);
  }, [screen.channel.url]);

  const handlePress = useCallback(() => {
    setFocusedScreen(screen.id);
    onOpenMenu(screen.id);
  }, [screen.id, setFocusedScreen, onOpenMenu]);
  const handleFocus = useCallback(() => {
    setFocusedScreen(screen.id);
    onTileFocus();
  }, [screen.id, setFocusedScreen, onTileFocus]);

  const isFocused = screen.isFocused;

  return (
    <FocusableItem
      onPress={handlePress}
      onFocus={handleFocus}
      hasTVPreferredFocus={preferredFocus}
      contentStyle={msp.content}
      style={[
        msp.tile,
        { borderColor: isFocused ? theme.accent : theme.border, borderWidth: isFocused ? 3 : 1 },
      ]}
      focusedStyle={{ borderColor: theme.focused, borderWidth: 3, transform: [] as any[] }}
    >
      <MultiScreenVideoView
        source={screen.channel.url}
        playing={screen.isPlaying}
        volume={screen.isMuted ? 0 : screen.volume}
        style={msp.video}
        onReady={() => setLoading(false)}
        onBuffering={(buffering) => setLoading(buffering)}
        onError={() => {
          setLoading(false);
          setError('Stream unavailable');
        }}
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

      <View style={msp.nameTag}>
        <Text style={[msp.nameTxt, { color: theme.text }]} numberOfLines={1}>{screen.channel.name}</Text>
        {isFocused && <Text style={msp.audioTag}>AUDIO</Text>}
      </View>
    </FocusableItem>
  );
});

const msp = StyleSheet.create({
  tile: { flex: 1, backgroundColor: '#000', position: 'relative', borderRadius: 6, overflow: 'hidden' },
  content: { flex: 1 },
  video: { width: '100%', height: '100%' },
  overlayCenter: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  errorTxt: { fontSize: 12, textAlign: 'center', paddingHorizontal: 8 },
  nameTag: { position: 'absolute', top: 8, left: 8, right: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.7)', flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameTxt: { flex: 1, fontSize: 12, fontWeight: '700' },
  audioTag: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
});

interface MultiScreenViewProps {
  channels: Channel[];
  onOpenControls: () => void;
}

type PickerTarget = { kind: 'add' } | { kind: 'replace'; screenId: string };

const MultiScreenView: React.FC<MultiScreenViewProps> = ({ channels, onOpenControls }) => {
  const theme = useThemeStore((s) => s.theme);
  const st = useMemo(() => createStyles(theme), [theme]);
  const focusedStyle = useMemo(() => ({ borderColor: theme.focused, borderWidth: 2, transform: [] as any[] }), [theme]);

  const {
    screens, layout, isMultiScreenMode, featuredScreenId, fullscreenScreenId,
    addScreen, removeScreen, setLayout, setFeaturedScreen, setFullscreenScreen,
    setScreenChannel, clearAllScreens, maxScreens,
  } = useMultiScreenStore();

  const [menuScreenId, setMenuScreenId] = useState<string | null>(null);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [channelQuery, setChannelQuery] = useState('');
  const [headerVisible, setHeaderVisible] = useState(true);
  const headerFirstRef = useRef<FocusableItemHandle>(null);
  const headerHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headerFocusedRef = useRef(false);
  const focusHeaderOnRevealRef = useRef(false);

  const clearHeaderHide = useCallback(() => {
    if (headerHideTimerRef.current) clearTimeout(headerHideTimerRef.current);
    headerHideTimerRef.current = null;
  }, []);

  const scheduleHeaderHide = useCallback(() => {
    clearHeaderHide();
    headerHideTimerRef.current = setTimeout(() => {
      if (!headerFocusedRef.current) setHeaderVisible(false);
    }, HEADER_HIDE_DELAY_MS);
  }, [clearHeaderHide]);

  useEffect(() => {
    scheduleHeaderHide();
    return clearHeaderHide;
  }, [scheduleHeaderHide, clearHeaderHide]);

  const handleHeaderFocus = useCallback(() => {
    headerFocusedRef.current = true;
    clearHeaderHide();
  }, [clearHeaderHide]);

  const handleHeaderBlur = useCallback(() => {
    headerFocusedRef.current = false;
    scheduleHeaderHide();
  }, [scheduleHeaderHide]);

  const handleTileFocus = useCallback(() => {
    headerFocusedRef.current = false;
    scheduleHeaderHide();
  }, [scheduleHeaderHide]);

  useEffect(() => {
    if (!KeyEvent || !isMultiScreenMode) return undefined;
    KeyEvent.onKeyDownListener((event: { keyCode: number }) => {
      if (
        !headerVisible &&
        !menuScreenId &&
        !pickerTarget &&
        (event.keyCode === 19 || event.keyCode === 82)
      ) {
        focusHeaderOnRevealRef.current = true;
        setHeaderVisible(true);
      }
    });
    return () => KeyEvent.removeKeyDownListener();
  }, [isMultiScreenMode, headerVisible, menuScreenId, pickerTarget]);

  useEffect(() => {
    if (!headerVisible || !focusHeaderOnRevealRef.current) return undefined;
    focusHeaderOnRevealRef.current = false;
    const frame = requestAnimationFrame(() => headerFirstRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [headerVisible]);

  const pickerChannels = useMemo(() => {
    if (!pickerTarget) return [];
    const usedIds = new Set(screens
      .filter((screen) => pickerTarget.kind === 'add' || screen.id !== pickerTarget.screenId)
      .map((screen) => screen.channel.id));
    const query = channelQuery.trim().toLowerCase();
    const matches: Channel[] = [];
    for (const channel of channels) {
      if (usedIds.has(channel.id) || !channel.name.toLowerCase().includes(query)) continue;
      matches.push(channel);
      if (matches.length === 80) break;
    }
    return matches;
  }, [channels, screens, pickerTarget, channelQuery]);

  const openPicker = useCallback((target: PickerTarget) => {
    setChannelQuery('');
    setPickerTarget(target);
  }, []);

  const selectPickerChannel = useCallback((channel: Channel) => {
    if (!pickerTarget) return;
    if (pickerTarget.kind === 'add') addScreen(channel);
    else setScreenChannel(pickerTarget.screenId, channel);
    setPickerTarget(null);
  }, [pickerTarget, addScreen, setScreenChannel]);

  if (!isMultiScreenMode || screens.length === 0) return null;

  const menuScreen = screens.find((s) => s.id === menuScreenId) ?? null;
  const fullscreenScreen = fullscreenScreenId ? screens.find((s) => s.id === fullscreenScreenId) : null;
  const canAddScreen = screens.length < maxScreens && channels.length > screens.length;

  // ── Layout selection ────────────────────────────────────────────────────────
  let body: React.ReactNode;
  if (fullscreenScreen) {
    body = (
      <View style={st.fullWrap}>
        <MultiScreenPlayer screen={fullscreenScreen} onOpenMenu={setMenuScreenId} onTileFocus={handleTileFocus} theme={theme} preferredFocus />
      </View>
    );
  } else if (layout === 'split' || featuredScreenId) {
    const featured = screens.find((s) => s.id === featuredScreenId) ?? screens[0];
    const rest = screens.filter((s) => s.id !== featured.id);
    body = (
      <View style={st.featuredWrap}>
        <View style={st.featuredMain}>
          <MultiScreenPlayer screen={featured} onOpenMenu={setMenuScreenId} onTileFocus={handleTileFocus} theme={theme} preferredFocus />
        </View>
        <View style={st.featuredSide}>
          {rest.map((screen) => (
            <View key={screen.id} style={st.featuredSideItem}>
              <MultiScreenPlayer screen={screen} onOpenMenu={setMenuScreenId} onTileFocus={handleTileFocus} theme={theme} />
            </View>
          ))}
        </View>
      </View>
    );
  } else if (screens.length === 2) {
    body = (
      <View style={st.rowWrap}>
        {screens.map((screen, index) => (
          <View key={screen.id} style={st.rowItem}>
            <MultiScreenPlayer screen={screen} onOpenMenu={setMenuScreenId} onTileFocus={handleTileFocus} theme={theme} preferredFocus={index === 0} />
          </View>
        ))}
      </View>
    );
  } else {
    body = (
      <View style={st.gridWrap}>
        {screens.map((screen, index) => (
          <View key={screen.id} style={st.gridItem}>
            <MultiScreenPlayer screen={screen} onOpenMenu={setMenuScreenId} onTileFocus={handleTileFocus} theme={theme} preferredFocus={index === 0} />
          </View>
        ))}
        {canAddScreen && (
          <FocusableItem onPress={() => openPicker({ kind: 'add' })} style={[st.gridItem, st.addTile]} focusedStyle={focusedStyle}>
            <Text style={[st.addPlus, { color: theme.textSub }]}>＋</Text>
            <Text style={[st.addTxt, { color: theme.textMuted }]}>Add Screen</Text>
          </FocusableItem>
        )}
      </View>
    );
  }

  return (
    <View style={st.root}>
      {body}

      {headerVisible && <View style={st.topBar}>
        <View style={st.topTitle}>
          <Text style={st.titleTxt}>MULTI VIEW</Text>
          <Text style={st.hintTxt}>
            {screens.length} channels · OK for tile options · Back to {fullscreenScreen ? 'grid' : 'exit'}
          </Text>
        </View>
        <View style={st.topActions}>
          {fullscreenScreen ? (
            <FocusableItem ref={headerFirstRef} onPress={() => setFullscreenScreen(null)} onFocus={handleHeaderFocus} onBlur={handleHeaderBlur} style={st.topBtn} focusedStyle={focusedStyle}>
              <Text style={st.topBtnTxt}>Back to grid</Text>
            </FocusableItem>
          ) : (
            <FocusableItem
              ref={headerFirstRef}
              onPress={() => setLayout(layout === 'grid' ? 'split' : 'grid')}
              onFocus={handleHeaderFocus}
              onBlur={handleHeaderBlur}
              style={st.topBtn}
              focusedStyle={focusedStyle}
            >
              <Text style={st.topBtnTxt}>{layout === 'grid' ? 'Grid' : 'Split'} layout</Text>
            </FocusableItem>
          )}
          {!fullscreenScreen && canAddScreen && (
            <FocusableItem onPress={() => openPicker({ kind: 'add' })} onFocus={handleHeaderFocus} onBlur={handleHeaderBlur} style={st.topBtn} focusedStyle={focusedStyle}>
              <Text style={st.topBtnTxt}>+ Add channel</Text>
            </FocusableItem>
          )}
          <FocusableItem onPress={onOpenControls} onFocus={handleHeaderFocus} onBlur={handleHeaderBlur} style={st.topBtn} focusedStyle={focusedStyle}>
            <Text style={st.topBtnTxt}>Manage</Text>
          </FocusableItem>
          <FocusableItem onPress={clearAllScreens} onFocus={handleHeaderFocus} onBlur={handleHeaderBlur} style={st.topBtnDanger} focusedStyle={focusedStyle}>
            <Text style={st.topBtnDangerTxt}>Exit multi view</Text>
          </FocusableItem>
        </View>
      </View>}

      {/* ── Per-screen context menu ─────────────────────────────────────────── */}
      <Modal visible={!!menuScreen} transparent animationType="fade" onRequestClose={() => setMenuScreenId(null)}>
        <View style={st.backdrop}>
          <View style={st.menuCard}>
            <Text style={st.menuTitle} numberOfLines={1}>{menuScreen?.channel.name}</Text>

            <FocusableItem
              onPress={() => { if (menuScreen) openPicker({ kind: 'replace', screenId: menuScreen.id }); setMenuScreenId(null); }}
              hasTVPreferredFocus
              style={st.menuItem}
              focusedStyle={focusedStyle}
            >
              <Text style={st.menuItemTxt}>Change channel</Text>
            </FocusableItem>

            <FocusableItem
              onPress={() => {
                if (!menuScreen) return;
                if (featuredScreenId === menuScreen.id) {
                  setLayout('grid');
                } else {
                  setLayout('split');
                  setFeaturedScreen(menuScreen.id);
                }
                setMenuScreenId(null);
              }}
              style={st.menuItem}
              focusedStyle={focusedStyle}
            >
              <Text style={st.menuItemTxt}>
                {menuScreen && featuredScreenId === menuScreen.id ? 'Equal size' : 'Make main screen'}
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

      <Modal visible={!!pickerTarget} transparent animationType="fade" onRequestClose={() => setPickerTarget(null)}>
        <View style={st.backdrop}>
          <View style={st.pickerCard}>
            <Text style={st.menuTitle}>{pickerTarget?.kind === 'add' ? 'Add a channel' : 'Change channel'}</Text>
            <TextInput
              value={channelQuery}
              onChangeText={setChannelQuery}
              placeholder="Search channels"
              placeholderTextColor={theme.textMuted}
              style={st.searchInput}
            />
            <ScrollView style={st.pickerList} keyboardShouldPersistTaps="handled">
              {pickerChannels.map((ch, index) => (
                <FocusableItem
                  key={ch.id}
                  hasTVPreferredFocus={index === 0}
                  onPress={() => selectPickerChannel(ch)}
                  style={st.pickerRow}
                  focusedStyle={focusedStyle}
                >
                  <Text style={st.pickerRowTxt} numberOfLines={1}>{ch.name}</Text>
                </FocusableItem>
              ))}
              {pickerChannels.length === 0 && <Text style={st.emptyTxt}>No matching channels</Text>}
            </ScrollView>
            <FocusableItem onPress={() => setPickerTarget(null)} style={st.menuClose} focusedStyle={focusedStyle}>
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
    position: 'absolute', top: 8, left: 8, right: 8, zIndex: 20, elevation: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    paddingHorizontal: 14, paddingVertical: 10, backgroundColor: 'rgba(10,10,10,0.88)',
    borderWidth: 1, borderColor: theme.border, borderRadius: 10,
  },
  topTitle: { flexShrink: 1 },
  titleTxt: { color: theme.text, fontSize: 18, fontWeight: '800', letterSpacing: 1 },
  hintTxt: { color: theme.textMuted, fontSize: 11, marginTop: 2 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topBtn: {
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8,
    backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border,
  },
  topBtnTxt: { color: theme.textSub, fontSize: 13, fontWeight: '700' },
  topBtnDanger: {
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8,
    backgroundColor: theme.card, borderWidth: 1, borderColor: theme.live,
  },
  topBtnDangerTxt: { color: theme.live, fontSize: 13, fontWeight: '700' },

  rowWrap: { flex: 1, flexDirection: 'row', padding: 6, gap: 6 },
  rowItem: { flex: 1 },

  gridWrap: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', padding: 6, gap: 6 },
  gridItem: { width: '49%', height: '49%' },
  addTile: {
    backgroundColor: theme.surface, borderWidth: 2, borderColor: theme.border,
    borderStyle: 'dashed', borderRadius: 6, justifyContent: 'center', alignItems: 'center',
  },
  addPlus: { fontSize: 30, fontWeight: '300' },
  addTxt: { fontSize: 12, marginTop: 4, fontWeight: '600' },

  featuredWrap: { flex: 1, flexDirection: 'row', padding: 6, gap: 6 },
  featuredMain: { flex: 2 },
  featuredSide: { flex: 1, gap: 6 },
  featuredSideItem: { flex: 1 },

  fullWrap: { flex: 1, padding: 6 },
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
  searchInput: {
    color: theme.text, fontSize: 14, paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 8,
  },
  pickerList: { maxHeight: 360 },
  emptyTxt: { color: theme.textMuted, textAlign: 'center', paddingVertical: 16 },
  pickerRow: {
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 8, marginBottom: 6,
    backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border,
  },
  pickerRowTxt: { color: theme.textSub, fontSize: 14, fontWeight: '600' },
});
