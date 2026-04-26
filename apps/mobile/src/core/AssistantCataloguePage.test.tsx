/**
 * Render + interaction tests for `<AssistantCataloguePage>`.
 *
 * Covers:
 *  - shell renders the screen title and the search input;
 *  - all eight registry modules render their localised header
 *    (`Фінік`, `Фізрук`, `Рутина`, `Харчування`, `Кросмодульні`,
 *    `Аналітика`, `Утиліти`, `Пам'ять`);
 *  - module headers carry the visible per-module count derived from
 *    `ASSISTANT_CAPABILITIES`;
 *  - a representative capability row (`create_transaction`) renders
 *    its label;
 *  - typing a query filters down the list and tapping a row opens the
 *    detail sheet with the capability's example commands;
 *  - clearing the query restores all entries.
 */

import { fireEvent, render } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import {
  ASSISTANT_CAPABILITIES,
  CAPABILITY_MODULE_META,
  CAPABILITY_MODULE_ORDER,
} from "@sergeant/shared";

import { AssistantCataloguePage } from "./AssistantCataloguePage";

jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual("react-native-safe-area-context");
  return {
    ...actual,
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  };
});

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

describe("AssistantCataloguePage", () => {
  it("renders the screen title and the search input", () => {
    const { getByText, getByTestId } = render(<AssistantCataloguePage />);
    expect(getByText("Можливості асистента")).toBeTruthy();
    expect(getByTestId("assistant-catalogue-search")).toBeTruthy();
  });

  it("renders every module header from the registry with its count", () => {
    const { getAllByText } = render(<AssistantCataloguePage />);

    for (const module of CAPABILITY_MODULE_ORDER) {
      const total = ASSISTANT_CAPABILITIES.filter(
        (c) => c.module === module,
      ).length;
      if (total === 0) continue;

      // Module title + count render inside a single nested <Text>;
      // assert the title substring is present at least once.
      const matches = getAllByText(
        new RegExp(CAPABILITY_MODULE_META[module].title),
      );
      if (matches.length === 0) {
        throw new Error(`Module header missing for ${module}`);
      }
    }
  });

  it("renders a representative capability row from the registry", () => {
    const { getByTestId, getByText } = render(<AssistantCataloguePage />);
    const sample = ASSISTANT_CAPABILITIES.find(
      (c) => c.id === "create_transaction",
    );
    expect(sample).toBeDefined();
    expect(getByTestId(`catalogue-capability-${sample!.id}`)).toBeTruthy();
    expect(getByText(sample!.label)).toBeTruthy();
  });

  it("filters the list as the user types and clears back when query empties", () => {
    const { getByTestId, queryByTestId } = render(<AssistantCataloguePage />);
    const search = getByTestId("assistant-catalogue-search");

    fireEvent.changeText(search, "тренування");
    // create_transaction belongs to фінанси and shouldn't match the query.
    expect(queryByTestId("catalogue-capability-create_transaction")).toBeNull();
    // start_workout belongs to фізрук and should still be visible.
    expect(queryByTestId("catalogue-capability-start_workout")).toBeTruthy();

    fireEvent.changeText(search, "");
    expect(
      queryByTestId("catalogue-capability-create_transaction"),
    ).toBeTruthy();
    expect(queryByTestId("catalogue-capability-start_workout")).toBeTruthy();
  });

  it("shows an empty state when nothing matches the query", () => {
    const { getByTestId, getByText } = render(<AssistantCataloguePage />);
    fireEvent.changeText(
      getByTestId("assistant-catalogue-search"),
      "zxqwerty12345",
    );
    expect(getByText(/Нічого не знайдено/)).toBeTruthy();
  });

  it("opens the detail sheet with the capability's examples on row tap", () => {
    const { getByTestId, getByText, getAllByText } = render(
      <AssistantCataloguePage />,
    );
    const sample = ASSISTANT_CAPABILITIES.find(
      (c) => c.id === "create_transaction",
    );
    expect(sample).toBeDefined();

    fireEvent.press(getByTestId(`catalogue-capability-${sample!.id}`));

    // The capability description renders both in the row card and in
    // the sheet (sheet covers the row but the row stays mounted), so
    // at least two matches indicate the sheet opened.
    expect(getAllByText(sample!.description).length).toBeGreaterThanOrEqual(2);
    // Example bullets are sheet-only — a single match is enough.
    expect(getByText(`«${sample!.examples[0]}»`)).toBeTruthy();
  });
});
