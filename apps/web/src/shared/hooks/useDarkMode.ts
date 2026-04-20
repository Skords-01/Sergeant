import { useCallback, useEffect, useState } from "react";

const DARK_KEY = "hub_dark_mode_v1";

function applyTheme(dark: boolean): void {
  if (dark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

function readInitial(): boolean {
  try {
    const stored = localStorage.getItem(DARK_KEY);
    if (stored !== null) return stored === "1";
  } catch {
    /* ignore */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function useDarkMode(): { dark: boolean; toggle: () => void } {
  const [dark, setDark] = useState<boolean>(() => {
    const d = readInitial();
    applyTheme(d);
    return d;
  });

  useEffect(() => {
    applyTheme(dark);
    try {
      localStorage.setItem(DARK_KEY, dark ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [dark]);

  const toggle = useCallback(() => setDark((d) => !d), []);

  return { dark, toggle };
}
