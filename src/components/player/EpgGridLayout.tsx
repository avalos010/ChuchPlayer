import React from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { FlashList, ListRenderItemInfo } from '@shopify/flash-list';
import FocusableItem from '../FocusableItem';
import { Channel, EPGProgram } from '../../types';
import { Theme } from '../../theme/themes';
import NativeEpgGrid from './NativeEpgGrid';
import { EpgInfoPanel, FocusedInfo } from './EpgInfoPanel';
import { ChannelRowData, EpgGroupItem, GroupRail, TimeHeader } from './EpgGridParts';
import { GROUP_RAIL_W, HDR_BTN_FOCUSED, ROW_H, TV, s } from './EpgGridShared';

interface EpgGridLayoutProps {
  channel: Channel | null;
  channelData: ChannelRowData[];
  channels: Channel[];
  clockFormat: '12h' | '24h';
  epgError: string | null;
  epgLoading: boolean;
  filteredChannels: Channel[];
  flashRef: React.RefObject<FlashList<ChannelRowData> | null>;
  focusedId: string | null;
  focusedInfo: FocusedInfo | null;
  groups: EpgGroupItem[];
  handleClose: () => void;
  handleGroupSelect: (group: string) => void;
  handleManualEpgRefresh?: () => void;
  handleNativeChannelSelect: (channelId: string) => void;
  handleNativeOpenGroups: () => void;
  handleSettings: () => void;
  hasAnyData: boolean;
  horizontalScrollXRef: React.MutableRefObject<number>;
  hScrollRef: React.RefObject<ScrollView | null>;
  initFocusId: string | null;
  minTimelineX: number;
  nativeDataVersion: number;
  nativeGridFocusTrigger: number;
  onTimelineScroll: (x: number) => void;
  onViewableItemsChanged: ({ viewableItems }: { viewableItems: any[] }) => void;
  playlistId: string;
  playlistName?: string;
  renderItem: (info: ListRenderItemInfo<ChannelRowData>) => React.ReactElement;
  selectedGroup: string;
  setShowGroupRail: React.Dispatch<React.SetStateAction<boolean>>;
  closeGroupRail: () => void;
  showChannelNumbers: boolean;
  showGroupRail: boolean;
  syncTimelineScroll: (x: number, animated?: boolean) => void;
  theme: Theme;
  timePos: number;
  timelineScrollX: number;
  useNativeGrid: boolean;
  buildFocusedInfo: (channelId: string) => FocusedInfo | null;
}

export function EpgGridLayout({
  channel, channelData, channels, clockFormat, epgError, epgLoading, filteredChannels, flashRef, focusedId, focusedInfo, groups, handleClose, handleGroupSelect, handleManualEpgRefresh, handleNativeChannelSelect, handleNativeOpenGroups, handleSettings, hasAnyData, horizontalScrollXRef, hScrollRef, initFocusId, minTimelineX, nativeDataVersion, nativeGridFocusTrigger, onTimelineScroll, onViewableItemsChanged, playlistId, playlistName, renderItem, selectedGroup, setShowGroupRail, closeGroupRail, showChannelNumbers, showGroupRail, syncTimelineScroll, theme, timePos, timelineScrollX, useNativeGrid, buildFocusedInfo,
}: EpgGridLayoutProps) {
  return <View style={s.root}>
    <EpgInfoPanel info={focusedInfo ?? (channel ? buildFocusedInfo(channel.id) : null)} channel={channel} channels={channels} theme={theme} showChannelNumbers={showChannelNumbers} clockFormat={clockFormat} />
    {epgLoading && !hasAnyData && <View pointerEvents="none" style={s.loadingOverlay}><ActivityIndicator size="large" color="#555555" /><Text style={s.loadingTxt}>Loading program guide…</Text></View>}
    {epgLoading && hasAnyData && <View pointerEvents="none" style={s.loadingBadge}><ActivityIndicator size="small" color="#888" /><Text style={s.loadingBadgeTxt}>Updating guide…</Text></View>}
    <View style={s.header}>
      <View style={{ flex: 1 }}><Text style={s.headerTitle}>Program Guide</Text>{playlistName ? <Text style={s.headerSub}>{playlistName}</Text> : null}</View>
      <View style={s.headerBtns}>
        {groups.length > 1 && <FocusableItem onPress={() => setShowGroupRail(true)} style={s.hBtn} focusedStyle={HDR_BTN_FOCUSED}><Text style={s.hBtnIcon}>☰</Text></FocusableItem>}
        {handleManualEpgRefresh && !epgLoading && <FocusableItem onPress={handleManualEpgRefresh} style={s.hBtn} focusedStyle={HDR_BTN_FOCUSED}><Text style={s.hBtnIcon}>↺</Text></FocusableItem>}
        <FocusableItem onPress={handleSettings} style={s.hBtn} focusedStyle={HDR_BTN_FOCUSED}><Text style={s.hBtnIcon}>⚙</Text></FocusableItem>
        <FocusableItem onPress={handleClose} style={[s.hBtn, s.hBtnClose]} focusedStyle={HDR_BTN_FOCUSED}><Text style={[s.hBtnIcon, { color: '#737373' }]}>✕</Text></FocusableItem>
      </View>
    </View>
    {showGroupRail && groups.length > 1 ? <GroupRail groups={groups} selectedGroup={selectedGroup} onSelect={handleGroupSelect} onClose={closeGroupRail} /> : null}
    {!epgLoading && epgError && <View pointerEvents="none" style={s.errBanner}><Text style={s.errTxt}>⚠  {epgError}</Text></View>}
    <View style={[s.gridWrap, showGroupRail && { marginLeft: GROUP_RAIL_W }]}>
      {useNativeGrid ? <NativeEpgGrid style={{ flex: 1 }} playlistId={playlistId} channels={filteredChannels} currentChannelId={channel?.id} accentColor={theme.accent} bgColor={theme.bg} dataVersion={nativeDataVersion} focusTrigger={nativeGridFocusTrigger} guideLoading={epgLoading} onChannelSelect={handleNativeChannelSelect} onOpenGroups={handleNativeOpenGroups} /> : <>
        <ScrollView ref={hScrollRef} style={{ flex: 1 }} horizontal showsHorizontalScrollIndicator={false} scrollEventThrottle={16} onScroll={(event) => {
          const x = event.nativeEvent.contentOffset.x;
          if (x < minTimelineX) { syncTimelineScroll(minTimelineX, false); return; }
          horizontalScrollXRef.current = x;
          onTimelineScroll(x);
        }} onScrollEndDrag={(event) => { if (event.nativeEvent.contentOffset.x < minTimelineX) syncTimelineScroll(minTimelineX, true); }} onMomentumScrollEnd={(event) => { if (event.nativeEvent.contentOffset.x < minTimelineX) syncTimelineScroll(minTimelineX, true); }}>
          <View style={{ flex: 1 }}><TimeHeader currentTimePosition={timePos} timelineScrollX={timelineScrollX} /><View style={{ flex: 1 }}><FlashList ref={flashRef} data={channelData} renderItem={renderItem} keyExtractor={(item) => item.channel.id} estimatedItemSize={ROW_H} extraData={{ focusedId, initFocusId, timePos, timelineScrollX, showChannelNumbers, clockFormat }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" nestedScrollEnabled={TV} onViewableItemsChanged={onViewableItemsChanged} viewabilityConfig={{ itemVisiblePercentThreshold: 40, minimumViewTime: 250 }} /></View></View>
        </ScrollView>
        {TV && !showGroupRail && groups.length > 1 ? <FocusableItem onPress={() => setShowGroupRail(true)} onFocus={() => setShowGroupRail(true)} style={s.leftGroupHotspot} focusedStyle={HDR_BTN_FOCUSED}><View /></FocusableItem> : null}
      </>}
    </View>
  </View>;
}
