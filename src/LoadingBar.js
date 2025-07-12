import React, { useEffect, useState } from 'react';
import './LoadingBar.css';

const LoadingBar = ({ isLoading, progress = 0 }) => {
    const [visible, setVisible] = useState(false);
    const [animatedProgress, setAnimatedProgress] = useState(0);

    useEffect(() => {
        if (isLoading) {
            setVisible(true);
            setAnimatedProgress(0);
            
            // Simulate smooth initial progress
            const timer = setTimeout(() => {
                setAnimatedProgress(20);
            }, 100);

            return () => clearTimeout(timer);
        } else {
            // Complete the progress bar before hiding
            setAnimatedProgress(100);
            
            const hideTimer = setTimeout(() => {
                setVisible(false);
                setAnimatedProgress(0);
            }, 300);

            return () => clearTimeout(hideTimer);
        }
    }, [isLoading]);

    useEffect(() => {
        if (isLoading && progress > 0) {
            // Smooth progress updates
            const targetProgress = Math.min(progress, 90); // Never show 100% until complete
            setAnimatedProgress(targetProgress);
        }
    }, [progress, isLoading]);

    if (!visible) return null;

    return (
        <div className="loading-bar-container">
            <div className="loading-bar-track">
                <div 
                    className="loading-bar-fill"
                    style={{ 
                        transform: `translateX(${animatedProgress - 100}%)`,
                        opacity: isLoading ? 1 : 0
                    }}
                />
                <div className="loading-bar-glow" />
            </div>
        </div>
    );
};

export default LoadingBar; 