import React, { useState, useEffect, useCallback } from 'react';
import apiService from './api';
import './ReviewModal.css';
import 'katex/dist/katex.min.css';
import AsteriskProgressBar from './AsteriskProgressBar';
import NoteContent from './components/shared/NoteContent';


// Timeline Component
const TimelineVisualization = ({ currentCard }) => {
    const [progression, setProgression] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (currentCard?.id) {
            loadProgression();
        }
    }, [currentCard?.id, loadProgression]);

    const loadProgression = useCallback(async () => {
        if (!currentCard?.id) return;
        
        setLoading(true);
        try {
            const progressionData = await apiService.getCardProgression(currentCard.id, 4);
            setProgression(progressionData.progression);
        } catch (error) {
            console.error('Failed to load progression:', error);
        } finally {
            setLoading(false);
        }
    }, [currentCard?.id]);

    if (loading || !progression) {
        return (
            <div className="timeline-container loading">
                <div className="timeline-dots">
                    <div className="timeline-dot loading-dot"></div>
                    <div className="timeline-dot loading-dot"></div>
                    <div className="timeline-dot loading-dot"></div>
                    <div className="timeline-dot loading-dot"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="timeline-container">
            <div className="timeline-dots">
                {progression.progression_intervals.map((interval, index) => (
                    <div key={index} className="timeline-dot">
                        <div className="dot-marker"></div>
                        <div className="dot-label">{interval.interval_text}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ReviewModal = ({ isOpen, onClose, fileId }) => {
    const [currentCard, setCurrentCard] = useState(null);
    const [showAnswer, setShowAnswer] = useState(false);
    const [loading, setLoading] = useState(false);
    const [reviewComplete, setReviewComplete] = useState(false);
    const [dueCards, setDueCards] = useState([]);
    const [newCards, setNewCards] = useState([]);
    const [learningCards, setLearningCards] = useState([]);
    const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 });

    useEffect(() => {
        if (isOpen) {
            loadDueCards();
            setShowAnswer(false);
            setReviewComplete(false);
            setSessionStats({ correct: 0, total: 0 });
        }
    }, [isOpen, fileId, loadDueCards]);

    const loadDueCards = useCallback(async () => {
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
    }, [fileId]);

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
                {/* Compact Header with Timeline */}
                <div className="review-modal-header compact">
                    <div className="header-content">
                        {/* Left: Brand with Progress */}
                        <div className="brand-section">
                            {currentCard && !reviewComplete && (() => {
                                const allCards = [...newCards, ...learningCards, ...dueCards];
                                
                                // Only show asterisk if there are actually cards to review
                                if (allCards.length === 0) {
                                    return (
                                        <div className="header-logo">
                                            <img src="/logo.svg" alt="Odyssey Logo" className="logo-svg" />
                                        </div>
                                    );
                                }
                                
                                const currentIndex = allCards.findIndex(card => card.id === currentCard.id);
                                const currentStep = currentIndex + 1;
                                
                                return (
                                    <AsteriskProgressBar 
                                        totalSteps={allCards.length}
                                        currentStep={currentStep}
                                        size={35}
                                        activeColor="rgba(255, 77, 6, 0.7)"
                                        inactiveColor="rgba(0, 0, 0, 0.05)"
                                        className="header-asterisk"
                                    />
                                );
                            })()}
                            {(!currentCard && !reviewComplete) && (
                                <div className="header-logo">
                                    <img src="/logo.svg" alt="Odyssey Logo" className="logo-svg" />
                                </div>
                            )}
                        </div>
                        
                        {/* Center: Timeline */}
                        {currentCard && !reviewComplete && (
                            <TimelineVisualization currentCard={currentCard} />
                        )}
                        
                        {/* Right: Compact Stats + Close */}
                        <div className="header-right">
                            <div className="stats-compact">
                                <div className="stat-item new">
                                    <span className="stat-value">{newCards.length}</span>
                                    <span className="stat-name">New</span>
                                </div>
                                <div className="stat-item learning">
                                    <span className="stat-value">{learningCards.length}</span>
                                    <span className="stat-name">Learning</span>
                                </div>
                                <div className="stat-item due">
                                    <span className="stat-value">{dueCards.length}</span>
                                    <span className="stat-name">Due</span>
                                </div>
                            </div>
                            <button className="close-button" onClick={onClose}>
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
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
                            {(() => {
                                const totalCards = newCards.length + learningCards.length + dueCards.length;
                                
                                if (totalCards === 0) {
                                    return (
                                        <div className="completion-logo">
                                            <img src="/logo.svg" alt="Odyssey Logo" className="logo-svg-large" />
                                        </div>
                                    );
                                }
                                
                                return (
                                    <div className="completion-asterisk">
                                        <AsteriskProgressBar 
                                            totalSteps={totalCards}
                                            currentStep={totalCards}
                                            size={100}
                                            activeColor="rgba(255, 77, 6, 0.7)"
                                            inactiveColor="rgba(0, 0, 0, 0.05)"
                                            className="completion-asterisk-element"
                                        />
                                    </div>
                                );
                            })()}
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
                                            <button className="reveal-text-button" onClick={handleShowAnswer}>
                                                <span className="material-symbols-outlined">visibility</span>
                                                <span>Show Answer</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="card-answer-area">
                                            <NoteContent 
                                                content={currentCard.annotation?.answer || null} 
                                                className="answer-content" 
                                            />
                                        </div>
                                    )}
                                </div>
                                
                                {showAnswer && (
                                    <div className="card-actions">
                                        <button 
                                            className="action-text-button forgot"
                                            onClick={() => handleReview(1)}
                                            disabled={loading}
                                        >
                                            <span className="material-symbols-outlined">close</span>
                                            <span>Forgot</span>
                                        </button>
                                        <button 
                                            className="action-text-button remembered"
                                            onClick={() => handleReview(4)}
                                            disabled={loading}
                                        >
                                            <span className="material-symbols-outlined">check</span>
                                            <span>Remembered</span>
                                        </button>
                                        <button className="source-text-button" onClick={handleViewInDocument}>
                                            <span className="material-symbols-outlined">open_in_new</span>
                                            <span>View Source</span>
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