import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface EPGGridErrorMessageProps {
  error: string | null;
  visible: boolean;
}

export const EPGGridErrorMessage: React.FC<EPGGridErrorMessageProps> = ({ error, visible }) => {
  if (!visible || !error) return null;

  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Unable to refresh the program guide</Text>
      <Text style={styles.errorText}>{error}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  errorContainer: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 40,
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderColor: 'rgba(248, 113, 113, 0.45)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    zIndex: 50,
  },
  errorTitle: {
    color: '#fecaca',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  errorText: {
    color: '#fecaca',
    fontSize: 14,
    opacity: 0.85,
  },
});

