import React, { useState, useEffect } from 'react';
import NoteEditor from './NoteEditor.jsx';
import NotesList from './NotesList.jsx';

function App() {
  const [notes, setNotes] = useState([]);
  const [pageInfo, setPageInfo] = useState({ url: '', title: '' });
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingNote, setEditingNote] = useState(null);

  useEffect(() => {
    loadPageData();
  }, []);

  async function loadPageData() {
    try {
      // Get current tab info
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        console.error('No active tab found');
        return;
      }

      setPageInfo({
        url: tab.url,
        title: tab.title,
      });

      // Load notes for this URL
      const response = await chrome.runtime.sendMessage({
        type: 'GET_NOTES',
        url: tab.url,
        title: tab.title,
      });

      if (response.notes) {
        setNotes(response.notes);
      }
    } catch (error) {
      console.error('Failed to load page data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveNote(noteData) {
    try {
      if (editingNote) {
        // Update existing note
        const response = await chrome.runtime.sendMessage({
          type: 'UPDATE_NOTE',
          annotationId: editingNote.id,
          updates: {
            question: noteData.question,
            answer: noteData.answer,
          },
        });

        if (response.success) {
          setNotes(notes.map(n => n.id === editingNote.id ? response.annotation : n));
        }
      } else {
        // Create new note
        const response = await chrome.runtime.sendMessage({
          type: 'SAVE_NOTE',
          ...noteData,
        });

        if (response.success) {
          setNotes([...notes, response.annotation]);
        }
      }

      setShowEditor(false);
      setEditingNote(null);
    } catch (error) {
      console.error('Failed to save note:', error);
      alert('Failed to save note. Please try again.');
    }
  }

  async function handleDeleteNote(noteId) {
    if (!confirm('Delete this note?')) return;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'DELETE_NOTE',
        annotationId: noteId,
      });

      if (response.success) {
        setNotes(notes.filter(n => n.id !== noteId));
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
      alert('Failed to delete note. Please try again.');
    }
  }

  function handleEditNote(note) {
    setEditingNote(note);
    setShowEditor(true);
  }

  function handleNewNote() {
    setEditingNote(null);
    setShowEditor(true);
  }

  if (loading) {
    return (
      <div className="app-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header */}
      <div className="header">
        <h1 className="app-title">Odyssey</h1>
        <div className="page-info">
          <div className="page-title">{pageInfo.title}</div>
          <div className="note-count">{notes.length} {notes.length === 1 ? 'note' : 'notes'}</div>
        </div>
      </div>

      {/* Main content */}
      <div className="main-content">
        {showEditor ? (
          <NoteEditor
            note={editingNote}
            onSave={handleSaveNote}
            onCancel={() => {
              setShowEditor(false);
              setEditingNote(null);
            }}
          />
        ) : (
          <>
            <button className="btn-new-note" onClick={handleNewNote}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14m-7-7h14" />
              </svg>
              New Note
            </button>

            <NotesList
              notes={notes}
              onEdit={handleEditNote}
              onDelete={handleDeleteNote}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default App;
