import { useEffect, useMemo, useState } from "react";
import { postJson } from "../lib/nutritionApi.js";
import { mergeItems } from "../lib/mergeItems.js";
import {
  loadActivePantryId,
  loadPantries,
  makeDefaultPantry,
  persistPantries,
  updatePantry,
  NUTRITION_PANTRIES_KEY,
  NUTRITION_ACTIVE_PANTRY_KEY,
} from "../lib/nutritionStorage.js";
import {
  normalizeFoodName,
  parseLoosePantryText,
} from "../lib/pantryTextParser.js";

export function useNutritionPantries({ setBusy, setErr, setStatusText }) {
  const [pantries, setPantries] = useState(() =>
    loadPantries(NUTRITION_PANTRIES_KEY, NUTRITION_ACTIVE_PANTRY_KEY),
  );
  const [activePantryId, setActivePantryId] = useState(() =>
    loadActivePantryId(NUTRITION_ACTIVE_PANTRY_KEY),
  );

  const activePantry = useMemo(() => {
    const arr = Array.isArray(pantries) ? pantries : [];
    return (
      arr.find((p) => p.id === activePantryId) || arr[0] || makeDefaultPantry()
    );
  }, [pantries, activePantryId]);

  const pantryText = activePantry?.text || "";
  const pantryItems = useMemo(
    () => (Array.isArray(activePantry?.items) ? activePantry.items : []),
    [activePantry?.items],
  );
  const [newItemName, setNewItemName] = useState("");

  const [pantryManagerOpen, setPantryManagerOpen] = useState(false);

  const [pantryForm, setPantryForm] = useState(() => ({
    mode: "create",
    name: "",
    err: "",
  }));

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const [itemEdit, setItemEdit] = useState(() => ({
    open: false,
    idx: -1,
    name: "",
    qty: "",
    unit: "",
    err: "",
  }));

  const [pantryStorageErr, setPantryStorageErr] = useState("");

  useEffect(() => {
    const ok = persistPantries(
      NUTRITION_PANTRIES_KEY,
      NUTRITION_ACTIVE_PANTRY_KEY,
      pantries,
      activePantryId,
    );
    setPantryStorageErr(ok ? "" : "Не вдалося зберегти дані складів.");
  }, [pantries, activePantryId]);

  const pantrySummary = useMemo(() => {
    if (!Array.isArray(pantryItems) || pantryItems.length === 0) return "—";
    return pantryItems
      .slice(0, 12)
      .map((x) => x.name)
      .filter(Boolean)
      .join(", ");
  }, [pantryItems]);

  const effectiveItems = useMemo(() => {
    if (Array.isArray(pantryItems) && pantryItems.length > 0)
      return pantryItems;
    const raw = pantryText.trim();
    if (!raw) return [];
    return parseLoosePantryText(raw);
  }, [pantryItems, pantryText]);

  const upsertItem = (raw) => {
    const parsed = parseLoosePantryText(raw);
    if (!parsed.length) return;
    setPantries((cur) =>
      updatePantry(cur, activePantryId, (p) => ({
        ...p,
        items: mergeItems(Array.isArray(p.items) ? p.items : [], parsed),
      })),
    );
  };

  const removeItem = (name) => {
    const n = normalizeFoodName(name);
    if (!n) return;
    setPantries((cur) =>
      updatePantry(cur, activePantryId, (p) => ({
        ...p,
        items: (Array.isArray(p.items) ? p.items : []).filter(
          (x) => normalizeFoodName(x?.name) !== n,
        ),
      })),
    );
  };

  const ensureStructuredItems = () => {
    if (pantryItems.length > 0) return true;
    if (effectiveItems.length === 0) return false;
    setPantries((cur) =>
      updatePantry(cur, activePantryId, (p) => ({
        ...p,
        items: effectiveItems.map((x) => ({
          name: normalizeFoodName(x?.name),
          qty: x?.qty ?? null,
          unit: x?.unit ?? null,
          notes: x?.notes ?? null,
        })),
      })),
    );
    return true;
  };

  const editItemAt = (idx) => {
    if (!ensureStructuredItems()) return;
    const cur = (Array.isArray(activePantry?.items) ? activePantry.items : [])[
      idx
    ];
    if (!cur) return;
    const curName = normalizeFoodName(cur.name) || "Продукт";
    setItemEdit({
      open: true,
      idx,
      name: curName,
      qty: cur.qty != null ? String(cur.qty) : "",
      unit: cur.unit != null ? String(cur.unit) : "",
      err: "",
    });
  };

  const removeItemAt = (idx) => {
    if (!ensureStructuredItems()) return;
    setPantries((curPantries) =>
      updatePantry(curPantries, activePantryId, (p) => {
        const items = Array.isArray(p.items) ? [...p.items] : [];
        items.splice(idx, 1);
        return { ...p, items };
      }),
    );
  };

  const applyTemplate = (id) => {
    const templates = {
      quickBreakfast: [
        "яйця",
        "йогурт",
        "банан",
        "вівсянка",
        "сир кисломолочний",
      ],
      quickLunch: ["курка", "рис", "огірок", "помідор", "оливкова олія"],
      quickFitness: ["тунець", "гречка", "яйця", "творог", "овочі"],
    };
    const list = templates[id] || [];
    setPantries((cur) =>
      updatePantry(cur, activePantryId, (p) => ({
        ...p,
        items: list.map((n) => ({
          name: n,
          qty: null,
          unit: null,
          notes: null,
        })),
        text: list.join(", "),
      })),
    );
  };

  const beginRenamePantry = () => {
    const curName = String(activePantry?.name || "").trim() || "Склад";
    setPantryForm({ mode: "rename", name: curName, err: "" });
    setPantryManagerOpen(true);
  };

  const beginCreatePantry = () => {
    setPantryForm({ mode: "create", name: "", err: "" });
    setPantryManagerOpen(true);
  };

  const beginDeletePantry = () => {
    setConfirmDeleteOpen(true);
  };

  const onSavePantryForm = (name, mode) => {
    if (mode === "rename") {
      setPantries((cur) =>
        updatePantry(cur, activePantryId, (p) => ({ ...p, name })),
      );
    } else {
      const id = `p_${Date.now()}`;
      setPantries((cur) => [
        ...(Array.isArray(cur) ? cur : []),
        { id, name, items: [], text: "" },
      ]);
      setActivePantryId(id);
    }
    setPantryManagerOpen(false);
  };

  const onConfirmDeletePantry = () => {
    const arr = Array.isArray(pantries) ? pantries : [];
    if (arr.length <= 1) return;
    const next = arr.filter((p) => p.id !== activePantryId);
    setPantries(next);
    setActivePantryId(next[0]?.id || "home");
    setConfirmDeleteOpen(false);
    setPantryManagerOpen(false);
  };

  const onSaveItemEdit = (idx, qty, unit) => {
    setPantries((curPantries) =>
      updatePantry(curPantries, activePantryId, (p) => {
        const items = Array.isArray(p.items) ? [...p.items] : [];
        const item = items[idx];
        if (!item) return p;
        items[idx] = { ...item, qty, unit };
        return { ...p, items };
      }),
    );
    setItemEdit((s) => ({ ...s, open: false }));
  };

  const setPantryText = (text) => {
    setPantries((cur) =>
      updatePantry(cur, activePantryId, (p) => ({ ...p, text })),
    );
  };

  const parsePantry = async () => {
    setBusy(true);
    setErr("");
    setStatusText("Розбираю список…");
    try {
      if (!pantryText.trim())
        throw new Error("Надиктуй/впиши список продуктів.");
      const data = await postJson("/api/nutrition/parse-pantry", {
        text: pantryText.trim(),
        locale: "uk-UA",
      });
      const next = Array.isArray(data?.items) ? data.items : [];
      setPantries((cur) =>
        updatePantry(cur, activePantryId, (p) => ({
          ...p,
          items: mergeItems(p.items, next),
        })),
      );
    } catch (e) {
      setErr(e?.message || "Помилка розбору списку");
    } finally {
      setStatusText("");
      setBusy(false);
    }
  };

  return {
    pantries,
    activePantryId,
    setActivePantryId,
    activePantry,
    pantryText,
    pantryItems,
    newItemName,
    setNewItemName,
    pantryManagerOpen,
    setPantryManagerOpen,
    pantryForm,
    setPantryForm,
    confirmDeleteOpen,
    setConfirmDeleteOpen,
    itemEdit,
    setItemEdit,
    upsertItem,
    removeItem,
    editItemAt,
    removeItemAt,
    applyTemplate,
    beginRenamePantry,
    beginCreatePantry,
    beginDeletePantry,
    onSavePantryForm,
    onConfirmDeletePantry,
    onSaveItemEdit,
    setPantryText,
    effectiveItems,
    pantrySummary,
    parsePantry,
    pantryStorageErr,
  };
}
