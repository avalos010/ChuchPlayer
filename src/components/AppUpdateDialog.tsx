import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { isTvLikePlatform } from '../utils/platform';
import FocusableItem from './FocusableItem';

const TV = isTvLikePlatform;

interface Props {
  visible: boolean;
  versionName: string;
  releaseNotes?: string;
  progress: number | null; // null = not downloading yet
  onUpdate: () => void;
  onDismiss: () => void;
}

const BTN_FOCUSED = {
  backgroundColor: 'rgba(14,165,233,0.25)',
  borderColor: '#0ea5e9',
  borderWidth: 2,
  transform: [] as any[],
  elevation: 6,
};

const AppUpdateDialog: React.FC<Props> = ({
  visible, versionName, releaseNotes, progress, onUpdate, onDismiss,
}) => (
  <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
    <View style={s.backdrop}>
      <View style={s.card}>
        <Text style={s.title}>Update available</Text>
        <Text style={s.version}>v{versionName}</Text>
        {releaseNotes ? <Text style={s.notes}>{releaseNotes}</Text> : null}

        {progress !== null ? (
          <View style={s.progressWrap}>
            <View style={s.progressBg}>
              <View style={[s.progressFg, { width: `${progress}%` as any }]} />
            </View>
            <Text style={s.progressTxt}>{progress}%</Text>
          </View>
        ) : (
          <View style={s.buttons}>
            {TV ? (
              <>
                <FocusableItem onPress={onUpdate} style={s.btnUpdate} focusedStyle={BTN_FOCUSED} hasTVPreferredFocus>
                  <Text style={s.btnUpdateTxt}>Update now</Text>
                </FocusableItem>
                <FocusableItem onPress={onDismiss} style={s.btnSkip} focusedStyle={BTN_FOCUSED}>
                  <Text style={s.btnSkipTxt}>Later</Text>
                </FocusableItem>
              </>
            ) : (
              <>
                <TouchableOpacity onPress={onUpdate} style={s.btnUpdate}>
                  <Text style={s.btnUpdateTxt}>Update now</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onDismiss} style={s.btnSkip}>
                  <Text style={s.btnSkipTxt}>Later</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    </View>
  </Modal>
);

export default AppUpdateDialog;

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#0d1117',
    borderRadius: TV ? 18 : 14,
    borderWidth: 1,
    borderColor: 'rgba(30,41,59,0.8)',
    padding: TV ? 40 : 28,
    width: TV ? 480 : 320,
    alignItems: 'center',
    gap: TV ? 12 : 10,
  },
  title: {
    color: '#f8fafc',
    fontSize: TV ? 24 : 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  version: {
    color: '#0ea5e9',
    fontSize: TV ? 16 : 13,
    fontWeight: '700',
  },
  notes: {
    color: '#64748b',
    fontSize: TV ? 14 : 12,
    textAlign: 'center',
    lineHeight: TV ? 20 : 17,
    marginTop: 4,
  },
  buttons: {
    flexDirection: 'row',
    gap: TV ? 14 : 10,
    marginTop: TV ? 8 : 6,
  },
  btnUpdate: {
    backgroundColor: '#0ea5e9',
    borderRadius: TV ? 12 : 8,
    paddingHorizontal: TV ? 28 : 20,
    paddingVertical: TV ? 14 : 10,
    borderWidth: 1,
    borderColor: '#0ea5e9',
  },
  btnUpdateTxt: {
    color: '#fff',
    fontSize: TV ? 15 : 13,
    fontWeight: '700',
  },
  btnSkip: {
    backgroundColor: 'rgba(30,41,59,0.8)',
    borderRadius: TV ? 12 : 8,
    paddingHorizontal: TV ? 28 : 20,
    paddingVertical: TV ? 14 : 10,
    borderWidth: 1,
    borderColor: 'rgba(51,65,85,0.8)',
  },
  btnSkipTxt: {
    color: '#64748b',
    fontSize: TV ? 15 : 13,
    fontWeight: '600',
  },
  progressWrap: {
    width: '100%',
    gap: 8,
    marginTop: TV ? 8 : 6,
    alignItems: 'center',
  },
  progressBg: {
    width: '100%',
    height: TV ? 6 : 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFg: {
    height: '100%',
    backgroundColor: '#0ea5e9',
    borderRadius: 4,
  },
  progressTxt: {
    color: '#0ea5e9',
    fontSize: TV ? 13 : 11,
    fontWeight: '700',
  },
});
