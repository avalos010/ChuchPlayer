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

  return (
    <View
      style={[
        styles.programBlock,
        {
          left,
          width,
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
    top: 8,
    bottom: 8,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 8,
    justifyContent: 'center',
    minWidth: 80,
  },
  programBlockNow: {
    backgroundColor: '#0891b2',
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

