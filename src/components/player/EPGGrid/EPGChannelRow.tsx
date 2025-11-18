import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import FocusableItem from '../../FocusableItem';
import { Channel, EPGProgram } from '../../../types';
import { EPGProgramBlock } from './EPGProgramBlock';

interface EPGChannelRowProps {
  channel: Channel;
  isCurrent: boolean;
  isFocused: boolean;
  programs: EPGProgram[];
  currentProgram: EPGProgram | null;
  currentTimePosition: number;
  horizontalScrollX: number;
  hoursToShow: number;
  hourWidth: number;
  rowHeight: number;
  channelWidth: number;
  onPress: () => void;
  onFocus: () => void;
  getProgramStyle: (program: EPGProgram) => { left: number; width: number };
  isProgramNow: (program: EPGProgram) => boolean;
}

export const EPGChannelRow: React.FC<EPGChannelRowProps> = ({
  channel,
  isCurrent,
  isFocused,
  programs,
  currentProgram,
  currentTimePosition,
  horizontalScrollX,
  hoursToShow,
  hourWidth,
  rowHeight,
  channelWidth,
  onPress,
  onFocus,
  getProgramStyle,
  isProgramNow,
}) => {
  return (
    <FocusableItem
      onPress={onPress}
      onFocus={onFocus}
      style={[
        styles.channelRow,
        { height: rowHeight },
        isCurrent && styles.channelRowCurrent,
      ]}
      focusedStyle={[
        styles.channelRowFocused,
        isCurrent && styles.channelRowCurrentFocused,
      ]}
    >
      {/* Channel Info */}
      <View style={[styles.channelInfo, { width: channelWidth }]}>
        {channel.logo ? (
          <Image
            source={{ uri: channel.logo }}
            style={styles.channelLogo}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={200}
          />
        ) : (
          <View style={styles.channelLogoPlaceholder}>
            <Text style={styles.channelInitials}>
              {channel.name.substring(0, 2).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.channelText}>
          <Text style={styles.channelName} numberOfLines={2}>
            {channel.name}
          </Text>
          {currentProgram && (
            <Text style={styles.currentProgram} numberOfLines={1}>
              {currentProgram.title}
            </Text>
          )}
        </View>
      </View>

      {/* Programs Timeline */}
      <View style={[styles.timelineContainer, { width: hoursToShow * hourWidth, height: rowHeight }]}>
        {programs && programs.length > 0
          ? programs
              .map((program) => {
                if (!program || !program.id) return null;

                try {
                  const style = getProgramStyle(program);
                  const isNow = isProgramNow(program);

                  // Only render if program is within visible timeline
                  if (
                    style.left > hoursToShow * hourWidth ||
                    style.left + style.width < 0
                  ) {
                    return null;
                  }

                  return (
                    <EPGProgramBlock
                      key={program.id}
                      program={program}
                      left={style.left}
                      width={style.width}
                      isNow={isNow}
                    />
                  );
                } catch (error) {
                  console.warn('[EPG Grid] Error rendering program:', error, program);
                  return null;
                }
              })
              .filter(Boolean)
          : null}

        {/* Current time indicator */}
        <View
          style={[
            styles.currentTimeIndicator,
            { left: currentTimePosition - horizontalScrollX },
          ]}
        />
      </View>
    </FocusableItem>
  );
};

const styles = StyleSheet.create({
  channelRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  channelRowFocused: {
    backgroundColor: '#1e40af',
    borderLeftWidth: 4,
    borderLeftColor: '#0891b2',
    borderTopWidth: 2,
    borderTopColor: '#0891b2',
    borderBottomWidth: 2,
    borderBottomColor: '#0891b2',
  },
  channelRowCurrent: {
    backgroundColor: '#1f2937',
  },
  channelRowCurrentFocused: {
    backgroundColor: '#1e3a8a',
  },
  channelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRightWidth: 1,
    borderRightColor: '#1e293b',
  },
  channelLogo: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
  },
  channelLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  channelInitials: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  channelText: {
    flex: 1,
  },
  channelName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  currentProgram: {
    color: '#a5f3fc',
    fontSize: 12,
    fontWeight: '500',
  },
  timelineContainer: {
    flex: 1,
    position: 'relative',
  },
  currentTimeIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#22d3ee',
    zIndex: 20,
  },
});

