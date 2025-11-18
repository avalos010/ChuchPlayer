import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

interface EPGGridLoadingOverlayProps {
  visible: boolean;
}

export const EPGGridLoadingOverlay: React.FC<EPGGridLoadingOverlayProps> = ({ visible }) => {
  if (!visible) return null;

  return (
    <View style={styles.loadingOverlay}>
      <ActivityIndicator size="large" color="#22d3ee" />
      <Text style={styles.loadingText}>Loading program guide…</Text>
      <Text style={[styles.loadingText, styles.loadingSubtext]}>
        This may take a few seconds
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  loadingText: {
    color: '#a5f3fc',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '600',
  },
  loadingSubtext: {
    fontSize: 12,
    marginTop: 8,
    opacity: 0.7,
  },
});

