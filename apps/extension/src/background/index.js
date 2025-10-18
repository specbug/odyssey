import api from './api.js';

console.log('Odyssey background service worker loaded');

// Store current page context
const pageContexts = new Map();

// Handle extension icon click - open side panel
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ tabId: tab.id });
});

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(message, sender) {
  const { type } = message;

  try {
    switch (type) {
      case 'OPEN_SIDE_PANEL':
        return await handleOpenSidePanel(message, sender);

      case 'GET_HIGHLIGHTS':
        return await handleGetHighlights(message);

      case 'SAVE_NOTE':
        return await handleSaveNote(message, sender);

      case 'GET_NOTES':
        return await handleGetNotes(message);

      case 'UPDATE_NOTE':
        return await handleUpdateNote(message);

      case 'DELETE_NOTE':
        return await handleDeleteNote(message);

      case 'GET_PAGE_CONTEXT':
        return await handleGetPageContext(message, sender);

      default:
        console.warn('Unknown message type:', type);
        return { error: 'Unknown message type' };
    }
  } catch (error) {
    console.error('Error handling message:', error);
    return { error: error.message };
  }
}

async function handleOpenSidePanel(message, sender) {
  const { highlightData } = message;
  const tab = sender.tab;

  // Store highlight data for this tab
  if (!pageContexts.has(tab.id)) {
    pageContexts.set(tab.id, {
      url: tab.url,
      title: tab.title,
      highlights: [],
    });
  }

  const context = pageContexts.get(tab.id);
  context.highlights.push(highlightData);

  // Open side panel
  await chrome.sidePanel.open({ tabId: tab.id });

  return { success: true };
}

async function handleGetHighlights(message) {
  const { url } = message;

  try {
    // Get source for this URL
    const source = await api.getOrCreateWebpageSource(url, 'Loading...');

    // Get annotations
    const annotations = await api.getAnnotations(source.id);

    // Extract highlight data from annotations
    const highlights = annotations.map(ann => {
      try {
        const positionData = JSON.parse(ann.position_data || '{}');
        return {
          id: ann.annotation_id,
          ...positionData,
          color: positionData.color || '#ffeb3b',
        };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);

    return { highlights };
  } catch (error) {
    console.error('Failed to get highlights:', error);
    return { highlights: [] };
  }
}

async function handleSaveNote(message, sender) {
  const { question, answer, highlightData } = message;
  const tab = sender.tab;

  try {
    // Get or create webpage source
    const source = await api.getOrCreateWebpageSource(tab.url, tab.title);

    // Create annotation
    const annotation = await api.createAnnotation(source.id, {
      annotation_id: highlightData.id,
      page_index: null, // No pages for web
      question,
      answer,
      highlighted_text: highlightData.text,
      position_data: JSON.stringify(highlightData),
    });

    return { success: true, annotation };
  } catch (error) {
    console.error('Failed to save note:', error);
    return { success: false, error: error.message };
  }
}

async function handleGetNotes(message) {
  const { url, title } = message;

  try {
    // Get or create webpage source
    const source = await api.getOrCreateWebpageSource(url, title);

    // Get annotations
    const annotations = await api.getAnnotations(source.id);

    return { notes: annotations, sourceId: source.id };
  } catch (error) {
    console.error('Failed to get notes:', error);
    return { notes: [], error: error.message };
  }
}

async function handleUpdateNote(message) {
  const { annotationId, updates } = message;

  try {
    const annotation = await api.updateAnnotation(annotationId, updates);
    return { success: true, annotation };
  } catch (error) {
    console.error('Failed to update note:', error);
    return { success: false, error: error.message };
  }
}

async function handleDeleteNote(message) {
  const { annotationId } = message;

  try {
    await api.deleteAnnotation(annotationId);
    return { success: true };
  } catch (error) {
    console.error('Failed to delete note:', error);
    return { success: false, error: error.message };
  }
}

async function handleGetPageContext(message, sender) {
  const tab = sender.tab || message.tab;

  if (!tab) {
    return { url: '', title: '', error: 'No tab context' };
  }

  return {
    url: tab.url,
    title: tab.title,
  };
}

// Clean up page contexts when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  pageContexts.delete(tabId);
});
