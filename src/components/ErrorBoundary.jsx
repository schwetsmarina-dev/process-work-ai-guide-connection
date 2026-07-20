import React from "react";
import { captureError } from "@/lib/telemetry";

// Global error boundary. Catches render-time errors anywhere in the tree and
// shows a calm fallback instead of a white screen, while reporting the error
// through the telemetry seam. Bilingual (ru/es) neutral copy — it can't read
// the user's language preference from here, so it shows both briefly.
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
      return (
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="max-w-md text-center">
            <h1 className="font-serif text-2xl font-semibold mb-3">
              Что-то пошло не так
            </h1>
            <p className="text-muted-foreground text-sm mb-1">
              Произошла ошибка. Твои данные в безопасности — попробуй обновить страницу.
            </p>
            <p className="text-muted-foreground text-sm mb-6">
              Algo salió mal. Tus datos están a salvo — intenta recargar la página.
            </p>
            <button
              onClick={this.handleReload}
              className="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Обновить · Recargar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
