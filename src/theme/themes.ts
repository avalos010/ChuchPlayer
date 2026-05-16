export interface Theme {
  id: string;
  name: string;
  bg: string;
  surface: string;
  card: string;
  cardActive: string;
  border: string;
  accent: string;
  accentText: string;
  text: string;
  textSub: string;
  textMuted: string;
  live: string;
  focused: string;
}

const LIVE_RED = '#ef4444';

const PRESETS: Record<string, Theme> = {
  dark: {
    id: 'dark', name: 'Dark Gray',
    bg: '#0a0a0a', surface: '#111111', card: '#161616', cardActive: '#1c1c1c',
    border: '#1e1e1e', accent: '#ffffff', accentText: '#0a0a0a',
    text: '#f5f5f5', textSub: '#888888', textMuted: '#444444',
    live: LIVE_RED, focused: '#ffffff',
  },
  amoled: {
    id: 'amoled', name: 'Amoled Black',
    bg: '#000000', surface: '#0a0a0a', card: '#111111', cardActive: '#181818',
    border: '#181818', accent: '#ffffff', accentText: '#000000',
    text: '#f5f5f5', textSub: '#888888', textMuted: '#3d3d3d',
    live: LIVE_RED, focused: '#ffffff',
  },
  blue: {
    id: 'blue', name: 'Dark Blue',
    bg: '#010a14', surface: '#0a1929', card: '#0d2137', cardActive: '#112843',
    border: '#1a3a55', accent: '#1e88e5', accentText: '#ffffff',
    text: '#e8f4fd', textSub: '#7eb8da', textMuted: '#3a6080',
    live: LIVE_RED, focused: '#1e88e5',
  },
  purple: {
    id: 'purple', name: 'Dark Purple',
    bg: '#0a0010', surface: '#120023', card: '#1a0035', cardActive: '#220045',
    border: '#2d0050', accent: '#9c27b0', accentText: '#ffffff',
    text: '#f3e5f5', textSub: '#c77dd6', textMuted: '#5a2070',
    live: LIVE_RED, focused: '#9c27b0',
  },
  green: {
    id: 'green', name: 'Dark Green',
    bg: '#001008', surface: '#0a1f10', card: '#0d2b15', cardActive: '#10361a',
    border: '#1a3d20', accent: '#2e7d32', accentText: '#ffffff',
    text: '#e8f5e9', textSub: '#81c784', textMuted: '#2e5a30',
    live: LIVE_RED, focused: '#2e7d32',
  },
  red: {
    id: 'red', name: 'Dark Red',
    bg: '#0f0000', surface: '#1a0000', card: '#250000', cardActive: '#300000',
    border: '#3d0000', accent: '#e53935', accentText: '#ffffff',
    text: '#ffebee', textSub: '#ef9a9a', textMuted: '#6d2020',
    live: '#ff7043', focused: '#e53935',
  },
  light: {
    id: 'light', name: 'Light',
    bg: '#f0f0f0', surface: '#ffffff', card: '#eeeeee', cardActive: '#e3e3e3',
    border: '#d5d5d5', accent: '#1976d2', accentText: '#ffffff',
    text: '#111111', textSub: '#555555', textMuted: '#999999',
    live: LIVE_RED, focused: '#1976d2',
  },
};

export const THEME_IDS = Object.keys(PRESETS) as (keyof typeof PRESETS)[];
export const THEME_LIST = THEME_IDS.map((id) => PRESETS[id]);

export function getPreset(id: string): Theme {
  return PRESETS[id] ?? PRESETS.dark;
}

// Derive surface/card/border from a custom background hex.
// Adds lightness offsets so the hierarchy feels right regardless of hue.
function adjustHex(hex: string, amount: number): string {
  const r = Math.min(255, Math.max(0, parseInt(hex.slice(1, 3), 16) + amount));
  const g = Math.min(255, Math.max(0, parseInt(hex.slice(3, 5), 16) + amount));
  const b = Math.min(255, Math.max(0, parseInt(hex.slice(5, 7), 16) + amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function contrastText(bg: string): string {
  const r = parseInt(bg.slice(1, 3), 16);
  const g = parseInt(bg.slice(3, 5), 16);
  const b = parseInt(bg.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#111111' : '#f5f5f5';
}

export function buildCustomTheme(bg: string, accent: string): Theme {
  const safeHex = (h: string) => /^#[0-9a-fA-F]{6}$/.test(h) ? h : '#0a0a0a';
  const safeBg = safeHex(bg);
  const safeAccent = safeHex(accent);
  const isDark = parseInt(safeBg.slice(1, 3), 16) < 128;
  const step = isDark ? 10 : -10;

  return {
    id: 'custom', name: 'Custom',
    bg: safeBg,
    surface: adjustHex(safeBg, step),
    card: adjustHex(safeBg, step * 2),
    cardActive: adjustHex(safeBg, step * 3),
    border: adjustHex(safeBg, step * 2),
    accent: safeAccent,
    accentText: contrastText(safeAccent),
    text: isDark ? '#f5f5f5' : '#111111',
    textSub: isDark ? '#888888' : '#555555',
    textMuted: isDark ? '#444444' : '#999999',
    live: LIVE_RED,
    focused: safeAccent,
  };
}

export default PRESETS;
