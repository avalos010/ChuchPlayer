import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import type { RefObject } from 'react';

interface TimeSlot {
  hour: number;
  label: string;
  isCurrent: boolean;
}

interface EPGGridTimeHeaderProps {
  timeSlots: TimeSlot[];
  currentTimePosition: number;
  horizontalScrollX: number;
  hoursToShow: number;
  hourWidth: number;
  onScroll: (offsetX: number) => void;
  scrollRef: RefObject<ScrollView | null>;
}

export const EPGGridTimeHeader: React.FC<EPGGridTimeHeaderProps> = ({
  timeSlots,
  currentTimePosition,
  horizontalScrollX,
  hoursToShow,
  hourWidth,
  onScroll,
  scrollRef,
}) => {
  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.timeHeader}
      contentContainerStyle={{ width: hoursToShow * hourWidth }}
      onScroll={(e) => onScroll(e.nativeEvent.contentOffset.x)}
      scrollEventThrottle={16}
    >
      {timeSlots.map((slot, index) => (
        <View
          key={index}
          style={[
            styles.timeSlot,
            { width: hourWidth },
            slot.isCurrent && styles.timeSlotCurrent,
          ]}
        >
          <Text
            style={[
              styles.timeSlotText,
              slot.isCurrent && styles.timeSlotTextCurrent,
            ]}
          >
            {slot.label}
          </Text>
        </View>
      ))}
      {/* Current time indicator in header */}
      <View
        style={[
          styles.currentTimeIndicatorHeader,
          { left: currentTimePosition - horizontalScrollX },
        ]}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  timeHeader: {
    height: 50,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  timeSlot: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#1e293b',
  },
  timeSlotCurrent: {
    backgroundColor: '#1e293b',
  },
  timeSlotText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  timeSlotTextCurrent: {
    color: '#ffffff',
  },
  currentTimeIndicatorHeader: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#22d3ee',
    zIndex: 10,
  },
});

