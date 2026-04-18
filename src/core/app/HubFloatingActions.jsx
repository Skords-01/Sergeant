export function HubFloatingActions({ onOpenChat }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 flex justify-center pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
      <button
        type="button"
        onClick={onOpenChat}
        className="flex items-center gap-2.5 px-5 h-12 rounded-full bg-primary text-bg shadow-float hover:brightness-110 active:scale-95 transition-all font-medium text-sm"
        aria-label="Відкрити асистента (фінанси та тренування)"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Асистент
      </button>
    </div>
  );
}
