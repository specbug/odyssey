import React from 'react';

// Last-resort net for a screen that throws mid-render. Without it, a crash
// inside (say) the PDF viewer blanks the entire shell — rail included — and
// the persisted `odyssey:route` walks the user straight back into the crash
// on the next load. The fallback always offers a way home.
//
// App.js keys this by route, so changing route remounts it with a clean slate.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[odyssey] screen crashed', error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: 'var(--paper)', zIndex: 200 }}>
        <div style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}>
          <div className="mono-sm" style={{ color: 'var(--ink-4)', marginBottom: 16 }}>SOMETHING BROKE</div>
          <div style={{ color: 'var(--ink-2)', marginBottom: 24 }}>
            {error?.message || 'This screen failed to render.'}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn primary" onClick={this.props.onGoHome}>Back to home</button>
            <button className="btn" onClick={() => window.location.reload()}>Reload</button>
          </div>
        </div>
      </div>
    );
  }
}
