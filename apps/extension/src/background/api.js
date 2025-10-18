/**
 * API client for Odyssey backend
 */

const API_BASE_URL = 'http://localhost:8000';

class OdysseyAPI {
  constructor() {
    this.cache = new Map();
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Create or get webpage source
  async getOrCreateWebpageSource(url, pageTitle) {
    const cacheKey = `source:${url}`;

    // Check cache
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const source = await this.request('/sources/webpage', {
        method: 'POST',
        body: JSON.stringify({
          url,
          page_title: pageTitle,
        }),
      });

      this.cache.set(cacheKey, source);
      return source;
    } catch (error) {
      console.error('Failed to create/get webpage source:', error);
      throw error;
    }
  }

  // Create annotation
  async createAnnotation(sourceId, annotationData) {
    return this.request(`/files/${sourceId}/annotations`, {
      method: 'POST',
      body: JSON.stringify(annotationData),
    });
  }

  // Get annotations for source
  async getAnnotations(sourceId) {
    return this.request(`/files/${sourceId}/annotations`);
  }

  // Update annotation
  async updateAnnotation(annotationId, updates) {
    return this.request(`/annotations/${annotationId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // Delete annotation
  async deleteAnnotation(annotationId) {
    return this.request(`/annotations/${annotationId}`, {
      method: 'DELETE',
    });
  }

  // Get all sources
  async getSources(sourceType = null) {
    const params = sourceType ? `?source_type=${sourceType}` : '';
    return this.request(`/sources${params}`);
  }
}

export default new OdysseyAPI();
