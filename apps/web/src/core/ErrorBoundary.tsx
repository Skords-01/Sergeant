import { Component, type ErrorInfo, type ReactNode } from "react";
import { captureException } from "./sentry";

interface FallbackProps {
  error: Error;
  resetError: () => void;
}

interface ErrorBoundaryProps {
  children?: ReactNode;
  fallback?: ReactNode | ((props: FallbackProps) => ReactNode);
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Лайтвейтний корневий ErrorBoundary — zero-cost у головному бандлі.
 *
 * Навмисно не використовує `Sentry.ErrorBoundary` з `@sentry/react`, бо той
 * статично підтягує весь SDK (~30–40 KB gzip) у initial chunk — див. правило
 * 2.3 у `.agents/skills/vercel-react-best-practices/AGENTS.md`
 * («Defer Non-Critical Third-Party Libraries»).
 *
 * `captureException` з `./sentry.js` — no-op, поки Sentry не завантажений
 * динамічним імпортом. Коли SDK буде готовий (див. `initSentry`), виклики
 * автоматично перенаправляться в реальний `Sentry.captureException`.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  resetError: () => void;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
    this.resetError = () => this.setState({ error: null });
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Lazy-forward: якщо Sentry SDK ще не підтягнувся, це no-op;
    // якщо вже підтягнувся — піде у Sentry.captureException.
    try {
      captureException(error, {
        contexts: { react: { componentStack: info?.componentStack } },
      });
    } catch {
      /* noop — error boundary не має ламатись через телеметрію */
    }
  }

  render() {
    const { error } = this.state;
    const { fallback: Fallback, children } = this.props;
    if (error) {
      if (typeof Fallback === "function") {
        return <Fallback error={error} resetError={this.resetError} />;
      }
      return Fallback || null;
    }
    return children;
  }
}
