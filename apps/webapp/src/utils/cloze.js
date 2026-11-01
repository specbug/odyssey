// Cloze deletion uses [[word]] marks. An annotation with N marks produces N
// study cards (one per blank, `cloze_index` 0..N-1); review hides only the
// blank at the card's index. Rendering lives in utils/render.js.

export const CLOZE_RE = /\[\[([^\]]+)\]\]/g;

export function hasCloze(text) {
  if (!text) return false;
  CLOZE_RE.lastIndex = 0;
  return CLOZE_RE.test(text);
}

export function countCloze(text) {
  if (!text) return 0;
  return (text.match(CLOZE_RE) || []).length;
}

export function extractAnswers(text) {
  if (!text) return [];
  const out = [];
  let m;
  CLOZE_RE.lastIndex = 0;
  while ((m = CLOZE_RE.exec(text)) !== null) out.push(m[1]);
  return out;
}

export function stripCloze(text) {
  if (!text) return '';
  return text.replace(CLOZE_RE, (_, inner) => inner);
}
