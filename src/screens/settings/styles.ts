
export function createStyles(theme: Theme) {
  const accentSoft = `${theme.accent}24`;
  const accentSofter = `${theme.accent}14`;
  const borderSoft = `${theme.border}cc`;

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.bg },
    scroll: {
      paddingHorizontal: TV ? 52 : 24,
      paddingTop: TV ? 34 : 24,
      paddingBottom: 36,
    },

    settingsHero: {
      flexDirection: TV ? 'row' : 'column',
      alignItems: TV ? 'center' : 'stretch',
      justifyContent: 'space-between',
      gap: TV ? 28 : 18,
      backgroundColor: theme.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: borderSoft,
      padding: TV ? 28 : 20,
      marginBottom: TV ? 30 : 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 18 },
      shadowOpacity: 0.18,
      shadowRadius: 26,
      elevation: 6,
    },
    settingsHeroText: {
      flex: 1,
      minWidth: 0,
    },
    settingsEyebrow: {
      color: theme.accent,
      fontSize: TV ? 12 : 10,
      fontWeight: '900',
      letterSpacing: 1.8,
      marginBottom: 8,
    },
    settingsTitle: {
      color: theme.text,
      fontSize: TV ? 36 : 28,
      fontWeight: '900',
    },
    settingsSubtitle: {
      color: theme.textSub,
      fontSize: TV ? 15 : 13,
      lineHeight: TV ? 23 : 19,
      marginTop: 8,
      maxWidth: 680,
    },
    settingsStats: {
      flexDirection: 'row',
      gap: 10,
      flexWrap: 'wrap',
    },
    statPill: {
      minWidth: TV ? 116 : 94,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: accentSofter,
      backgroundColor: theme.card,
      paddingHorizontal: TV ? 16 : 13,
      paddingVertical: TV ? 13 : 11,
    },
    statValue: {
      color: theme.text,
      fontSize: TV ? 20 : 17,
      fontWeight: '900',
    },
    statLabel: {
      color: theme.textMuted,
      fontSize: TV ? 11 : 10,
      fontWeight: '800',
      marginTop: 3,
    },

    backBtn: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: TV ? 20 : 16,
      paddingVertical: TV ? 12 : 9,
      borderRadius: 12,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: borderSoft,
      marginBottom: TV ? 18 : 16,
    },
    backBtnTxt: { color: theme.text, fontSize: TV ? 16 : 14, fontWeight: '800' },

    sectionTitle: {
      color: theme.textSub,
      fontSize: TV ? 11 : 10,
      fontWeight: '800',
      letterSpacing: 1.4,
      marginBottom: TV ? 14 : 10,
      marginTop: 2,
      textTransform: 'uppercase',
    },

    card: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: borderSoft,
      padding: TV ? 24 : 18,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 3,
    },
    centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },

    divider: { height: 1, backgroundColor: 'transparent', marginVertical: TV ? 18 : 14 },

    settingRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
    settingRowFocusWrap: {
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginHorizontal: -12,
      marginVertical: -10,
    },
    settingRowTop: { paddingTop: 18, marginTop: 18, borderTopWidth: 1, borderTopColor: borderSoft },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 20 },
    settingTitle: { color: theme.text, fontSize: TV ? 17 : 15, fontWeight: '800', marginBottom: 4 },
    settingDesc: { color: theme.textSub, fontSize: TV ? 13 : 11, lineHeight: TV ? 20 : 17 },
    valueLabel: { color: theme.accent, fontSize: TV ? 15 : 13, fontWeight: '900' },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    chip: {
      paddingHorizontal: TV ? 20 : 14, paddingVertical: TV ? 10 : 7,
      borderRadius: 12,
      backgroundColor: theme.card,
      borderWidth: 1, borderColor: borderSoft,
    },
    chipActive: { backgroundColor: theme.accent, borderColor: theme.accent },
    chipTxt: { color: theme.textSub, fontSize: TV ? 14 : 12, fontWeight: '800' },
    chipTxtActive: { color: theme.accentText, fontSize: TV ? 14 : 12, fontWeight: '900' },

    playlistRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: borderSoft,
      padding: TV ? 22 : 16,
      marginBottom: 10,
      gap: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
      elevation: 2,
    },
    playlistName: { color: theme.text, fontSize: TV ? 19 : 16, fontWeight: '800', marginBottom: 4 },
    playlistMeta: { color: theme.textSub, fontSize: TV ? 14 : 12, fontWeight: '600' },
    editBtn: {
      paddingHorizontal: TV ? 20 : 16, paddingVertical: TV ? 12 : 9,
      borderRadius: 12,
      backgroundColor: theme.card,
      borderWidth: 1, borderColor: borderSoft,
    },
    editBtnTxt: { color: theme.text, fontSize: TV ? 14 : 13, fontWeight: '800' },
    deleteBtn: {
      paddingHorizontal: TV ? 20 : 16, paddingVertical: TV ? 12 : 9,
      borderRadius: 12,
      backgroundColor: 'rgba(239,68,68,0.08)',
      borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
    },
    deleteBtnTxt: { color: '#f87171', fontSize: TV ? 14 : 13, fontWeight: '800' },

    addBtn: {
      alignItems: 'center',
      paddingVertical: TV ? 18 : 14,
      borderRadius: 16,
      backgroundColor: accentSoft,
      borderWidth: 1, borderColor: theme.accent,
      marginBottom: 4,
    },
    addBtnTxt: { color: theme.text, fontSize: TV ? 17 : 15, fontWeight: '900' },

    emptyTitle: { color: theme.text, fontSize: TV ? 18 : 15, fontWeight: '700', marginBottom: 6 },
    emptyBody: { color: theme.textMuted, fontSize: TV ? 14 : 12, lineHeight: TV ? 22 : 18 },

    refreshBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      paddingVertical: TV ? 18 : 14, borderRadius: 16,
      backgroundColor: theme.card, borderWidth: 1, borderColor: borderSoft,
    },
    refreshBtnDisabled: { opacity: 0.5 },
    refreshBtnTxt: { color: theme.text, fontSize: TV ? 17 : 15, fontWeight: '900' },

    changePinBtn: {
      alignSelf: 'flex-start',
      paddingHorizontal: TV ? 20 : 16,
      paddingVertical: TV ? 12 : 9,
      borderRadius: 12,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: borderSoft,
    },
    changePinTxt: { color: theme.text, fontSize: TV ? 14 : 13, fontWeight: '800' },

    swatchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    swatchBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: TV ? 12 : 10,
      paddingVertical: TV ? 9 : 7,
      borderRadius: 12,
      borderWidth: 1.5,
      gap: 7,
      minWidth: TV ? 110 : 90,
    },
    swatchBtnActive: { borderWidth: 2.5 },
    swatchDot: { width: TV ? 12 : 10, height: TV ? 12 : 10, borderRadius: 6 },
    swatchLabel: { fontSize: TV ? 12 : 11, fontWeight: '700' },
    colorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    colorSwatch: { width: TV ? 44 : 36, height: TV ? 44 : 36, borderRadius: 12, borderWidth: 1, borderColor: borderSoft },
    colorLabel: { color: theme.textSub, fontSize: TV ? 12 : 10, fontWeight: '800', marginBottom: 5, letterSpacing: 0.5 },
    colorInput: {
      backgroundColor: theme.card,
      color: theme.text,
      borderRadius: 12, borderWidth: 1, borderColor: borderSoft,
      paddingHorizontal: TV ? 14 : 10, paddingVertical: TV ? 10 : 8,
      fontSize: TV ? 15 : 13, fontFamily: 'monospace',
    },

    helpBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    helpTitle: { color: theme.text, fontSize: TV ? 16 : 14, fontWeight: '800' },
    helpArrow: { color: theme.accent, fontSize: TV ? 24 : 20, fontWeight: '700' },

    aboutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
    aboutLabel: { color: theme.textSub, fontSize: TV ? 14 : 12, fontWeight: '700' },
    aboutValue: { color: theme.text, fontSize: TV ? 15 : 13, fontWeight: '800' },

    modalBackdrop: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.72)',
      justifyContent: 'center', alignItems: 'center', padding: TV ? 40 : 24,
    },
    modalBox: {
      backgroundColor: theme.surface,
      borderRadius: 22,
      borderWidth: 1, borderColor: borderSoft,
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
      backgroundColor: theme.card, borderWidth: 1, borderColor: borderSoft,
      alignItems: 'center',
    },
    tabActive: { backgroundColor: theme.accent, borderColor: theme.accent },
    tabTxt: { color: theme.textSub, fontSize: TV ? 15 : 13, fontWeight: '700' },
    tabTxtActive: { color: theme.accentText },
    input: {
      backgroundColor: theme.card,
      color: theme.text,
      borderRadius: 14, borderWidth: 1, borderColor: borderSoft,
      paddingHorizontal: TV ? 18 : 14, paddingVertical: TV ? 16 : 12,
      fontSize: TV ? 16 : 14,
    },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
    cancelBtn: {
      paddingHorizontal: TV ? 24 : 18, paddingVertical: TV ? 14 : 10,
      borderRadius: 12, backgroundColor: theme.card,
      borderWidth: 1, borderColor: borderSoft, alignItems: 'center', minWidth: 110,
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
import { Platform, StyleSheet } from 'react-native';
import { Theme } from '../../theme/themes';

const TV = Platform.OS === 'android';
