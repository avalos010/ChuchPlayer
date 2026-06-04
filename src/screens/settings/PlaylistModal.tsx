import React from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import FocusableItem from '../../components/FocusableItem';
import { openTvInputDialog } from '../../services/tvInputDialog';
import { PlaylistSourceType } from '../../types';

type PlaylistField = 'name' | 'url' | 'xtreamServer' | 'xtreamUsername' | 'xtreamPassword';

interface PlaylistModalProps {
  visible: boolean;
  editingPlaylistId: string | null;
  sourceType: PlaylistSourceType;
  setSourceType: (value: PlaylistSourceType) => void;
  newPlaylistName: string;
  setNewPlaylistName: (value: string) => void;
  newPlaylistUrl: string;
  setNewPlaylistUrl: (value: string) => void;
  xtreamServerUrl: string;
  setXtreamServerUrl: (value: string) => void;
  xtreamUsername: string;
  setXtreamUsername: (value: string) => void;
  xtreamPassword: string;
  setXtreamPassword: (value: string) => void;
  addingPlaylist: boolean;
  onClose: () => void;
  onSave: () => void;
  styles: any;
  focusedStyle: any;
  nameInputRef: React.RefObject<any>;
  urlInputRef: React.RefObject<any>;
  xtreamServerRef: React.RefObject<any>;
  xtreamUsernameRef: React.RefObject<any>;
  xtreamPasswordRef: React.RefObject<any>;
  modalSaveBtnRef: React.RefObject<any>;
}

const PlaylistModal: React.FC<PlaylistModalProps> = ({
  visible,
  editingPlaylistId,
  sourceType,
  setSourceType,
  newPlaylistName,
  setNewPlaylistName,
  newPlaylistUrl,
  setNewPlaylistUrl,
  xtreamServerUrl,
  setXtreamServerUrl,
  xtreamUsername,
  setXtreamUsername,
  xtreamPassword,
  setXtreamPassword,
  addingPlaylist,
  onClose,
  onSave,
  styles,
  focusedStyle,
  nameInputRef,
  urlInputRef,
  xtreamServerRef,
  xtreamUsernameRef,
  xtreamPasswordRef,
  modalSaveBtnRef,
}) => {
  const isTV = Platform.isTV;

  const closeKeyboard = React.useCallback(() => {
    Keyboard.dismiss();
    nameInputRef.current?.blur?.();
    urlInputRef.current?.blur?.();
    xtreamServerRef.current?.blur?.();
    xtreamUsernameRef.current?.blur?.();
    xtreamPasswordRef.current?.blur?.();
  }, [nameInputRef, urlInputRef, xtreamPasswordRef, xtreamServerRef, xtreamUsernameRef]);

  const closeModal = React.useCallback(() => {
    closeKeyboard();
    onClose();
  }, [closeKeyboard, onClose]);

  const fieldConfig = React.useMemo(() => ({
    name: {
      label: 'Playlist name',
      value: newPlaylistName,
      setValue: setNewPlaylistName,
      inputRef: nameInputRef,
      keyboardType: 'default' as const,
      secureTextEntry: false,
    },
    url: {
      label: 'M3U URL',
      value: newPlaylistUrl,
      setValue: setNewPlaylistUrl,
      inputRef: urlInputRef,
      keyboardType: 'url' as const,
      secureTextEntry: false,
    },
    xtreamServer: {
      label: 'Server URL',
      value: xtreamServerUrl,
      setValue: setXtreamServerUrl,
      inputRef: xtreamServerRef,
      keyboardType: 'url' as const,
      secureTextEntry: false,
    },
    xtreamUsername: {
      label: 'Username',
      value: xtreamUsername,
      setValue: setXtreamUsername,
      inputRef: xtreamUsernameRef,
      keyboardType: 'default' as const,
      secureTextEntry: false,
    },
    xtreamPassword: {
      label: 'Password',
      value: xtreamPassword,
      setValue: setXtreamPassword,
      inputRef: xtreamPasswordRef,
      keyboardType: 'default' as const,
      secureTextEntry: true,
    },
  }), [
    nameInputRef,
    newPlaylistName,
    newPlaylistUrl,
    setNewPlaylistName,
    setNewPlaylistUrl,
    setXtreamPassword,
    setXtreamServerUrl,
    setXtreamUsername,
    urlInputRef,
    xtreamPassword,
    xtreamPasswordRef,
    xtreamServerRef,
    xtreamServerUrl,
    xtreamUsername,
    xtreamUsernameRef,
  ]);

  const visibleFields = React.useMemo<PlaylistField[]>(() => (
    sourceType === 'm3u'
      ? ['name', 'url']
      : ['name', 'xtreamServer', 'xtreamUsername', 'xtreamPassword']
  ), [sourceType]);

  React.useEffect(() => {
    if (!visible) closeKeyboard();
  }, [closeKeyboard, visible]);

  React.useEffect(() => {
    if (!visible || !isTV) return undefined;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeModal();
      return true;
    });

    return () => subscription.remove();
  }, [closeModal, isTV, visible]);

  const editTvField = React.useCallback(async (field: PlaylistField) => {
    const config = fieldConfig[field];
    closeKeyboard();

    try {
      const nextValue = await openTvInputDialog({
        title: config.label,
        value: config.value,
        secureTextEntry: config.secureTextEntry,
        keyboardType: config.keyboardType,
      });
      if (nextValue !== null) config.setValue(nextValue);
    } catch {
      config.inputRef.current?.focus?.();
    }
  }, [closeKeyboard, fieldConfig]);

  const renderInlineInput = React.useCallback((field: PlaylistField) => {
    const config = fieldConfig[field];
    return (
      <TextInput
        key={field}
        ref={config.inputRef}
        style={styles.input}
        placeholder={config.label}
        placeholderTextColor="#3d3d3d"
        value={config.value}
        onChangeText={config.setValue}
        autoCapitalize="none"
        keyboardType={config.keyboardType}
        secureTextEntry={config.secureTextEntry}
        returnKeyType={field === visibleFields[visibleFields.length - 1] ? 'done' : 'next'}
        submitBehavior={field === visibleFields[visibleFields.length - 1] ? 'blurAndSubmit' : 'submit'}
        onSubmitEditing={() => {
          const nextField = visibleFields[visibleFields.indexOf(field) + 1];
          if (nextField) fieldConfig[nextField].inputRef.current?.focus?.();
          else modalSaveBtnRef.current?.focus?.();
        }}
      />
    );
  }, [fieldConfig, modalSaveBtnRef, styles.input, visibleFields]);

  const renderSourceTabs = (autoFocusFirst = false) => (
    <View style={styles.tabRow}>
      {(['m3u', 'xtream'] as PlaylistSourceType[]).map((type, idx) => (
        <FocusableItem
          key={type}
          onPress={() => {
            closeKeyboard();
            setSourceType(type);
          }}
          hasTVPreferredFocus={autoFocusFirst && idx === 0}
          style={[styles.tab, sourceType === type && styles.tabActive]}
          focusedStyle={focusedStyle}
        >
          <Text style={[styles.tabTxt, sourceType === type && styles.tabTxtActive]}>
            {type === 'm3u' ? 'M3U' : 'Xtream Codes'}
          </Text>
        </FocusableItem>
      ))}
    </View>
  );

  if (isTV) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={closeModal}
          focusable={false}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}}
            style={styles.modalBox}
            focusable={false}
          >
            <Text style={styles.modalTitle}>
              {editingPlaylistId ? 'Edit Playlist' : 'Add Playlist'}
            </Text>
            <Text style={{ color: '#888888', fontSize: 13, fontWeight: '700' }}>
              Select a row to edit. No inline keyboard trap.
            </Text>

            {renderSourceTabs(visible)}

            <View style={{ gap: 10 }}>
              {visibleFields.map(field => {
                const config = fieldConfig[field];
                const value = config.secureTextEntry && config.value
                  ? '*'.repeat(Math.min(config.value.length, 12))
                  : config.value;

                return (
                  <FocusableItem
                    key={field}
                    onPress={() => editTvField(field)}
                    style={styles.input}
                    focusedStyle={focusedStyle}
                  >
                    <Text style={{ color: '#888888', fontSize: 12, fontWeight: '700', marginBottom: 5 }}>
                      {config.label}
                    </Text>
                    <Text style={{ color: value ? '#ffffff' : '#3d3d3d', fontSize: 16 }}>
                      {value || 'Press select to enter'}
                    </Text>
                  </FocusableItem>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <FocusableItem
                onPress={closeModal}
                style={styles.cancelBtn}
                focusedStyle={focusedStyle}
                disabled={addingPlaylist}
              >
                <Text style={styles.cancelBtnTxt}>Cancel</Text>
              </FocusableItem>
              <FocusableItem
                ref={modalSaveBtnRef}
                onPress={() => {
                  closeKeyboard();
                  onSave();
                }}
                style={styles.confirmBtn}
                focusedStyle={focusedStyle}
                disabled={addingPlaylist}
              >
                {addingPlaylist ? (
                  <ActivityIndicator color="#0a0a0a" size="small" />
                ) : (
                  <Text style={styles.confirmBtnTxt}>
                    {editingPlaylistId ? 'Save' : 'Add'}
                  </Text>
                )}
              </FocusableItem>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity
        style={styles.modalBackdrop}
        activeOpacity={1}
        onPress={closeModal}
        focusable={false}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {}}
          style={styles.modalBox}
          focusable={false}
        >
          <Text style={styles.modalTitle}>
            {editingPlaylistId ? 'Edit Playlist' : 'Add Playlist'}
          </Text>

          {renderSourceTabs(visible)}

          {visibleFields.map(renderInlineInput)}

          <View style={styles.modalActions}>
            <FocusableItem
              onPress={closeModal}
              style={styles.cancelBtn}
              focusedStyle={focusedStyle}
              disabled={addingPlaylist}
            >
              <Text style={styles.cancelBtnTxt}>Cancel</Text>
            </FocusableItem>
            <FocusableItem
              ref={modalSaveBtnRef}
              onPress={() => {
                closeKeyboard();
                onSave();
              }}
              style={styles.confirmBtn}
              focusedStyle={focusedStyle}
              disabled={addingPlaylist}
            >
              {addingPlaylist ? (
                <ActivityIndicator color="#0a0a0a" size="small" />
              ) : (
                <Text style={styles.confirmBtnTxt}>
                  {editingPlaylistId ? 'Save' : 'Add'}
                </Text>
              )}
            </FocusableItem>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

export default PlaylistModal;
