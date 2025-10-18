/**
 * Simple text highlighting system for Odyssey
 * Stores highlights with text + context for fuzzy re-matching
 */

class OdysseyHighlighter {
  constructor() {
    this.highlights = new Map(); // id -> highlight data
    this.tooltip = null;
    this.selectedRange = null;
    this.selectedText = '';

    this.init();
  }

  init() {
    // Listen for text selection
    document.addEventListener('mouseup', (e) => this.handleSelection(e));
    document.addEventListener('keyup', (e) => this.handleSelection(e));

    // Hide tooltip on scroll or click elsewhere
    document.addEventListener('scroll', () => this.hideTooltip());
    document.addEventListener('mousedown', (e) => {
      if (!e.target.closest('.odyssey-tooltip')) {
        this.hideTooltip();
      }
    });

    // Load existing highlights for this URL
    this.loadHighlights();
  }

  handleSelection(e) {
    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (!text || text.length < 3) {
      this.hideTooltip();
      return;
    }

    // Store selection info
    this.selectedText = text;
    this.selectedRange = selection.getRangeAt(0).cloneRange();

    // Show tooltip near selection
    this.showTooltip(e.clientX, e.clientY);
  }

  showTooltip(x, y) {
    if (!this.tooltip) {
      this.tooltip = document.createElement('div');
      this.tooltip.className = 'odyssey-tooltip';
      this.tooltip.innerHTML = `
        <button class="odyssey-btn-add-note">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
          Add Note
        </button>
      `;
      document.body.appendChild(this.tooltip);

      // Handle click
      this.tooltip.querySelector('.odyssey-btn-add-note').addEventListener('click', () => {
        this.createHighlight();
      });
    }

    // Position tooltip
    const tooltipRect = this.tooltip.getBoundingClientRect();
    const left = Math.min(x, window.innerWidth - tooltipRect.width - 10);
    const top = y - tooltipRect.height - 10;

    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `${top}px`;
    this.tooltip.style.display = 'flex';
  }

  hideTooltip() {
    if (this.tooltip) {
      this.tooltip.style.display = 'none';
    }
  }

  createHighlight() {
    if (!this.selectedRange || !this.selectedText) return;

    const highlightId = `highlight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Get context around selection
    const container = this.selectedRange.commonAncestorContainer;
    const fullText = container.textContent || '';
    const selectionStart = this.getTextOffset(container, this.selectedRange.startContainer, this.selectedRange.startOffset);

    const contextLength = 20;
    const prefix = fullText.substring(Math.max(0, selectionStart - contextLength), selectionStart);
    const suffix = fullText.substring(
      selectionStart + this.selectedText.length,
      Math.min(fullText.length, selectionStart + this.selectedText.length + contextLength)
    );

    // Create highlight span
    const highlightSpan = document.createElement('span');
    highlightSpan.className = 'odyssey-highlight';
    highlightSpan.dataset.highlightId = highlightId;
    highlightSpan.style.backgroundColor = '#ffeb3b66'; // Default yellow

    // Wrap the selected range
    try {
      this.selectedRange.surroundContents(highlightSpan);
    } catch (e) {
      // If surroundContents fails (crosses element boundaries), use extractContents
      const fragment = this.selectedRange.extractContents();
      highlightSpan.appendChild(fragment);
      this.selectedRange.insertNode(highlightSpan);
    }

    // Store highlight data
    const highlightData = {
      id: highlightId,
      text: this.selectedText,
      prefix,
      suffix,
      xpath: this.getXPath(container),
      color: '#ffeb3b',
      timestamp: Date.now()
    };

    this.highlights.set(highlightId, highlightData);

    // Send message to background to open side panel
    chrome.runtime.sendMessage({
      type: 'OPEN_SIDE_PANEL',
      highlightData
    });

    // Clear selection
    window.getSelection().removeAllRanges();
    this.hideTooltip();
  }

  // Get XPath to element (simple version)
  getXPath(element) {
    if (element.nodeType === Node.TEXT_NODE) {
      element = element.parentElement;
    }

    const parts = [];
    while (element && element.nodeType === Node.ELEMENT_NODE) {
      let index = 0;
      let sibling = element.previousSibling;
      while (sibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === element.tagName) {
          index++;
        }
        sibling = sibling.previousSibling;
      }

      const tagName = element.tagName.toLowerCase();
      const pathIndex = index ? `[${index + 1}]` : '';
      parts.unshift(`${tagName}${pathIndex}`);

      element = element.parentElement;
    }

    return '/' + parts.join('/');
  }

  // Get text offset within container
  getTextOffset(container, node, offset) {
    let textOffset = 0;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);

    let currentNode;
    while ((currentNode = walker.nextNode())) {
      if (currentNode === node) {
        return textOffset + offset;
      }
      textOffset += currentNode.textContent.length;
    }

    return textOffset;
  }

  // Load and re-highlight saved highlights
  async loadHighlights() {
    const url = window.location.href;

    // Request highlights from background script
    chrome.runtime.sendMessage({
      type: 'GET_HIGHLIGHTS',
      url
    }, (response) => {
      if (response && response.highlights) {
        response.highlights.forEach(h => this.rehighlight(h));
      }
    });
  }

  // Re-highlight text (best effort fuzzy matching)
  rehighlight(highlightData) {
    const { text, prefix, suffix, color } = highlightData;

    // Try to find the text using prefix/suffix context
    const bodyText = document.body.textContent;
    const searchStr = prefix + text + suffix;

    let index = bodyText.indexOf(searchStr);
    if (index === -1) {
      // Fallback: just search for the text
      index = bodyText.indexOf(text);
      if (index === -1) {
        console.log('Could not re-highlight:', text.substring(0, 50));
        return; // Give up gracefully
      }
    }

    // Find the actual DOM node containing this text
    // This is simplified - may not work for all cases
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT
    );

    let currentOffset = 0;
    let node;
    const targetStart = index + prefix.length;
    const targetEnd = targetStart + text.length;

    while ((node = walker.nextNode())) {
      const nodeLength = node.textContent.length;

      if (currentOffset + nodeLength >= targetStart && currentOffset <= targetEnd) {
        // This node contains part of our highlight
        const startInNode = Math.max(0, targetStart - currentOffset);
        const endInNode = Math.min(nodeLength, targetEnd - currentOffset);

        if (startInNode < endInNode) {
          try {
            const range = document.createRange();
            range.setStart(node, startInNode);
            range.setEnd(node, endInNode);

            const span = document.createElement('span');
            span.className = 'odyssey-highlight';
            span.dataset.highlightId = highlightData.id;
            span.style.backgroundColor = color + '66'; // Add transparency

            range.surroundContents(span);
            this.highlights.set(highlightData.id, highlightData);
            break;
          } catch (e) {
            console.log('Could not apply highlight:', e);
          }
        }
      }

      currentOffset += nodeLength;
    }
  }

  // Update highlight color
  updateHighlightColor(highlightId, color) {
    const span = document.querySelector(`[data-highlight-id="${highlightId}"]`);
    if (span) {
      span.style.backgroundColor = color + '66';
    }

    const data = this.highlights.get(highlightId);
    if (data) {
      data.color = color;
      this.highlights.set(highlightId, data);
    }
  }

  // Get all highlights for current page
  getHighlights() {
    return Array.from(this.highlights.values());
  }
}

// Initialize highlighter
const highlighter = new OdysseyHighlighter();

// Listen for messages from side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'UPDATE_HIGHLIGHT_COLOR') {
    highlighter.updateHighlightColor(message.highlightId, message.color);
    sendResponse({ success: true });
  } else if (message.type === 'GET_PAGE_HIGHLIGHTS') {
    sendResponse({ highlights: highlighter.getHighlights() });
  }
});
