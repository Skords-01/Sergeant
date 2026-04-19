/**
 * Мініатюри страв у IndexedDB (окремо від localStorage).
 * Ключ — id запису їжі.
 */

const DB_NAME = "hub_nutrition_meal_photos";
const STORE = "thumbs";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
  });
}

export async function saveMealThumbnail(
  mealId: string | null | undefined,
  blob: Blob | null | undefined,
): Promise<boolean> {
  if (!mealId || !blob) return false;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(blob, mealId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return true;
  } catch {
    return false;
  }
}

export async function getMealThumbnailBlob(
  mealId: string | null | undefined,
): Promise<Blob | null> {
  if (!mealId) return null;
  try {
    const db = await openDb();
    const blob = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(mealId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return blob instanceof Blob ? blob : null;
  } catch {
    return null;
  }
}

export async function deleteMealThumbnail(
  mealId: string | null | undefined,
): Promise<void> {
  if (!mealId) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(mealId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* ignore */
  }
}

export async function listMealThumbnailIds(): Promise<string[]> {
  try {
    const db = await openDb();
    const ids = await new Promise<string[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAllKeys();
      req.onsuccess = () =>
        resolve(Array.isArray(req.result) ? req.result.map(String) : []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

export interface GcMealThumbnailsOptions {
  maxDeletes?: number;
}

export async function gcMealThumbnails(
  validMealIds: Iterable<string> | Set<string> | null | undefined,
  { maxDeletes = 500 }: GcMealThumbnailsOptions = {},
): Promise<{ ok: boolean; deleted: number }> {
  const keep =
    validMealIds instanceof Set
      ? (validMealIds as Set<string>)
      : new Set<string>(
          Array.isArray(validMealIds) ? (validMealIds as string[]) : [],
        );
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const keys = await new Promise<string[]>((resolve, reject) => {
      const r = store.getAllKeys();
      r.onsuccess = () =>
        resolve(Array.isArray(r.result) ? r.result.map(String) : []);
      r.onerror = () => reject(r.error);
    });
    let deleted = 0;
    for (const k of keys) {
      if (deleted >= maxDeletes) break;
      if (!keep.has(String(k))) {
        store.delete(k);
        deleted += 1;
      }
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return { ok: true, deleted };
  } catch {
    return { ok: false, deleted: 0 };
  }
}

export function fileToThumbnailBlob(
  file: Blob,
  maxSize = 128,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        URL.revokeObjectURL(url);
        const canvas = document.createElement("canvas");
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const scale = maxSize / Math.max(w, h, 1);
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.72);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
      resolve(null);
    };
    img.src = url;
  });
}
