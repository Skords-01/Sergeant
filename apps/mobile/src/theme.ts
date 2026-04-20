// Базова палітра для темної теми (основний режим web-апки).
// Коли підійдемо до повноцінного дизайну — розширимо.
export const colors = {
  bg: "#0b0d10",
  surface: "#13161b",
  border: "#1f242c",
  text: "#f2f4f7",
  textMuted: "#8a94a6",
  accent: "#7c5cff",
  danger: "#ef4444",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
} as const;
