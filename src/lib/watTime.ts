// Format match kickoff timestamps in West Africa Time (WAT) with the
// full calendar date and 12-hour clock — e.g. "Friday 7 August 2026, 10:40 AM".

const WAT_TZ = 'Africa/Lagos';

export function watParts(ms: number): Intl.DateTimeFormatPart[] {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: WAT_TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).formatToParts(new Date(ms));
}

function part(parts: Intl.DateTimeFormatPart[], type: string): string {
  const hit = parts.find((p) => p.type === type);
  return hit ? hit.value : '';
}

export function formatWAT(ms: number): string {
  if (!ms || ms <= 0) return 'Time TBD';
  const parts = watParts(ms);
  const hour = part(parts, 'hour');
  const minute = part(parts, 'minute');
  const ampm = part(parts, 'dayPeriod').toUpperCase();
  return `${part(parts, 'weekday')} ${part(parts, 'day')} ${part(parts, 'month')} ${part(parts, 'year')}, ${hour}:${minute} ${ampm}`;
}

export function formatWatShort(ms: number): string {
  if (!ms || ms <= 0) return 'Time TBD';
  const parts = watParts(ms);
  return `${part(parts, 'weekday')} ${part(parts, 'day')} ${part(parts, 'month')}`;
}

export function formatWatTimeOnly(ms: number): string {
  if (!ms || ms <= 0) return 'Time TBD';
  const parts = watParts(ms);
  const hour = part(parts, 'hour');
  const minute = part(parts, 'minute');
  const ampm = part(parts, 'dayPeriod').toUpperCase();
  return `${hour}:${minute} ${ampm}`;
}

export function getWatHour(ms: number): number {
  if (!ms || ms <= 0) return 0;
  const d = new Date(ms);
  // West Africa Time (WAT) is UTC+1 (Africa/Lagos, fixed offset +01:00)
  return (d.getUTCHours() + 1) % 24;
}