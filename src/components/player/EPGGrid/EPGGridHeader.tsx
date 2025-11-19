import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import FocusableItem from '../../FocusableItem';

interface EPGGridHeaderProps {
  playlistName?: string;
  onRefresh?: () => void;
  onSettings: () => void;
  onClose: () => void;
  categoryDropdown?: React.ReactNode;
}

export const EPGGridHeader: React.FC<EPGGridHeaderProps> = ({
  playlistName,
  onRefresh,
  onSettings,
  onClose,
  categoryDropdown,
}) => {
  return (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <View style={styles.titleRow}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Electronic Program Guide</Text>
            {playlistName && <Text style={styles.subtitle}>{playlistName}</Text>}
          </View>
          {categoryDropdown}
        </View>
      </View>
      <View style={styles.headerActions}>
        {onRefresh && (
          <FocusableItem 
            onPress={onRefresh} 
            style={styles.headerButton}
            focusedStyle={{
              backgroundColor: '#0891b2',
              borderWidth: 2,
              borderColor: '#0891b2',
              transform: [{ scale: 1.1 }],
            }}
          >
            <Text style={styles.headerButtonText}>↻</Text>
          </FocusableItem>
        )}
        <FocusableItem 
          onPress={onSettings} 
          style={styles.headerButton}
          focusedStyle={{
            backgroundColor: '#0891b2',
            borderWidth: 2,
            borderColor: '#0891b2',
            transform: [{ scale: 1.1 }],
          }}
        >
          <Text style={styles.headerButtonText}>⚙️</Text>
        </FocusableItem>
        <FocusableItem 
          onPress={onClose} 
          style={[styles.headerButton, styles.closeButton]}
          focusedStyle={{
            backgroundColor: '#ef4444',
            borderWidth: 2,
            borderColor: '#ef4444',
            transform: [{ scale: 1.1 }],
          }}
        >
          <Text style={styles.headerButtonText}>✕</Text>
        </FocusableItem>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    backgroundColor: '#1e293b',
  },
  headerContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    backgroundColor: '#dc2626',
  },
  headerButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});

