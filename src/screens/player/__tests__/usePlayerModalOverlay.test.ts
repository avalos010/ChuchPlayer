import { hasPlayerModalOverlay, PlayerModalOverlayState } from '../usePlayerModalOverlay';

const closedState = (): PlayerModalOverlayState => ({
  showEPG: false,
  showEPGGrid: false,
  showChannelList: false,
  showGroupsPlaylists: false,
  showProgramInfo: false,
  showSleepTimer: false,
  showChannelNumberPad: false,
  showInfoBar: false,
});

describe('hasPlayerModalOverlay', () => {
  it('treats the expanded info-bar controls as a modal overlay', () => {
    expect(hasPlayerModalOverlay({ ...closedState(), showInfoBar: true })).toBe(true);
  });

  it('allows the player D-pad zones when every overlay is closed', () => {
    expect(hasPlayerModalOverlay(closedState())).toBe(false);
  });
});
