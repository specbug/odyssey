import React from 'react';

// Last-resort net for a screen that throws mid-render. Without it, a crash
// inside (say) the PDF viewer blanks the whole shell, rail included, and the
// persisted `odyssey:route` walks the user straight back into the crash on
// the next load. The fallback always offers a way home.
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
    const why = error?.message ? ` ${String(error.message).replace(/\.$/, '')}.` : '';
    return (
      <div className="overlay-message">
        <p className="t-body">Couldn’t show this screen.{why}</p>
        <div className="overlay-actions">
          <button className="btn primary" onClick={this.props.onGoHome}>Home</button>
          <button className="btn" onClick={() => window.location.reload()}>Reload</button>
        </div>
      </div>
    );
  }
}
