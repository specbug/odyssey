// Deterministic hue (0-360) from a Blake3 hex hash.
// Used when a doc's color_hue column is null — the hash gives us a stable
// per-doc tint without extra storage.
export function hashToHue(hash) {
  if (!hash || typeof hash !== 'string') return 220;
  const prefix = hash.slice(0, 8);
  const n = parseInt(prefix, 16);
  if (!Number.isFinite(n)) return 220;
  return n % 360;
}
