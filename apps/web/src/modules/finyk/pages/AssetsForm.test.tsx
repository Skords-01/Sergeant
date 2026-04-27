// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import {
  SubscriptionForm,
  AssetForm,
  DebtForm,
  ReceivableForm,
} from "./AssetsForm";
import { createRef } from "react";

describe("SubscriptionForm", () => {
  it("renders inputs and buttons", () => {
    const { container } = render(
      <SubscriptionForm
        newSub={{
          name: "",
          emoji: "",
          keyword: "",
          billingDay: "",
          currency: "UAH",
        }}
        setNewSub={vi.fn()}
        setSubscriptions={vi.fn()}
        setShowSubForm={vi.fn()}
      />,
    );
    expect(
      screen.getByPlaceholderText("Ключове слово з транзакції"),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("День списання (1-31)"),
    ).toBeInTheDocument();
    const buttons = within(container).getAllByRole("button");
    const buttonLabels = buttons.map((b) => b.textContent?.trim());
    expect(buttonLabels).toContain("Додати");
    expect(buttonLabels).toContain("Скасувати");
  });

  it("calls setShowSubForm(false) on cancel", () => {
    const onCancel = vi.fn();
    const { container } = render(
      <SubscriptionForm
        newSub={{
          name: "",
          emoji: "",
          keyword: "",
          billingDay: "",
          currency: "UAH",
        }}
        setNewSub={vi.fn()}
        setSubscriptions={vi.fn()}
        setShowSubForm={onCancel}
      />,
    );
    const cancelBtn = within(container)
      .getAllByRole("button")
      .find((b) => b.textContent?.trim() === "Скасувати");
    fireEvent.click(cancelBtn!);
    expect(onCancel).toHaveBeenCalledWith(false);
  });
});

describe("AssetForm", () => {
  it("renders the form title and currency select", () => {
    render(
      <AssetForm
        newAsset={{ name: "", amount: "", currency: "UAH", emoji: "" }}
        setNewAsset={vi.fn()}
        setManualAssets={vi.fn()}
        setShowAssetForm={vi.fn()}
        assetFormRef={createRef()}
        assetNameInputRef={createRef()}
      />,
    );
    expect(screen.getByText("Новий актив")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Сума")).toBeInTheDocument();
  });
});

describe("ReceivableForm", () => {
  it("renders the receivable inputs", () => {
    render(
      <ReceivableForm
        newRecv={{ name: "", emoji: "", amount: "", note: "", dueDate: "" }}
        setNewRecv={vi.fn()}
        setReceivables={vi.fn()}
        setShowRecvForm={vi.fn()}
      />,
    );
    expect(screen.getByPlaceholderText("Сума ₴")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Нотатка (необов'язково)"),
    ).toBeInTheDocument();
  });
});

describe("DebtForm", () => {
  it("renders the debt form title and inputs", () => {
    render(
      <DebtForm
        newDebt={{ name: "", emoji: "", totalAmount: "", dueDate: "" }}
        setNewDebt={vi.fn()}
        setManualDebts={vi.fn()}
        setShowDebtForm={vi.fn()}
        debtFormRef={createRef()}
        debtNameInputRef={createRef()}
      />,
    );
    expect(screen.getByText("Новий пасив")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Загальна сума ₴")).toBeInTheDocument();
  });

  it("calls setShowDebtForm(false) on cancel", () => {
    const onCancel = vi.fn();
    const { container } = render(
      <DebtForm
        newDebt={{ name: "", emoji: "", totalAmount: "", dueDate: "" }}
        setNewDebt={vi.fn()}
        setManualDebts={vi.fn()}
        setShowDebtForm={onCancel}
        debtFormRef={createRef()}
        debtNameInputRef={createRef()}
      />,
    );
    const cancelBtn = within(container)
      .getAllByRole("button")
      .find((b) => b.textContent?.trim() === "Скасувати");
    fireEvent.click(cancelBtn!);
    expect(onCancel).toHaveBeenCalledWith(false);
  });
});
