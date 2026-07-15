/** Local-minus-UTC offset (in minutes) for `timezone` at the instant `at`. */
function getTimezoneOffsetMinutes(timezone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const asUtc = Date.UTC(+map.year, +map.month - 1, +map.day, +map.hour, +map.minute, +map.second);
  return (asUtc - at.getTime()) / 60000;
}

/**
 * The UTC instant corresponding to local midnight, "today", in `timezone` — used for daily
 * queue-number/ticket-count resets instead of the server's own (often UTC) midnight, so a branch
 * in a different timezone doesn't roll over at the wrong wall-clock hour.
 */
export function getBranchDayStart(timezone: string, at: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(at);
  const y = parts.find((p) => p.type === 'year')!.value;
  const m = parts.find((p) => p.type === 'month')!.value;
  const d = parts.find((p) => p.type === 'day')!.value;

  const utcGuess = new Date(`${y}-${m}-${d}T00:00:00Z`);
  const offsetMinutes = getTimezoneOffsetMinutes(timezone, utcGuess);
  return new Date(utcGuess.getTime() - offsetMinutes * 60000);
}
