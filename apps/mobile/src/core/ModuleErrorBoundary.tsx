/**
 * Sergeant Hub-core — ModuleErrorBoundary (React Native)
 *
 * Mobile port of the web per-module boundary. Isolates a single
 * lazy-loaded module's render crash from the rest of the hub, lets the
 * user retry the module sub-tree without a full reload, and offers a
 * "back to hub" escape hatch.
 *
 * @see apps/web/src/core/ModuleErrorBoundary.tsx — canonical source of truth
 *
 * Parity notes:
 * - Same class-component shape, same two-action fallback (retry /
 *   back-to-hub).
 * - `retryRev` counter reused as a React `key` on the children wrapper
 *   so a retry force-remounts the module sub-tree — effects that threw
 *   inside `useEffect` don't get a chance to re-throw on the same
 *   element identity.
 * - `onBackToHub` delegates the hub-navigation decision to the parent,
 *   matching web.
 *
 * Differences from web (intentional — see PR body):
 * - New optional `moduleName?: string` prop. When supplied, the
 *   fallback headline is contextualised as
 *   `"Модуль {moduleName} не вдалося завантажити"` (per Phase 2 task
 *   spec). Web doesn't currently pipe a module name into the fallback
 *   copy — keeping it optional preserves call-site parity.
 * - Telemetry: `@sentry/react-native` is **not** added yet
 *   (Phase 10+); `componentDidCatch` forwards to `console.error`.
 * - UI primitives: shared `Card` + `Button` from
 *   `@/components/ui/*` — no hand-rolled `<div>` / Tailwind classes.
 *   The fallback uses a slightly "less aggressive" surface
 *   (`Card padding="lg"`) than the top-level boundary so a module
 *   crash doesn't visually masquerade as a full-app crash.
 * - NativeWind classes lean on concrete `cream-*` / `stone-*` tokens
 *   pending mobile design-token rollout — same caveat as elsewhere.
 */

import { Component, type ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface ModuleErrorBoundaryProps {
  onBackToHub: () => void;
  moduleName?: string;
  children?: ReactNode;
}

interface ModuleErrorBoundaryState {
  error: Error | null;
  /** Rev counter used as a React `key` on the children wrapper so a
   *  retry forces a clean remount — a plain `setState({error: null})`
   *  doesn't always work when the error was thrown inside `useEffect`
   *  (the same effect may re-throw). Mirrors the web implementation. */
  retryRev: number;
}

export default class ModuleErrorBoundary extends Component<
  ModuleErrorBoundaryProps,
  ModuleErrorBoundaryState
> {
  constructor(props: ModuleErrorBoundaryProps) {
    super(props);
    this.state = { error: null, retryRev: 0 };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    // TODO(phase-10): forward via `@sentry/react-native` once mobile
    // observability is wired up. See `ErrorBoundary.tsx` for the same
    // deferral note.
    try {
      console.error("[ModuleErrorBoundary] caught error", error, {
        moduleName: this.props.moduleName,
      });
    } catch {
      /* noop */
    }
  }

  private handleRetry = () => {
    this.setState((s) => ({ error: null, retryRev: s.retryRev + 1 }));
  };

  private handleBack = () => {
    this.setState({ error: null });
    this.props.onBackToHub();
  };

  render() {
    const { error, retryRev } = this.state;
    const { moduleName } = this.props;

    if (error) {
      const title = moduleName
        ? `Модуль ${moduleName} не вдалося завантажити`
        : "Помилка в модулі";

      return (
        <View className="flex-1 bg-cream-50 items-stretch justify-center p-6">
          <Card variant="default" padding="lg">
            <Text className="text-base font-semibold text-stone-900 mb-2">
              {title}
            </Text>
            <ScrollView className="max-h-40 mb-4">
              <Text className="text-xs text-danger">{error.message}</Text>
            </ScrollView>
            <View className="flex-col gap-2">
              <Button
                variant="primary"
                size="lg"
                onPress={this.handleRetry}
                accessibilityLabel="Спробувати ще раз"
              >
                Спробувати ще
              </Button>
              <Button variant="secondary" size="lg" onPress={this.handleBack}>
                До вибору модуля
              </Button>
            </View>
          </Card>
        </View>
      );
    }

    // Remount sub-tree on retry by using `retryRev` as the React key.
    return <View key={retryRev}>{this.props.children}</View>;
  }
}
