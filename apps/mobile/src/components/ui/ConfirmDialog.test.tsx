import { fireEvent, render } from "@testing-library/react-native";
import { AccessibilityInfo, Pressable } from "react-native";

import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  beforeEach(() => {
    jest
      .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
      .mockResolvedValue(false);
    jest
      .spyOn(AccessibilityInfo, "addEventListener")
      .mockImplementation(() => ({ remove: () => {} }) as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders nothing when open=false", () => {
    const { queryByText } = render(
      <ConfirmDialog open={false} title="Видалити запис?" />,
    );
    expect(queryByText("Видалити запис?")).toBeNull();
  });

  it("renders title and description when open=true", () => {
    const { getByText } = render(
      <ConfirmDialog
        open
        title="Видалити запис?"
        description="Цю дію не можна скасувати."
      />,
    );
    expect(getByText("Видалити запис?")).toBeTruthy();
    expect(getByText("Цю дію не можна скасувати.")).toBeTruthy();
  });

  it("pressing the confirm button calls onConfirm", () => {
    const onConfirm = jest.fn();
    const { getByText } = render(
      <ConfirmDialog open confirmLabel="Так, видалити" onConfirm={onConfirm} />,
    );
    fireEvent.press(getByText("Так, видалити"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("pressing the cancel button calls onCancel", () => {
    const onCancel = jest.fn();
    const { getByText } = render(
      <ConfirmDialog open cancelLabel="Скасувати дію" onCancel={onCancel} />,
    );
    fireEvent.press(getByText("Скасувати дію"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("scrim press calls onCancel", () => {
    const onCancel = jest.fn();
    const { UNSAFE_getAllByType } = render(
      <ConfirmDialog open onCancel={onCancel} />,
    );
    // Pressables in render order: [0] scrim, [1] confirm, [2] cancel.
    const scrim = UNSAFE_getAllByType(Pressable)[0];
    expect(scrim.props.testID).toBe("confirm-dialog-scrim");
    fireEvent.press(scrim);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("danger=false uses the non-destructive primary confirm variant", () => {
    const { UNSAFE_getAllByType } = render(
      <ConfirmDialog open danger={false} confirmLabel="Зберегти" />,
    );
    // Pressables in render order: [0] scrim, [1] confirm, [2] cancel.
    const pressables = UNSAFE_getAllByType(Pressable);
    expect(pressables.length).toBeGreaterThanOrEqual(3);
    const confirm = pressables[1];
    expect(confirm.props.className).toContain("bg-brand-500");
    expect(confirm.props.className).not.toContain("bg-danger");
  });
});
