import { Component } from "react";

/**
 * Ловить помилки рендеру всередині lazy-модуля; дозволяє повернутися до хаба без перезавантаження вкладки.
 */
export default class ModuleErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      const { onBackToHub } = this.props;
      return (
        <div
          className="min-h-dvh bg-bg flex flex-col items-center justify-center p-6 text-text"
          style={{
            paddingTop: "env(safe-area-inset-top, 0px)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          <p className="text-sm text-muted mb-2 text-center">
            Помилка в модулі
          </p>
          <pre className="text-xs text-red-600 dark:text-red-400 mb-6 max-w-lg w-full overflow-auto whitespace-pre-wrap break-words">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => {
              this.setState({ error: null });
              onBackToHub();
            }}
            className="px-5 py-2.5 rounded-2xl bg-panel border border-line text-text text-sm font-medium shadow-card hover:shadow-float transition-shadow"
          >
            До вибору модуля
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
