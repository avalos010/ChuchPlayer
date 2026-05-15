import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList, Channel, EPGProgram } from '../types';
import { usePlayerStore } from '../store/usePlayerStore';
import { useEPGManagement } from '../hooks/useEPGManagement';
import { useChannelInitialization } from '../hooks/useChannelInitialization';
import { getPlaylists, saveLastChannel } from '../utils/storage';

// Web-only HTML5 video player (resolved via Metro's .web.tsx extension)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const WebVideo = require('../components/player/WebVideo.web').default;

interface WebPlayerScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Player'>;
  route: RouteProp<RootStackParamList, 'Player'>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtTime = (d?: Date | null): string => {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const progressPct = (start?: Date | null, end?: Date | null): number => {
  if (!start || !end) return 0;
  const now = Date.now();
  const s = start.getTime();
  const e = end.getTime();
  if (now < s || now > e) return 0;
  return Math.min(100, ((now - s) / (e - s)) * 100);
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const ChannelRow: React.FC<{
  channel: Channel;
  isCurrent: boolean;
  currentProgram: EPGProgram | null;
  onPress: () => void;
}> = ({ channel, isCurrent, currentProgram, onPress }) => {
  const [imgErr, setImgErr] = useState(false);
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[s.chRow, isCurrent && s.chRowActive]}
      activeOpacity={0.7}
    >
      {channel.logo && !imgErr ? (
        <Image
          source={{ uri: channel.logo }}
          style={s.chLogo}
          resizeMode="contain"
          onError={() => setImgErr(true)}
        />
      ) : (
        <View style={[s.chLogoFallback, isCurrent && s.chLogoFallbackActive]}>
          <Text style={s.chInitials}>{channel.name.substring(0, 2).toUpperCase()}</Text>
        </View>
      )}
      <View style={s.chMeta}>
        <Text style={[s.chName, isCurrent && s.chNameActive]} numberOfLines={1}>
          {channel.name}
        </Text>
        {currentProgram ? (
          <Text style={s.chProg} numberOfLines={1}>{currentProgram.title}</Text>
        ) : channel.group ? (
          <Text style={s.chProg} numberOfLines={1}>{channel.group}</Text>
        ) : null}
      </View>
      {isCurrent && <View style={s.liveDot} />}
    </TouchableOpacity>
  );
};

const ProgramRow: React.FC<{ program: EPGProgram; isCurrent?: boolean }> = ({ program, isCurrent }) => {
  const ts = fmtTime(program.start);
  const te = fmtTime(program.end);
  const pct = isCurrent ? progressPct(program.start, program.end) : 0;
  return (
    <View style={[s.progRow, isCurrent && s.progRowCurrent]}>
      <View style={s.progTimeCol}>
        <Text style={[s.progTime, isCurrent && s.progTimeCurrent]}>{ts}</Text>
        <Text style={s.progTimeEnd}>–{te}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.progTitle, isCurrent && s.progTitleCurrent]} numberOfLines={1}>
          {program.title}
        </Text>
        {isCurrent && pct > 0 && (
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${pct}%` as any }]} />
          </View>
        )}
        {program.description ? (
          <Text style={s.progDesc} numberOfLines={isCurrent ? 2 : 1}>{program.description}</Text>
        ) : null}
      </View>
    </View>
  );
};

// ─── Main screen ──────────────────────────────────────────────────────────────

const WebPlayerScreen: React.FC<WebPlayerScreenProps> = ({ navigation, route }) => {
  const channel   = usePlayerStore((s) => s.channel);
  const channels  = usePlayerStore((s) => s.channels);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const loading   = usePlayerStore((s) => s.loading);
  const setChannel  = usePlayerStore((s) => s.setChannel);
  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying);
  const playlist  = usePlayerStore((s) => s.playlist);

  const { getProgramsForChannel, getCurrentProgram, epgLoading } = useEPGManagement();

  useChannelInitialization({
    initialChannel: route.params?.channel,
    getCurrentProgram,
  });

  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const [videoError, setVideoError] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Reset video error when channel changes
  useEffect(() => { setVideoError(false); }, [channel?.id]);

  const groups = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = ['All'];
    channels.forEach((ch) => { if (ch.group && !seen.has(ch.group)) { seen.add(ch.group); out.push(ch.group); } });
    return out;
  }, [channels]);

  const filteredChannels = useMemo(() => {
    if (selectedGroup === 'All') return channels;
    return channels.filter((ch) => ch.group === selectedGroup);
  }, [channels, selectedGroup]);

  const currentProgram  = channel ? getCurrentProgram(channel.id) : null;
  const allPrograms     = channel ? getProgramsForChannel(channel.id) : [];
  const upcomingPrograms = useMemo(() => {
    const now = new Date();
    return allPrograms
      .filter((p) => p.end > now && (!currentProgram || p.id !== currentProgram.id))
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 6);
  }, [allPrograms, currentProgram]);

  const handleChannelSelect = useCallback(async (ch: Channel) => {
    setChannel(ch);
    setIsPlaying(true);
    await saveLastChannel(ch);
  }, [setChannel, setIsPlaying]);

  const handleSettings = useCallback(() => {
    navigation.navigate('Settings');
  }, [navigation]);

  // ── No playlist state ────────────────────────────────────────────────────
  if (!playlist && channels.length === 0) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyTitle}>No playlist loaded</Text>
        <Text style={s.emptyDesc}>Add a playlist in Settings to get started.</Text>
        <TouchableOpacity style={s.emptyBtn} onPress={handleSettings}>
          <Text style={s.emptyBtnTxt}>Open Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.root}>

      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => setSidebarOpen((v) => !v)} style={s.menuBtn}>
          <Text style={s.menuIcon}>☰</Text>
        </TouchableOpacity>
        <Text style={s.brandName}>ChuchPlayer</Text>
        {playlist && (
          <Text style={s.playlistName} numberOfLines={1}>{playlist.name}</Text>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.groupScroll}>
          {groups.map((g) => (
            <TouchableOpacity
              key={g}
              onPress={() => setSelectedGroup(g)}
              style={[s.groupTab, selectedGroup === g && s.groupTabActive]}
            >
              <Text style={[s.groupTabTxt, selectedGroup === g && s.groupTabTxtActive]}>
                {g}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity onPress={handleSettings} style={s.settingsBtn}>
          <Text style={s.settingsIcon}>⚙</Text>
        </TouchableOpacity>
      </View>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <View style={s.body}>

        {/* Sidebar: channel list */}
        {sidebarOpen && (
          <View style={s.sidebar}>
            <View style={s.sidebarHeader}>
              <Text style={s.sidebarTitle}>{selectedGroup}</Text>
              <Text style={s.sidebarCount}>{filteredChannels.length} ch</Text>
            </View>
            <ScrollView style={s.sidebarList} showsVerticalScrollIndicator={false}>
              {filteredChannels.map((ch) => (
                <ChannelRow
                  key={ch.id}
                  channel={ch}
                  isCurrent={ch.id === channel?.id}
                  currentProgram={ch.id === channel?.id ? currentProgram : null}
                  onPress={() => handleChannelSelect(ch)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Main: video + EPG timeline */}
        <View style={s.main}>
          {/* Video area */}
          <View style={s.videoWrap}>
            {!channel ? (
              <View style={s.videoPlaceholder}>
                <Text style={s.videoPlaceholderIcon}>📺</Text>
                <Text style={s.videoPlaceholderTxt}>Select a channel to start watching</Text>
              </View>
            ) : videoError ? (
              <View style={s.videoPlaceholder}>
                <Text style={s.videoPlaceholderIcon}>⚠</Text>
                <Text style={s.videoPlaceholderTxt}>Stream unavailable</Text>
                <Text style={s.videoPlaceholderSub}>{channel.url}</Text>
              </View>
            ) : (
              <WebVideo
                uri={channel.url}
                isPlaying={isPlaying}
                onError={() => setVideoError(true)}
                onLoad={() => setIsPlaying(true)}
              />
            )}

            {loading && (
              <View style={s.videoLoading}>
                <ActivityIndicator size="large" color="#f5f5f5" />
              </View>
            )}
          </View>

          {/* Video footer: channel name + controls */}
          {channel && (
            <View style={s.videoFooter}>
              <View style={{ flex: 1 }}>
                <Text style={s.footerChName} numberOfLines={1}>{channel.name}</Text>
                {currentProgram && (
                  <Text style={s.footerProgName} numberOfLines={1}>{currentProgram.title}</Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => setIsPlaying(!isPlaying)}
                style={s.playBtn}
              >
                <Text style={s.playBtnIcon}>{isPlaying ? '⏸' : '▶'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* EPG timeline for current channel */}
          {channel && allPrograms.length > 0 && (
            <View style={s.timeline}>
              <Text style={s.timelineLabel}>GUIDE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.timelineScroll}>
                {allPrograms.slice(0, 12).map((p) => {
                  const isNow = p.start <= new Date() && p.end > new Date();
                  const pct = isNow ? progressPct(p.start, p.end) : 0;
                  return (
                    <View key={p.id} style={[s.timelineSlot, isNow && s.timelineSlotNow]}>
                      <Text style={[s.timelineTime, isNow && s.timelineTimeNow]}>
                        {fmtTime(p.start)}
                      </Text>
                      <Text style={[s.timelineTitle, isNow && s.timelineTitleNow]} numberOfLines={2}>
                        {p.title}
                      </Text>
                      {isNow && pct > 0 && (
                        <View style={s.timelineTrack}>
                          <View style={[s.timelineFill, { width: `${pct}%` as any }]} />
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {epgLoading && (
            <View style={s.epgLoadingBar}>
              <ActivityIndicator size="small" color="#555" />
              <Text style={s.epgLoadingTxt}>Loading guide data…</Text>
            </View>
          )}
        </View>

        {/* Right panel: now playing + up next */}
        {channel && (
          <View style={s.rightPanel}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Channel header */}
              <View style={s.rpChHeader}>
                <View style={s.rpDot} />
                <Text style={s.rpChName} numberOfLines={2}>{channel.name}</Text>
              </View>

              {currentProgram ? (
                <>
                  <Text style={s.rpSectionLabel}>NOW PLAYING</Text>
                  <ProgramRow program={currentProgram} isCurrent />
                </>
              ) : (
                <Text style={s.rpNoInfo}>No program info available</Text>
              )}

              {upcomingPrograms.length > 0 && (
                <>
                  <View style={s.rpDivider} />
                  <Text style={s.rpSectionLabel}>UP NEXT</Text>
                  {upcomingPrograms.map((p) => (
                    <ProgramRow key={p.id} program={p} />
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  );
};

export default WebPlayerScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────

const SIDEBAR_W = 280;
const RIGHT_W   = 300;
const TOPBAR_H  = 52;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a', overflow: 'hidden' as any },

  // Top bar
  topBar: {
    height: TOPBAR_H,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d0d0d',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    paddingHorizontal: 12,
    gap: 10,
  },
  menuBtn: {
    width: 36, height: 36, justifyContent: 'center', alignItems: 'center',
    borderRadius: 8, backgroundColor: '#161616',
  },
  menuIcon: { color: '#8a8a8a', fontSize: 16 },
  brandName: { color: '#f5f5f5', fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  playlistName: { color: '#3d3d3d', fontSize: 12, fontWeight: '500', maxWidth: 160 },
  groupScroll: { flex: 1 },
  groupTab: {
    paddingHorizontal: 14, paddingVertical: 6, marginRight: 4, borderRadius: 20,
    backgroundColor: '#161616', borderWidth: 1, borderColor: '#1f1f1f',
  },
  groupTabActive: { backgroundColor: '#f5f5f5', borderColor: '#f5f5f5' },
  groupTabTxt:   { color: '#555555', fontSize: 12, fontWeight: '600' },
  groupTabTxtActive: { color: '#0a0a0a' },
  settingsBtn: {
    width: 36, height: 36, justifyContent: 'center', alignItems: 'center',
    borderRadius: 8, backgroundColor: '#161616',
  },
  settingsIcon: { color: '#8a8a8a', fontSize: 16 },

  // Body — minHeight: 0 is the CSS trick that lets flex children scroll
  body: { flex: 1, flexDirection: 'row', minHeight: 0 as any, overflow: 'hidden' as any },

  // Sidebar
  sidebar: {
    width: SIDEBAR_W,
    minHeight: 0 as any,
    backgroundColor: '#0d0d0d',
    borderRightWidth: 1,
    borderRightColor: '#1a1a1a',
    display: 'flex' as any,
    flexDirection: 'column',
  },
  sidebarHeader: {
    flexShrink: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  sidebarTitle: { color: '#f5f5f5', fontSize: 13, fontWeight: '700' },
  sidebarCount: { color: '#3d3d3d', fontSize: 11 },
  sidebarList: { flex: 1, minHeight: 0 as any },

  // Channel rows
  chRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  chRowActive: { backgroundColor: '#161616', borderLeftWidth: 2, borderLeftColor: '#f5f5f5' },
  chLogo: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#181818' },
  chLogoFallback: {
    width: 44, height: 44, borderRadius: 8, backgroundColor: '#181818',
    borderWidth: 1, borderColor: '#222', justifyContent: 'center', alignItems: 'center',
  },
  chLogoFallbackActive: { backgroundColor: '#1f1f1f' },
  chInitials: { color: '#3d3d3d', fontSize: 13, fontWeight: '800' },
  chMeta: { flex: 1 },
  chName: { color: '#6a6a6a', fontSize: 13, fontWeight: '600', marginBottom: 2 },
  chNameActive: { color: '#f5f5f5' },
  chProg: { color: '#333', fontSize: 11, fontWeight: '400' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#f5f5f5' },

  // Main area
  main: { flex: 1, flexDirection: 'column', minHeight: 0 as any, overflow: 'hidden' as any },
  videoWrap: {
    aspectRatio: 16 / 9,
    flexShrink: 0,
    backgroundColor: '#000',
    position: 'relative' as any,
  },
  videoPlaceholder: {
    flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10,
  },
  videoPlaceholderIcon: { fontSize: 48 },
  videoPlaceholderTxt: { color: '#4a4a4a', fontSize: 15, fontWeight: '600' },
  videoPlaceholderSub: { color: '#2a2a2a', fontSize: 11 },
  videoLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },

  // Video footer
  videoFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#0d0d0d', borderTopWidth: 1, borderTopColor: '#1a1a1a',
  },
  footerChName: { color: '#f5f5f5', fontSize: 14, fontWeight: '700' },
  footerProgName: { color: '#555', fontSize: 12, marginTop: 2 },
  playBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5f5f5',
    justifyContent: 'center', alignItems: 'center',
  },
  playBtnIcon: { fontSize: 16, color: '#0a0a0a' },

  // EPG timeline
  timeline: {
    flexShrink: 0,
    borderTopWidth: 1, borderTopColor: '#1a1a1a',
    backgroundColor: '#0a0a0a', paddingTop: 10,
  },
  timelineLabel: {
    color: '#2a2a2a', fontSize: 10, fontWeight: '700', letterSpacing: 2,
    paddingHorizontal: 14, marginBottom: 8,
  },
  timelineScroll: { paddingHorizontal: 10, paddingBottom: 10 },
  timelineSlot: {
    width: 140, marginRight: 8, padding: 10,
    backgroundColor: '#111', borderRadius: 8,
    borderWidth: 1, borderColor: '#1a1a1a',
  },
  timelineSlotNow: {
    backgroundColor: '#f5f5f5', borderColor: '#f5f5f5',
  },
  timelineTime: { color: '#3d3d3d', fontSize: 10, fontWeight: '600', marginBottom: 4 },
  timelineTimeNow: { color: '#555' },
  timelineTitle: { color: '#555', fontSize: 12, fontWeight: '600' },
  timelineTitleNow: { color: '#0a0a0a' },
  timelineTrack: {
    height: 2, backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 1,
    marginTop: 8, overflow: 'hidden',
  },
  timelineFill: { height: '100%', backgroundColor: '#333', borderRadius: 1 },

  // EPG loading indicator
  epgLoadingBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, borderTopWidth: 1, borderTopColor: '#1a1a1a',
  },
  epgLoadingTxt: { color: '#3d3d3d', fontSize: 11 },

  // Right panel
  rightPanel: {
    width: RIGHT_W, backgroundColor: '#0d0d0d',
    borderLeftWidth: 1, borderLeftColor: '#1a1a1a',
    padding: 16, minHeight: 0 as any,
  },
  rpChHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  rpDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#f5f5f5' },
  rpChName: { flex: 1, color: '#f5f5f5', fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  rpSectionLabel: {
    color: '#2a2a2a', fontSize: 9, fontWeight: '700', letterSpacing: 2.5,
    marginBottom: 10, marginTop: 4,
  },
  rpNoInfo: { color: '#2a2a2a', fontSize: 12, paddingVertical: 8 },
  rpDivider: { height: 1, backgroundColor: '#1a1a1a', marginVertical: 16 },

  // Program rows (in right panel)
  progRow: {
    flexDirection: 'row', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#111',
  },
  progRowCurrent: { backgroundColor: '#111', borderRadius: 8, padding: 10, borderBottomWidth: 0 },
  progTimeCol: { width: 52, alignItems: 'flex-end' },
  progTime: { color: '#3d3d3d', fontSize: 11, fontWeight: '600' },
  progTimeCurrent: { color: '#f5f5f5' },
  progTimeEnd: { color: '#222', fontSize: 10 },
  progTitle: { color: '#555', fontSize: 12, fontWeight: '600', marginBottom: 3 },
  progTitleCurrent: { color: '#f5f5f5', fontSize: 13 },
  progDesc: { color: '#2a2a2a', fontSize: 11, lineHeight: 16 },
  progressTrack: {
    height: 2, backgroundColor: '#1f1f1f', borderRadius: 1, marginTop: 6, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#e5e5e5', borderRadius: 1 },

  // Empty state
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: '#0a0a0a' },
  emptyTitle: { color: '#f5f5f5', fontSize: 20, fontWeight: '800' },
  emptyDesc: { color: '#3d3d3d', fontSize: 14 },
  emptyBtn: {
    marginTop: 8, paddingHorizontal: 24, paddingVertical: 12,
    backgroundColor: '#f5f5f5', borderRadius: 10,
  },
  emptyBtnTxt: { color: '#0a0a0a', fontSize: 14, fontWeight: '700' },
});
