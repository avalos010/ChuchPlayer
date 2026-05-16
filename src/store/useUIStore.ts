/**
 * UI Store - Manages all UI visibility states
 * 
 * This store is separate from player state because:
 * - UI state changes frequently (user interactions)
 * - UI state is presentation-only (no business logic)
 * - Components can subscribe only to UI state they need
 */

import { create } from 'zustand';
import { Channel, EPGProgram } from '../types';

export interface ProgramInfoData {
  channel: Channel;
  program: EPGProgram;
}

interface UIState {
  // Overlay visibility
  showEPG: boolean;
  showEPGGrid: boolean;
  showChannelList: boolean;
  showGroupsPlaylists: boolean;
  showChannelNumberPad: boolean;
  showVolumeIndicator: boolean;
  showControls: boolean;
  showFloatingButtons: boolean;
  showInfoBar: boolean;
  showProgramInfo: boolean;
  showSleepTimer: boolean;

  selectedGroup: string | null;
  programInfoData: ProgramInfoData | null;

  // Actions
  setShowEPG: (show: boolean) => void;
  setShowEPGGrid: (show: boolean) => void;
  setShowChannelList: (show: boolean) => void;
  setShowGroupsPlaylists: (show: boolean) => void;
  setShowChannelNumberPad: (show: boolean) => void;
  setShowVolumeIndicator: (show: boolean) => void;
  setShowControls: (show: boolean) => void;
  setShowFloatingButtons: (show: boolean) => void;
  setShowInfoBar: (show: boolean) => void;
  setShowProgramInfo: (show: boolean, data?: ProgramInfoData | null) => void;
  setShowSleepTimer: (show: boolean) => void;
  setSelectedGroup: (group: string | null) => void;

  // Helper actions
  closeAllOverlays: () => void;
  toggleEPG: () => void;
  toggleControls: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Initial state
  showEPG: false,
  showEPGGrid: false,
  showChannelList: false,
  showGroupsPlaylists: false,
  showChannelNumberPad: false,
  showVolumeIndicator: false,
  showControls: true,
  showFloatingButtons: false,
  showInfoBar: false,
  showProgramInfo: false,
  showSleepTimer: false,
  selectedGroup: null,
  programInfoData: null,

  // Actions
  setShowEPG: (show) => set({ showEPG: show }),
  setShowEPGGrid: (show) => set({ showEPGGrid: show }),
  setShowChannelList: (show) => set({ showChannelList: show }),
  setShowGroupsPlaylists: (show) => set({ showGroupsPlaylists: show }),
  setShowChannelNumberPad: (show) => set({ showChannelNumberPad: show }),
  setShowVolumeIndicator: (show) => set({ showVolumeIndicator: show }),
  setShowControls: (show) => set({ showControls: show }),
  setShowFloatingButtons: (show) => set({ showFloatingButtons: show }),
  setShowInfoBar: (show) => set({ showInfoBar: show }),
  setShowProgramInfo: (show, data) => set({ showProgramInfo: show, programInfoData: data ?? null }),
  setShowSleepTimer: (show) => set({ showSleepTimer: show }),
  setSelectedGroup: (group) => set({ selectedGroup: group }),

  // Helper actions
  closeAllOverlays: () => set({
    showEPG: false,
    showEPGGrid: false,
    showChannelList: false,
    showGroupsPlaylists: false,
    showChannelNumberPad: false,
    showProgramInfo: false,
    showSleepTimer: false,
    selectedGroup: null,
  }),
  toggleEPG: () => set((state) => ({ showEPG: !state.showEPG })),
  toggleControls: () => set((state) => ({ showControls: !state.showControls })),
}));


