import { fireEvent, render } from "@testing-library/react-native";
import { AccessibilityInfo, Modal, Text } from "react-native";

import { Sheet } from "./Sheet";

describe("Sheet", () => {
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

  it("does not render title / description / children when `open` is false", () => {
    const { queryByText } = render(
      <Sheet
        open={false}
        onClose={() => {}}
        title="Назва шита"
        description="Опис шита"
      >
        <Text>Вміст шита</Text>
      </Sheet>,
    );
    expect(queryByText("Назва шита")).toBeNull();
    expect(queryByText("Опис шита")).toBeNull();
    expect(queryByText("Вміст шита")).toBeNull();
  });

  it("renders title, description and children when `open` is true", () => {
    const { getByText } = render(
      <Sheet open onClose={() => {}} title="Назва шита" description="Опис шита">
        <Text>Вміст шита</Text>
      </Sheet>,
    );
    expect(getByText("Назва шита")).toBeTruthy();
    expect(getByText("Опис шита")).toBeTruthy();
    expect(getByText("Вміст шита")).toBeTruthy();
  });

  it("calls `onClose` when the scrim is pressed", () => {
    const onClose = jest.fn();
    const { getAllByLabelText } = render(
      <Sheet open onClose={onClose} title="Назва шита">
        <Text>Вміст шита</Text>
      </Sheet>,
    );
    // Both the scrim and the close button share the `closeLabel`
    // (matches web): scrim is rendered first in JSX, so index 0.
    const scrim = getAllByLabelText("Закрити")[0];
    fireEvent.press(scrim);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls `onClose` when the close button is pressed", () => {
    const onClose = jest.fn();
    const { getAllByLabelText } = render(
      <Sheet open onClose={onClose} title="Назва шита">
        <Text>Вміст шита</Text>
      </Sheet>,
    );
    const closeButton = getAllByLabelText("Закрити")[1];
    fireEvent.press(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls `onClose` on Android hardware back via Modal.onRequestClose", () => {
    const onClose = jest.fn();
    const { UNSAFE_getByType } = render(
      <Sheet open onClose={onClose} title="Назва шита">
        <Text>Вміст шита</Text>
      </Sheet>,
    );
    const modal = UNSAFE_getByType(Modal);
    fireEvent(modal, "requestClose");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders the footer slot when provided", () => {
    const { getByText } = render(
      <Sheet
        open
        onClose={() => {}}
        title="Назва шита"
        footer={<Text>Футер шита</Text>}
      >
        <Text>Вміст шита</Text>
      </Sheet>,
    );
    expect(getByText("Футер шита")).toBeTruthy();
  });

  it("does not render a footer region when no `footer` is passed", () => {
    const { queryByText } = render(
      <Sheet open onClose={() => {}} title="Назва шита">
        <Text>Вміст шита</Text>
      </Sheet>,
    );
    expect(queryByText("Футер шита")).toBeNull();
  });
});
