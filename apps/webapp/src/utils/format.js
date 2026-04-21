// Human-friendly date formatting for notes/library rows.

const DAY = 86_400_000;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

export function relativeDate(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const delta = Date.now() - then;
  if (delta < 0) return 'just now';
  if (delta < 60_000) return 'moments ago';
  if (delta < 3_600_000) {
    const m = Math.floor(delta / 60_000);
    return m === 1 ? 'a minute ago' : `${m} minutes ago`;
  }
  if (delta < DAY) {
    const h = Math.floor(delta / 3_600_000);
    return h === 1 ? 'an hour ago' : `${h} hours ago`;
  }
  if (delta < 2 * DAY) return 'yesterday';
  if (delta < WEEK) return `${Math.floor(delta / DAY)} days ago`;
  if (delta < 2 * WEEK) return 'a week ago';
  if (delta < MONTH) return `${Math.floor(delta / WEEK)} weeks ago`;
  if (delta < 2 * MONTH) return 'a month ago';
  if (delta < YEAR) return `${Math.floor(delta / MONTH)} months ago`;
  return `${Math.floor(delta / YEAR)} years ago`;
}

// "2024·02·11" style — designed to sit quietly next to mono metadata.
export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}·${pad(d.getMonth() + 1)}·${pad(d.getDate())}`;
}
