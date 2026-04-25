import { useState } from "react";
import { Button } from "@shared/components/ui/Button";
import { Card } from "@shared/components/ui/Card";
import { Icon } from "@shared/components/ui/Icon";
import { Input } from "@shared/components/ui/Input";
import { useToast } from "@shared/hooks/useToast";
import { changePassword } from "../authClient";

export function ChangePasswordSection({ online }: { online: boolean }) {
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
    try {
      const res = await changePassword({
        currentPassword: current,
        newPassword: next,
      });
      if (res.error) {
        toast.error(res.error.message ?? "Не вдалося змінити пароль");
        return;
      }
      toast.success("Пароль змінено");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch {
      toast.error("Не вдалося змінити пароль");
    } finally {
      setSaving(false);
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
