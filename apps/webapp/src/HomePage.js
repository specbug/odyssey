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



    const handleFileClick = (file) => {
        onFileSelect(file);
    };

    const handleDeleteFile = async (e, fileId, fileName) => {
        e.stopPropagation(); // Prevent card click

        if (!window.confirm(`Are you sure you want to delete "${fileName}"? This action cannot be undone.`)) {
            return;
        }

        try {
            await apiService.deleteFile(fileId);
            // Refresh the file list
            await loadFiles();
        } catch (error) {
            console.error('Failed to delete file:', error);
            alert('Failed to delete file. Please try again.');
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
                    <div className="error-icon-container">
                        <span className="material-symbols-outlined">error</span>
                    </div>
                    <h3>Something went wrong</h3>
                    <p>{error}</p>
                    <button className="retry-button" onClick={loadFiles}>
                        <span className="material-symbols-outlined">refresh</span>
                        <span>Try Again</span>
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
                    <div className="empty-icon-container">
                        <span className="material-symbols-outlined">description</span>
                    </div>
                    <h2>Nothing here</h2>
                    <p>Upload your first PDF to get started with your learning journey</p>
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
                                <div className="card-header">
                                    <span className="pdf-badge">PDF</span>
                                    <button
                                        className="delete-button"
                                        onClick={(e) => handleDeleteFile(e, file.id, file.display_name)}
                                        aria-label="Delete file"
                                        title="Delete file"
                                    >
                                        <span className="material-symbols-outlined">delete</span>
                                    </button>
                                </div>

                                <h3 className="file-title" title={file.display_name}>
                                    {file.display_name}
                                </h3>

                                <div className="card-metadata">
                                    <span>{formatFileSize(file.file_size)}</span>
                                    <span className="metadata-separator">·</span>
                                    <span>{formatDate(file.upload_date)}</span>
                                    <span className="metadata-separator">·</span>
                                    <span>{file.annotation_count || 0} note{(file.annotation_count || 0) !== 1 ? 's' : ''}</span>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            {file.total_pages && file.total_pages > 0 && (
                                <div className="progress-bar-container">
                                    <div
                                        className={`progress-bar ${
                                            file.last_read_position === 0 ? 'unstarted' :
                                            file.last_read_position >= file.total_pages - 1 ? 'completed' :
                                            'in-progress'
                                        }`}
                                        style={{
                                            width: `${Math.min(((file.last_read_position + 1) / file.total_pages) * 100, 100)}%`
                                        }}
                                    ></div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default HomePage; 