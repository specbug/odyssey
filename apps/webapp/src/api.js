// ApiService — a thin fetch wrapper around the FastAPI backend.
// Each method throws on non-2xx so callers can try/catch per call.
//
// Base URL rules:
//   - dev: http://localhost:8000 (CRA dev server + uvicorn on :8000)
//   - prod: /api (served by nginx + FastAPI behind it)
// PUBLIC_URL is injected by CRA at build time.

const API_BASE_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:8000'
    : `${process.env.PUBLIC_URL || ''}/api`;

async function asJson(res) {
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.detail || res.statusText; }
    catch { detail = res.statusText; }
    const err = new Error(`${res.status} ${detail}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

class ApiService {
  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  // ─── Files ────────────────────────────────────────────────────────────
  async uploadFile(file) {
    const fd = new FormData();
    fd.append('file', file);
    return asJson(await fetch(`${this.baseUrl}/upload`, { method: 'POST', body: fd }));
  }

  async getFiles() {
    return asJson(await fetch(`${this.baseUrl}/files`));
  }

  async getFile(fileId) {
    return asJson(await fetch(`${this.baseUrl}/files/${fileId}`));
  }

  async downloadFile(fileId, hash = null) {
    const res = await fetch(this.fileDownloadUrl(fileId, hash));
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    return res.blob();
  }

  // Append the file hash as `?v=<hash>` when known — file_id is a SQLite rowid
  // that SQLite reuses after a delete, so the URL by itself is not a stable
  // cache key. Including the hash guarantees the browser treats two different
  // underlying PDFs (sharing the same reused id) as distinct URLs.
  fileDownloadUrl(fileId, hash = null) {
    const base = `${this.baseUrl}/files/${fileId}/download`;
    return hash ? `${base}?v=${encodeURIComponent(hash)}` : base;
  }

  async deleteFile(fileId) {
    return asJson(await fetch(`${this.baseUrl}/files/${fileId}`, { method: 'DELETE' }));
  }

  async updateFileZoom(fileId, zoomLevel) {
    return asJson(await fetch(`${this.baseUrl}/files/${fileId}/zoom`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zoom_level: zoomLevel }),
    }));
  }

  async updateReadPosition(fileId, position) {
    return asJson(await fetch(`${this.baseUrl}/files/${fileId}/position`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ last_read_position: position }),
    }));
  }

  async updateTotalPages(fileId, totalPages) {
    return asJson(await fetch(`${this.baseUrl}/files/${fileId}/pages`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ total_pages: totalPages }),
    }));
  }

  async updateFileMetadata(fileId, { author, color_hue, excerpt }) {
    const body = {};
    if (author !== undefined) body.author = author;
    if (color_hue !== undefined) body.color_hue = color_hue;
    if (excerpt !== undefined) body.excerpt = excerpt;
    return asJson(await fetch(`${this.baseUrl}/files/${fileId}/metadata`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }));
  }

  // ─── Annotations ─────────────────────────────────────────────────────
  async createAnnotation(fileId, annotation) {
    return asJson(await fetch(`${this.baseUrl}/files/${fileId}/annotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(annotation),
    }));
  }

  async createStandaloneAnnotation(annotation) {
    return asJson(await fetch(`${this.baseUrl}/annotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(annotation),
    }));
  }

  async getAnnotations(fileId) {
    return asJson(await fetch(`${this.baseUrl}/files/${fileId}/annotations`));
  }

  async getAllAnnotations({ source, tag } = {}) {
    const params = new URLSearchParams();
    if (source != null) params.set('source', String(source));
    if (tag) params.set('tag', tag);
    const qs = params.toString();
    return asJson(await fetch(`${this.baseUrl}/annotations${qs ? `?${qs}` : ''}`));
  }

  async updateAnnotation(annotationId, annotationData) {
    return asJson(await fetch(`${this.baseUrl}/annotations/${annotationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(annotationData),
    }));
  }

  async deleteAnnotation(annotationId) {
    return asJson(await fetch(`${this.baseUrl}/annotations/${annotationId}`, {
      method: 'DELETE',
    }));
  }

  // ─── Images ──────────────────────────────────────────────────────────
  async uploadImage(blob) {
    const fd = new FormData();
    fd.append('file', blob);
    return asJson(await fetch(`${this.baseUrl}/images/upload`, { method: 'POST', body: fd }));
  }

  imageUrl(uuid) {
    return `${this.baseUrl}/images/${uuid}`;
  }

  // ─── Study cards & review ────────────────────────────────────────────
  async createStudyCard(annotationId) {
    return asJson(await fetch(
      `${this.baseUrl}/study-cards?annotation_id=${annotationId}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } }
    ));
  }

  async getDueCards(fileId = null, limit = 50) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (fileId != null) params.set('file_id', String(fileId));
    return asJson(await fetch(`${this.baseUrl}/study-cards/due?${params.toString()}`));
  }

  async getStudyCard(cardId) {
    return asJson(await fetch(`${this.baseUrl}/study-cards/${cardId}`));
  }

  async reviewCard(cardId, { rating, time_taken, session_id } = {}) {
    return asJson(await fetch(`${this.baseUrl}/study-cards/${cardId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card_id: cardId, rating, time_taken, session_id }),
    }));
  }

  async getCardTimeline(cardId) {
    return asJson(await fetch(`${this.baseUrl}/study-cards/${cardId}/timeline`));
  }

  async getCardProgression(cardId, steps = 4) {
    return asJson(await fetch(`${this.baseUrl}/study-cards/${cardId}/progression?steps=${steps}`));
  }

  async startSession(userId = null) {
    return asJson(await fetch(`${this.baseUrl}/review-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userId ? { user_id: userId } : {}),
    }));
  }

  async endSession(sessionId) {
    return asJson(await fetch(`${this.baseUrl}/review-sessions/${sessionId}/end`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
    }));
  }

  // ─── Stats ───────────────────────────────────────────────────────────
  async getDashboardStats() {
    return asJson(await fetch(`${this.baseUrl}/stats/dashboard`));
  }

  async getStudyStats() {
    return asJson(await fetch(`${this.baseUrl}/study-stats`));
  }

  async healthCheck() {
    return asJson(await fetch(`${this.baseUrl}/health`));
  }
}

const apiService = new ApiService();
export default apiService;
