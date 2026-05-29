import { formatClockTime } from '../time';

describe('formatClockTime', () => {
  const value = new Date('2024-01-01T13:05:00.000Z');

  it('formats 24h times', () => {
    expect(
      formatClockTime(value, '24h', {
        timeZone: 'UTC',
        hour: '2-digit',
        minute: '2-digit',
      }),
    ).toBe('13:05');
  });

  it('formats 12h times', () => {
    expect(
      formatClockTime(value, '12h', {
        timeZone: 'UTC',
        hour: 'numeric',
        minute: '2-digit',
      }),
    ).toBe('1:05 PM');
  });
});
