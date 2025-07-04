const API_BASE_URL = 'http://localhost:8000';

class ApiService {
    constructor() {
        this.baseUrl = API_BASE_URL;
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
            const response = await fetch(`${this.baseUrl}/files/${fileId}/download`);
            if (!response.ok) {
                throw new Error('Failed to download file');
            }
            return response.blob();
        } catch (error) {
            console.error('Download error:', error);
            throw error;
        }
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
}

export default new ApiService(); 