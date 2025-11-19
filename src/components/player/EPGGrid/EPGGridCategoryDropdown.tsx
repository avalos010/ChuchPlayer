import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, FlatList, TouchableOpacity } from 'react-native';
import FocusableItem from '../../FocusableItem';

interface EPGGridCategoryDropdownProps {
  groups: string[];
  selectedGroup: string;
  onGroupSelect: (group: string) => void;
}

export const EPGGridCategoryDropdown: React.FC<EPGGridCategoryDropdownProps> = ({
  groups,
  selectedGroup,
  onGroupSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (groups.length <= 1) return null;

  const handleSelect = (group: string) => {
    onGroupSelect(group);
    setIsOpen(false);
  };

  return (
    <>
      <FocusableItem
        onPress={() => setIsOpen(true)}
        style={styles.dropdownButton}
        focusedStyle={{
          backgroundColor: '#334155',
          borderWidth: 2,
          borderColor: '#0891b2',
        }}
      >
        <Text style={styles.dropdownButtonText} numberOfLines={1}>
          {selectedGroup}
        </Text>
        <Text style={styles.dropdownArrow}>▼</Text>
      </FocusableItem>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsOpen(false)}
        >
          <View style={styles.dropdownMenu}>
            <FlatList
              data={groups}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <FocusableItem
                  onPress={() => handleSelect(item)}
                  style={[
                    styles.dropdownItem,
                    selectedGroup === item && styles.dropdownItemSelected,
                  ]}
                  focusedStyle={{
                    backgroundColor: '#334155',
                    borderWidth: 2,
                    borderColor: '#0891b2',
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      selectedGroup === item && styles.dropdownItemTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                  {selectedGroup === item && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </FocusableItem>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#1e293b',
    minWidth: 120,
    maxWidth: 200,
  },
  dropdownButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  dropdownArrow: {
    color: '#cbd5e1',
    fontSize: 10,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingTop: 60,
    paddingLeft: 24,
  },
  dropdownMenu: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    minWidth: 200,
    maxHeight: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  dropdownItemSelected: {
    backgroundColor: '#1e293b',
  },
  dropdownItemText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  dropdownItemTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  checkmark: {
    color: '#0891b2',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

