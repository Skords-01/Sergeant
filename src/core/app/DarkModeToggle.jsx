import { Icon } from "@shared/components/ui/Icon";

const CLS =
  "w-11 h-11 flex items-center justify-center rounded-2xl text-muted hover:text-text hover:bg-panelHi transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

/** Sun/Moon icon toggle for dark mode */
export function DarkModeToggle({ dark, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={dark ? "Увімкнути світлу тему" : "Увімкнути темну тему"}
      title={dark ? "Світла тема" : "Темна тема"}
      className={CLS}
    >
      <Icon name={dark ? "sun" : "moon"} size={20} />
    </button>
  );
}
