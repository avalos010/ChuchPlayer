export interface PlayerModalOverlayState {
  showEPG: boolean;
  showEPGGrid: boolean;
  showChannelList: boolean;
  showGroupsPlaylists: boolean;
  showProgramInfo: boolean;
  showSleepTimer: boolean;
  showChannelNumberPad: boolean;
}

export const hasPlayerModalOverlay = (state: PlayerModalOverlayState) =>
  state.showEPG ||
  state.showEPGGrid ||
  state.showChannelList ||
  state.showGroupsPlaylists ||
  state.showProgramInfo ||
  state.showSleepTimer ||
  state.showChannelNumberPad;
