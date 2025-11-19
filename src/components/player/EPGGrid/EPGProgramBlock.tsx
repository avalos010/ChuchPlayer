import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { EPGProgram } from '../../../types';

interface EPGProgramBlockProps {
  program: EPGProgram;
  left: number;
  width: number;
  isNow: boolean;
}

export const EPGProgramBlock: React.FC<EPGProgramBlockProps> = ({
  program,
  left,
  width,
  isNow,
}) => {
  const programStart = program.start instanceof Date ? program.start : new Date(program.start);
  const programEnd = program.end instanceof Date ? program.end : new Date(program.end);
  const hasValidDates = !isNaN(programStart.getTime()) && !isNaN(programEnd.getTime());

  // Debug: Log program position
  if (__DEV__) {
    console.log(`[EPG ProgramBlock] Rendering "${program.title}" at left=${left.toFixed(0)}, width=${width.toFixed(0)}`);
  }

  return (
    <View
      style={[
        styles.programBlock,
        {
          left,
          width: Math.max(width, 80), // Ensure minimum width
        },
        isNow && styles.programBlockNow,
      ]}
    >
      <Text style={styles.programTitle} numberOfLines={1}>
        {program.title || 'Untitled'}
      </Text>
      {hasValidDates && (
        <Text style={styles.programTime} numberOfLines={1}>
          {programStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
          {programEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  programBlock: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    backgroundColor: '#334155',
    borderRadius: 6,
    padding: 6,
    justifyContent: 'center',
    minWidth: 80,
    borderWidth: 2, // Increased border width for better visibility
    borderColor: '#64748b', // Lighter border color for better visibility
    zIndex: 15, // Ensure programs are above separators and background
    elevation: 15, // High elevation for Android to appear above separators
    shadowColor: '#000', // Add shadow for better visibility
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  programBlockNow: {
    backgroundColor: '#0891b2',
    borderColor: '#22d3ee',
  },
  programTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  programTime: {
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '500',
  },
});

