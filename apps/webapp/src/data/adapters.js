import { hasCloze } from '../utils/cloze';
import { relativeDate, formatDate } from '../utils/format';

// API shape → design shape. Pure functions, no fetching.

// File row (PDFFileResponse) → LibraryScreen's `doc`.
export function toLibraryDoc(file) {
  if (!file) return null;
  const title = file.display_name || file.original_filename || 'Untitled';
  return {
    id: file.id,
    title,
    authors: file.author || '',
    pages: file.total_pages || 0,
    read: file.last_read_position || 0,
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
    page: (ann.page_index != null ? ann.page_index + 1 : null),
    date: relativeDate(ann.updated_date || ann.created_date),
    rawDate: ann.updated_date || ann.created_date,
    type,
    excerpt,
    prompt,
    answer,
    tags: Array.isArray(ann.tags) ? ann.tags : [],
    tag: ann.tag || '',
    linkCount: ann.link_count || 0,
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
