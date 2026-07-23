import React from "react";
import { captureError } from "@/lib/telemetry";
import { t, getStoredLanguage } from "@/lib/i18n";

// Global error boundary. Catches render-time errors anywhere in the tree and
// shows a calm fallback instead of a white screen, while reporting the error
// through the telemetry seam. Language comes from localStorage, since this
// renders outside the React data layer and cannot read AppUser.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    captureError(error, { componentStack: info?.componentStack });
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const lang = getStoredLanguage();
      return (
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="max-w-md text-center">
            <h1 className="font-serif text-2xl font-semibold mb-3">
              {t("error_title", lang)}
            </h1>
            <p className="text-muted-foreground text-sm mb-6">
              {t("error_text", lang)}
            </p>
            <button
              onClick={this.handleReload}
              className="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              {t("error_reload", lang)}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
