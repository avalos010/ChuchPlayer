export const WEB_PLAYER_ACCENT = '#1fa2ff';
export const WEB_PLAYER_SIDEBAR_WIDTH = 430;

export const fmtTime = (date?: Date | null): string => {
  if (!date) return '';
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  return value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const progressPct = (start?: Date | null, end?: Date | null): number => {
  if (!start || !end) return 0;
  const now = Date.now();
  const startMs = start.getTime();
  const endMs = end.getTime();
  if (now < startMs || now > endMs) return 0;
  return Math.min(100, ((now - startMs) / (endMs - startMs)) * 100);
};
