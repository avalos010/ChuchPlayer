import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import FocusableItem from '../../FocusableItem';

interface EPGGridGroupFilterProps {
  groups: string[];
  selectedGroup: string;
  onGroupSelect: (group: string) => void;
}

export const EPGGridGroupFilter: React.FC<EPGGridGroupFilterProps> = ({
  groups,
  selectedGroup,
  onGroupSelect,
}) => {
  if (groups.length <= 1) return null;

  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false} 
      style={styles.groupFilter}
      contentContainerStyle={{ paddingRight: 16 }}
    >
      {groups.map((group, index) => (
        <FocusableItem
          key={group}
          onPress={() => onGroupSelect(group)}
          hasTVPreferredFocus={index === 0}
          style={[
            styles.groupButton,
            selectedGroup === group && styles.groupButtonActive,
          ]}
          focusedStyle={{
            backgroundColor: selectedGroup === group ? '#0891b2' : '#334155',
            borderWidth: 2,
            borderColor: '#0891b2',
            transform: [{ scale: 1.05 }],
          }}
        >
          <Text
            style={[
              styles.groupButtonText,
              selectedGroup === group && styles.groupButtonTextActive,
            ]}
          >
            {group}
          </Text>
        </FocusableItem>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  groupFilter: {
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  groupButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    marginRight: 8,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupButtonActive: {
    backgroundColor: '#0891b2',
  },
  groupButtonText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  groupButtonTextActive: {
    color: '#ffffff',
  },
});

