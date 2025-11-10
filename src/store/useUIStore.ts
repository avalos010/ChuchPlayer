/**
 * UI Store - Manages all UI visibility states
 * 
 * This store is separate from player state because:
 * - UI state changes frequently (user interactions)
 * - UI state is presentation-only (no business logic)
 * - Components can subscribe only to UI state they need
 */

import { create } from 'zustand';

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

  selectedGroup: string | null;

  // Actions
  setShowEPG: (show: boolean) => void;
  setShowEPGGrid: (show: boolean) => void;
  setShowChannelList: (show: boolean) => void;
  setShowGroupsPlaylists: (show: boolean) => void;
  setShowChannelNumberPad: (show: boolean) => void;
  setShowVolumeIndicator: (show: boolean) => void;
  setShowControls: (show: boolean) => void;
  setShowFloatingButtons: (show: boolean) => void;
  setSelectedGroup: (group: string | null) => void;

  // Helper actions
  closeAllOverlays: () => void;
  toggleEPG: () => void;
  toggleControls: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  // Initial state
  showEPG: false,
  showEPGGrid: false,
  showChannelList: false,
  showGroupsPlaylists: false,
  showChannelNumberPad: false,
  showVolumeIndicator: false,
  showControls: true,
  showFloatingButtons: false,
  selectedGroup: null,

  // Actions
  setShowEPG: (show) => set({ showEPG: show }),
  setShowEPGGrid: (show) => set({ showEPGGrid: show }),
  setShowChannelList: (show) => set({ showChannelList: show }),
  setShowGroupsPlaylists: (show) => set({ showGroupsPlaylists: show }),
  setShowChannelNumberPad: (show) => set({ showChannelNumberPad: show }),
  setShowVolumeIndicator: (show) => set({ showVolumeIndicator: show }),
  setShowControls: (show) => set({ showControls: show }),
  setShowFloatingButtons: (show) => set({ showFloatingButtons: show }),
  setSelectedGroup: (group) => set({ selectedGroup: group }),

  // Helper actions
  closeAllOverlays: () => set({
    showEPG: false,
    showEPGGrid: false,
    showChannelList: false,
    showGroupsPlaylists: false,
    showChannelNumberPad: false,
    selectedGroup: null,
  }),
  toggleEPG: () => set((state) => ({ showEPG: !state.showEPG })),
  toggleControls: () => set((state) => ({ showControls: !state.showControls })),
}));


