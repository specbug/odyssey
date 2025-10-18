import React from 'react';
import './HeaderInfo.css';

const HeaderInfo = ({
    fileName,
    currentPage,
    totalPages,
    notesCount,
    dueCardsCount
}) => {
    // Calculate progress percentage
    const progressPercent = totalPages > 0
        ? Math.round(((currentPage + 1) / totalPages) * 100)
        : 0;

    return (
        <div className="header-info-container">
            {/* Document Title */}
            <div className="header-document-title">
                {fileName || 'No file selected'}
            </div>

            {/* Progress Bar */}
            {totalPages > 0 && (
                <div className="header-progress-bar-container">
                    <div
                        className="header-progress-bar-fill"
                        style={{ width: `${progressPercent}%` }}
                    >
                        <div className="header-progress-bar-glow"></div>
                    </div>
                </div>
            )}

            {/* Metadata Row */}
            {totalPages > 0 && (
                <div className="header-metadata-row">
                    <span className="header-metadata-item">
                        Page {currentPage + 1} of {totalPages}
                    </span>
                    <span className="header-metadata-separator">•</span>
                    <span className="header-metadata-item">
                        {notesCount || 0} note{notesCount !== 1 ? 's' : ''}
                    </span>
                    {dueCardsCount > 0 && (
                        <>
                            <span className="header-metadata-separator">•</span>
                            <span className="header-metadata-item header-cards-due">
                                <span className="led-indicator"></span>
                                {dueCardsCount} card{dueCardsCount !== 1 ? 's' : ''} due
                            </span>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default HeaderInfo;
