/**
 * Utility functions for handling cloze deletions
 * Supports Anki-style cloze syntax: {{c1::text}}, {{c2::text}}, etc.
 */

/**
 * Detects if a string contains cloze deletion syntax
 * @param {string} text - The text to check
 * @returns {boolean} - True if text contains cloze syntax
 */
export const hasCloze = (text) => {
    if (!text) return false;
    return /\{\{c\d+::.+?\}\}/g.test(text);
};

/**
 * Extracts all cloze indices from a text
 * @param {string} text - The text to parse
 * @returns {number[]} - Array of cloze indices (e.g., [1, 2, 3])
 */
export const extractClozeIndices = (text) => {
    if (!text) return [];
    const matches = text.matchAll(/\{\{c(\d+)::.+?\}\}/g);
    const indices = [...matches].map(match => parseInt(match[1], 10));
    return [...new Set(indices)].sort((a, b) => a - b);
};

/**
 * Parses cloze text for a specific index, replacing that cloze with a blank
 * @param {string} text - The text containing cloze syntax
 * @param {number} clozeIndex - The cloze index to blank out
 * @returns {Object} - { questionHtml, answerHtml, clozeContent }
 */
export const parseClozeForIndex = (text, clozeIndex) => {
    if (!text || !clozeIndex) {
        return { questionHtml: text, answerHtml: text, clozeContent: '' };
    }

    const clozeRegex = /\{\{c(\d+)::(.+?)\}\}/g;
    let clozeContent = '';

    // For the question: Replace target cloze with blank, remove syntax from others
    const questionHtml = text.replace(clozeRegex, (match, index, content) => {
        const idx = parseInt(index, 10);
        if (idx === clozeIndex) {
            clozeContent = content;
            return '<span class="cloze-blank">______</span>';
        }
        return content;
    });

    // For the answer: Remove all cloze syntax but highlight the target
    const answerHtml = text.replace(clozeRegex, (match, index, content) => {
        const idx = parseInt(index, 10);
        if (idx === clozeIndex) {
            return `<span class="cloze-reveal">${content}</span>`;
        }
        return content;
    });

    return { questionHtml, answerHtml, clozeContent };
};

/**
 * Removes all cloze syntax from text, leaving only the content
 * @param {string} text - The text containing cloze syntax
 * @returns {string} - Text with cloze syntax removed
 */
export const stripClozeSyntax = (text) => {
    if (!text) return text;
    return text.replace(/\{\{c\d+::(.+?)\}\}/g, '$1');
};

/**
 * Calculates the relative luminance of an RGB color
 * Used for determining text contrast
 * @param {string} color - Color in hex format (#RRGGBB) or rgb format
 * @returns {number} - Luminance value between 0 and 1
 */
export const getLuminance = (color) => {
    // Convert hex to RGB
    let r, g, b;

    if (color.startsWith('#')) {
        const hex = color.replace('#', '');
        r = parseInt(hex.substr(0, 2), 16) / 255;
        g = parseInt(hex.substr(2, 2), 16) / 255;
        b = parseInt(hex.substr(4, 2), 16) / 255;
    } else {
        // Assume it's already RGB or fallback
        return 0.5; // Default to mid-luminance
    }

    // Apply gamma correction
    r = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
    g = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
    b = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

    // Calculate relative luminance
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * Determines if text should be black or white based on background color
 * @param {string} backgroundColor - Background color in hex format
 * @returns {string} - '#1a1a1a' for dark text or '#ffffff' for light text
 */
export const getContrastText = (backgroundColor) => {
    const luminance = getLuminance(backgroundColor);
    // If background is light (luminance > 0.5), use dark text
    // If background is dark (luminance <= 0.5), use light text
    return luminance > 0.5 ? '#1a1a1a' : '#ffffff';
};
