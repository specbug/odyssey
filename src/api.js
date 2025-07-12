// Use different API base URLs for development vs production
const API_BASE_URL = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:8000' 
    : '/api';

class ApiService {
    constructor() {
        this.baseUrl = API_BASE_URL;
        this.pdfCache = new Map(); // Cache for downloaded PDF files
        this.cacheMaxSize = 5; // Maximum number of PDFs to cache
    }

    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${this.baseUrl}/upload`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Upload failed');
            }

            return await response.json();
        } catch (error) {
            console.error('Upload error:', error);
            throw error;
        }
    }

    async getFiles() {
        try {
            const response = await fetch(`${this.baseUrl}/files`);
            if (!response.ok) {
                throw new Error('Failed to fetch files');
            }
            return await response.json();
        } catch (error) {
            console.error('Get files error:', error);
            throw error;
        }
    }

    async getFile(fileId) {
        try {
            const response = await fetch(`${this.baseUrl}/files/${fileId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch file');
            }
            return await response.json();
        } catch (error) {
            console.error('Get file error:', error);
            throw error;
        }
    }

    async downloadFile(fileId) {
        try {
            // Check if file is already cached
            if (this.pdfCache.has(fileId)) {
                console.log(`📋 Using cached PDF for file ${fileId}`);
                // Move to end to mark as recently used
                const cachedBlob = this.pdfCache.get(fileId);
                this.pdfCache.delete(fileId);
                this.pdfCache.set(fileId, cachedBlob);
                return cachedBlob;
            }

            console.log(`📥 Downloading PDF for file ${fileId}`);
            const response = await fetch(`${this.baseUrl}/files/${fileId}/download`);
            if (!response.ok) {
                throw new Error('Failed to download file');
            }
            
            const blob = await response.blob();
            
            // Cache the downloaded file
            this._cacheFile(fileId, blob);
            
            return blob;
        } catch (error) {
            console.error('Download error:', error);
            throw error;
        }
    }

    _cacheFile(fileId, blob) {
        // Remove oldest item if cache is full
        if (this.pdfCache.size >= this.cacheMaxSize) {
            const oldestKey = this.pdfCache.keys().next().value;
            this.pdfCache.delete(oldestKey);
            console.log(`🗑️ Evicted PDF ${oldestKey} from cache`);
        }
        
        this.pdfCache.set(fileId, blob);
        console.log(`💾 Cached PDF for file ${fileId} (cache size: ${this.pdfCache.size})`);
    }

    async deleteFile(fileId) {
        try {
            const response = await fetch(`${this.baseUrl}/files/${fileId}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                throw new Error('Failed to delete file');
            }
            return await response.json();
        } catch (error) {
            console.error('Delete file error:', error);
            throw error;
        }
    }

    async createAnnotation(fileId, annotation) {
        try {
            const response = await fetch(`${this.baseUrl}/files/${fileId}/annotations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(annotation),
            });

            if (!response.ok) {
                throw new Error('Failed to create annotation');
            }

            return await response.json();
        } catch (error) {
            console.error('Create annotation error:', error);
            throw error;
        }
    }

    async getAnnotations(fileId) {
        try {
            const response = await fetch(`${this.baseUrl}/files/${fileId}/annotations`);
            if (!response.ok) {
                throw new Error('Failed to fetch annotations');
            }
            return await response.json();
        } catch (error) {
            console.error('Get annotations error:', error);
            throw error;
        }
    }

    async updateAnnotation(annotationId, annotationData) {
        try {
            const response = await fetch(`${this.baseUrl}/annotations/${annotationId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(annotationData),
            });

            if (!response.ok) {
                throw new Error('Failed to update annotation');
            }

            return await response.json();
        } catch (error) {
            console.error('Update annotation error:', error);
            throw error;
        }
    }

    async deleteAnnotation(annotationId) {
        try {
            const response = await fetch(`${this.baseUrl}/annotations/${annotationId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Failed to delete annotation');
            }

            return await response.json();
        } catch (error) {
            console.error('Delete annotation error:', error);
            throw error;
        }
    }

    async healthCheck() {
        try {
            const response = await fetch(`${this.baseUrl}/health`);
            if (!response.ok) {
                throw new Error('Health check failed');
            }
            return await response.json();
        } catch (error) {
            console.error('Health check error:', error);
            throw error;
        }
    }

    // Spaced Repetition API Methods

    async createStudyCard(annotationId) {
        try {
            const response = await fetch(`${this.baseUrl}/study-cards?annotation_id=${annotationId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error('Failed to create study card');
            }

            return await response.json();
        } catch (error) {
            console.error('Create study card error:', error);
            throw error;
        }
    }

    async getDueCards(limit = 50) {
        try {
            const response = await fetch(`${this.baseUrl}/study-cards/due?limit=${limit}`);
            if (!response.ok) {
                throw new Error('Failed to fetch due cards');
            }
            return await response.json();
        } catch (error) {
            console.error('Get due cards error:', error);
            throw error;
        }
    }

    async getStudyCards(skip = 0, limit = 100) {
        try {
            const response = await fetch(`${this.baseUrl}/study-cards?skip=${skip}&limit=${limit}`);
            if (!response.ok) {
                throw new Error('Failed to fetch study cards');
            }
            return await response.json();
        } catch (error) {
            console.error('Get study cards error:', error);
            throw error;
        }
    }

    async getStudyCard(cardId) {
        try {
            const response = await fetch(`${this.baseUrl}/study-cards/${cardId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch study card');
            }
            return await response.json();
        } catch (error) {
            console.error('Get study card error:', error);
            throw error;
        }
    }

    async reviewCard(cardId, reviewData) {
        try {
            const response = await fetch(`${this.baseUrl}/study-cards/${cardId}/review`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(reviewData),
            });

            if (!response.ok) {
                throw new Error('Failed to review card');
            }

            return await response.json();
        } catch (error) {
            console.error('Review card error:', error);
            throw error;
        }
    }

    async getReviewOptions(cardId) {
        try {
            const response = await fetch(`${this.baseUrl}/study-cards/${cardId}/options`);
            if (!response.ok) {
                throw new Error('Failed to fetch review options');
            }
            return await response.json();
        } catch (error) {
            console.error('Get review options error:', error);
            throw error;
        }
    }

    async getCardTimeline(cardId) {
        try {
            const response = await fetch(`${this.baseUrl}/study-cards/${cardId}/timeline`);
            if (!response.ok) {
                throw new Error('Failed to fetch card timeline');
            }
            return await response.json();
        } catch (error) {
            console.error('Get card timeline error:', error);
            throw error;
        }
    }

    async getCardProgression(cardId, steps = 4) {
        try {
            const response = await fetch(`${this.baseUrl}/study-cards/${cardId}/progression?steps=${steps}`);
            if (!response.ok) {
                throw new Error('Failed to fetch card progression');
            }
            return await response.json();
        } catch (error) {
            console.error('Get card progression error:', error);
            throw error;
        }
    }

    async createReviewSession(sessionData = {}) {
        try {
            const response = await fetch(`${this.baseUrl}/review-sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(sessionData),
            });

            if (!response.ok) {
                throw new Error('Failed to create review session');
            }

            return await response.json();
        } catch (error) {
            console.error('Create review session error:', error);
            throw error;
        }
    }

    async endReviewSession(sessionId) {
        try {
            const response = await fetch(`${this.baseUrl}/review-sessions/${sessionId}/end`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error('Failed to end review session');
            }

            return await response.json();
        } catch (error) {
            console.error('End review session error:', error);
            throw error;
        }
    }

    async getStudyStats() {
        try {
            const response = await fetch(`${this.baseUrl}/study-stats`);
            if (!response.ok) {
                throw new Error('Failed to fetch study stats');
            }
            return await response.json();
        } catch (error) {
            console.error('Get study stats error:', error);
            throw error;
        }
    }
}

export default new ApiService(); 