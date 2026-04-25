import { describe, it, expect } from "vitest";
import { mergeTxByIdDesc } from "./mergeTx";
import type { Transaction } from "@sergeant/finyk-domain/domain/types";

function tx(id: string, time: number, amount = -100): Transaction {
  return {
    id,
    time,
    amount,
    description: id,
    date: new Date(time * 1000).toISOString(),
    type: "expense",
    source: "mono",
  } as Transaction;
}

describe("mergeTxByIdDesc", () => {
  it("повертає порожній масив для двох порожніх входів", () => {
    expect(mergeTxByIdDesc([], [])).toEqual([]);
  });

  it("сортує за спаданням time", () => {
    const out = mergeTxByIdDesc([tx("a", 100), tx("b", 300), tx("c", 200)], []);
    expect(out.map((t) => t.id)).toEqual(["b", "c", "a"]);
  });

  it("дедупить по id, current перекриває previous", () => {
    const prev = [tx("a", 100, -100)];
    const cur = [tx("a", 100, -150)]; // оновлена сума
    const out = mergeTxByIdDesc(cur, prev);
    expect(out).toHaveLength(1);
    expect(out[0].amount).toBe(-150);
  });

  it("зберігає id зі snapshot-у, яких немає у поточному (partial-failure кейс)", () => {
    // Регресія: при rate-limit-і Monobank поточний combine повертав tx
    // лише одного акаунта; без злиття зі snapshot-ом UI втрачав дані інших.
    const prev = [tx("a", 100), tx("b", 200), tx("c", 300)];
    const cur = [tx("b", 200)]; // тільки 1 акаунт встиг відповісти
    const out = mergeTxByIdDesc(cur, prev);
    expect(out.map((t) => t.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("у current всі унікальні + previous всі унікальні — об'єднує всі без втрат", () => {
    const prev = [tx("a", 100), tx("b", 200)];
    const cur = [tx("c", 300), tx("d", 400)];
    const out = mergeTxByIdDesc(cur, prev);
    expect(out.map((t) => t.id)).toEqual(["d", "c", "b", "a"]);
  });

  it("обробляє відсутній time як 0 (поведінка дефолту)", () => {
    const a = { ...tx("a", 100), time: undefined } as unknown as Transaction;
    const b = tx("b", 200);
    const out = mergeTxByIdDesc([a, b], []);
    expect(out.map((t) => t.id)).toEqual(["b", "a"]);
  });
});
