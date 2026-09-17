import { isTvLikePlatform } from '../../utils/platform';
import { createEpgGridStyles } from './EpgGridStyles';
import { INFO_H } from './EpgInfoPanel';

export const TV = isTvLikePlatform;
export const CH_COL = TV ? 286 : 226;
export const SLOT_W = TV ? 184 : 136;
export const ROW_H = TV ? 92 : 72;
export const ROW_H_F = TV ? 118 : 92;
export const HDR_H = TV ? 50 : 42;
export const GROUP_RAIL_W = TV ? 282 : 232;

export const s = createEpgGridStyles({
  channelColumnWidth: CH_COL,
  timeSlotWidth: SLOT_W,
  timeHeaderHeight: HDR_H,
  infoPanelHeight: INFO_H,
  groupRailWidth: GROUP_RAIL_W,
});

export const HDR_BTN_FOCUSED = {
  backgroundColor: '#ffffff',
  borderColor: '#ffffff',
  borderWidth: 2,
  transform: [] as any[],
  elevation: 6,
  shadowColor: '#ffffff',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.2,
  shadowRadius: 8,
};
