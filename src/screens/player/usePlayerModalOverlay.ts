export interface PlayerModalOverlayState {
  showEPG: boolean;
  showEPGGrid: boolean;
  showChannelList: boolean;
  showGroupsPlaylists: boolean;
  showPrimaryNavigation: boolean;
  showProgramInfo: boolean;
  showSleepTimer: boolean;
  showChannelNumberPad: boolean;
  showInfoBar: boolean;
}

export const hasPlayerModalOverlay = (state: PlayerModalOverlayState) =>
  state.showEPG ||
  state.showEPGGrid ||
  state.showChannelList ||
  state.showGroupsPlaylists ||
  state.showPrimaryNavigation ||
  state.showProgramInfo ||
  state.showSleepTimer ||
  state.showChannelNumberPad ||
  state.showInfoBar;
