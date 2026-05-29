export const formatClockTime = (
  value?: Date | number | string | null,
  clockFormat: '12h' | '24h' = '24h',
  options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
  },
) => {
  if (value === undefined || value === null) return '';

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleTimeString([], {
    ...options,
    hour12: clockFormat === '12h',
  });
};
