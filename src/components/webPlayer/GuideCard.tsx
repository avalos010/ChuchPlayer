import React from 'react';
import { View, Text } from 'react-native';
import { EPGProgram } from '../../types';
import { fmtTime, progressPct } from './utils';
import { webPlayerStyles as s } from './styles';

interface GuideCardProps {
  program: EPGProgram;
  active?: boolean;
}

const GuideCard: React.FC<GuideCardProps> = ({ program, active = false }) => {
  const pct = active ? progressPct(program.start, program.end) : 0;

  return (
    <View style={[s.guideCard, active && s.guideCardActive]}>
      <Text style={[s.guideTime, active && s.guideTimeActive]}>
        {fmtTime(program.start)} - {fmtTime(program.end)}
      </Text>
      <Text style={[s.guideTitle, active && s.guideTitleActive]} numberOfLines={2}>
        {program.title}
      </Text>
      {program.description ? (
        <Text style={s.guideDesc} numberOfLines={1}>
          {program.description}
        </Text>
      ) : null}
      {active && pct > 0 ? (
        <View style={s.guideTrack}>
          <View style={[s.guideFill, { width: `${pct}%` as any }]} />
        </View>
      ) : null}
    </View>
  );
};

export default GuideCard;
