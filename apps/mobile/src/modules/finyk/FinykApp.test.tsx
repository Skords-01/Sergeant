/**
 * Smoke test for the Finyk mobile module shell.
 *
 * Confirms the Overview shell renders its core surfaces — hero copy
 * and the four drill-down nav cards — so subsequent Phase 4 PRs have
 * a regression fence before they start swapping in real content.
 */
import { render, screen } from "@testing-library/react-native";

import { FinykApp } from "./FinykApp";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

describe("FinykApp shell", () => {
  it("renders module title and hero copy", () => {
    render(<FinykApp />);
    expect(screen.getByText("ФІНІК")).toBeTruthy();
    expect(screen.getByText("Особисті фінанси та бюджети")).toBeTruthy();
  });

  it("renders all four drill-down nav cards", () => {
    render(<FinykApp />);
    expect(screen.getByText("Операції")).toBeTruthy();
    expect(screen.getByText("Планування")).toBeTruthy();
    expect(screen.getByText("Аналітика")).toBeTruthy();
    expect(screen.getByText("Активи")).toBeTruthy();
  });
});
