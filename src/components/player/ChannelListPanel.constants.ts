import { isTvLikePlatform } from '../../utils/platform';

export type TabId = 'all' | 'fav' | 'recent';

export const TV = isTvLikePlatform;
export const PANEL_W = TV ? 340 : 300;
export const EPG_W = TV ? 400 : 290;
export const TOTAL_W = PANEL_W + EPG_W;
export const GROUPS_PANEL_W = TV ? 300 : 240;
export const NAVIGATION_PANEL_W = TV ? 240 : 210;
export const SLIDE_DUR = 120;
export const PANEL_ALPHA = 0.8;
export const TINT_ALPHA = 0.35;

export const TABS: { id: TabId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'fav', label: '★ Fav' },
  { id: 'recent', label: '🕒 Recent' },
];
