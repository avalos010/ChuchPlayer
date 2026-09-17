import React from 'react';
import { ActivityIndicator, FlatList, Switch, Text, TextInput, View } from 'react-native';
import FocusableItem from '../../components/FocusableItem';
import { Playlist, Settings, SettingsFocusTarget } from '../../types';
import { THEME_LIST } from '../../theme/themes';
import { showError, showSuccess } from '../../utils/toast';
import { Card, Divider, SectionTitle, SettingRow } from './SettingsPrimitives';

interface SettingsPrimarySectionsProps {
  styles: any;
  settings: Settings;
  playlists: Playlist[];
  loadingPlaylists: boolean;
  renderPlaylistItem: ({ item }: { item: Playlist }) => React.ReactElement;
  onAddPlaylist: () => void;
  addPlaylistRef: React.RefObject<any>;
  shouldPreferFocus: (target: SettingsFocusTarget) => boolean;
  setSectionOffset: (key: SettingsFocusTarget | 'top', y: number) => void;
  themeId: string;
  setTheme: (id: string) => void;
  setCustomAccentInput: (value: string) => void;
  setCustomBgInput: (value: string) => void;
  customAccentInput: string;
  customBgInput: string;
  setCustom: (bg: string, accent: string) => void;
  resetTheme: () => void;
  updateSetting: (key: keyof Settings, value: any) => void;
  loading: boolean;
  focusedStyle: any;
  rowFocusedStyle: any;
}

export function SettingsPrimarySections(props: SettingsPrimarySectionsProps) {
  const { styles, settings, playlists, loadingPlaylists, renderPlaylistItem, onAddPlaylist, addPlaylistRef, shouldPreferFocus, setSectionOffset, themeId, setTheme, setCustomAccentInput, setCustomBgInput, customAccentInput, customBgInput, setCustom, resetTheme, updateSetting, loading, focusedStyle, rowFocusedStyle } = props;
  return <>
        {/* ══ PLAYLISTS ═══════════════════════════════════ */}
        <SectionTitle styles={styles} label="Playlists" />

        {loadingPlaylists ? (
          <Card styles={styles} style={styles.centered}>
            <ActivityIndicator size="large" color="#555555" />
          </Card>
        ) : playlists.length === 0 ? (
          <Card styles={styles}>
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
            onPress={onAddPlaylist}
            hasTVPreferredFocus={shouldPreferFocus('addPlaylist')}
            style={styles.addBtn}
            focusedStyle={focusedStyle}
          >
            <Text style={styles.addBtnTxt}>+ Add Playlist</Text>
          </FocusableItem>
        </View>

        <Divider styles={styles} />

        {/* ══ APPEARANCE ══════════════════════════════════ */}
        <SectionTitle styles={styles} label="Appearance" />
        <Card styles={styles}>
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

        <Card styles={styles} style={{ marginTop: 0 }}>
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
              focusedStyle={focusedStyle}
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
              focusedStyle={focusedStyle}
            >
              <Text style={styles.chipTxt}>Reset</Text>
            </FocusableItem>
          </View>
        </Card>

        <Divider styles={styles} />

        {/* ══ PLAYBACK ════════════════════════════════════ */}
        <SectionTitle styles={styles} label="Playback" />
        <Card styles={styles}>
          <SettingRow styles={styles} rowFocusedStyle={rowFocusedStyle}
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
          <SettingRow styles={styles} rowFocusedStyle={rowFocusedStyle}
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
                  focusedStyle={focusedStyle}
                >
                  <Text style={[styles.chipTxt, settings.bufferMode === opt.id && styles.chipTxtActive]}>
                    {opt.label}
                  </Text>
                </FocusableItem>
              ))}
            </View>
          </View>
        </Card>
  </>;
}
