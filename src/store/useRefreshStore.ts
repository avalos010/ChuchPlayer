import { create } from 'zustand';

interface RefreshState {
  triggerRefresh: (() => Promise<void>) | null;
  setTriggerRefresh: (fn: (() => Promise<void>) | null) => void;
}

export const useRefreshStore = create<RefreshState>((set) => ({
  triggerRefresh: null,
  setTriggerRefresh: (fn) => set({ triggerRefresh: fn }),
}));
