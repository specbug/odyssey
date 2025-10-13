import React, { useState, useEffect, useRef } from 'react';
import apiService from './api';
import './ReviewModal.css';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import AsteriskProgressBar from './AsteriskProgressBar';

// Vibrant color themes inspired by Orbit
const COLOR_THEMES = [
    { bg: '#F47E60', fg: '#1A1A1A', name: 'Orbit Orange' },
    { bg: '#FF6B6B', fg: '#1A1A1A', name: 'Coral Red' },
    { bg: '#9B59B6', fg: '#FFFFFF', name: 'Deep Purple' },
    { bg: '#3498DB', fg: '#FFFFFF', name: 'Ocean Blue' },
    { bg: '#E74C3C', fg: '#FFFFFF', name: 'Sunset Pink' },
    { bg: '#F39C12', fg: '#1A1A1A', name: 'Warm Amber' },
];

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

// Timeline Component
const TimelineVisualization = ({ currentCard }) => {
    const [progression, setProgression] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (currentCard?.id) {
            loadProgression();
        }
    }, [currentCard?.id]);

    const loadProgression = async () => {
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
    };

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

const ReviewModal = ({ isOpen, onClose, fileId, listRef, highlights }) => {
    const [currentCard, setCurrentCard] = useState(null);
    const [showAnswer, setShowAnswer] = useState(false);
    const [loading, setLoading] = useState(false);
    const [reviewComplete, setReviewComplete] = useState(false);
    const [dueCards, setDueCards] = useState([]);
    const [newCards, setNewCards] = useState([]);
    const [learningCards, setLearningCards] = useState([]);
    const [reviewedToday, setReviewedToday] = useState(0);
    const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 });
    const [currentThemeIndex, setCurrentThemeIndex] = useState(0);
    const [showContextMenu, setShowContextMenu] = useState(false);
    const contextMenuRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            loadDueCards();
            setShowAnswer(false);
            setReviewComplete(false);
            setSessionStats({ correct: 0, total: 0 });
            setCurrentThemeIndex(Math.floor(Math.random() * COLOR_THEMES.length));
        }
    }, [isOpen, fileId]);

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen || reviewComplete) return;

        const handleKeyPress = (e) => {
            // Ignore if user is typing in an input field
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if (e.code === 'Space' && !showAnswer) {
                e.preventDefault();
                handleShowAnswer();
            } else if (e.key === '1' && showAnswer) {
                e.preventDefault();
                handleReview(1);
            } else if (e.key === '2' && showAnswer) {
                e.preventDefault();
                handleReview(4);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [isOpen, showAnswer, reviewComplete, currentCard]);

    // Click outside context menu to close
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
                setShowContextMenu(false);
            }
        };

        if (showContextMenu) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showContextMenu]);

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
                // Change to next theme color
                setCurrentThemeIndex((prev) => (prev + 1) % COLOR_THEMES.length);
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

    const handleViewInDocument = async () => {
        if (!currentCard?.annotation) return;

        const annotationId = currentCard.annotation.annotation_id;
        const pageIndex = currentCard.annotation.page_index;

        console.log(`📍 Navigating to annotation ${annotationId} on page ${pageIndex + 1}`);

        // Close the modal first
        onClose();

        // Wait a moment for modal to close
        await new Promise(resolve => setTimeout(resolve, 100));

        // Use listRef to scroll to the page (this forces the page to render)
        if (listRef?.current) {
            listRef.current.scrollToItem(pageIndex, 'center');
            console.log(`📜 Scrolled to page ${pageIndex + 1} using listRef`);
        }

        // Wait for page to render and find the element with retries
        const maxRetries = 10;
        const retryDelay = 200; // ms

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));

            const element = document.querySelector(`[data-annotation-id="${annotationId}"]`);
            if (element) {
                console.log(`✅ Found annotation element on attempt ${attempt + 1}`);

                // Scroll to the specific element within the page
                element.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                    inline: 'nearest'
                });

                // Highlight the PDF annotation for longer
                element.style.transition = 'background-color 0.3s ease';
                element.style.backgroundColor = 'rgba(255, 77, 6, 0.3)';
                setTimeout(() => {
                    element.style.backgroundColor = '';
                }, 3000);

                // Find and highlight the corresponding note with a red border
                const noteElement = document.querySelector(`[data-note-id="${annotationId}"]`);
                if (noteElement) {
                    noteElement.style.transition = 'border 0.3s ease';
                    noteElement.style.border = '2px solid #ff5252';
                    setTimeout(() => {
                        noteElement.style.border = '';
                    }, 3000);
                }

                return; // Success, exit
            }

            console.log(`⏳ Attempt ${attempt + 1}/${maxRetries}: Element not found yet, retrying...`);
        }

        console.warn(`❌ Could not find annotation element after ${maxRetries} attempts`);
    };

    if (!isOpen) return null;

    const currentTheme = COLOR_THEMES[currentThemeIndex];

    return (
        <div
            className="review-fullscreen"
            style={{
                backgroundColor: currentTheme.bg,
                color: currentTheme.fg,
                transition: 'background-color 0.5s cubic-bezier(0.4, 0, 0.2, 1), color 0.5s ease'
            }}
        >
            <div className="review-container">
                {/* Top Bar: Orbit-Inspired */}
                <div className="orbit-top-bar">
                    {/* Left: Spaced Repetition Intervals */}
                    {currentCard && !reviewComplete && (
                        <TimelineVisualization currentCard={currentCard} />
                    )}

                    {/* Center: Progress Asterisk */}
                    {currentCard && !reviewComplete && (() => {
                        const allCards = [...newCards, ...learningCards, ...dueCards];
                        const currentIndex = allCards.findIndex(card => card.id === currentCard.id);
                        const currentStep = currentIndex + 1;

                        return (
                            <div className="header-progress-asterisk">
                                <AsteriskProgressBar
                                    totalSteps={allCards.length}
                                    currentStep={currentStep}
                                    size={36}
                                    activeColor="#ff4d06"
                                    inactiveColor="rgba(0, 0, 0, 0.15)"
                                    className="asterisk-progress"
                                />
                            </div>
                        );
                    })()}

                    {/* Right: Brand + Context Menu + Stats + Close */}
                    <div className="top-bar-right">
                        <div className="brand-logo">
                            <img src={`${process.env.PUBLIC_URL}/logo.svg`} alt="Odyssey" className="logo-svg" />
                        </div>

                        {/* Context Menu - Only show when actively reviewing */}
                        {currentCard && !reviewComplete && (
                            <div className="context-menu-wrapper" ref={contextMenuRef}>
                                <button
                                    className="context-menu-button"
                                    onClick={() => setShowContextMenu(!showContextMenu)}
                                    style={{ color: currentTheme.fg }}
                                >
                                    <span className="material-symbols-outlined">more_vert</span>
                                </button>

                                {showContextMenu && (
                                    <div className="context-menu-dropdown">
                                        <button className="context-menu-item" onClick={() => {
                                            handleReview(0);
                                            setShowContextMenu(false);
                                        }}>
                                            <span className="material-symbols-outlined">skip_next</span>
                                            <span>Skip Prompt</span>
                                        </button>
                                        <button className="context-menu-item" onClick={() => {
                                            handleViewInDocument();
                                            setShowContextMenu(false);
                                        }}>
                                            <span className="material-symbols-outlined">open_in_new</span>
                                            <span>Visit Prompt Origin</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        <button className="close-button-orbit" onClick={onClose} style={{ color: currentTheme.fg }}>
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>



                {/* Center Content Area */}
                <div className="orbit-center-content">
                    {loading && !currentCard ? (
                        <div className="loading-state-orbit">
                            <div className="loading-spinner-orbit" style={{ borderTopColor: currentTheme.fg }}></div>
                            <h3 style={{ color: currentTheme.fg }}>Preparing your cards</h3>
                        </div>
                    ) : reviewComplete ? (
                        <div className="completion-state-orbit">
                            {sessionStats.total === 0 ? (
                                <>
                                    <div className="completion-logo">
                                        <img src={`${process.env.PUBLIC_URL}/logo.svg`} alt="Odyssey Logo" className="logo-svg-large" />
                                    </div>
                                    <h2 style={{ color: currentTheme.fg }}>No Cards to Review</h2>
                                    <p style={{ color: currentTheme.fg, opacity: 0.8 }}>
                                        You're all caught up! Create more annotations to generate study cards.
                                    </p>
                                    <button
                                        className="orbit-primary-button"
                                        onClick={handleReturnToBook}
                                        style={{
                                            backgroundColor: currentTheme.fg,
                                            color: currentTheme.bg
                                        }}
                                    >
                                        <span>Continue Reading</span>
                                        <span className="material-symbols-outlined">arrow_forward</span>
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="completion-asterisk">
                                        <AsteriskProgressBar
                                            totalSteps={sessionStats.total}
                                            currentStep={sessionStats.total}
                                            size={120}
                                            activeColor="#ff4d06"
                                            inactiveColor="rgba(255, 77, 6, 0.2)"
                                            className="completion-asterisk-element"
                                        />
                                    </div>
                                    <h2 style={{ color: currentTheme.fg }}>Review Complete</h2>
                                    <div className="completion-stats-orbit">
                                        <div className="completion-summary">
                                            <span className="cards-reviewed" style={{ color: currentTheme.fg }}>{sessionStats.total}</span>
                                            <span className="cards-label" style={{ color: currentTheme.fg, opacity: 0.7 }}>cards reviewed</span>
                                        </div>
                                        <div className="accuracy-display">
                                            <span className="accuracy-percentage" style={{ color: currentTheme.fg }}>
                                                {Math.round((sessionStats.correct / sessionStats.total) * 100)}%
                                            </span>
                                            <span className="accuracy-label" style={{ color: currentTheme.fg, opacity: 0.7 }}>accuracy</span>
                                        </div>
                                    </div>
                                    <button
                                        className="orbit-primary-button"
                                        onClick={handleReturnToBook}
                                        style={{
                                            backgroundColor: currentTheme.fg,
                                            color: currentTheme.bg
                                        }}
                                    >
                                        <span>Continue Reading</span>
                                        <span className="material-symbols-outlined">arrow_forward</span>
                                    </button>
                                </>
                            )}
                        </div>
                    ) : currentCard ? (
                        <>
                            {/* Main Question Display */}
                            <div className="orbit-question-container">
                                <NoteContent
                                    content={currentCard.annotation?.question || 'No question available'}
                                    className="orbit-question-text"
                                />

                                {showAnswer && currentCard.annotation?.answer && (
                                    <div className="orbit-answer-container">
                                        <NoteContent
                                            content={currentCard.annotation.answer}
                                            className="orbit-answer-text"
                                        />
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="empty-state-orbit">
                            <div className="empty-visual">
                                <div className="empty-icon-container" style={{ backgroundColor: `${currentTheme.fg}22` }}>
                                    <span className="material-symbols-outlined" style={{ color: currentTheme.fg }}>school</span>
                                </div>
                            </div>
                            <h2 style={{ color: currentTheme.fg }}>Ready to Learn</h2>
                            <p style={{ color: currentTheme.fg, opacity: 0.8 }}>
                                Create annotations in your document to generate study cards automatically.
                            </p>
                            <button
                                className="orbit-primary-button"
                                onClick={handleReturnToBook}
                                style={{
                                    backgroundColor: currentTheme.fg,
                                    color: currentTheme.bg
                                }}
                            >
                                <span>Return to Book</span>
                                <span className="material-symbols-outlined">arrow_forward</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Bottom Action Bar */}
                {currentCard && !reviewComplete && (
                    <div className="orbit-bottom-bar">
                        {!showAnswer ? (
                            <button
                                className="orbit-show-answer-button"
                                onClick={handleShowAnswer}
                                style={{
                                    backgroundColor: `${currentTheme.fg}22`,
                                    color: currentTheme.fg
                                }}
                            >
                                <span className="material-symbols-outlined">visibility</span>
                                <span>Show Answer</span>
                            </button>
                        ) : (
                            <div className="orbit-action-buttons">
                                <button
                                    className="orbit-forgot-button"
                                    onClick={() => handleReview(1)}
                                    disabled={loading}
                                    style={{
                                        backgroundColor: `${currentTheme.fg}22`,
                                        color: currentTheme.fg
                                    }}
                                >
                                    <span className="material-symbols-outlined">close</span>
                                    <span>Forgotten</span>
                                </button>
                                <button
                                    className="orbit-remembered-button"
                                    onClick={() => handleReview(4)}
                                    disabled={loading}
                                    style={{
                                        backgroundColor: `${currentTheme.fg}22`,
                                        color: currentTheme.fg
                                    }}
                                >
                                    <span className="material-symbols-outlined">check</span>
                                    <span>Remembered</span>
                                </button>
                            </div>
                        )}

                        {/* Skip button - always visible */}
                        <button
                            className="orbit-skip-button"
                            onClick={() => handleReview(0)}
                            style={{
                                color: currentTheme.fg,
                                opacity: 0.6
                            }}
                        >
                            <span>Skip</span>
                            <span className="material-symbols-outlined">arrow_forward</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReviewModal; 