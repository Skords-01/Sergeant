import { useCallback, useEffect, useState } from "react";
import { cn } from "@shared/lib/cn";
import { Icon } from "@shared/components/ui/Icon";
import { Button } from "@shared/components/ui/Button";
import { trackEvent, ANALYTICS_EVENTS } from "../analytics";

// ---------------------------------------------------------------------------
// Permission types & config
// ---------------------------------------------------------------------------

export type PermissionType = "push" | "camera" | "microphone";

interface PermissionConfig {
  icon: string;
  title: string;
  description: string;
  storageKey: string;
}

const PERMISSION_CONFIG: Record<PermissionType, PermissionConfig> = {
  push: {
    icon: "bell",
    title: "Нагадування",
    description: "Хочеш нагадування про звички та цілі?",
    storageKey: "permission_push_asked_v1",
  },
  camera: {
    icon: "camera",
    title: "Камера",
    description: "Для AI-аналізу їжі по фото.",
    storageKey: "permission_camera_asked_v1",
  },
  microphone: {
    icon: "mic",
    title: "Мікрофон",
    description: "Для голосового вводу витрат.",
    storageKey: "permission_microphone_asked_v1",
  },
};

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function wasAsked(type: PermissionType): boolean {
  try {
    return localStorage.getItem(PERMISSION_CONFIG[type].storageKey) === "1";
  } catch {
    return false;
  }
}

function markAsked(type: PermissionType): void {
  try {
    localStorage.setItem(PERMISSION_CONFIG[type].storageKey, "1");
  } catch {
    /* noop */
  }
}

// ---------------------------------------------------------------------------
// Hook: permission gate
// ---------------------------------------------------------------------------

/**
 * Returns the next permission to request (one at a time), or null
 * if all relevant permissions have been asked.
 */
export function useNextPermission(
  activeModules: string[],
): PermissionType | null {
  const [next, setNext] = useState<PermissionType | null>(null);

  useEffect(() => {
    const queue: PermissionType[] = [];
    if (activeModules.includes("routine") && !wasAsked("push")) {
      queue.push("push");
    }
    if (activeModules.includes("nutrition") && !wasAsked("camera")) {
      queue.push("camera");
    }
    if (!wasAsked("microphone")) {
      queue.push("microphone");
    }
    setNext(queue[0] ?? null);
  }, [activeModules]);

  return next;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PermissionsPrompt({
  type,
  onGranted,
  onDismiss,
}: {
  type: PermissionType;
  onGranted?: () => void;
  onDismiss?: () => void;
}) {
  const config = PERMISSION_CONFIG[type];

  const requestPermission = useCallback(async () => {
    trackEvent(ANALYTICS_EVENTS.PERMISSION_REQUESTED, { type });
    markAsked(type);

    try {
      if (type === "push" && "Notification" in window) {
        const result = await Notification.requestPermission();
        if (result === "granted") {
          trackEvent(ANALYTICS_EVENTS.PERMISSION_GRANTED, { type });
          onGranted?.();
        } else {
          trackEvent(ANALYTICS_EVENTS.PERMISSION_DENIED, { type });
        }
      } else if (
        (type === "camera" || type === "microphone") &&
        navigator.mediaDevices
      ) {
        const constraints =
          type === "camera" ? { video: true } : { audio: true };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        stream.getTracks().forEach((t) => t.stop());
        trackEvent(ANALYTICS_EVENTS.PERMISSION_GRANTED, { type });
        onGranted?.();
      }
    } catch {
      trackEvent(ANALYTICS_EVENTS.PERMISSION_DENIED, { type });
    }

    onDismiss?.();
  }, [type, onGranted, onDismiss]);

  const handleLater = useCallback(() => {
    markAsked(type);
    trackEvent(ANALYTICS_EVENTS.PERMISSION_DENIED, { type, deferred: true });
    onDismiss?.();
  }, [type, onDismiss]);

  return (
    <section
      className={cn(
        "bg-panel border border-line rounded-2xl p-4 shadow-card",
        "flex items-start gap-3",
      )}
      aria-label={config.title}
    >
      <div className="shrink-0 w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
        <Icon name={config.icon} size={20} />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <h3 className="text-sm font-bold text-text">{config.title}</h3>
          <p className="text-xs text-muted mt-0.5">{config.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" size="xs" onClick={requestPermission}>
            Дозволити
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={handleLater}
            className="text-muted"
          >
            Пізніше
          </Button>
        </div>
      </div>
    </section>
  );
}
