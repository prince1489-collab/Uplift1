// ErrorBoundary.jsx — stops one thrown error from taking the whole app with it.
//
// The app had none. That meant any exception during render unmounted the entire tree and
// left a blank white screen: no message, no reload button, nothing to tell you the app had
// crashed rather than simply failed to load. Two bugs in one week ended that way, and in
// both cases the underlying mistake was small — an undefined passed to a state setter, and
// a null read in a callback. Neither deserved to be fatal.
//
// This does not make those bugs acceptable; it makes them recoverable. A crash now shows
// what happened and offers a way out, which is the difference between "the app is broken"
// and "the app hiccuped".

import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Kept in the console for chrome://inspect against a device, which is the only way to
    // see this on a phone. Deliberately not swallowed silently.
    console.error("[Seen] render crash:", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    const message = this.state.error?.message || String(this.state.error);
    return (
      <div style={{
        minHeight: "100dvh", display: "grid", placeItems: "center", padding: "24px",
        background: "#FFF6EF", color: "#5C4A3E", textAlign: "center",
        fontFamily: "Inter, system-ui, sans-serif",
      }}>
        <div style={{ maxWidth: 340 }}>
          <div style={{ fontSize: 34, marginBottom: 12 }}>🌱</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#3D3229", margin: "0 0 8px" }}>
            Seen hit a snag
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.55, margin: "0 0 18px" }}>
            Something went wrong while drawing this screen. Nothing you wrote has been lost —
            reloading usually clears it.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              width: "100%", padding: "13px 20px", borderRadius: 999, border: "none",
              background: "#D24341", color: "#fff", fontSize: 15, fontWeight: 700,
            }}>
            Reload Seen
          </button>
          {/* The actual error, small and last. Someone reporting this can read it out, which
              beats "it went white" as a bug report. */}
          <p style={{ fontSize: 11, marginTop: 16, opacity: 0.65, wordBreak: "break-word" }}>
            {message}
          </p>
        </div>
      </div>
    );
  }
}
