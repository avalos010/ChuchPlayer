import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Channel, EPGProgram } from '../../types';
import { fmtTime, progressPct } from './utils';
import { webPlayerStyles as s } from './styles';

interface SidebarGuideProps {
  channel: Channel | null;
  programs: EPGProgram[];
  onCatchupSelect: (channel: Channel, program: EPGProgram) => void;
}

const SidebarGuide: React.FC<SidebarGuideProps> = ({ channel, programs, onCatchupSelect }) => {
  const visiblePrograms = useMemo(() => {
    const now = Date.now();
    return programs
      .filter((program) => {
        const endMs = program.end.getTime();
        const startMs = program.start.getTime();
        return endMs > now - 12 * 60 * 60 * 1000 && startMs < now + 12 * 60 * 60 * 1000;
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 24);
  }, [programs]);

  if (!channel) return null;

  return (
    <View style={s.sidebarGuide}>
      <View style={s.sidebarGuideHeader}>
        <Text style={s.sidebarGuideEyebrow}>EPG</Text>
        <Text style={s.sidebarGuideTitle} numberOfLines={1}>{channel.name}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.sidebarGuideList}>
        {visiblePrograms.length > 0 ? (
          visiblePrograms.map((program) => {
            const now = Date.now();
            const startMs = program.start.getTime();
            const endMs = program.end.getTime();
            const isNow = startMs <= now && now < endMs;
            const isPast = endMs < now;
            const hasCatchup = !!program.catchupUrl || !!program.catchupAvailable || !!channel.catchupAvailable;
            const canPlayCatchup = isPast && hasCatchup;

            return (
              <TouchableOpacity
                key={program.id}
                disabled={!canPlayCatchup}
                onPress={() => onCatchupSelect(channel, program)}
                style={[
                  s.sidebarGuideItem,
                  isNow && s.sidebarGuideItemNow,
                  canPlayCatchup && s.sidebarGuideItemCatchup,
                ]}
                activeOpacity={canPlayCatchup ? 0.82 : 1}
              >
                <View style={s.sidebarGuideTimeRow}>
                  <Text style={s.sidebarGuideTime}>
                    {fmtTime(program.start)} - {fmtTime(program.end)}
                  </Text>
                  {isNow ? (
                    <Text style={s.sidebarGuideNow}>NOW</Text>
                  ) : canPlayCatchup ? (
                    <Text style={s.sidebarGuideCatchup}>CATCHUP</Text>
                  ) : null}
                </View>
                <Text style={s.sidebarGuideProgramTitle} numberOfLines={2}>{program.title}</Text>
                {program.description ? (
                  <Text style={s.sidebarGuideDesc} numberOfLines={2}>{program.description}</Text>
                ) : null}
                {isNow ? (
                  <View style={s.sidebarGuideTrack}>
                    <View
                      style={[
                        s.sidebarGuideFill,
                        { width: `${progressPct(program.start, program.end)}%` as any },
                      ]}
                    />
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={s.sidebarGuideEmpty}>
            <Text style={s.sidebarGuideEmptyTitle}>No guide data</Text>
            <Text style={s.sidebarGuideEmptyText}>This channel does not have EPG data yet.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default SidebarGuide;
