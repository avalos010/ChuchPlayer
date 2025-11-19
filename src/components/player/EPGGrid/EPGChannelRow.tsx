import React, { useMemo } from 'react';
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

export const EPGChannelRow: React.FC<EPGChannelRowProps> = React.memo(({
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
  // Memoize visible programs to avoid recalculating on every render
  const visiblePrograms = useMemo(() => {
    if (!programs || programs.length === 0) {
      if (__DEV__ && programs?.length === 0) {
        console.log(`[EPG ChannelRow] No programs for channel ${channel.name}`);
      }
      return null;
    }
    
    // Pre-calculate visible bounds once
    const visibleLeft = -hourWidth * 6;
    const visibleRight = hoursToShow * hourWidth + hourWidth * 6;
    
    // Filter and map programs in a single pass for better performance
    const result: React.ReactNode[] = [];
    for (let i = 0; i < programs.length; i++) {
      const program = programs[i];
      if (!program || !program.id) continue;

      try {
        const style = getProgramStyle(program);
        const programRight = style.left + style.width;
        const programLeft = style.left;
        
        // Only render if program overlaps with visible area
        if (programRight >= visibleLeft && programLeft <= visibleRight) {
          const isNow = isProgramNow(program);
          result.push(
            <EPGProgramBlock
              key={program.id}
              program={program}
              left={style.left}
              width={style.width}
              isNow={isNow}
            />
          );
        } else if (__DEV__ && i === 0) {
          // Debug: Log first program position if it's outside visible area
          console.log(`[EPG ChannelRow] Program "${program.title}" for ${channel.name} is outside visible area: left=${style.left.toFixed(0)}, right=${programRight.toFixed(0)}, visibleLeft=${visibleLeft}, visibleRight=${visibleRight}`);
        }
      } catch (error) {
        // Log errors in dev mode
        if (__DEV__) {
          console.warn(`[EPG ChannelRow] Error rendering program for ${channel.name}:`, error);
        }
        continue;
      }
    }
    
    if (__DEV__ && result.length > 0) {
      console.log(`[EPG ChannelRow] Rendering ${result.length} visible programs for ${channel.name}`);
    }
    
    return result.length > 0 ? result : null;
  }, [programs, hoursToShow, hourWidth, getProgramStyle, isProgramNow, channel.name]);

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
        {/* Background layer */}
        <View style={styles.timelineBackground} />
        
        {/* Programs layer - rendered above background */}
        <View style={styles.programsLayer} pointerEvents="box-none">
          {visiblePrograms || (
            // Show placeholder when no programs
            <View style={styles.noProgramsPlaceholder}>
              <Text style={styles.noProgramsText}>No EPG data</Text>
            </View>
          )}
        </View>

        {/* Current time indicator - rendered above programs */}
        <View
          style={[
            styles.currentTimeIndicator,
            { left: currentTimePosition - horizontalScrollX },
          ]}
        />
        
        {/* Bottom separator - rendered at the bottom, below programs */}
        <View style={styles.bottomSeparator} />
      </View>
      
      {/* Debug: Show program count */}
      {__DEV__ && programs.length > 0 && (
        <View style={{ position: 'absolute', top: 0, right: 0, backgroundColor: 'red', padding: 2, zIndex: 1000 }}>
          <Text style={{ color: 'white', fontSize: 10 }}>{programs.length} programs</Text>
        </View>
      )}
    </FocusableItem>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  // Only re-render if these props change
  return (
    prevProps.channel.id === nextProps.channel.id &&
    prevProps.isCurrent === nextProps.isCurrent &&
    prevProps.isFocused === nextProps.isFocused &&
    prevProps.programs === nextProps.programs &&
    prevProps.currentProgram?.id === nextProps.currentProgram?.id &&
    prevProps.currentTimePosition === nextProps.currentTimePosition &&
    prevProps.horizontalScrollX === nextProps.horizontalScrollX &&
    prevProps.hoursToShow === nextProps.hoursToShow &&
    prevProps.hourWidth === nextProps.hourWidth &&
    prevProps.rowHeight === nextProps.rowHeight &&
    prevProps.channelWidth === nextProps.channelWidth
  );
});

const styles = StyleSheet.create({
  channelRow: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    overflow: 'visible', // Allow programs to be visible
    // Removed borderBottom - will use a separator view instead if needed
  },
  channelRowFocused: {
    backgroundColor: '#2563eb',
    borderLeftWidth: 4,
    borderLeftColor: '#0891b2',
    borderTopWidth: 2,
    borderTopColor: '#0891b2',
    borderBottomWidth: 2,
    borderBottomColor: '#0891b2',
  },
  channelRowCurrent: {
    backgroundColor: '#334155',
  },
  channelRowCurrentFocused: {
    backgroundColor: '#1e40af',
  },
  channelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRightWidth: 1,
    borderRightColor: '#475569',
    backgroundColor: '#1e293b',
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
    backgroundColor: '#334155',
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
    backgroundColor: 'transparent', // Make transparent so programs show through
    overflow: 'visible', // Allow programs to be visible even if they extend beyond bounds
  },
  timelineBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1e293b',
    zIndex: 0,
  },
  programsLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    elevation: 10, // High elevation for Android
  },
  currentTimeIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#22d3ee',
    zIndex: 20,
    elevation: 20, // Highest elevation for Android
  },
  bottomSeparator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#334155',
    zIndex: 1, // Below programs
    elevation: 1,
  },
  noProgramsPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  noProgramsText: {
    color: '#64748b',
    fontSize: 12,
    fontStyle: 'italic',
  },
});

