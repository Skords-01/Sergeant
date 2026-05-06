interface FinykAuthErrorBannerProps {
  authError: string;
  onBackToHub?: () => void;
  onDismiss: () => void;
}

/**
 * Невеликий warning-банер про протермінований Mono-токен.
 * Винесено з FinykApp.tsx (initiative 0013 carry-over Top-7 #6).
 */
export function FinykAuthErrorBanner({
  authError,
  onBackToHub,
  onDismiss,
}: FinykAuthErrorBannerProps) {
  return (
    <div className="fixed top-[calc(56px+env(safe-area-inset-top,0)+8px)] left-4 right-4 z-50 max-w-lg mx-auto">
      <div className="bg-warning/15 border border-warning/40 rounded-2xl px-4 py-3 flex items-start gap-3 shadow-card">
        <span className="text-lg shrink-0 mt-0.5">⚠️</span>
        <div className="flex-1 min-w-0">
          <p className="text-style-label text-text">Токен потребує оновлення</p>
          <p className="text-xs text-muted mt-0.5">{authError}</p>
          {onBackToHub && (
            <button
              onClick={onBackToHub}
              className="text-xs font-semibold text-primary mt-2 hover:underline"
            >
              Оновити токен у Налаштуваннях Hub
            </button>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="text-muted hover:text-text transition-colors shrink-0"
          aria-label="Закрити"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
