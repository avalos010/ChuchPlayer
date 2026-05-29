import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Channel, EPGProgram } from '../../types';
import ChannelRow from './ChannelRow';
import { webPlayerStyles as s } from './styles';

interface SidebarPanelProps {
  groups: string[];
  selectedGroup: string;
  filteredChannels: Channel[];
  currentChannelId?: string;
  highlightedChannelId: string | null;
  showChannelNumbers: boolean;
  onGroupSelect: (group: string) => void;
  onChannelSelect: (channel: Channel) => void;
  getCurrentProgram: (channelId: string) => EPGProgram | null;
}

const SidebarPanel: React.FC<SidebarPanelProps> = ({
  groups,
  selectedGroup,
  filteredChannels,
  currentChannelId,
  highlightedChannelId,
  showChannelNumbers,
  onGroupSelect,
  onChannelSelect,
  getCurrentProgram,
}) => {
  const [showGroups, setShowGroups] = useState(false);

  return (
    <View testID="web-sidebar" style={s.sidebar}>
      <View style={s.sidebarHeaderRow}>
        <View style={s.sidebarHeader}>
          <Text style={s.sidebarHeading}>TV</Text>
          <Text style={s.sidebarSub}>{filteredChannels.length} channels</Text>
        </View>
        <TouchableOpacity
          testID="web-groups-button"
          onPress={() => setShowGroups((value) => !value)}
          style={[s.groupsToggleBtn, showGroups && s.groupsToggleBtnActive]}
        >
          <Text style={[s.groupsToggleTxt, showGroups && s.groupsToggleTxtActive]}>Groups</Text>
        </TouchableOpacity>
      </View>

      <View style={s.sidebarBody}>
        {showGroups ? (
          <View testID="web-group-rail" style={s.groupRail}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.groupRailScroll}>
              {groups.map((group) => {
                const active = selectedGroup === group;
                return (
                  <TouchableOpacity
                    testID={`web-group-${group.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}
                    key={group}
                    onPress={() => {
                      onGroupSelect(group);
                      setShowGroups(false);
                    }}
                    style={[s.groupRailItem, active && s.groupRailItemActive]}
                  >
                    <Text style={[s.groupRailTxt, active && s.groupRailTxtActive]} numberOfLines={2}>
                      {group}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <ScrollView style={s.channelList} showsVerticalScrollIndicator={false}>
          {filteredChannels.map((channel, index) => (
            <ChannelRow
              key={channel.id}
              channel={channel}
              index={index}
              isCurrent={channel.id === currentChannelId}
              isHighlighted={channel.id === highlightedChannelId}
              currentProgram={getCurrentProgram(channel.id)}
              showChannelNumbers={showChannelNumbers}
              onPress={() => onChannelSelect(channel)}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

export default SidebarPanel;
