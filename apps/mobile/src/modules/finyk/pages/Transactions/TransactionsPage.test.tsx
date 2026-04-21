/**
 * Finyk Transactions screen — covers core requirements: day-grouped
 * sections with running totals, filter chips with persisted state, swipe
 * left = Edit / swipe right = Categorize, empty-state primary CTA, and
 * pull-to-refresh re-reading MMKV.
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import type { Transaction } from "@sergeant/finyk-domain/domain";

import { STORAGE_KEYS } from "@sergeant/shared";

import { _getMMKVInstance, safeWriteLS } from "@/lib/storage";

const FILTERS_KEY = STORAGE_KEYS.FINYK_TX_FILTERS;

jest.mock("@/sync/enqueue", () => ({
  enqueueChange: jest.fn(),
}));

// FlashList in jest renders an `AutoLayoutView` that does not invoke
// `renderItem`, so swap it for a plain ScrollView that walks the data
// array and renders each row directly.
jest.mock("@shopify/flash-list", () => {
  const React = require("react");
  const { ScrollView, View } = require("react-native");
  return {
    FlashList: ({
      data,
      renderItem,
      keyExtractor,
      testID,
      refreshControl,
    }: any) => (
      <ScrollView testID={testID} refreshControl={refreshControl}>
        {(data ?? []).map((item: any, index: number) => (
          <View key={keyExtractor ? keyExtractor(item, index) : index}>
            {renderItem({ item, index })}
          </View>
        ))}
      </ScrollView>
    ),
  };
});

// Replace the gesture-driven SwipeToAction with two plain Pressables so
// jest can simulate "swipe left" / "swipe right" deterministically
// without spinning up Reanimated worklets.
jest.mock("@/components/ui/SwipeToAction", () => {
  const React = require("react");
  const { View, Pressable, Text } = require("react-native");
  let counter = 0;
  return {
    SwipeToAction: ({ children, onSwipeLeft, onSwipeRight }: any) => {
      const idx = React.useMemo(() => ++counter, []);
      return (
        <View>
          {children}
          <Pressable
            testID={`swipe-left-${idx}`}
            onPress={() => onSwipeLeft && onSwipeLeft()}
          >
            <Text>L</Text>
          </Pressable>
          <Pressable
            testID={`swipe-right-${idx}`}
            onPress={() => onSwipeRight && onSwipeRight()}
          >
            <Text>R</Text>
          </Pressable>
        </View>
      );
    },
  };
});

import { TransactionsPage } from "./TransactionsPage";

const FIXED_NOW = new Date("2026-04-21T12:00:00.000Z");

function makeRealTx(overrides: Partial<Transaction>): Transaction {
  const time = overrides.time ?? Math.floor(FIXED_NOW.getTime() / 1000);
  return {
    id: "tx",
    amount: -10000,
    date: new Date(time * 1000).toISOString(),
    categoryId: "",
    type: "expense",
    source: "mono",
    time,
    description: "tx",
    mcc: 0,
    accountId: "acc-1",
    manual: false,
    _source: "monobank",
    _accountId: "acc-1",
    _manual: false,
    ...overrides,
  };
}

beforeEach(() => {
  _getMMKVInstance().clearAll();
});

describe("TransactionsPage — render", () => {
  it("renders the empty state with a primary CTA when there are no transactions", () => {
    render(<TransactionsPage now={FIXED_NOW} />);
    expect(screen.getByTestId("finyk-transactions-empty")).toBeTruthy();
    const cta = screen.getByTestId("finyk-transactions-empty-add");
    expect(cta).toBeTruthy();
    fireEvent.press(cta);
    expect(screen.getByTestId("finyk-transactions-sheet")).toBeTruthy();
  });

  it("renders seeded manual expenses grouped by day with running totals", () => {
    render(
      <TransactionsPage
        now={FIXED_NOW}
        seed={{
          manualExpenses: [
            {
              id: "me-1",
              description: "обід",
              amount: 250,
              category: "🍴 їжа",
              date: "2026-04-15T12:00:00.000Z",
            },
            {
              id: "me-2",
              description: "кава",
              amount: 80,
              category: "🍔 кафе та ресторани",
              date: "2026-04-15T09:00:00.000Z",
            },
            {
              id: "me-3",
              description: "проїзд",
              amount: 30,
              category: "🚖 транспорт",
              date: "2026-04-10T09:00:00.000Z",
            },
          ],
        }}
      />,
    );
    expect(screen.getByTestId("finyk-transactions-list")).toBeTruthy();
    expect(screen.queryByTestId("finyk-transactions-empty")).toBeNull();
    // Two distinct day-headers (Apr 15 and Apr 10).
    expect(screen.getByTestId("finyk-tx-day-h-2026-04-15")).toBeTruthy();
    expect(screen.getByTestId("finyk-tx-day-h-2026-04-10")).toBeTruthy();
  });

  it("computes per-day running totals correctly across multiple groups", () => {
    render(
      <TransactionsPage
        now={FIXED_NOW}
        seed={{
          manualExpenses: [
            // Apr 15 — total = -250 + -80 = -330
            {
              id: "me-1",
              description: "обід",
              amount: 250,
              category: "🍴 їжа",
              date: "2026-04-15T12:00:00.000Z",
            },
            {
              id: "me-2",
              description: "кава",
              amount: 80,
              category: "🍔 кафе та ресторани",
              date: "2026-04-15T09:00:00.000Z",
            },
            // Apr 10 — total = -30
            {
              id: "me-3",
              description: "проїзд",
              amount: 30,
              category: "🚖 транспорт",
              date: "2026-04-10T09:00:00.000Z",
            },
          ],
        }}
      />,
    );
    function flatText(node: any): string {
      if (node == null) return "";
      if (typeof node === "string" || typeof node === "number") return String(node);
      if (Array.isArray(node)) return node.map(flatText).join("");
      if (node.props?.children) return flatText(node.props.children);
      return "";
    }
    const aprFifteen = flatText(
      screen.getByTestId("finyk-tx-day-h-2026-04-15").props.children,
    );
    const aprTen = flatText(
      screen.getByTestId("finyk-tx-day-h-2026-04-10").props.children,
    );
    // Totals are the sum of signed amounts (manual expenses convert to
    // negative cents — fmtAmt divides by 100 → "330,00₴" / "30,00₴").
    expect(aprFifteen).toMatch(/330/);
    expect(aprTen).toMatch(/30/);
    // Sanity: the Apr 15 group with two items must NOT show -80 alone.
    expect(aprFifteen).not.toMatch(/^.*\b80,00.*$/);
  });

  it("disables the next-month button when viewing the current month", () => {
    render(<TransactionsPage now={FIXED_NOW} />);
    const nextBtn = screen.getByTestId("finyk-transactions-next-month");
    expect(nextBtn.props.accessibilityState?.disabled).toBe(true);
  });
});

describe("TransactionsPage — filters", () => {
  it("filters to expenses only when the 'Витрати' chip is tapped", () => {
    render(
      <TransactionsPage
        now={FIXED_NOW}
        seed={{
          manualExpenses: [
            {
              id: "me-1",
              description: "обід",
              amount: 250,
              category: "🍴 їжа",
              date: "2026-04-15T12:00:00.000Z",
            },
          ],
          realTx: [
            makeRealTx({
              id: "tx-income",
              time: Math.floor(
                new Date("2026-04-12T10:00:00.000Z").getTime() / 1000,
              ),
              amount: 50000,
              description: "зарплата",
            }),
          ],
        }}
      />,
    );

    expect(screen.getByText("зарплата")).toBeTruthy();
    expect(screen.getByText("обід")).toBeTruthy();

    fireEvent.press(screen.getByTestId("finyk-transactions-filter-expense"));

    expect(screen.queryByText("зарплата")).toBeNull();
    expect(screen.getByText("обід")).toBeTruthy();
  });

  it("persists the active filter to MMKV and exposes a clear-all action", async () => {
    const { unmount } = render(<TransactionsPage now={FIXED_NOW} />);
    fireEvent.press(screen.getByTestId("finyk-transactions-filter-income"));

    await waitFor(() => {
      const raw = _getMMKVInstance().getString(FILTERS_KEY);
      expect(raw).toBeTruthy();
      expect(JSON.parse(raw!).filter).toBe("income");
    });

    // Clear-all chip should appear and reset the persisted filter.
    const clearBtn = screen.getByTestId("finyk-transactions-clear-filters");
    fireEvent.press(clearBtn);
    await waitFor(() => {
      const raw = _getMMKVInstance().getString(FILTERS_KEY);
      expect(JSON.parse(raw!).filter).toBe("all");
    });
    unmount();
  });

  it("filters by a date range when the user picks a window", async () => {
    render(
      <TransactionsPage
        now={FIXED_NOW}
        seed={{
          manualExpenses: [
            {
              id: "me-1",
              description: "обід",
              amount: 250,
              category: "🍴 їжа",
              date: "2026-04-15T12:00:00.000Z",
            },
            {
              id: "me-2",
              description: "проїзд",
              amount: 30,
              category: "🚖 транспорт",
              date: "2026-04-05T09:00:00.000Z",
            },
          ],
        }}
      />,
    );
    fireEvent.press(screen.getByTestId("finyk-transactions-filter-range"));
    fireEvent.changeText(
      screen.getByTestId("finyk-transactions-range-start"),
      "2026-04-10",
    );
    fireEvent.changeText(
      screen.getByTestId("finyk-transactions-range-end"),
      "2026-04-20",
    );
    fireEvent.press(screen.getByTestId("finyk-transactions-range-apply"));

    await waitFor(() => {
      expect(screen.getByText("обід")).toBeTruthy();
      expect(screen.queryByText("проїзд")).toBeNull();
    });
    // The chip switches to its "active" label.
    expect(
      screen.getByTestId("finyk-transactions-filter-range"),
    ).toBeTruthy();
  });

  it("hydrates the filter from MMKV across remounts", () => {
    safeWriteLS(FILTERS_KEY, {
      filter: "income",
      accountIds: [],
      range: { startMs: null, endMs: null },
    });
    render(
      <TransactionsPage
        now={FIXED_NOW}
        seed={{
          manualExpenses: [
            {
              id: "me-1",
              description: "обід",
              amount: 250,
              category: "🍴 їжа",
              date: "2026-04-15T12:00:00.000Z",
            },
          ],
        }}
      />,
    );
    // 'обід' is an expense → should not render under the income filter.
    expect(screen.queryByText("обід")).toBeNull();
    // The income chip is rendered as selected.
    const chip = screen.getByTestId("finyk-transactions-filter-income");
    expect(chip.props.accessibilityState?.selected).toBe(true);
  });
});

describe("TransactionsPage — swipe actions", () => {
  it("opens a categorize picker when a row is swiped right", async () => {
    render(
      <TransactionsPage
        now={FIXED_NOW}
        seed={{
          manualExpenses: [
            {
              id: "me-1",
              description: "обід",
              amount: 250,
              category: "🍴 їжа",
              date: "2026-04-15T12:00:00.000Z",
            },
          ],
        }}
      />,
    );
    const swipeRight = screen.getAllByTestId(/swipe-right-/i)[0]!;
    fireEvent.press(swipeRight);
    await waitFor(() => {
      expect(
        screen.getByTestId("finyk-transactions-cat-picker"),
      ).toBeTruthy();
    });
  });

  it("re-reads MMKV-backed manual expenses on pull-to-refresh", async () => {
    render(
      <TransactionsPage
        now={FIXED_NOW}
        seed={{
          manualExpenses: [
            {
              id: "me-1",
              description: "обід",
              amount: 250,
              category: "🍴 їжа",
              date: "2026-04-15T12:00:00.000Z",
            },
          ],
        }}
      />,
    );
    expect(screen.getByText("обід")).toBeTruthy();
    expect(screen.queryByText("нова витрата")).toBeNull();

    // Simulate a CloudSync write landing in MMKV from another consumer.
    safeWriteLS("finyk_manual_expenses_v1", [
      {
        id: "me-1",
        description: "обід",
        amount: 250,
        category: "🍴 їжа",
        date: "2026-04-15T12:00:00.000Z",
      },
      {
        id: "me-2",
        description: "нова витрата",
        amount: 99,
        category: "🍴 їжа",
        date: "2026-04-16T08:00:00.000Z",
      },
    ]);

    const list = screen.getByTestId("finyk-transactions-list");
    const refreshControl = list.props.refreshControl;
    expect(refreshControl).toBeTruthy();
    refreshControl.props.onRefresh();

    await waitFor(() => {
      expect(screen.getByText("нова витрата")).toBeTruthy();
    });
  });

  it("hydrates bank transactions from the FINYK_TX_CACHE MMKV snapshot when no seed is provided", () => {
    const realTx = makeRealTx({
      id: "tx-cached-bank",
      time: Math.floor(new Date("2026-04-12T10:00:00.000Z").getTime() / 1000),
      amount: -54321,
      description: "Сільпо",
      mcc: 5411,
    });
    safeWriteLS(STORAGE_KEYS.FINYK_TX_CACHE, {
      txs: [realTx],
      timestamp: Date.now(),
    });
    render(<TransactionsPage now={FIXED_NOW} />);
    expect(screen.getByText("Сільпо")).toBeTruthy();
  });

  it("falls back to FINYK_TX_CACHE_LAST_GOOD when the primary cache is empty", () => {
    const realTx = makeRealTx({
      id: "tx-last-good",
      time: Math.floor(new Date("2026-04-08T10:00:00.000Z").getTime() / 1000),
      amount: -10000,
      description: "Аврора",
      mcc: 5411,
    });
    safeWriteLS(STORAGE_KEYS.FINYK_TX_CACHE_LAST_GOOD, {
      txs: [realTx],
      timestamp: Date.now(),
    });
    render(<TransactionsPage now={FIXED_NOW} />);
    expect(screen.getByText("Аврора")).toBeTruthy();
  });

  it("removes a manual expense when the user taps Delete in the edit sheet", async () => {
    render(
      <TransactionsPage
        now={FIXED_NOW}
        seed={{
          manualExpenses: [
            {
              id: "me-del",
              description: "стара витрата",
              amount: 99,
              category: "🍴 їжа",
              date: "2026-04-15T12:00:00.000Z",
            },
          ],
        }}
      />,
    );
    expect(screen.getByText("стара витрата")).toBeTruthy();
    const swipeLeft = screen.getAllByTestId(/swipe-left-/i)[0]!;
    fireEvent.press(swipeLeft);
    const del = await screen.findByTestId("finyk-transactions-sheet-delete");
    fireEvent.press(del);
    await waitFor(() => {
      expect(screen.queryByText("стара витрата")).toBeNull();
    });
  });

  it("opens an edit options sheet when a bank row is swiped left and lets the user hide it", async () => {
    const realTx: Transaction = makeRealTx({
      id: "tx-bank",
      time: Math.floor(new Date("2026-04-15T10:00:00.000Z").getTime() / 1000),
      amount: -12345,
      description: "ATB",
      mcc: 5411,
    });
    render(<TransactionsPage now={FIXED_NOW} seed={{ realTx: [realTx] }} />);
    expect(screen.getByText("ATB")).toBeTruthy();

    const swipeLeft = screen.getAllByTestId(/swipe-left-/i)[0]!;
    fireEvent.press(swipeLeft);

    const sheet = await screen.findByTestId(
      "finyk-transactions-bank-edit-sheet",
    );
    expect(sheet).toBeTruthy();

    fireEvent.press(
      screen.getByTestId("finyk-transactions-bank-edit-hide"),
    );
    await waitFor(() => {
      expect(screen.queryByText("ATB")).toBeNull();
    });
  });

  it("opens the prefilled edit sheet when a manual row is swiped left", async () => {
    render(
      <TransactionsPage
        now={FIXED_NOW}
        seed={{
          manualExpenses: [
            {
              id: "me-1",
              description: "обід",
              amount: 250,
              category: "🍴 їжа",
              date: "2026-04-15T12:00:00.000Z",
            },
          ],
        }}
      />,
    );
    const swipeLeft = screen.getAllByTestId(/swipe-left-/i)[0]!;
    fireEvent.press(swipeLeft);
    await waitFor(() => {
      expect(screen.getByTestId("finyk-transactions-sheet")).toBeTruthy();
    });
  });
});
