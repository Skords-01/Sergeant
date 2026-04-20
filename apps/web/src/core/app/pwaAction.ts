export const PWA_ACTION_KEY = "pwa_pending_action";

export function consumePwaAction() {
  try {
    const a = localStorage.getItem(PWA_ACTION_KEY);
    if (a) localStorage.removeItem(PWA_ACTION_KEY);
    return a || null;
  } catch {
    return null;
  }
}
