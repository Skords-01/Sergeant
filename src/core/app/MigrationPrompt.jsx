export function MigrationPrompt({ onUpload, onSkip, syncing }) {
  return (
    <div className="min-h-dvh bg-bg flex items-center justify-center p-6 page-enter">
      <div className="max-w-sm w-full bg-panel border border-line rounded-3xl p-6 shadow-float space-y-5">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto bg-accent/10 rounded-2xl flex items-center justify-center">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-accent"
              aria-hidden
            >
              <polyline points="16 16 12 12 8 16" />
              <line x1="12" y1="12" x2="12" y2="21" />
              <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-text">
            Локальні дані знайдено
          </h2>
          <p className="text-sm text-muted leading-relaxed">
            У вас є дані на цьому пристрої, які ще не збережено в хмарі. Бажаєте
            завантажити їх у свій акаунт?
          </p>
        </div>
        <div className="space-y-2">
          <button
            type="button"
            onClick={onUpload}
            disabled={syncing}
            className="w-full py-3 rounded-2xl bg-accent text-white font-semibold text-sm hover:brightness-110 transition disabled:opacity-50"
          >
            {syncing ? "Завантаження..." : "Завантажити в хмару"}
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="w-full py-3 rounded-2xl border border-line text-muted text-sm hover:text-text hover:bg-panelHi transition"
          >
            Пропустити
          </button>
        </div>
      </div>
    </div>
  );
}
