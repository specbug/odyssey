import React, { useState, useEffect } from 'react';
import apiService from './api';
import './ReviewModal.css';

const ReviewModal = ({ isOpen, onClose, fileId }) => {
    const [currentCard, setCurrentCard] = useState(null);
    const [showAnswer, setShowAnswer] = useState(false);
    const [loading, setLoading] = useState(false);
    const [reviewComplete, setReviewComplete] = useState(false);
    const [dueCards, setDueCards] = useState([]);
    const [newCards, setNewCards] = useState([]);
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
            setDueCards(cardsData.due_cards || []);
            setNewCards(cardsData.new_cards || []);
            
            // Start with the first available card
            const allCards = [...(cardsData.due_cards || []), ...(cardsData.new_cards || [])];
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
            const allCards = [...dueCards, ...newCards];
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

    if (!isOpen) return null;

    return (
        <div className="review-modal-overlay" onClick={onClose}>
            <div className="review-modal" onClick={(e) => e.stopPropagation()}>
                <div className="review-modal-header">
                    <div className="review-progress">
                        <span className="memory-icon">⭐</span>
                        <div className="review-stats">
                            <span className="stat-item">Due: {dueCards.length}</span>
                            <span className="stat-item">New: {newCards.length}</span>
                            <span className="stat-item">Today: {sessionStats.total}</span>
                        </div>
                    </div>
                    <button className="exit-review-button" onClick={onClose}>
                        <span className="material-symbols-outlined">close</span>
                        <span>Exit Review</span>
                    </button>
                </div>

                <div className="review-content">
                    {loading && !currentCard ? (
                        <div className="review-loading">
                            <div className="loading-spinner"></div>
                            <p>Loading your study cards...</p>
                        </div>
                    ) : reviewComplete ? (
                        <div className="review-complete">
                            <div className="completion-icon">⭐</div>
                            <h2>Review complete</h2>
                            <div className="session-summary">
                                <p>Great job! You reviewed {sessionStats.total} cards</p>
                                <p>Accuracy: {sessionStats.total > 0 ? Math.round((sessionStats.correct / sessionStats.total) * 100) : 0}%</p>
                            </div>
                            <button className="return-button" onClick={handleReturnToBook}>
                                Return to Book
                            </button>
                        </div>
                    ) : currentCard ? (
                        <div className="study-card">
                            <div className="card-question">
                                <p>{currentCard.annotation?.question || 'No question available'}</p>
                            </div>
                            
                            {!showAnswer ? (
                                <button className="show-answer-button" onClick={handleShowAnswer}>
                                    <span className="material-symbols-outlined">visibility</span>
                                    Show Answer
                                </button>
                            ) : (
                                <>
                                    <div className="card-answer">
                                        <p>{currentCard.annotation?.answer || 'No answer available'}</p>
                                    </div>
                                    
                                    <div className="review-actions">
                                        <button 
                                            className="review-button forgotten"
                                            onClick={() => handleReview(1)}
                                            disabled={loading}
                                        >
                                            <span className="material-symbols-outlined">close</span>
                                            Forgotten
                                        </button>
                                        <button 
                                            className="review-button remembered"
                                            onClick={() => handleReview(4)}
                                            disabled={loading}
                                        >
                                            <span className="material-symbols-outlined">check</span>
                                            Remembered
                                        </button>
                                    </div>
                                    
                                    <div className="view-source">
                                        <span>View Source</span>
                                        <span className="material-symbols-outlined">arrow_forward</span>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="no-cards">
                            <div className="empty-icon">📚</div>
                            <h2>No cards to review</h2>
                            <p>Create some annotations to start studying!</p>
                            <button className="return-button" onClick={handleReturnToBook}>
                                Return to Book
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReviewModal; 