import { hashToHue } from '../utils/hue';
import { hasCloze } from '../utils/cloze';
import { relativeDate, formatDate } from '../utils/format';

// API shape → design shape. Pure functions, no fetching.

// File row (PDFFileResponse) → LibraryScreen's `doc`.
export function toLibraryDoc(file) {
  if (!file) return null;
  const title = file.display_name || file.original_filename || 'Untitled';
  const hue = Number.isFinite(file.color_hue) ? file.color_hue : hashToHue(file.file_hash);
  return {
    id: file.id,
    title,
    authors: file.author || '—',
    pages: file.total_pages || 0,
    read: file.last_read_position || 0,
    hue,
    added: formatDate(file.upload_date),
    cards: file.annotation_count || 0,
    due: file.due_count || 0,
    retained: null, // per-doc retention not yet in schema
    sample: file.excerpt || null,
    fileHash: file.file_hash,
    // pass-throughs for screens that need raw data
    raw: file,
  };
}

// AnnotationResponse → design's NotesScreen note shape.
export function toNote(ann) {
  if (!ann) return null;
  const prompt = ann.question || '';
  const answer = ann.answer || '';
  const excerpt = ann.highlighted_text || prompt || '';
  const isCloze = hasCloze(prompt) || hasCloze(excerpt);
  const type = isCloze ? 'cloze' : answer ? 'recall' : 'note';
  return {
    id: ann.id,
    source: ann.file_id,
    sourceTitle: ann.file_title || null,
    sourceHue: Number.isFinite(ann.file_color_hue) ? ann.file_color_hue : null,
    page: (ann.page_index != null ? ann.page_index + 1 : null),
    date: relativeDate(ann.updated_date || ann.created_date),
    rawDate: ann.updated_date || ann.created_date,
    type,
    excerpt,
    prompt,
    answer,
    tags: Array.isArray(ann.tags) ? ann.tags : [],
    tag: ann.tag || '',
    stability: 0, // filled from study card if linked (not always needed)
    raw: ann,
  };
}

// StudyCardResponse → review queue card shape.
// For cloze annotations with multiple blanks, each blank lives on its own card
// (backend fans out to N StudyCards); `clozeIndex` picks which blank to hide.
export function toQueueCard(card) {
  if (!card) return null;
  const ann = card.annotation || {};
  const isCloze = hasCloze(ann.question || ann.highlighted_text || '');
  return {
    id: card.id,
    annotationId: card.annotation_id,
    clozeIndex: Number.isInteger(card.cloze_index) ? card.cloze_index : 0,
    source: ann.file_id ?? null,
    type: isCloze ? 'cloze' : 'recall',
    prompt: ann.question || ann.highlighted_text || '',
    answer: ann.answer || '',
    interval: card.scheduled_days || 0,
    stability: Math.round((card.stability || 0) * 10) / 10,
    nextIntervals: Array.isArray(card.next_intervals) && card.next_intervals.length === 4
      ? card.next_intervals
      : [1, 1, 1, 1],
    state: card.state || 'New',
    raw: card,
  };
}

// DashboardStats → home Memory tiles.
export function toStats(s) {
  if (!s) return { retained: '—', stability: '—', sessions: '—', streak: '—', cardsInLog: 0 };
  const retainedPct = Number.isFinite(s.retention_14d) ? Math.round(s.retention_14d * 100) : 0;
  const stabilityDays = Number.isFinite(s.stability_avg_days) ? s.stability_avg_days : 0;
  return {
    retained: `${retainedPct}%`,
    stability: `${stabilityDays.toFixed(1)}d`,
    sessions: String(s.sessions_quarter || 0),
    streak: String(s.streak_days || 0),
    cardsInLog: s.cards_in_log || 0,
  };
}

// Build the `prompts` array for a starburst glyph from an array of queue cards.
export function queueToStarburstPrompts(queue, currentIdx = 0) {
  return (queue || []).map((c, i) => ({
    days: c.interval || c.stability || 7,
    state: i < currentIdx ? 'review' : i === currentIdx ? 'learning' : 'new',
    heavy: i === currentIdx,
  }));
}
