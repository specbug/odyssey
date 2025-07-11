import React, { memo } from 'react';
import { InlineMath, BlockMath } from 'react-katex';
import PropTypes from 'prop-types';

/**
 * NoteContent component for rendering LaTeX math expressions and HTML content
 * Supports both inline and block math expressions with various LaTeX delimiters
 */
const NoteContent = memo(({ content, className = '' }) => {
    /**
     * Renders LaTeX math expressions within text content
     * Supports multiple LaTeX delimiters:
     * - $...$ for inline math
     * - $$...$$ for block math
     * - \(...\) for inline math
     * - \[...\] for block math
     * - \begin{equation}...\end{equation} for block math
     */
    const renderLatex = (string) => {
        if (!string) return [];
        
        // Clean up HTML div tags that might interfere with LaTeX parsing
        const processedString = string.replace(/<div>/g, ' ').replace(/<\/div>/g, ' ');

        // Comprehensive LaTeX delimiter regex
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

                // Parse different LaTeX delimiters
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
                    try {
                        if (isBlock) {
                            return <BlockMath key={index} math={katexString} />;
                        } else {
                            return <InlineMath key={index} math={katexString} />;
                        }
                    } catch (error) {
                        console.warn('LaTeX rendering error:', error);
                        // Fallback to raw text if LaTeX parsing fails
                        return <span key={index}>{part}</span>;
                    }
                }
            }
            
            // Render regular HTML content
            return <span key={index} dangerouslySetInnerHTML={{ __html: part }}></span>;
        });
    };

    return (
        <div className={`note-content ${className}`}>
            {renderLatex(content)}
        </div>
    );
});

NoteContent.propTypes = {
    content: PropTypes.string,
    className: PropTypes.string
};

NoteContent.displayName = 'NoteContent';

export default NoteContent;