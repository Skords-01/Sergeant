import { Component } from "react";

export class SectionErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (error) {
      const title = this.props.title || "Помилка";
      const resetLabel = this.props.resetLabel || "Відновити";
      const onReset = this.props.onReset;
      return (
        <div className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-text shadow-card">
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-subtle mt-1">
            Ця секція впала, але інші частини модуля працюють.
          </div>
          <pre className="mt-2 text-[11px] text-danger whitespace-pre-wrap break-words max-h-40 overflow-auto">
            {String(error?.message || error)}
          </pre>
          <div className="mt-3 flex gap-2 flex-wrap">
            <button
              type="button"
              className="px-4 py-2 rounded-xl border border-line bg-panelHi text-xs font-semibold hover:bg-panel transition-colors"
              onClick={() => {
                this.setState({ error: null });
                onReset?.();
              }}
            >
              {resetLabel}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

