import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '../components/ui/Button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Last-resort catch for render errors that slip past route-level handling.
 * Query/mutation errors are handled in place by each feature (loading /
 * error states), not here.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-4 text-center">
          <h1 className="font-display text-xl font-semibold text-navy">Something came loose</h1>
          <p className="max-w-sm text-sm text-navy/60">
            An unexpected error broke this page. Reloading usually fixes it.
          </p>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </div>
      );
    }

    return this.props.children;
  }
}
