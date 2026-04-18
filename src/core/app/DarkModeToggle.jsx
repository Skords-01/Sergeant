import { Icon } from "@shared/components/ui/Icon";

/** Sun/Moon icon toggle for dark mode */
export function DarkModeToggle({ dark, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={dark ? "Увімкнути світлу тему" : "Увімкнути темну тему"}
      title={dark ? "Світла тема" : "Темна тема"}
      className="w-10 h-10 flex items-center justify-center rounded-2xl text-muted hover:text-text hover:bg-panelHi transition-colors"
    >
      <Icon name={dark ? "sun" : "moon"} size={20} />
    </button>
  );
}
