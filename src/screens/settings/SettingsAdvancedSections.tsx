import React from 'react';
import { ActivityIndicator, Alert, Switch, Text, View } from 'react-native';
import FocusableItem from '../../components/FocusableItem';
import { Settings, SettingsFocusTarget } from '../../types';
import { showSuccess } from '../../utils/toast';
import { Card, Divider, RowBetween, SectionTitle, SettingRow } from './SettingsPrimitives';

interface SettingsAdvancedSectionsProps {
  styles: any;
  settings: Settings;
  updateSetting: (key: keyof Settings, value: any) => void;
  loading: boolean;
  infoBarTimeoutRef: React.RefObject<any>;
  epgRefreshRef: React.RefObject<any>;
  helpRemoteRef: React.RefObject<any>;
  shouldPreferFocus: (target: SettingsFocusTarget) => boolean;
  setSectionOffset: (key: SettingsFocusTarget | 'top', y: number) => void;
  setSleepTimer: (minutes: number) => void;
  hasPlayer: boolean;
  navigateToPlayer: () => void;
  manualRefreshing: boolean;
  onManualRefresh: () => void;
  setPinModalVisible: (visible: boolean) => void;
  focusedStyle: any;
  rowFocusedStyle: any;
}

export function SettingsAdvancedSections(props: SettingsAdvancedSectionsProps) {
  const { styles, settings, updateSetting, loading, infoBarTimeoutRef, epgRefreshRef, helpRemoteRef, shouldPreferFocus, setSectionOffset, setSleepTimer, hasPlayer, navigateToPlayer, manualRefreshing, onManualRefresh, setPinModalVisible, focusedStyle, rowFocusedStyle } = props;
  const infoBarOptions = [{ label: '3s', value: 3 }, { label: '6s', value: 6 }, { label: '10s', value: 10 }, { label: 'Never', value: 0 }];
  return <>
        <Divider styles={styles} />

        {/* ══ INTERFACE ═══════════════════════════════════ */}
        <View onLayout={(e) => setSectionOffset('interface', e.nativeEvent.layout.y)} />
        <SectionTitle styles={styles} label="Interface" />
        <Card styles={styles}>
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
                  focusedStyle={focusedStyle}
                >
                  <Text style={[styles.chipTxt, (settings.infoBarTimeoutSeconds ?? 6) === opt.value && styles.chipTxtActive]}>
                    {opt.label}
                  </Text>
                </FocusableItem>
              ))}
            </View>
          </View>
          <SettingRow styles={styles} rowFocusedStyle={rowFocusedStyle}
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
                  focusedStyle={focusedStyle}
                >
                  <Text style={[styles.chipTxt, (settings.clockFormat ?? '24h') === fmt && styles.chipTxtActive]}>
                    {fmt}
                  </Text>
                </FocusableItem>
              ))}
            </View>
          </View>
          <SettingRow styles={styles} rowFocusedStyle={rowFocusedStyle}
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

        <Divider styles={styles} />

        {/* ══ SLEEP TIMER ══════════════════════════════════ */}
        <SectionTitle styles={styles} label="Sleep Timer" />
        <Card styles={styles}>
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
                  if (hasPlayer) navigateToPlayer();
                  setTimeout(() => showSuccess(opt.min === 0 ? 'Sleep timer off.' : `Sleep timer set: ${opt.label}`), 100);
                }}
                style={styles.chip}
                focusedStyle={focusedStyle}
              >
                <Text style={styles.chipTxt}>{opt.label}</Text>
              </FocusableItem>
            ))}
          </View>
        </Card>

        <Divider styles={styles} />

        {/* ══ MULTI-SCREEN ════════════════════════════════ */}
        <SectionTitle styles={styles} label="Multi-Screen" />
        <Card styles={styles}>
          <SettingRow styles={styles} rowFocusedStyle={rowFocusedStyle}
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
                  focusedStyle={focusedStyle}
                >
                  <Text style={[styles.chipTxt, settings.maxMultiScreens === n && styles.chipTxtActive]}>{n}</Text>
                </FocusableItem>
              ))}
            </View>
          </View>
        </Card>

        <Divider styles={styles} />

        {/* ══ EPG ═════════════════════════════════════════ */}
        <View onLayout={(e) => setSectionOffset('epg', e.nativeEvent.layout.y)} />
        <SectionTitle styles={styles} label="EPG" />

        <Card styles={styles} style={{ marginBottom: 10 }}>
          <RowBetween styles={styles}>
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
                focusedStyle={focusedStyle}
              >
                <Text style={[styles.chipTxt, settings.epgRefreshIntervalMinutes === min && styles.chipTxtActive]}>
                  {min / 60}h
                </Text>
              </FocusableItem>
            ))}
          </View>
        </Card>

        <Card styles={styles} style={{ marginBottom: 10 }}>
          <RowBetween styles={styles}>
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
                focusedStyle={focusedStyle}
              >
                <Text style={[styles.chipTxt, settings.channelRefreshIntervalMinutes === min && styles.chipTxtActive]}>
                  {min / 60}h
                </Text>
              </FocusableItem>
            ))}
          </View>
        </Card>

        <FocusableItem
          onPress={onManualRefresh}
          style={[styles.refreshBtn, manualRefreshing && styles.refreshBtnDisabled]}
          focusedStyle={focusedStyle}
          disabled={manualRefreshing}
        >
          {manualRefreshing
            ? <ActivityIndicator size="small" color="#f5f5f5" style={{ marginRight: 10 }} />
            : null}
          <Text style={styles.refreshBtnTxt}>{manualRefreshing ? 'Refreshing…' : 'Refresh Now'}</Text>
        </FocusableItem>

        <Divider styles={styles} />

        {/* ══ PARENTAL LOCK ════════════════════════════════ */}
        <SectionTitle styles={styles} label="Parental Lock" />
        <Card styles={styles}>
          <SettingRow styles={styles} rowFocusedStyle={rowFocusedStyle}
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
                focusedStyle={focusedStyle}
              >
                <Text style={styles.changePinTxt}>Change PIN</Text>
              </FocusableItem>
            </View>
          )}
        </Card>

        <Divider styles={styles} />

        {/* ══ HELP ════════════════════════════════════════ */}
        <View onLayout={(e) => setSectionOffset('help', e.nativeEvent.layout.y)} />
        <SectionTitle styles={styles} label="Help" />

        <FocusableItem
          onPress={() => Alert.alert(
            'How to Add Playlists',
            'M3U Playlists:\n1. Get an M3U URL from your IPTV provider\n2. Tap "Add Playlist"\n3. Choose M3U, enter a name and paste the URL\n\nXtream Codes:\n1. Choose "Xtream Codes"\n2. Enter server URL, username, and password',
          )}
          style={[styles.card, styles.helpBtn]}
          focusedStyle={focusedStyle}
        >
          <Text style={styles.helpTitle}>How to Add Playlists</Text>
          <Text style={styles.helpArrow}>›</Text>
        </FocusableItem>

        <FocusableItem
          ref={helpRemoteRef}
          onPress={() => Alert.alert(
            'TV Remote Controls',
            'Navigation:\n• D-Pad: Move between items\n• Center/OK: Select\n• Back: Previous screen\n\nPlayer:\n• Center/OK: Open horizontal controls\n• D-Pad Up/Down: Switch channel\n• D-Pad Left: Open channel list\n• INFO key: Program details\n• Long press EPG block: Program details\n• Back: Open program guide',
          )}
          hasTVPreferredFocus={shouldPreferFocus('help')}
          style={[styles.card, styles.helpBtn]}
          focusedStyle={focusedStyle}
        >
          <Text style={styles.helpTitle}>TV Remote Controls</Text>
          <Text style={styles.helpArrow}>›</Text>
        </FocusableItem>

        <Divider styles={styles} />

        {/* ══ ABOUT ═══════════════════════════════════════ */}
        <SectionTitle styles={styles} label="About" />
        <Card styles={styles}>
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
  </>;
}
