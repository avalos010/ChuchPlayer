import React from 'react';
import { Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import FocusableItem from '../../components/FocusableItem';

interface PinModalProps {
  visible: boolean;
  pinInput: string;
  pinConfirm: string;
  setPinInput: (value: string) => void;
  setPinConfirm: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
  styles: any;
  focusedStyle: any;
}

const PinModal: React.FC<PinModalProps> = ({
  visible,
  pinInput,
  pinConfirm,
  setPinInput,
  setPinConfirm,
  onClose,
  onSave,
  styles,
  focusedStyle,
}) => (
  <Modal visible={visible} transparent animationType="fade">
    <TouchableOpacity
      style={styles.modalBackdrop}
      activeOpacity={1}
      onPress={onClose}
      focusable={false}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => {}}
        style={[styles.modalBox, { maxWidth: 400 }]}
        focusable={false}
      >
        <Text style={styles.modalTitle}>Set PIN</Text>
        <Text style={styles.settingDesc}>
          Enter a 4-digit PIN to protect content.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="New 4-digit PIN"
          placeholderTextColor="#3d3d3d"
          value={pinInput}
          onChangeText={(value) => setPinInput(value.replace(/\D/g, '').slice(0, 4))}
          keyboardType="numeric"
          secureTextEntry
          maxLength={4}
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm PIN"
          placeholderTextColor="#3d3d3d"
          value={pinConfirm}
          onChangeText={(value) => setPinConfirm(value.replace(/\D/g, '').slice(0, 4))}
          keyboardType="numeric"
          secureTextEntry
          maxLength={4}
        />
        <View style={styles.modalActions}>
          <FocusableItem
            onPress={onClose}
            style={styles.cancelBtn}
            focusedStyle={focusedStyle}
          >
            <Text style={styles.cancelBtnTxt}>Cancel</Text>
          </FocusableItem>
          <FocusableItem onPress={onSave} style={styles.confirmBtn} focusedStyle={focusedStyle}>
            <Text style={styles.confirmBtnTxt}>Save</Text>
          </FocusableItem>
        </View>
      </TouchableOpacity>
    </TouchableOpacity>
  </Modal>
);

export default PinModal;
