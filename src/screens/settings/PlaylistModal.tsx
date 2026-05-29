import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import FocusableItem from '../../components/FocusableItem';
import { PlaylistSourceType } from '../../types';

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
        style={styles.modalBox}
        focusable={false}
      >
        <Text style={styles.modalTitle}>
          {editingPlaylistId ? 'Edit Playlist' : 'Add Playlist'}
        </Text>

        <View style={styles.tabRow}>
          {(['m3u', 'xtream'] as PlaylistSourceType[]).map((type, idx) => (
            <FocusableItem
              key={type}
              onPress={() => setSourceType(type)}
              hasTVPreferredFocus={visible && idx === 0}
              style={[styles.tab, sourceType === type && styles.tabActive]}
              focusedStyle={focusedStyle}
            >
              <Text style={[styles.tabTxt, sourceType === type && styles.tabTxtActive]}>
                {type === 'm3u' ? 'M3U' : 'Xtream Codes'}
              </Text>
            </FocusableItem>
          ))}
        </View>

        <TextInput
          ref={nameInputRef}
          style={styles.input}
          placeholder="Playlist name"
          placeholderTextColor="#3d3d3d"
          value={newPlaylistName}
          onChangeText={setNewPlaylistName}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => {
            if (sourceType === 'm3u') urlInputRef.current?.focus();
            else xtreamServerRef.current?.focus();
          }}
        />

        {sourceType === 'm3u' ? (
          <TextInput
            ref={urlInputRef}
            style={styles.input}
            placeholder="M3U URL"
            placeholderTextColor="#3d3d3d"
            value={newPlaylistUrl}
            onChangeText={setNewPlaylistUrl}
            autoCapitalize="none"
            keyboardType="url"
            returnKeyType="done"
            submitBehavior="blurAndSubmit"
            onSubmitEditing={() => modalSaveBtnRef.current?.focus()}
          />
        ) : (
          <>
            <TextInput
              ref={xtreamServerRef}
              style={styles.input}
              placeholder="Server URL (https://...)"
              placeholderTextColor="#3d3d3d"
              value={xtreamServerUrl}
              onChangeText={setXtreamServerUrl}
              autoCapitalize="none"
              keyboardType="url"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => xtreamUsernameRef.current?.focus()}
            />
            <TextInput
              ref={xtreamUsernameRef}
              style={styles.input}
              placeholder="Username"
              placeholderTextColor="#3d3d3d"
              value={xtreamUsername}
              onChangeText={setXtreamUsername}
              autoCapitalize="none"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => xtreamPasswordRef.current?.focus()}
            />
            <TextInput
              ref={xtreamPasswordRef}
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#3d3d3d"
              value={xtreamPassword}
              onChangeText={setXtreamPassword}
              secureTextEntry
              autoCapitalize="none"
              returnKeyType="done"
              submitBehavior="blurAndSubmit"
              onSubmitEditing={() => modalSaveBtnRef.current?.focus()}
            />
          </>
        )}

        <View style={styles.modalActions}>
          <FocusableItem
            onPress={onClose}
            style={styles.cancelBtn}
            focusedStyle={focusedStyle}
            disabled={addingPlaylist}
          >
            <Text style={styles.cancelBtnTxt}>Cancel</Text>
          </FocusableItem>
          <FocusableItem
            ref={modalSaveBtnRef}
            onPress={onSave}
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

export default PlaylistModal;
