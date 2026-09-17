import { StyleSheet } from 'react-native';
import { isTvLikePlatform } from '../../utils/platform';

const TV = isTvLikePlatform;

interface EpgGridStyleConfig {
  channelColumnWidth: number;
  timeSlotWidth: number;
  timeHeaderHeight: number;
  infoPanelHeight: number;
  groupRailWidth: number;
}

export const createEpgGridStyles = ({
  channelColumnWidth: CH_COL,
  timeSlotWidth: SLOT_W,
  timeHeaderHeight: HDR_H,
  infoPanelHeight: INFO_H,
  groupRailWidth: GROUP_RAIL_W,
}: EpgGridStyleConfig) => StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#05080d',
    zIndex: 25,
    elevation: 25,
  },

  // Loading
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40, elevation: 40,
    backgroundColor: 'rgba(5,8,13,0.94)',
    justifyContent: 'center', alignItems: 'center', gap: 12,
  },
  loadingTxt: { color: '#9fb3c8', fontSize: TV ? 17 : 14, fontWeight: '700' },

  loadingBadge: {
    position: 'absolute',
    top: TV ? 24 : 18, right: TV ? 24 : 18,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(8,13,21,0.95)',
    borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.16)',
    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6,
    zIndex: 45, elevation: 45,
  },
  loadingBadgeTxt: { color: '#9fb3c8', fontSize: TV ? 12 : 11, fontWeight: '700' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: TV ? 22 : 18,
    paddingVertical: TV ? 12 : 10,
    backgroundColor: '#05080d',
    borderBottomWidth: 1, borderBottomColor: 'rgba(148, 163, 184, 0.14)',
  },
  headerTitle: {
    color: '#e8f0fa',
    fontSize: TV ? 22 : 18,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  headerSub: {
    color: '#7f96b2',
    fontSize: TV ? 12 : 10,
    fontWeight: '700',
    marginTop: 3,
  },
  headerBtns: { flexDirection: 'row', gap: 10 },
  hBtn: {
    width: TV ? 50 : 42, height: TV ? 50 : 42,
    borderRadius: TV ? 12 : 10,
    backgroundColor: '#101826', borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.16)',
    justifyContent: 'center', alignItems: 'center',
  },
  hBtnClose: { backgroundColor: '#0a101a', borderColor: 'rgba(148, 163, 184, 0.12)' },
  hBtnIcon: { color: '#cbd5e1', fontSize: TV ? 20 : 17, fontWeight: '800' },

  gridWrap: {
    flex: 1,
  },
  leftGroupHotspot: {
    position: 'absolute',
    left: 0,
    top: HDR_H,
    bottom: 0,
    width: TV ? 34 : 28,
    backgroundColor: 'transparent',
    zIndex: 78,
    elevation: 78,
  },

  groupRail: {
    position: 'absolute',
    left: 0,
    top: INFO_H + (TV ? 75 : 63),
    bottom: 0,
    width: GROUP_RAIL_W,
    backgroundColor: 'rgba(5, 8, 13, 0.97)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(148, 163, 184, 0.18)',
    zIndex: 80,
    elevation: 80,
    paddingHorizontal: TV ? 14 : 10,
    paddingTop: TV ? 14 : 10,
  },
  groupRailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: TV ? 12 : 8,
    paddingHorizontal: TV ? 4 : 2,
  },
  groupRailTitle: {
    color: '#e8f0fa',
    fontSize: TV ? 18 : 15,
    fontWeight: '900',
  },
  groupRailClose: {
    width: TV ? 42 : 36,
    height: TV ? 42 : 36,
    borderRadius: 8,
    backgroundColor: '#101826',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.16)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupRailCloseTxt: {
    color: '#cbd5e1',
    fontSize: TV ? 25 : 20,
    fontWeight: '900',
  },
  groupRailScroll: {
    paddingBottom: TV ? 24 : 18,
    gap: TV ? 8 : 6,
  },
  groupRailItem: {
    minHeight: TV ? 64 : 54,
    borderRadius: 8,
    backgroundColor: '#0b111d',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  groupRailItemActive: {
    backgroundColor: '#17263c',
    borderColor: 'rgba(103, 215, 255, 0.45)',
  },
  groupRailAccent: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: 'transparent',
  },
  groupRailMeta: {
    flex: 1,
    paddingHorizontal: TV ? 13 : 10,
    gap: 3,
  },
  groupRailName: {
    color: '#dbeafe',
    fontSize: TV ? 14 : 12,
    fontWeight: '800',
  },
  groupRailNameActive: {
    color: '#f8fafc',
  },
  groupRailCount: {
    color: '#7f96b2',
    fontSize: TV ? 11 : 9,
    fontWeight: '700',
  },
  groupRailCountActive: {
    color: '#9ee7ff',
  },

  // Error banner
  errBanner: {
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(239,68,68,0.25)',
    paddingHorizontal: TV ? 28 : 20, paddingVertical: 10,
  },
  errTxt: { color: '#f87171', fontSize: TV ? 14 : 12, fontWeight: '500' },

  // Time header
  timeHeader: {
    height: HDR_H,
    backgroundColor: '#070b12',
    borderBottomWidth: 1, borderBottomColor: 'rgba(148, 163, 184, 0.14)',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  timeSlot: {
    width: SLOT_W, height: HDR_H,
    justifyContent: 'center', alignItems: 'center',
    borderRightWidth: 1, borderRightColor: 'rgba(148, 163, 184, 0.1)',
  },
  timeSlotNow: { backgroundColor: 'rgba(56,189,248,0.1)' },
  timeText:    { color: '#8fa4bd', fontSize: TV ? 12 : 10, fontWeight: '800', letterSpacing: 0.5 },
  timeTextNow: { color: '#67d7ff' },
  timeChLabel: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: CH_COL,
    borderRightWidth: 1, borderRightColor: 'rgba(148, 163, 184, 0.14)',
    backgroundColor: '#070b12',
    justifyContent: 'center', paddingHorizontal: TV ? 20 : 14, zIndex: 8,
  },
  timeChLabelTxt: { color: '#8fa4bd', fontSize: TV ? 10 : 8, fontWeight: '900', letterSpacing: 2 },

  // Row
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: 'rgba(148, 163, 184, 0.08)',
    borderLeftWidth: 5, overflow: 'hidden',
  },

  // Program blocks
  block: {
    position: 'absolute', borderRadius: 5, borderWidth: 1,
    paddingHorizontal: TV ? 10 : 8, paddingVertical: TV ? 7 : 5,
    justifyContent: 'center', overflow: 'hidden',
  },
  blockTitle: { fontSize: TV ? 13 : 11, fontWeight: '800', lineHeight: TV ? 17 : 15 },
  blockTime:  { fontSize: TV ? 10 : 9, fontWeight: '700', marginTop: 2 },
  blockDesc:  { color: '#475569', fontSize: TV ? 10 : 9, marginTop: 4, lineHeight: TV ? 14 : 13 },
  noData: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  noDataText: { color: '#64748b', fontSize: TV ? 12 : 10, fontWeight: '700' },

  timeLine: {
    position: 'absolute', top: 0, bottom: 0,
    width: 2.5, backgroundColor: '#38bdf8', zIndex: 20,
  },
  timeDot: {
    position: 'absolute', top: -4, left: -5,
    width: 11, height: 11, borderRadius: 6,
    backgroundColor: '#38bdf8', borderWidth: 2, borderColor: '#05080d',
  },

  // Channel column
  chCol: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: CH_COL,
    borderRightWidth: 1, borderRightColor: 'rgba(148, 163, 184, 0.14)',
    zIndex: 6, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: TV ? 12 : 9, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.7, shadowRadius: 12, elevation: 8,
  },
  channelNumber: {
    color: '#67d7ff',
    fontSize: TV ? 12 : 10,
    fontWeight: '900',
    minWidth: TV ? 30 : 26,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  chMeta: { flex: 1 },
  chName: {
    color: '#dbeafe',
    fontSize: TV ? 13 : 11,
    fontWeight: '800',
    lineHeight: TV ? 17 : 15,
    marginBottom: 2,
  },
  chNow:  { color: '#8fa4bd', fontSize: TV ? 10 : 9, fontWeight: '700' },
  chGroup:{ color: '#405060', fontSize: TV ? 10 : 8, fontWeight: '500', marginTop: 1 },
  logoFallback: {
    borderRadius: 8, backgroundColor: '#111827',
    borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.16)',
    justifyContent: 'center', alignItems: 'center',
  },
  logoInitials: { color: '#9fb3c8', fontSize: TV ? 14 : 11, fontWeight: '900' },
  onNowBadge: {
    position: 'absolute', bottom: 6, right: 8,
    backgroundColor: '#ef4444', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  onNowText: { color: '#ffffff', fontSize: TV ? 9 : 7, fontWeight: '800', letterSpacing: 0.5 },
  catchupBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#1a3550',
    borderRadius: 3,
    paddingHorizontal: 5, paddingVertical: 1,
    marginTop: 3,
  },
  catchupText: { color: '#5aaad0', fontSize: TV ? 9 : 7, fontWeight: '800', letterSpacing: 0.3 },
});
