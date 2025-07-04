import React, { useState, useEffect } from 'react';
import apiService from './api';
import './HomePage.css';

const HomePage = ({ onFileSelect }) => {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadFiles();
    }, []);

    const loadFiles = async () => {
        try {
            setLoading(true);
            const fileList = await apiService.getFiles();
            setFiles(fileList);
        } catch (err) {
            setError('Failed to load PDF files');
            console.error('Error loading files:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleFileClick = async (file) => {
        try {
            // Download the file and create a File object for the PDF viewer
            const blob = await apiService.downloadFile(file.id);
            const fileObject = new File([blob], file.original_filename, { type: 'application/pdf' });
            onFileSelect(fileObject, file);
        } catch (err) {
            console.error('Error opening file:', err);
        }
    };

    const formatFileSize = (bytes) => {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="home-page">
                <div className="home-header">
                </div>
                <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Loading your library...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="home-page">
                <div className="home-header">
                </div>
                <div className="error-state">
                    <div className="error-icon">⚠️</div>
                    <h3>Something went wrong</h3>
                    <p>{error}</p>
                    <button className="retry-button" onClick={loadFiles}>
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="home-page">
            <div className="home-header">
                <div className="library-overview">
                    <div className="library-count">
                        <span className="count-number">{files.length}</span>
                    </div>
                    <div className="library-label">
                        <span className="primary-label">Document{files.length !== 1 ? 's' : ''}</span>
                        <span className="secondary-label">in your library</span>
                    </div>
                </div>
            </div>

            {files.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">📄</div>
                    <h2>No PDFs yet</h2>
                    <p>Upload your first PDF to get started with annotations and note-taking</p>
                    <div className="upload-prompt">
                        <div className="upload-icon">⬆️</div>
                        <span>Use the upload button in the toolbar above</span>
                    </div>
                </div>
            ) : (
                <div className="files-grid">
                    {files.map((file) => (
                        <div 
                            key={file.id} 
                            className="file-card"
                            onClick={() => handleFileClick(file)}
                        >
                            <div className="file-card-content">
                                <div className="file-icon">
                                    <div className="pdf-icon">
                                        <span>PDF</span>
                                    </div>
                                </div>
                                
                                <div className="file-info">
                                    <h3 className="file-name" title={file.display_name}>
                                        {file.display_name}
                                    </h3>
                                    
                                    <div className="file-meta">
                                        <span className="file-size">
                                            {formatFileSize(file.file_size)}
                                        </span>
                                        <span className="file-date">
                                            {formatDate(file.upload_date)}
                                        </span>
                                    </div>
                                    
                                    <div className="file-actions">
                                        <div className="annotation-badge">
                                            <span className="annotation-count">{file.annotation_count || 0}</span>
                                            <span className="annotation-label">note{(file.annotation_count || 0) !== 1 ? 's' : ''}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default HomePage; 