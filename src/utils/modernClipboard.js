/**
 * Modern clipboard utilities to replace deprecated document.execCommand
 * Uses the Selection API and Range API for better performance and standards compliance
 */

/**
 * Inserts HTML content at the current cursor position or selection
 * @param {string} html - The HTML content to insert
 * @param {HTMLElement} [target] - Optional target element, defaults to current selection
 * @returns {boolean} - True if successful, false if failed
 */
export function insertHTML(html, target = null) {
    try {
        const selection = window.getSelection();
        
        if (!selection || selection.rangeCount === 0) {
            console.warn('No selection available for HTML insertion');
            return false;
        }

        const range = selection.getRangeAt(0);
        
        // Delete current selection if any
        range.deleteContents();
        
        // Create a document fragment from the HTML
        const fragment = document.createRange().createContextualFragment(html);
        
        // Insert the fragment
        range.insertNode(fragment);
        
        // Move cursor to the end of the inserted content
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        
        return true;
    } catch (error) {
        console.error('Error inserting HTML:', error);
        return false;
    }
}

/**
 * Inserts plain text at the current cursor position or selection
 * @param {string} text - The text content to insert
 * @param {HTMLElement} [target] - Optional target element, defaults to current selection
 * @returns {boolean} - True if successful, false if failed
 */
export function insertText(text, target = null) {
    try {
        const selection = window.getSelection();
        
        if (!selection || selection.rangeCount === 0) {
            console.warn('No selection available for text insertion');
            return false;
        }

        const range = selection.getRangeAt(0);
        
        // Delete current selection if any
        range.deleteContents();
        
        // Create a text node and insert it
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        
        // Move cursor to the end of the inserted text
        range.setStartAfter(textNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        
        return true;
    } catch (error) {
        console.error('Error inserting text:', error);
        return false;
    }
}

/**
 * Enhanced paste handler that supports both text and images
 * @param {ClipboardEvent} event - The paste event
 * @param {Function} onImagePaste - Callback for handling image paste
 * @param {Function} onTextPaste - Callback for handling text paste
 * @returns {boolean} - True if handled, false if not
 */
export function handlePaste(event, onImagePaste = null, onTextPaste = null) {
    try {
        event.preventDefault();
        
        const items = event.clipboardData.items;
        let handled = false;
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            
            if (item.type.indexOf('image') !== -1) {
                const blob = item.getAsFile();
                const reader = new FileReader();
                
                reader.onload = (readerEvent) => {
                    const img = `<img src="${readerEvent.target.result}" class="pasted-image" style="max-width: 100%; height: auto;" />`;
                    
                    if (onImagePaste) {
                        onImagePaste(img, blob);
                    } else {
                        insertHTML(img);
                    }
                };
                
                reader.readAsDataURL(blob);
                handled = true;
                break;
            } else if (item.type === 'text/plain') {
                const text = event.clipboardData.getData('text/plain');
                
                if (onTextPaste) {
                    onTextPaste(text);
                } else {
                    insertText(text);
                }
                handled = true;
                break;
            }
        }
        
        return handled;
    } catch (error) {
        console.error('Error handling paste:', error);
        return false;
    }
}

/**
 * Checks if the Selection API is supported
 * @returns {boolean} - True if supported, false if not
 */
export function isSelectionAPISupported() {
    return !!(window.getSelection && document.createRange);
}

/**
 * Fallback function for older browsers that still need execCommand
 * @param {string} command - The command to execute
 * @param {string} value - The value for the command
 * @returns {boolean} - True if successful, false if failed
 */
export function fallbackExecCommand(command, value) {
    try {
        if (document.execCommand) {
            return document.execCommand(command, false, value);
        }
        return false;
    } catch (error) {
        console.error('Fallback execCommand failed:', error);
        return false;
    }
}

/**
 * Safe insertion that tries modern API first, then falls back to execCommand
 * @param {string} content - Content to insert
 * @param {string} type - 'html' or 'text'
 * @returns {boolean} - True if successful, false if failed
 */
export function safeInsert(content, type = 'text') {
    if (isSelectionAPISupported()) {
        if (type === 'html') {
            return insertHTML(content);
        } else {
            return insertText(content);
        }
    } else {
        // Fallback for older browsers
        const command = type === 'html' ? 'insertHTML' : 'insertText';
        return fallbackExecCommand(command, content);
    }
}