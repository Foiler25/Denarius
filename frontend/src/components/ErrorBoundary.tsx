import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info });
    // Make sure the error reaches the browser console even when wrapped
    console.error("Unhandled render error caught by ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-dvh flex items-center justify-center p-6 bg-background text-foreground">
          <div className="max-w-2xl w-full space-y-4">
            <h1 className="text-xl font-semibold text-destructive">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              The app hit an unexpected error while rendering. Open the browser console for the full
              stack trace, or share the message below when reporting.
            </p>
            <pre className="text-xs bg-muted/50 border rounded-md p-3 overflow-auto max-h-64 whitespace-pre-wrap">
              {this.state.error.name}: {this.state.error.message}
              {"\n\n"}
              {this.state.error.stack}
            </pre>
            <button
              onClick={() => location.reload()}
              className="text-sm rounded-md border px-3 py-1.5 hover:bg-muted"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
