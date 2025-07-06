import React, { useState, useEffect } from 'react';
import apiService from './api';
import './ReviewModal.css';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

// Import the sophisticated note content component from App.js
const NoteContent = React.memo(({ content, className }) => {
    const renderLatex = (string) => {
        if (!string) return [];
        
        const processedString = string.replace(/<div>/g, ' ').replace(/<\/div>/g, ' ');

        const latexRegex = /(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$|\\[[\s\S]*?\\\]|\\\(.*?\\\)|\\begin\{equation\}[\s\S]*?\\end\{equation\})/g;
        const parts = processedString.split(latexRegex);

        return parts.map((part, index) => {
            if (!part) {
                return null;
            }

            const match = part.match(latexRegex);
            if (match && match[0] === part) {
                let isBlock = false;
                let katexString = '';

                if (part.startsWith('$$')) {
                    isBlock = true;
                    katexString = part.substring(2, part.length - 2);
                } else if (part.startsWith('\\[')) {
                    isBlock = true;
                    katexString = part.substring(2, part.length - 2);
                } else if (part.startsWith('\\begin{equation}')) {
                    isBlock = true;
                    katexString = part.substring(16, part.length - 14);
                } else if (part.startsWith('$')) {
                    isBlock = false;
                    katexString = part.substring(1, part.length - 1);
                } else if (part.startsWith('\\(')) {
                    isBlock = false;
                    katexString = part.substring(2, part.length - 2);
                }
                
                if (katexString) {
                    if (isBlock) {
                        return <BlockMath key={index} math={katexString} />;
                    } else {
                        return <InlineMath key={index} math={katexString} />;
                    }
                }
            }
            
            return <span key={index} dangerouslySetInnerHTML={{ __html: part }}></span>;
        });
    };

    return <div className={`note-content ${className}`}>{renderLatex(content)}</div>;
});

const ReviewModal = ({ isOpen, onClose, fileId }) => {
    const [currentCard, setCurrentCard] = useState(null);
    const [showAnswer, setShowAnswer] = useState(false);
    const [loading, setLoading] = useState(false);
    const [reviewComplete, setReviewComplete] = useState(false);
    const [dueCards, setDueCards] = useState([]);
    const [newCards, setNewCards] = useState([]);
    const [learningCards, setLearningCards] = useState([]);
    const [reviewedToday, setReviewedToday] = useState(0);
    const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 });

    useEffect(() => {
        if (isOpen) {
            loadDueCards();
            setShowAnswer(false);
            setReviewComplete(false);
            setSessionStats({ correct: 0, total: 0 });
        }
    }, [isOpen, fileId]);

    const loadDueCards = async () => {
        if (!fileId) return;
        
        setLoading(true);
        try {
            // First, get all annotations for this file
            const annotations = await apiService.getAnnotations(fileId);
            
            // Create study cards for annotations that don't have them
            const studyCardPromises = annotations.map(async (annotation) => {
                try {
                    return await apiService.createStudyCard(annotation.id);
                } catch (error) {
                    console.log(`Study card may already exist for annotation ${annotation.id}`);
                    return null;
                }
            });
            
            await Promise.all(studyCardPromises);
            
            // Now get the due cards
            const cardsData = await apiService.getDueCards();
            console.log('Cards data received:', cardsData); // Debug log
            
            // Handle the updated response structure
            const allCards = [
                ...(cardsData.due_cards || []), 
                ...(cardsData.new_cards || []),
                ...(cardsData.learning_cards || [])
            ];
            
            // Categorize cards properly
            const newCards = cardsData.new_cards || [];
            const learningCards = cardsData.learning_cards || [];
            const dueCards = cardsData.due_cards || [];
            
            setNewCards(newCards);
            setLearningCards(learningCards);
            setDueCards(dueCards);
            
            // Start with the first available card
            if (allCards.length > 0) {
                setCurrentCard(allCards[0]);
            } else {
                setReviewComplete(true);
            }
        } catch (error) {
            console.error('Failed to load due cards:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleShowAnswer = () => {
        setShowAnswer(true);
    };

    const handleReview = async (quality) => {
        if (!currentCard) return;
        
        setLoading(true);
        try {
            await apiService.reviewCard(currentCard.id, {
                card_id: currentCard.id,
                quality: quality,
                time_taken: 30 // You could track actual time here
            });
            
            // Update session stats
            setSessionStats(prev => ({
                correct: prev.correct + (quality >= 3 ? 1 : 0),
                total: prev.total + 1
            }));
            
            // Move to next card
            const allCards = [...newCards, ...learningCards, ...dueCards];
            const currentIndex = allCards.findIndex(card => card.id === currentCard.id);
            const remainingCards = allCards.slice(currentIndex + 1);
            
            if (remainingCards.length > 0) {
                setCurrentCard(remainingCards[0]);
                setShowAnswer(false);
            } else {
                setReviewComplete(true);
            }
        } catch (error) {
            console.error('Failed to review card:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleReturnToBook = () => {
        onClose();
    };

    const handleViewInDocument = () => {
        if (!currentCard?.annotation) return;
        
        // Close the modal first
        onClose();
        
        // Try to scroll to the annotation after a short delay
        setTimeout(() => {
            const annotationId = currentCard.annotation.annotation_id;
            const element = document.querySelector(`[data-annotation-id="${annotationId}"]`);
            if (element) {
                element.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center',
                    inline: 'nearest'
                });
                // Briefly highlight the annotation
                element.style.transition = 'background-color 0.3s ease';
                element.style.backgroundColor = 'rgba(255, 77, 6, 0.2)';
                setTimeout(() => {
                    element.style.backgroundColor = '';
                }, 2000);
            }
        }, 100);
    };

    if (!isOpen) return null;

    return (
        <div className="review-modal-overlay" onClick={onClose}>
            <div className="review-modal" onClick={(e) => e.stopPropagation()}>
                {/* Premium Header */}
                <div className="review-modal-header">
                    <div className="header-content">
                    <div className="brand-section">
                            <div className="brand-text">
                            <span className="material-icons infinity-icon">all_inclusive</span>
                                <p className="tagline">Spaced Repetition</p>
                            </div>
                        </div>
                        <div className="stats-section">
                            <div className="stat-grid">
                                <div className="stat-card new">
                                    <span className="stat-number">{newCards.length}</span>
                                    <span className="stat-label">New</span>
                                </div>
                                <div className="stat-card learning">
                                    <span className="stat-number">{learningCards.length}</span>
                                    <span className="stat-label">Learning</span>
                                </div>
                                <div className="stat-card due">
                                    <span className="stat-number">{dueCards.length}</span>
                                    <span className="stat-label">Due</span>
                                </div>
                            </div>
                        </div>
                        
                        <button className="close-button" onClick={onClose}>
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>

                <div className="card-progress">
                                    <div className="progress-indicator">
                                        <span className="current-position">{sessionStats.total + 1}</span>
                                        <span className="separator">of</span>
                                        <span className="total-cards">{newCards.length + learningCards.length + dueCards.length}</span>
                                    </div>
                                </div>

                {/* Content Area */}
                <div className="review-content">
                    {loading && !currentCard ? (
                        <div className="loading-state">
                            <div className="loading-animation">
                                <div className="loading-spinner"></div>
                            </div>
                            <h3>Preparing your cards</h3>
                            <p>Setting up your personalized review session...</p>
                        </div>
                    ) : reviewComplete ? (
                        <div className="completion-state">
                            <h2>Review Complete</h2>
                            <div className="completion-stats">
                                <div className="completion-summary">
                                    <span className="cards-reviewed">{sessionStats.total}</span>
                                    <span className="cards-label">cards reviewed</span>
                                </div>
                                <div className="accuracy-display">
                                    <span className="accuracy-percentage">
                                        {sessionStats.total > 0 ? Math.round((sessionStats.correct / sessionStats.total) * 100) : 0}%
                                    </span>
                                    <span className="accuracy-label">accuracy</span>
                                </div>
                            </div>
                            <button className="primary-button" onClick={handleReturnToBook}>
                                <span>Continue Reading</span>
                                <span className="material-symbols-outlined">arrow_forward</span>
                            </button>
                        </div>
                    ) : currentCard ? (
                        <div className="study-session">
                            <div className="card-container">
                                
                                <div className="card-question-area">
                                        <NoteContent 
                                            content={currentCard.annotation?.question || 'No question available'} 
                                            className="question-content" 
                                        />
                                    
                                    {!showAnswer ? (
                                        <div className="reveal-section">
                                            <button className="reveal-button" onClick={handleShowAnswer}>
                                                <span className="material-symbols-outlined">visibility</span>
                                                <span>Show Answer</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="card-answer-area">
                                                <NoteContent 
                                                    content={currentCard.annotation?.answer || null} 
                                                    className="answer-content" 
                                                />
                                            </div>
                                            
                                            <div className="review-section">
                                                <div className="review-buttons">
                                                    <button 
                                                        className="difficulty-button hard"
                                                        onClick={() => handleReview(1)}
                                                        disabled={loading}
                                                    >
                                                        <span className="material-symbols-outlined">close</span>
                                                        <span>Forgot</span>
                                                        <span className="next-review">1 min</span>
                                                    </button>
                                                    <button 
                                                        className="difficulty-button easy"
                                                        onClick={() => handleReview(4)}
                                                        disabled={loading}
                                                    >
                                                        <span className="material-symbols-outlined">check</span>
                                                        <span>Remembered</span>
                                                        <span className="next-review">4 days</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                                
                                {showAnswer && (
                                    <div className="source-link">
                                        <button className="source-button" onClick={handleViewInDocument}>
                                            <span>View in Document</span>
                                            <span className="material-symbols-outlined">arrow_outward</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-visual">
                                <div className="empty-icon-container">
                                    <span className="material-symbols-outlined">school</span>
                                </div>
                            </div>
                            <h2>Ready to Learn</h2>
                            <p>Create annotations in your document to generate study cards automatically.</p>
                            <button className="primary-button" onClick={handleReturnToBook}>
                                <span>Return to Book</span>
                                <span className="material-symbols-outlined">arrow_forward</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReviewModal; 