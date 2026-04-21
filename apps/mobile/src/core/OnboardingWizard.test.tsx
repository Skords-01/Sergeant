import { fireEvent, render } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import {
  FIRST_ACTION_PENDING_KEY,
  FIRST_ACTION_STARTED_AT_KEY,
  ONBOARDING_DONE_KEY,
  VIBE_PICKS_KEY,
} from "@sergeant/shared";

import { OnboardingWizard } from "./OnboardingWizard";
import { _getMMKVInstance } from "@/lib/storage";

function resetStore() {
  _getMMKVInstance().clearAll();
}

describe("OnboardingWizard", () => {
  beforeEach(() => {
    resetStore();
    // Swallow the async reduce-motion probe so tests don't leak React
    // act warnings. Matches the pattern used by Sheet/Skeleton tests.
    jest
      .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
      .mockResolvedValue(false);
    jest
      .spyOn(AccessibilityInfo, "addEventListener")
      .mockReturnValue({ remove: () => {} } as ReturnType<
        typeof AccessibilityInfo.addEventListener
      >);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders the splash headline and all four vibe chips", () => {
    const { getByText, getByTestId } = render(
      <OnboardingWizard onDone={jest.fn()} />,
    );
    expect(getByText("Твоє життя — один екран.")).toBeTruthy();
    expect(getByTestId("onboarding-chip-finyk")).toBeTruthy();
    expect(getByTestId("onboarding-chip-fizruk")).toBeTruthy();
    expect(getByTestId("onboarding-chip-routine")).toBeTruthy();
    expect(getByTestId("onboarding-chip-nutrition")).toBeTruthy();
  });

  it("defaults every chip to the selected state (lazy-path)", () => {
    const { getByTestId } = render(<OnboardingWizard onDone={jest.fn()} />);
    for (const id of ["finyk", "fizruk", "routine", "nutrition"] as const) {
      const chip = getByTestId(`onboarding-chip-${id}`);
      expect(chip.props.accessibilityState?.selected).toBe(true);
    }
  });

  it("toggles a chip off and surfaces the empty-picks hint when every chip is cleared", () => {
    const { getByTestId, getByText, queryByText } = render(
      <OnboardingWizard onDone={jest.fn()} />,
    );
    fireEvent.press(getByTestId("onboarding-chip-finyk"));
    expect(
      getByTestId("onboarding-chip-finyk").props.accessibilityState?.selected,
    ).toBe(false);
    expect(queryByText(/Без вибору — всі 4 модулі/)).toBeNull();

    for (const id of ["fizruk", "routine", "nutrition"] as const) {
      fireEvent.press(getByTestId(`onboarding-chip-${id}`));
    }
    expect(getByText(/Без вибору — всі 4 модулі/)).toBeTruthy();
  });

  it("persists picks + done flag + first-action markers on finish", () => {
    const onDone = jest.fn();
    const mmkv = _getMMKVInstance();
    const { getByTestId } = render(<OnboardingWizard onDone={onDone} />);

    fireEvent.press(getByTestId("onboarding-finish"));

    expect(mmkv.getString(ONBOARDING_DONE_KEY)).toBe("1");
    expect(mmkv.getString(FIRST_ACTION_PENDING_KEY)).toBe("1");
    expect(mmkv.getString(FIRST_ACTION_STARTED_AT_KEY)).toBeTruthy();
    const saved = mmkv.getString(VIBE_PICKS_KEY);
    expect(saved).toBeTruthy();
    expect(JSON.parse(saved as string)).toEqual([
      "finyk",
      "fizruk",
      "routine",
      "nutrition",
    ]);

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(null, {
      intent: "vibe_empty",
      picks: ["finyk", "fizruk", "routine", "nutrition"],
    });
  });

  it("falls back to every module when the user cleared every chip before tapping finish", () => {
    const onDone = jest.fn();
    const { getByTestId } = render(<OnboardingWizard onDone={onDone} />);
    for (const id of ["finyk", "fizruk", "routine", "nutrition"] as const) {
      fireEvent.press(getByTestId(`onboarding-chip-${id}`));
    }

    fireEvent.press(getByTestId("onboarding-finish"));

    expect(onDone).toHaveBeenCalledWith(null, {
      intent: "vibe_empty",
      picks: ["finyk", "fizruk", "routine", "nutrition"],
    });
    expect(
      JSON.parse(_getMMKVInstance().getString(VIBE_PICKS_KEY) as string),
    ).toEqual(["finyk", "fizruk", "routine", "nutrition"]);
  });

  it("persists the caller's chosen subset when they deselected some modules", () => {
    const onDone = jest.fn();
    const { getByTestId } = render(<OnboardingWizard onDone={onDone} />);
    fireEvent.press(getByTestId("onboarding-chip-fizruk"));
    fireEvent.press(getByTestId("onboarding-chip-nutrition"));

    fireEvent.press(getByTestId("onboarding-finish"));

    expect(onDone).toHaveBeenCalledWith(null, {
      intent: "vibe_empty",
      picks: ["finyk", "routine"],
    });
  });
});
