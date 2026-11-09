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
  if (delta < 60_000) return 'just now';
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

// "11 Feb 2024".
export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const NBSP = '\u00a0';

// An FSRS interval in days, as a short readout: "<1 d", "9 d", "4 mo", "1.6 yr".
export function fmtInterval(days) {
  const d = Number(days);
  if (!Number.isFinite(d) || d < 1) return `<${NBSP}1${NBSP}d`;
  if (d < 31) return `${Math.round(d)}${NBSP}d`;
  if (d < 365) return `${Math.round(d / 30.44)}${NBSP}mo`;
  const y = d / 365;
  return `${y < 10 ? y.toFixed(1) : Math.round(y)}${NBSP}yr`;
}

// "1 card", "12 cards".
export function plural(n, one, many = `${one}s`) {
  return `${n}${NBSP}${n === 1 ? one : many}`;
}

// What failed, and why when known. A fetch that never reached the server
// throws a TypeError; anything else carries the server's message.
export function failText(what, err) {
  const msg = err?.message || String(err || '');
  const why = (err instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(msg))
    ? 'Server not responding.'
    : msg ? `${msg.replace(/\.$/, '')}.` : '';
  return `Couldn’t ${what}.${why ? ` ${why}` : ''}`;
}

// Note text as one plain line: drawer HTML, cloze brackets and image markers
// stripped. For labels and snippets where rich rendering would be noise.
export function plainText(text, max = Infinity, { keepCloze = false } = {}) {
  if (!text) return '';
  // DOMParser builds an inert document: no scripts run, no images load.
  const html = String(text).replace(/<(br|div|p)[^>]*>/gi, ' ');
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  const s = (body.textContent || '')
    .replace(/\[\[([^\]]+)\]\]/g, keepCloze ? '[[$1]]' : '$1')
    .replace(/\[image:[^\]]+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

// Display names for the linker's relation types (app/linker.py:RELATIONS).
export const RELATION_LABEL = {
  same_concept: 'Same concept',
  elaborates: 'Elaborates',
  example: 'Example',
  contrasts: 'Contrasts',
  prerequisite: 'Prerequisite',
  cause_effect: 'Cause and effect',
};

// The note type, as a word on its card (the edge is the document's ink).
export const TYPE_LABEL = { cloze: 'Cloze', recall: 'Recall', note: 'Note' };
