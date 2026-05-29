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
    onPress={onPress}
    style={[
      s.channelRow,
      isCurrent && s.channelRowCurrent,
      isHighlighted && s.channelRowHighlighted,
    ]}
    activeOpacity={0.88}
  >
    {showChannelNumbers ? (
      <Text style={s.channelNumber}>
        {String(channel.number ?? index + 1).padStart(3, '0')}
      </Text>
    ) : null}
    <ChannelLogo channel={channel} size={52} />
    <View style={s.channelMeta}>
      <View style={s.channelTitleRow}>
        <Text style={[s.channelName, isCurrent && s.channelNameCurrent]} numberOfLines={1}>
          {channel.name}
        </Text>
        {isCurrent ? (
          <View style={s.liveBadge}>
            <Text style={s.liveBadgeTxt}>LIVE</Text>
          </View>
        ) : null}
      </View>
      <Text style={s.channelProgram} numberOfLines={1}>
        {currentProgram?.title ?? channel.group ?? 'No guide data'}
      </Text>
    </View>
  </TouchableOpacity>
);

export default ChannelRow;
