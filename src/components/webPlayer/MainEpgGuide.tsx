import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Channel, EPGProgram } from '../../types';
import ChannelLogo from './ChannelLogo';
import { fmtTime, progressPct } from './utils';
import { webPlayerStyles as s } from './styles';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const WebVideo = require('../player/WebVideo.web').default;

interface MainEpgGuideProps {
  channels: Channel[];
  currentChannel: Channel | null;
  isPlaying: boolean;
  showChannelNumbers: boolean;
  getProgramsForChannel: (channelId: string) => EPGProgram[];
  onClose: () => void;
  onChannelSelect: (channel: Channel) => void;
  onCatchupSelect: (channel: Channel, program: EPGProgram) => void;
}

const getVisiblePrograms = (programs: EPGProgram[]) => {
  const now = Date.now();
  return programs
    .filter((program) => {
      const endMs = program.end.getTime();
      const startMs = program.start.getTime();
      return endMs > now - 12 * 60 * 60 * 1000 && startMs < now + 18 * 60 * 60 * 1000;
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, 8);
};

const MainEpgGuide: React.FC<MainEpgGuideProps> = ({
  channels,
  currentChannel,
  isPlaying,
  showChannelNumbers,
  getProgramsForChannel,
  onClose,
  onChannelSelect,
  onCatchupSelect,
}) => {
  const rows = useMemo(
    () =>
      channels.map((channel) => ({
        channel,
        programs: getVisiblePrograms(getProgramsForChannel(channel.id)),
      })),
    [channels, getProgramsForChannel],
  );

  return (
    <View testID="web-main-epg" style={s.mainGuide}>
      <View style={s.mainGuideHeader}>
        <View style={s.mainGuideTitleBlock}>
          <Text style={s.mainGuideEyebrow}>EPG</Text>
          <Text style={s.mainGuideTitle}>Program Guide</Text>
        </View>

        {currentChannel ? (
          <View testID="web-main-epg-pip" style={s.mainGuidePip}>
            <WebVideo uri={currentChannel.url} isPlaying={isPlaying} />
          </View>
        ) : null}

        <TouchableOpacity testID="web-main-epg-close" onPress={onClose} style={s.mainGuideCloseBtn}>
          <Text style={s.mainGuideCloseTxt}>Close</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.mainGuideList}>
        {rows.length > 0 ? (
          rows.map(({ channel, programs }, index) => (
            <View
              key={channel.id}
              style={[
                s.mainGuideChannelRow,
                currentChannel?.id === channel.id && s.mainGuideChannelRowActive,
              ]}
            >
              <TouchableOpacity
                testID={`web-main-epg-channel-${channel.id}`}
                style={s.mainGuideChannelCell}
                onPress={() => onChannelSelect(channel)}
                activeOpacity={0.82}
              >
                {showChannelNumbers ? (
                  <Text style={s.mainGuideChannelNumber}>
                    {String(channel.number ?? index + 1).padStart(3, '0')}
                  </Text>
                ) : null}
                <ChannelLogo channel={channel} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={s.mainGuideChannelName} numberOfLines={1}>{channel.name}</Text>
                  {channel.group ? (
                    <Text style={s.mainGuideChannelGroup} numberOfLines={1}>{channel.group}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.mainGuideProgramRail}>
                {programs.length > 0 ? (
                  programs.map((program) => {
                    const now = Date.now();
                    const startMs = program.start.getTime();
                    const endMs = program.end.getTime();
                    const isNow = startMs <= now && now < endMs;
                    const isPast = endMs < now;
                    const hasCatchup = !!program.catchupUrl || !!program.catchupAvailable || !!channel.catchupAvailable;
                    const canPlayCatchup = isPast && hasCatchup;

                    return (
                      <TouchableOpacity
                        testID={`web-main-epg-program-${channel.id}-${program.id}`}
                        key={program.id}
                        disabled={!canPlayCatchup}
                        onPress={() => onCatchupSelect(channel, program)}
                        style={[
                          s.mainGuideProgramCard,
                          isNow && s.mainGuideProgramCardNow,
                          canPlayCatchup && s.mainGuideProgramCardCatchup,
                        ]}
                        activeOpacity={canPlayCatchup ? 0.82 : 1}
                      >
                        <View style={s.mainGuideTimeRow}>
                          <Text style={s.mainGuideTime}>
                            {fmtTime(program.start)} - {fmtTime(program.end)}
                          </Text>
                          {isNow ? (
                            <Text style={s.mainGuideNow}>NOW</Text>
                          ) : canPlayCatchup ? (
                            <Text style={s.mainGuideCatchup}>CATCHUP</Text>
                          ) : null}
                        </View>
                        <Text style={s.mainGuideProgramTitle} numberOfLines={2}>{program.title}</Text>
                        {isNow ? (
                          <View style={s.mainGuideTrack}>
                            <View
                              style={[
                                s.mainGuideFill,
                                { width: `${progressPct(program.start, program.end)}%` as any },
                              ]}
                            />
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <View style={s.mainGuideNoDataCard}>
                    <Text style={s.mainGuideEmptyText}>No guide data</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          ))
        ) : (
          <View style={s.mainGuideEmpty}>
            <Text style={s.mainGuideEmptyTitle}>No channels</Text>
            <Text style={s.mainGuideEmptyText}>Add a playlist to populate the guide.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default MainEpgGuide;
