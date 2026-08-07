// Format match kickoff timestamps in West Africa Time (WAT, UTC+1) with the
// full calendar date and 12-hour clock — e.g. "Friday 7 August 2026, 10:40AM".

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
  return `${part(parts, 'weekday')} ${part(parts, 'day')} ${part(parts, 'month')} ${part(parts, 'year')}, ${hour}:${minute}${ampm}`;
}

export function formatWatShort(ms: number): string {
  if (!ms || ms <= 0) return 'Time TBD';
  const parts = watParts(ms);
  return `${part(parts, 'weekday')} ${part(parts, 'day')} ${part(parts, 'month')}`;
}