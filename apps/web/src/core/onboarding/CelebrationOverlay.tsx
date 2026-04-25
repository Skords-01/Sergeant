import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@shared/lib/cn";
import { Icon } from "@shared/components/ui/Icon";
import { Button } from "@shared/components/ui/Button";
import { trackEvent, ANALYTICS_EVENTS } from "../analytics";
import { getTimeToValueMs } from "./vibePicks";

/**
 * Confetti particle rendered by the celebration overlay.
 * Uses CSS keyframes for falling animation — no external lib needed.
 */
function ConfettiParticle({ delay, left }: { delay: number; left: number }) {
  const colors = [
    "bg-brand-500",
    "bg-yellow-400",
    "bg-emerald-400",
    "bg-rose-400",
    "bg-sky-400",
    "bg-purple-400",
  ];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const size = 4 + Math.random() * 6;
  const rotation = Math.random() * 360;

  return (
    <span
      className={cn(color, "absolute rounded-sm opacity-0")}
      style={{
        width: size,
        height: size * 0.6,
        left: `${left}%`,
        top: -10,
        transform: `rotate(${rotation}deg)`,
        animation: `confetti-fall 2.5s ${delay}s ease-out forwards`,
      }}
      aria-hidden
    />
  );
}

function buildCelebrrationCopy(ttvMs: number | null): {
  title: string;
  subtitle: string;
} {
  if (ttvMs != null && ttvMs < 60000) {
    const sec = Math.max(1, Math.round(ttvMs / 1000));
    return {
      title: `${sec} сек — і це вже твої дані!`,
      subtitle: "Перший запис є. Що далі?",
    };
  }
  return {
    title: "Це вже твої дані!",
    subtitle: "Перший запис є. Що далі?",
  };
}

/**
 * Enriched celebration shown after the user's first real entry.
 * Replaces the simple toast from Phase 1 with confetti + an
 * actionable card suggesting the next module to try.
 */
export function CelebrationOverlay({
  onDismiss,
  nextModuleLabel,
  onNextModule,
}: {
  onDismiss: () => void;
  nextModuleLabel?: string;
  onNextModule?: () => void;
}) {
  const [show, setShow] = useState(false);
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    requestAnimationFrame(() => setShow(true));
    trackEvent(ANALYTICS_EVENTS.CELEBRATION_SHOWN, { type: "first_entry" });
  }, []);

  const handleDismiss = useCallback(() => {
    setShow(false);
    setTimeout(onDismiss, 300);
  }, [onDismiss]);

  const ttvMs = getTimeToValueMs();
  const copy = buildCelebrrationCopy(ttvMs);

  const particles = useRef(
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      delay: Math.random() * 0.8,
      left: Math.random() * 100,
    })),
  );

  return (
    <>
      {/* Confetti keyframes injected once */}
      <style>{`
        @keyframes confetti-fall {
          0% { opacity: 1; transform: translateY(0) rotate(0deg); }
          100% { opacity: 0; transform: translateY(85vh) rotate(720deg); }
        }
      `}</style>

      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className={cn(
          "fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm transition-opacity duration-300",
          show ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={handleDismiss}
        onKeyDown={(e) => {
          if (e.key === "Escape") handleDismiss();
        }}
        role="dialog"
        aria-label="Вітаємо з першим записом"
      >
        {/* Confetti layer */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {particles.current.map((p) => (
            <ConfettiParticle key={p.id} delay={p.delay} left={p.left} />
          ))}
        </div>

        {/* Card */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div
          className={cn(
            "relative bg-panel rounded-3xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-4 text-center transition-transform duration-300",
            show ? "scale-100" : "scale-90",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-16 h-16 mx-auto rounded-2xl bg-brand-500/10 flex items-center justify-center">
            <Icon
              name="party-popper"
              size={32}
              className="text-brand-600 dark:text-brand-400"
            />
          </div>
          <h2 className="text-xl font-bold text-text">{copy.title}</h2>
          <p className="text-sm text-muted">{copy.subtitle}</p>

          <div className="space-y-2 pt-2">
            {nextModuleLabel && onNextModule && (
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={() => {
                  onNextModule();
                  handleDismiss();
                }}
              >
                Спробувати {nextModuleLabel}
                <Icon name="chevron-right" size={16} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted"
              onClick={handleDismiss}
            >
              На дашборд
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
