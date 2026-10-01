import { Platform, StyleSheet } from 'react-native';
import { Theme, withAlpha } from '../../theme/themes';

const TV = Platform.OS === 'android';

export function createStyles(theme: Theme) {
  const accentSoft = withAlpha(theme.accent, 0.12);

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.bg },
    scroll: {
      width: '100%',
      maxWidth: TV ? 700 : 720,
      alignSelf: 'center',
      paddingHorizontal: TV ? 34 : 22,
      paddingTop: TV ? 30 : 22,
      paddingBottom: TV ? 56 : 32,
    },

    settingsHero: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 18,
      paddingBottom: TV ? 26 : 20,
      marginBottom: TV ? 28 : 22,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    settingsHeroText: {
      flex: 1,
      minWidth: 0,
    },
    settingsEyebrow: {
      color: theme.accent,
      fontSize: TV ? 12 : 10,
      fontWeight: '900',
      letterSpacing: 2,
      marginBottom: 6,
    },
    settingsTitle: {
      color: theme.text,
      fontSize: TV ? 30 : 26,
      fontWeight: '800',
    },
    settingsSubtitle: {
      color: theme.textSub,
      fontSize: TV ? 13 : 12,
      lineHeight: TV ? 19 : 18,
      marginTop: 7,
      maxWidth: 520,
    },

    backBtn: {
      paddingHorizontal: TV ? 14 : 12,
      paddingVertical: TV ? 10 : 8,
      borderRadius: 9,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    backBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    backBtnTxt: { color: theme.text, fontSize: TV ? 14 : 13, fontWeight: '700' },

    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      marginBottom: TV ? 12 : 10,
    },
    sectionTitle: {
      color: theme.textSub,
      fontSize: TV ? 11 : 10,
      fontWeight: '800',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
    sectionRule: { flex: 1, height: 1, backgroundColor: theme.border },

    card: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      padding: TV ? 21 : 17,
      marginBottom: 8,
    },
    centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },

    divider: { height: TV ? 26 : 20 },

    settingRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
    settingRowFocusWrap: {
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginHorizontal: -12,
      marginVertical: -10,
    },
    settingRowTop: { paddingTop: 17, marginTop: 17, borderTopWidth: 1, borderTopColor: theme.border },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 20 },
    settingTitle: { color: theme.text, fontSize: TV ? 17 : 15, fontWeight: '800', marginBottom: 4 },
    settingDesc: { color: theme.textSub, fontSize: TV ? 13 : 11, lineHeight: TV ? 20 : 17 },
    valueLabel: { color: theme.accent, fontSize: TV ? 15 : 13, fontWeight: '900' },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    chip: {
      paddingHorizontal: TV ? 20 : 14, paddingVertical: TV ? 10 : 7,
      borderRadius: 8,
      backgroundColor: theme.card,
      borderWidth: 1, borderColor: theme.border,
    },
    chipActive: { backgroundColor: theme.accent, borderColor: theme.accent },
    chipTxt: { color: theme.textSub, fontSize: TV ? 14 : 12, fontWeight: '800' },
    chipTxtActive: { color: theme.accentText, fontSize: TV ? 14 : 12, fontWeight: '900' },

    playlistRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      padding: TV ? 18 : 14,
      marginBottom: 8,
      gap: 16,
    },
    playlistName: { color: theme.text, fontSize: TV ? 19 : 16, fontWeight: '800', marginBottom: 4 },
    playlistMeta: { color: theme.textSub, fontSize: TV ? 14 : 12, fontWeight: '600' },
    editBtn: {
      paddingHorizontal: TV ? 20 : 16, paddingVertical: TV ? 12 : 9,
      borderRadius: 8,
      backgroundColor: theme.card,
      borderWidth: 1, borderColor: theme.border,
    },
    editBtnTxt: { color: theme.text, fontSize: TV ? 14 : 13, fontWeight: '800' },
    deleteBtn: {
      paddingHorizontal: TV ? 20 : 16, paddingVertical: TV ? 12 : 9,
      borderRadius: 8,
      backgroundColor: 'rgba(239,68,68,0.08)',
      borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
    },
    deleteBtnTxt: { color: '#f87171', fontSize: TV ? 14 : 13, fontWeight: '800' },

    addBtn: {
      alignItems: 'center',
      paddingVertical: TV ? 18 : 14,
      borderRadius: 10,
      backgroundColor: accentSoft,
      borderWidth: 1, borderColor: theme.accent,
      marginBottom: 4,
    },
    addBtnContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    addBtnTxt: { color: theme.text, fontSize: TV ? 17 : 15, fontWeight: '900' },

    emptyTitle: { color: theme.text, fontSize: TV ? 18 : 15, fontWeight: '700', marginBottom: 6 },
    emptyBody: { color: theme.textMuted, fontSize: TV ? 14 : 12, lineHeight: TV ? 22 : 18 },

    refreshBtn: {
      paddingVertical: TV ? 16 : 13, borderRadius: 10,
      backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border,
    },
    refreshContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    refreshBtnDisabled: { opacity: 0.5 },
    refreshBtnTxt: { color: theme.text, fontSize: TV ? 17 : 15, fontWeight: '900' },

    changePinBtn: {
      alignSelf: 'flex-start',
      paddingHorizontal: TV ? 20 : 16,
      paddingVertical: TV ? 12 : 9,
      borderRadius: 8,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    changePinTxt: { color: theme.text, fontSize: TV ? 14 : 13, fontWeight: '800' },

    swatchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    swatchBtn: {
      paddingHorizontal: TV ? 12 : 10,
      paddingVertical: TV ? 9 : 7,
      borderRadius: 12,
      borderWidth: 1.5,
      minWidth: TV ? 110 : 90,
    },
    swatchContent: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    swatchBtnActive: { borderWidth: 2.5 },
    swatchDot: { width: TV ? 12 : 10, height: TV ? 12 : 10, borderRadius: 6 },
    swatchLabel: { fontSize: TV ? 12 : 11, fontWeight: '700' },
    colorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    colorSwatch: { width: TV ? 44 : 36, height: TV ? 44 : 36, borderRadius: 10, borderWidth: 1, borderColor: theme.border },
    colorLabel: { color: theme.textSub, fontSize: TV ? 12 : 10, fontWeight: '800', marginBottom: 5, letterSpacing: 0.5 },
    colorInput: {
      backgroundColor: theme.card,
      color: theme.text,
      borderRadius: 8, borderWidth: 1, borderColor: theme.border,
      paddingHorizontal: TV ? 14 : 10, paddingVertical: TV ? 10 : 8,
      fontSize: TV ? 15 : 13, fontFamily: 'monospace',
    },

    helpBtn: { marginBottom: 10 },
    helpContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
    helpTitle: { color: theme.text, fontSize: TV ? 16 : 14, fontWeight: '800' },

    aboutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
    aboutRowSeparator: { borderBottomWidth: 1, borderBottomColor: theme.border },
    aboutLabel: { color: theme.textSub, fontSize: TV ? 14 : 12, fontWeight: '700' },
    aboutValue: { color: theme.text, fontSize: TV ? 15 : 13, fontWeight: '800' },

    modalBackdrop: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.72)',
      justifyContent: 'center', alignItems: 'center', padding: TV ? 40 : 24,
    },
    modalBox: {
      backgroundColor: theme.surface,
      borderRadius: 22,
      borderWidth: 1, borderColor: theme.border,
      padding: TV ? 36 : 24,
      width: '100%', maxWidth: 680,
      gap: 14,
      shadowColor: '#000', shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.42, shadowRadius: 40, elevation: 30,
    },
    modalTitle: { color: theme.text, fontSize: TV ? 24 : 20, fontWeight: '800', marginBottom: 4 },
    tabRow: { flexDirection: 'row', gap: 10 },
    tab: {
      flex: 1, paddingVertical: TV ? 14 : 10, borderRadius: 12,
      backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border,
      alignItems: 'center',
    },
    tabActive: { backgroundColor: theme.accent, borderColor: theme.accent },
    tabTxt: { color: theme.textSub, fontSize: TV ? 15 : 13, fontWeight: '700' },
    tabTxtActive: { color: theme.accentText },
    input: {
      backgroundColor: theme.card,
      color: theme.text,
      borderRadius: 14, borderWidth: 1, borderColor: theme.border,
      paddingHorizontal: TV ? 18 : 14, paddingVertical: TV ? 16 : 12,
      fontSize: TV ? 16 : 14,
    },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
    cancelBtn: {
      paddingHorizontal: TV ? 24 : 18, paddingVertical: TV ? 14 : 10,
      borderRadius: 12, backgroundColor: theme.card,
      borderWidth: 1, borderColor: theme.border, alignItems: 'center', minWidth: 110,
    },
    cancelBtnTxt: { color: theme.text, fontSize: TV ? 15 : 13, fontWeight: '800' },
    confirmBtn: {
      paddingHorizontal: TV ? 24 : 18, paddingVertical: TV ? 14 : 10,
      borderRadius: 12, backgroundColor: theme.accent,
      alignItems: 'center', minWidth: 110,
    },
    confirmBtnTxt: { color: theme.accentText, fontSize: TV ? 15 : 13, fontWeight: '900' },
  });
}

export type SettingsStyles = ReturnType<typeof createStyles>;
