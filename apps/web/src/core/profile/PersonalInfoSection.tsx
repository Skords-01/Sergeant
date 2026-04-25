import { useEffect, useRef, useState } from "react";
import { Button } from "@shared/components/ui/Button";
import { Card } from "@shared/components/ui/Card";
import { Icon } from "@shared/components/ui/Icon";
import { Input } from "@shared/components/ui/Input";
import { useToast } from "@shared/hooks/useToast";
import { cn } from "@shared/lib/cn";
import { changeEmail, sendVerificationEmail, updateUser } from "../authClient";
import { assertAvatarFile, compressAvatar } from "./avatar";
import type { ProfileUser } from "./types";

interface PersonalInfoSectionProps {
  user: ProfileUser;
  online: boolean;
  onRefresh: () => Promise<void>;
}

export function PersonalInfoSection({
  user,
  online,
  onRefresh,
}: PersonalInfoSectionProps) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user.name ?? "");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [confirmRemoveAvatar, setConfirmRemoveAvatar] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const dirty = name.trim() !== (user.name ?? "");

  useEffect(() => {
    setName(user.name ?? "");
  }, [user.name]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const res = await updateUser({ name: trimmed });
      if (res.error) {
        toast.error(res.error.message ?? "Не вдалося оновити ім'я");
        return;
      }
      toast.success("Ім'я оновлено");
      await onRefresh();
    } catch {
      toast.error("Не вдалося оновити ім'я");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileRef.current) fileRef.current.value = "";
    setUploadingAvatar(true);
    try {
      assertAvatarFile(file);
      const dataUrl = await compressAvatar(file);
      const res = await updateUser({ image: dataUrl });
      if (res.error) {
        toast.error(res.error.message ?? "Не вдалося оновити аватар");
        return;
      }
      toast.success("Аватар оновлено");
      await onRefresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Не вдалося обробити зображення",
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setConfirmRemoveAvatar(false);
    setUploadingAvatar(true);
    try {
      const res = await updateUser({ image: null });
      if (res.error) {
        toast.error(res.error.message ?? "Не вдалося видалити аватар");
        return;
      }
      toast.success("Аватар видалено");
      await onRefresh();
    } catch {
      toast.error("Не вдалося видалити аватар");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSendVerification = async () => {
    if (!user.email) return;
    setSendingVerification(true);
    try {
      const res = await sendVerificationEmail({ email: user.email });
      if (res.error) {
        toast.error(
          res.error.message ?? "Не вдалося надіслати лист підтвердження",
        );
        return;
      }
      toast.success("Лист підтвердження надіслано");
    } catch {
      toast.error("Не вдалося надіслати лист підтвердження");
    } finally {
      setSendingVerification(false);
    }
  };

  const handleChangeEmail = async () => {
    const trimmed = newEmail.trim();
    if (!trimmed) return;
    setSavingEmail(true);
    try {
      const res = await changeEmail({ newEmail: trimmed });
      if (res.error) {
        toast.error(res.error.message ?? "Не вдалося змінити email");
        return;
      }
      toast.success("Лист підтвердження нового email надіслано");
      setEditingEmail(false);
      setNewEmail("");
      await onRefresh();
    } catch {
      toast.error("Не вдалося змінити email");
    } finally {
      setSavingEmail(false);
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
            {user.image && !confirmRemoveAvatar && (
              <button
                type="button"
                className="text-xs text-muted hover:text-danger transition-colors mt-1"
                disabled={!online || uploadingAvatar}
                onClick={() => setConfirmRemoveAvatar(true)}
              >
                Видалити фото
              </button>
            )}
            {user.image && confirmRemoveAvatar && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-danger font-medium">
                  Видалити?
                </span>
                <button
                  type="button"
                  className="text-xs font-semibold text-danger hover:text-danger/80 transition-colors"
                  onClick={handleRemoveAvatar}
                >
                  Так
                </button>
                <button
                  type="button"
                  className="text-xs text-muted hover:text-text transition-colors"
                  onClick={() => setConfirmRemoveAvatar(false)}
                >
                  Ні
                </button>
              </div>
            )}
          </div>
        </div>

        {!user.emailVerified && user.email && (
          <div className="flex items-center gap-2 rounded-xl bg-warning/10 border border-warning/30 px-3 py-2.5">
            <Icon name="alert" size={14} className="text-warning shrink-0" />
            <p className="text-xs text-warning font-medium flex-1">
              Email не підтверджено
            </p>
            <Button
              variant="ghost"
              size="xs"
              disabled={!online || sendingVerification}
              loading={sendingVerification}
              onClick={handleSendVerification}
            >
              Надіслати лист
            </Button>
          </div>
        )}

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

        <div className="space-y-2">
          <label
            htmlFor="profile-email"
            className="block text-xs font-medium text-muted"
          >
            Email
          </label>
          {!editingEmail ? (
            <div className="flex items-center gap-2">
              <p className="text-sm text-text flex-1 truncate">{user.email}</p>
              <Button
                variant="ghost"
                size="xs"
                disabled={!online}
                onClick={() => {
                  setEditingEmail(true);
                  setNewEmail(user.email ?? "");
                }}
              >
                Змінити
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                id="profile-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Новий email"
                autoComplete="email"
                className="flex-1"
              />
              <Button
                variant="primary"
                size="sm"
                disabled={
                  !newEmail.trim() ||
                  newEmail.trim() === user.email ||
                  savingEmail ||
                  !online
                }
                loading={savingEmail}
                onClick={handleChangeEmail}
              >
                Зберегти
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingEmail(false);
                  setNewEmail("");
                }}
              >
                Скасувати
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
