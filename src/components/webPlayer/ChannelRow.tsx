import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Channel, EPGProgram } from '../../types';
import ChannelLogo from './ChannelLogo';
import { webPlayerStyles as s } from './styles';

interface ChannelRowProps {
  channel: Channel;
  index: number;
  isCurrent: boolean;
  isHighlighted: boolean;
  currentProgram: EPGProgram | null;
  showChannelNumbers: boolean;
  onPress: () => void;
}

const ChannelRow: React.FC<ChannelRowProps> = ({
  channel,
  index,
  isCurrent,
  isHighlighted,
  currentProgram,
  showChannelNumbers,
  onPress,
}) => (
  <TouchableOpacity
    testID={`web-channel-row-${channel.id}`}
    onPress={onPress}
    style={[
      s.channelRow,
      isCurrent && s.channelRowCurrent,
      isHighlighted && s.channelRowHighlighted,
    ]}
    activeOpacity={0.88}
  >
    <View
      style={[
        s.channelSelectionRail,
        (isCurrent || isHighlighted) && s.channelSelectionRailActive,
      ]}
    />
    {showChannelNumbers ? (
      <Text style={[s.channelNumber, isHighlighted && s.channelNumberHighlighted]}>
        {String(channel.number ?? index + 1).padStart(3, '0')}
      </Text>
    ) : null}
    <ChannelLogo channel={channel} size={52} />
    <View style={s.channelMeta}>
      <View style={s.channelTitleRow}>
        <Text
          style={[
            s.channelName,
            isCurrent && s.channelNameCurrent,
            isHighlighted && s.channelNameHighlighted,
          ]}
          numberOfLines={1}
        >
          {channel.name}
        </Text>
        {isCurrent ? (
          <View style={s.liveBadge}>
            <View style={s.liveBadgeDot} />
            <Text style={s.liveBadgeTxt}>LIVE</Text>
          </View>
        ) : null}
      </View>
      <Text style={[s.channelProgram, isHighlighted && s.channelProgramHighlighted]} numberOfLines={1}>
        {currentProgram?.title ?? channel.group ?? 'No guide data'}
      </Text>
    </View>
  </TouchableOpacity>
);

export default ChannelRow;
