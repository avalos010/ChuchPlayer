/**
 * EPG Store - Manages EPG (Electronic Program Guide) state
 * 
 * This store handles:
 * - Current program information
 * - EPG data caching (if needed in future)
 * 
 * Separated because EPG is a distinct feature domain
 */

import { create } from 'zustand';
import { EPGProgram } from '../types';

interface EPGState {
  currentProgram: EPGProgram | null;

  // Actions
  setCurrentProgram: (program: EPGProgram | null) => void;
}

export const useEPGStore = create<EPGState>((set) => ({
  // Initial state
  currentProgram: null,

  // Actions
  setCurrentProgram: (program) => set({ currentProgram: program }),
}));

