import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@shared/lib/cn";
import { Button } from "@shared/components/ui/Button";
import { Card } from "@shared/components/ui/Card";
import { Icon } from "@shared/components/ui/Icon";
import { Input } from "@shared/components/ui/Input";
import { useToast } from "@shared/hooks/useToast";
import { useOnlineStatus } from "@shared/hooks/useOnlineStatus";
import { useAuth } from "./AuthContext.jsx";
import {
  updateUser,
  changePassword,
  listSessions,
  revokeSession,
  deleteUser,
  signOut,
  type SessionItem,
} from "./authClient.js";

// ────────────────────── Avatar helpers ──────────────────────

const MAX_AVATAR_SIZE = 128;
const AVATAR_QUALITY = 0.8;

function compressAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      const scale = Math.min(
        MAX_AVATAR_SIZE / img.width,
        MAX_AVATAR_SIZE / img.height,
        1,
      );
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/webp", AVATAR_QUALITY));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не вдалося прочитати зображення"));
    };
    img.src = url;
  });
}

// ────────────────────── Personal info ──────────────────────

function PersonalInfoSection({
  user,
  online,
  onRefresh,
}: {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    emailVerified: boolean;
  };
  online: boolean;
  onRefresh: () => Promise<void>;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user.name ?? "");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const dirty = name.trim() !== (user.name ?? "");

  useEffect(() => {
    setName(user.name ?? "");
  }, [user.name]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    const res = await updateUser({ name: trimmed });
    setSaving(false);
    if (res.error) {
      toast.error(res.error.message ?? "Не вдалося оновити ім'я");
    } else {
      toast.success("Ім'я оновлено");
      await onRefresh();
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileRef.current) fileRef.current.value = "";
    setUploadingAvatar(true);
    try {
      const dataUrl = await compressAvatar(file);
      const res = await updateUser({ image: dataUrl });
      if (res.error) {
        toast.error(res.error.message ?? "Не вдалося оновити аватар");
      } else {
        toast.success("Аватар оновлено");
        await onRefresh();
      }
    } catch {
      toast.error("Не вдалося обробити зображення");
    }
    setUploadingAvatar(false);
  };

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true);
    const res = await updateUser({ image: null });
    setUploadingAvatar(false);
    if (res.error) {
      toast.error(res.error.message ?? "Не вдалося видалити аватар");
    } else {
      toast.success("Аватар видалено");
      await onRefresh();
    }
  };

  const initial = (user.name || user.email || "?")[0].toUpperCase();

  return (
    <Card radius="lg" padding="none" className="overflow-hidden">
      <div className="px-4 py-3.5 flex items-center gap-2 border-b border-line">
        <Icon name="user" size={18} className="text-muted" />
        <span className="text-sm font-semibold text-text">
          Персональні дані
        </span>
      </div>

      <div className="p-4 space-y-5">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="relative group shrink-0"
            disabled={!online || uploadingAvatar}
            onClick={() => fileRef.current?.click()}
            aria-label="Змінити аватар"
          >
            {user.image ? (
              <img
                src={user.image}
                alt=""
                className="w-16 h-16 rounded-2xl object-cover"
              />
            ) : (
              <div
                className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold",
                  "bg-brand-500/15 text-brand-600 dark:text-brand-400",
                )}
              >
                {initial}
              </div>
            )}
            <div
              className={cn(
                "absolute inset-0 rounded-2xl flex items-center justify-center",
                "bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity",
                uploadingAvatar && "opacity-100",
              )}
            >
              {uploadingAvatar ? (
                <span className="inline-block animate-spin">
                  <Icon name="refresh-cw" size={18} className="text-white" />
                </span>
              ) : (
                <Icon name="upload" size={18} className="text-white" />
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-text truncate">
              {user.name || "Без імені"}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-sm text-muted truncate">{user.email}</p>
              {user.emailVerified && (
                <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400 text-2xs font-medium">
                  <Icon name="check" size={10} strokeWidth={3} />
                  Підтверджено
                </span>
              )}
            </div>
            {user.image && (
              <button
                type="button"
                className="text-xs text-muted hover:text-danger transition-colors mt-1"
                disabled={!online || uploadingAvatar}
                onClick={handleRemoveAvatar}
              >
                Видалити фото
              </button>
            )}
          </div>
        </div>

        {/* Edit name */}
        <div className="space-y-2">
          <label
            htmlFor="profile-name"
            className="block text-xs font-medium text-muted"
          >
            Ім{"'"}я
          </label>
          <div className="flex gap-2">
            <Input
              id="profile-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ваше ім'я"
              autoComplete="name"
              className="flex-1"
            />
            <Button
              variant="primary"
              size="sm"
              disabled={!dirty || saving || !online}
              loading={saving}
              onClick={handleSave}
            >
              Зберегти
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ────────────────────── Change password ──────────────────────

function ChangePasswordSection({ online }: { online: boolean }) {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const valid =
    online && current.length > 0 && next.length >= 10 && next === confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    const res = await changePassword({
      currentPassword: current,
      newPassword: next,
    });
    setSaving(false);
    if (res.error) {
      toast.error(res.error.message ?? "Не вдалося змінити пароль");
    } else {
      toast.success("Пароль змінено");
      setCurrent("");
      setNext("");
      setConfirm("");
    }
  };

  return (
    <Card radius="lg" padding="none" className="overflow-hidden">
      <div className="px-4 py-3.5 flex items-center gap-2 border-b border-line">
        <Icon name="settings" size={18} className="text-muted" />
        <span className="text-sm font-semibold text-text">Безпека</span>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {/* eslint-disable-next-line sergeant-design/no-eyebrow-drift --
            Standalone label for a form section inside Card, not a collapsible
            SettingsSubGroup — SectionHeading cannot express this layout. */}
        <p className="text-xs font-bold text-muted uppercase tracking-widest">
          Зміна паролю
        </p>
        <div className="space-y-2">
          <label
            htmlFor="profile-current-pw"
            className="block text-xs font-medium text-muted"
          >
            Поточний пароль
          </label>
          <Input
            id="profile-current-pw"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor="profile-new-pw"
            className="block text-xs font-medium text-muted"
          >
            Новий пароль (мінімум 10 символів)
          </label>
          <Input
            id="profile-new-pw"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            minLength={10}
            autoComplete="new-password"
            error={next.length > 0 && next.length < 10}
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor="profile-confirm-pw"
            className="block text-xs font-medium text-muted"
          >
            Підтвердити новий пароль
          </label>
          <Input
            id="profile-confirm-pw"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            error={confirm.length > 0 && confirm !== next}
          />
          {confirm.length > 0 && confirm !== next && (
            <p className="text-xs text-danger">Паролі не збігаються</p>
          )}
        </div>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          className="w-full"
          disabled={!valid || saving}
          loading={saving}
        >
          Змінити пароль
        </Button>
      </form>
    </Card>
  );
}

// ────────────────────── Sessions ──────────────────────

function formatDate(value: string | Date): string {
  try {
    const d = typeof value === "string" ? new Date(value) : value;
    return d.toLocaleString("uk-UA", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
}

function parseUA(ua: string | null | undefined): string {
  if (!ua) return "Невідомий пристрій";
  const browser =
    ua.match(/(?:Chrome|Firefox|Safari|Edge|Opera|OPR)[/ ]([\d.]+)/)?.[0] ?? "";
  const os =
    ua.match(
      /(?:Windows NT [\d.]+|Mac OS X [\d._]+|Linux|Android [\d.]+|iOS [\d._]+)/,
    )?.[0] ?? "";
  const parts = [browser, os].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "Невідомий пристрій";
}

function SessionsSection({ online }: { online: boolean }) {
  const toast = useToast();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!online) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await listSessions();
    setLoading(false);
    if (res.data) {
      setSessions(res.data);
    }
  }, [online]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRevoke = async (id: string) => {
    setRevoking(id);
    const res = await revokeSession({ id });
    setRevoking(null);
    if (res.error) {
      toast.error(res.error.message ?? "Не вдалося завершити сесію");
    } else {
      toast.success("Сесію завершено");
      setSessions((prev) => prev.filter((s) => s.id !== id));
    }
  };

  return (
    <Card radius="lg" padding="none" className="overflow-hidden">
      <div className="px-4 py-3.5 flex items-center justify-between border-b border-line">
        <div className="flex items-center gap-2">
          <Icon name="refresh-cw" size={18} className="text-muted" />
          <span className="text-sm font-semibold text-text">Активні сесії</span>
        </div>
        <Button
          variant="ghost"
          size="xs"
          onClick={load}
          disabled={loading || !online}
        >
          Оновити
        </Button>
      </div>

      <div className="p-4">
        {loading && sessions.length === 0 ? (
          <p className="text-sm text-muted text-center py-4">Завантаження…</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted text-center py-4">Немає сесій</p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => {
              const isExpired = new Date(s.expiresAt) < new Date();
              return (
                <li
                  key={s.id}
                  className="flex items-start gap-3 p-3 rounded-xl border border-line bg-panel"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text truncate">
                      {parseUA(s.userAgent)}
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      {s.ipAddress ?? "IP невідомий"}
                      {" \u00b7 "}
                      {formatDate(s.createdAt)}
                    </p>
                    {isExpired && (
                      <span className="text-2xs text-danger font-medium">
                        Закінчилась
                      </span>
                    )}
                  </div>
                  <Button
                    variant="danger"
                    size="xs"
                    disabled={revoking === s.id}
                    loading={revoking === s.id}
                    onClick={() => handleRevoke(s.id)}
                  >
                    Завершити
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}

// ────────────────────── Danger zone ──────────────────────

function DangerZoneSection({
  online,
  onLogout,
}: {
  online: boolean;
  onLogout: () => Promise<void>;
}) {
  const toast = useToast();
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    const res = await deleteUser({ password: password || undefined });
    setDeleting(false);
    if (res.error) {
      toast.error(res.error.message ?? "Не вдалося видалити акаунт");
    } else {
      toast.success("Акаунт видалено");
      setShowConfirm(false);
      try {
        await signOut();
      } catch {
        /* ignore */
      }
      await onLogout();
      navigate("/", { replace: true });
    }
  };

  return (
    <>
      <Card
        radius="lg"
        padding="none"
        className="overflow-hidden border-danger/30"
      >
        <div className="px-4 py-3.5 flex items-center gap-2 border-b border-danger/20">
          <Icon name="alert" size={18} className="text-danger" />
          <span className="text-sm font-semibold text-danger">
            Небезпечна зона
          </span>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-sm text-muted">
            Видалення акаунту є незворотною дією. Усі ваші дані буде повністю
            видалено з серверу.
          </p>
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            disabled={!online}
            onClick={() => setShowConfirm(true)}
          >
            Видалити акаунт
          </Button>
        </div>
      </Card>

      {showConfirm && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowConfirm(false)}
            aria-label="Закрити"
          />
          <div className="relative w-full max-w-sm bg-panel border border-line rounded-2xl shadow-soft p-5 z-10">
            <h2 className="text-base font-bold text-text">
              Видалити акаунт назавжди?
            </h2>
            <p className="text-sm text-muted mt-2">
              Введіть пароль для підтвердження. Цю дію неможливо скасувати.
            </p>
            <div className="mt-4">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ваш пароль"
                autoComplete="current-password"
              />
            </div>
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                className="flex-1 py-3 rounded-xl border border-line text-sm font-semibold text-muted hover:bg-panelHi transition-colors"
                onClick={() => {
                  setShowConfirm(false);
                  setPassword("");
                }}
              >
                Скасувати
              </button>
              <button
                type="button"
                disabled={deleting || !password}
                className={cn(
                  "flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-colors",
                  "bg-danger hover:bg-danger/90 disabled:opacity-50",
                )}
                onClick={handleDelete}
              >
                {deleting ? "Видалення…" : "Видалити"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ────────────────────── Memory bank ──────────────────────

interface MemoryEntry {
  id: string;
  fact: string;
  category: string;
  createdAt: string;
}

const PROFILE_KEY = "hub_user_profile_v1";

const CATEGORY_META: Record<string, { label: string; emoji: string }> = {
  allergy: { label: "Алергії", emoji: "🚫" },
  diet: { label: "Дієта", emoji: "🍎" },
  goal: { label: "Цілі", emoji: "🎯" },
  training: { label: "Тренування", emoji: "🏋️" },
  health: { label: "Здоров'я", emoji: "💊" },
  preference: { label: "Уподобання", emoji: "⭐" },
  other: { label: "Інше", emoji: "📝" },
};

const MEMORY_ONBOARDING_PROMPT =
  "Привіт! Давай заповнимо мій профіль. Задай мені по черзі кілька запитань: 1) Чи є в мене алергії або обмеження в їжі? 2) Яка моя дієта чи стиль харчування? 3) Яка моя основна ціль (схуднути, набрати масу, підтримка)? 4) Скільки разів на тиждень я тренуюсь і де? 5) Чи є щось ще важливе про моє здоров'я? Запам'ятай кожну відповідь через remember.";

function MemoryBankSection() {
  const [entries, setEntries] = useState<MemoryEntry[]>(() => {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      return raw ? (JSON.parse(raw) as MemoryEntry[]) : [];
    } catch {
      return [];
    }
  });

  const handleDelete = useCallback(
    (id: string) => {
      const next = entries.filter((e) => e.id !== id);
      setEntries(next);
      try {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
      } catch {}
    },
    [entries],
  );

  const openMemoryChat = useCallback(() => {
    const prompt =
      entries.length === 0
        ? MEMORY_ONBOARDING_PROMPT
        : "Хочу додати інформацію про себе. Запитай мене що важливого я хочу щоб ти запам'ятав.";
    window.dispatchEvent(new CustomEvent("hub:openChat", { detail: prompt }));
  }, [entries.length]);

  const grouped = useMemo(() => {
    const map: Record<string, MemoryEntry[]> = {};
    for (const e of entries) {
      const cat = e.category || "other";
      if (!map[cat]) map[cat] = [];
      map[cat].push(e);
    }
    return map;
  }, [entries]);

  const isEmpty = entries.length === 0;

  return (
    <Card radius="lg" padding="none" className="overflow-hidden">
      <div className="px-4 py-3.5 flex items-center gap-2 border-b border-line">
        <Icon name="sparkle" size={18} className="text-muted" />
        <span className="text-sm font-semibold text-text">Пам&apos;ять ШІ</span>
        <span className="ml-auto text-xs text-muted">
          {entries.length}{" "}
          {entries.length === 1
            ? "запис"
            : entries.length < 5
              ? "записи"
              : "записів"}
        </span>
      </div>

      <div className="p-4">
        {isEmpty ? (
          <div className="text-center py-6">
            <div className="text-3xl mb-3">🧠</div>
            <p className="text-sm text-muted mb-1">
              Банк пам&apos;яті порожній
            </p>
            <p className="text-xs text-muted/70 mb-4">
              ШІ задасть кілька запитань щоб дізнатися про ваші алергії, цілі,
              уподобання та рівень активності
            </p>
            <Button variant="primary" size="sm" onClick={openMemoryChat}>
              <Icon name="sparkle" size={14} className="mr-1.5" />
              Заповнити профіль
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(grouped).map(([cat, items]) => {
              const meta = CATEGORY_META[cat] || { label: cat, emoji: "📝" };
              return (
                <div key={cat}>
                  <div className="text-xs font-semibold text-muted mb-1.5">
                    {meta.emoji} {meta.label}
                  </div>
                  <div className="space-y-1">
                    {items.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center gap-2 group"
                      >
                        <span className="text-sm text-text flex-1 min-w-0 truncate">
                          {entry.fact}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDelete(entry.id)}
                          className="opacity-0 group-hover:opacity-100 shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-muted hover:text-danger hover:bg-danger/10 transition-all"
                          aria-label={`Видалити: ${entry.fact}`}
                        >
                          <Icon name="x" size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={openMemoryChat}
              className="w-full mt-2 py-2.5 rounded-xl border border-dashed border-line text-sm text-muted hover:text-text hover:border-muted transition-colors flex items-center justify-center gap-1.5"
            >
              <Icon name="plus" size={14} />
              Додати інфо
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

// ────────────────────── Profile page shell ──────────────────────

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout, refresh } = useAuth();
  const online = useOnlineStatus();

  if (!user) {
    return null;
  }

  return (
    <div
      className="min-h-dvh bg-bg"
      style={{
        paddingTop: "max(1.25rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="max-w-lg mx-auto px-5 pb-8 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 pt-6 pb-2">
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={() => navigate(-1)}
            aria-label="Назад"
          >
            <Icon name="chevron-left" size={20} />
          </Button>
          <h1 className="text-xl font-bold text-text">Профіль</h1>
        </div>

        {!online && (
          <div className="flex items-center gap-2 rounded-xl bg-warning/10 border border-warning/30 px-4 py-3">
            <Icon name="wifi-off" size={16} className="text-warning shrink-0" />
            <p className="text-sm text-warning font-medium">
              Ви офлайн — редагування профілю тимчасово недоступне
            </p>
          </div>
        )}

        <PersonalInfoSection user={user} online={online} onRefresh={refresh} />
        <MemoryBankSection />
        <ChangePasswordSection online={online} />
        <SessionsSection online={online} />
        <DangerZoneSection online={online} onLogout={logout} />
      </div>
    </div>
  );
}
