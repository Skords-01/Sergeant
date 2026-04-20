import { fireEvent, render } from "@testing-library/react-native";
import { Component } from "react";
import { Text } from "react-native";

import ModuleErrorBoundary from "./ModuleErrorBoundary";

let consoleSpy: jest.SpyInstance;
beforeEach(() => {
  consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  consoleSpy.mockRestore();
});

function Thrower({ boom }: { boom: boolean }) {
  if (boom) throw new Error("module-kaboom");
  return <Text>module-ok</Text>;
}

describe("ModuleErrorBoundary", () => {
  it("renders children when nothing throws", () => {
    const { getByText } = render(
      <ModuleErrorBoundary onBackToHub={() => {}}>
        <Thrower boom={false} />
      </ModuleErrorBoundary>,
    );
    expect(getByText("module-ok")).toBeTruthy();
  });

  it("renders the generic fallback headline when moduleName is omitted", () => {
    const { getByText } = render(
      <ModuleErrorBoundary onBackToHub={() => {}}>
        <Thrower boom />
      </ModuleErrorBoundary>,
    );
    expect(getByText("Помилка в модулі")).toBeTruthy();
    expect(getByText("module-kaboom")).toBeTruthy();
  });

  it("contextualises the headline with moduleName when provided", () => {
    const { getByText } = render(
      <ModuleErrorBoundary onBackToHub={() => {}} moduleName="Фінік">
        <Thrower boom />
      </ModuleErrorBoundary>,
    );
    expect(getByText("Модуль Фінік не вдалося завантажити")).toBeTruthy();
  });

  it("retry resets local state and remounts the sub-tree without bubbling to the parent boundary", () => {
    let shouldThrow = true;
    const parentOnError = jest.fn();
    function ControlledThrower() {
      if (shouldThrow) throw new Error("module-kaboom");
      return <Text>module-recovered</Text>;
    }

    class TestRoot extends Component<
      Record<string, never>,
      { parentCaught: boolean }
    > {
      state = { parentCaught: false };
      static getDerivedStateFromError() {
        return { parentCaught: true };
      }
      componentDidCatch(err: Error) {
        parentOnError(err);
      }
      render() {
        if (this.state.parentCaught) return <Text>parent-fallback</Text>;
        return (
          <ModuleErrorBoundary onBackToHub={() => {}}>
            <ControlledThrower />
          </ModuleErrorBoundary>
        );
      }
    }

    const { getByText, queryByText, rerender } = render(<TestRoot />);

    // Module-level fallback, NOT the parent fallback.
    expect(getByText("Помилка в модулі")).toBeTruthy();
    expect(queryByText("parent-fallback")).toBeNull();
    expect(parentOnError).not.toHaveBeenCalled();

    // Stop throwing and hit retry.
    shouldThrow = false;
    fireEvent.press(getByText("Спробувати ще"));
    rerender(<TestRoot />);

    expect(queryByText("Помилка в модулі")).toBeNull();
    expect(getByText("module-recovered")).toBeTruthy();
    expect(parentOnError).not.toHaveBeenCalled();
  });

  it("'До вибору модуля' button calls onBackToHub", () => {
    const onBackToHub = jest.fn();
    const { getByText } = render(
      <ModuleErrorBoundary onBackToHub={onBackToHub}>
        <Thrower boom />
      </ModuleErrorBoundary>,
    );
    fireEvent.press(getByText("До вибору модуля"));
    expect(onBackToHub).toHaveBeenCalledTimes(1);
  });
});
