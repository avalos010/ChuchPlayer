import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Channel, EPGProgram } from '../../types';
import ChannelLogo from './ChannelLogo';
import GuideCard from './GuideCard';
import { fmtTime, progressPct } from './utils';
import { webPlayerStyles as s } from './styles';

interface InfoOverlayProps {
  channel: Channel;
  currentProgram: EPGProgram | null;
  visiblePrograms: EPGProgram[];
  sidebarOpen: boolean;
  guideOpen: boolean;
  epgLoading: boolean;
  onToggleSidebar: () => void;
  onToggleGuide: () => void;
}

const InfoOverlay: React.FC<InfoOverlayProps> = ({
  channel,
  currentProgram,
  visiblePrograms,
  sidebarOpen,
  guideOpen,
  epgLoading,
  onToggleSidebar,
  onToggleGuide,
}) => (
  <View style={s.infoOverlay}>
    <View style={s.infoHeader}>
      <ChannelLogo channel={channel} size={64} />
      <View style={{ flex: 1 }}>
        <Text style={s.infoChannelName} numberOfLines={1}>{channel.name}</Text>
        <Text style={s.infoProgramName} numberOfLines={1}>
          {currentProgram?.title ?? 'No program information'}
        </Text>
        {currentProgram ? (
          <Text style={s.infoTime}>
            {fmtTime(currentProgram.start)} - {fmtTime(currentProgram.end)}
          </Text>
        ) : null}
      </View>
      <View style={s.infoActions}>
        <TouchableOpacity
          onPress={onToggleGuide}
          style={[s.infoActionBtn, guideOpen && s.infoActionBtnActive]}
        >
          <Text style={[s.infoActionTxt, guideOpen && s.infoActionTxtActive]}>EPG</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onToggleSidebar} style={s.infoActionBtn}>
          <Text style={s.infoActionTxt}>{sidebarOpen ? 'Hide list' : 'Show list'}</Text>
        </TouchableOpacity>
      </View>
    </View>

    {currentProgram ? (
      <View style={s.programProgressWrap}>
        <View style={s.programProgressTrack}>
          <View
            style={[
              s.programProgressFill,
              { width: `${progressPct(currentProgram.start, currentProgram.end)}%` as any },
            ]}
          />
        </View>
      </View>
    ) : null}

    <View style={s.guideRail}>
      <View style={s.guideRailHeader}>
        <Text style={s.guideRailTitle}>Guide</Text>
        <Text style={s.guideRailHint}>Left opens channels, Up/Down zaps, Enter plays</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.guideRailScroll}>
        {visiblePrograms.length > 0 ? (
          visiblePrograms.map((program) => (
            <GuideCard
              key={program.id}
              program={program}
              active={!!currentProgram && program.id === currentProgram.id}
            />
          ))
        ) : (
          <View style={s.noGuideCard}>
            <Text style={s.noGuideTitle}>No guide data</Text>
            <Text style={s.noGuideText}>The channel is playing, but there is no EPG for it yet.</Text>
          </View>
        )}
      </ScrollView>

      {epgLoading ? (
        <View style={s.epgBadge}>
          <ActivityIndicator size="small" color="#93c5fd" />
          <Text style={s.epgBadgeTxt}>Updating guide</Text>
        </View>
      ) : null}
    </View>
  </View>
);

export default InfoOverlay;
