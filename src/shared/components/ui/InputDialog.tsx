import {
  useRef,
  useState,
  useEffect,
  useId,
  type FormEvent,
  type HTMLInputTypeAttribute,
  type ReactNode,
} from "react";
import { useDialogFocusTrap } from "@shared/hooks/useDialogFocusTrap";
import { cn } from "@shared/lib/cn";
import { Button } from "./Button";

export interface InputDialogProps {
  open: boolean;
  title?: string;
  description?: ReactNode;
  placeholder?: string;
  defaultValue?: string;
  type?: HTMLInputTypeAttribute;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: (value: string) => void;
  onCancel?: () => void;
}

export function InputDialog({
  open,
  title = "Введіть значення",
  description,
  placeholder = "",
  defaultValue = "",
  type = "text",
  confirmLabel = "ОК",
  cancelLabel = "Скасувати",
  onConfirm,
  onCancel,
}: InputDialogProps) {
  const ref = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);
  const titleId = useId();

  useDialogFocusTrap(open, ref, { onEscape: onCancel });

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      const timer = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(timer);
    }
  }, [open, defaultValue]);

  if (!open) return null;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onConfirm?.(value);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center"
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-text/40 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden
      />

      <form
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={handleSubmit}
        className={cn(
          "relative z-10 w-full max-w-sm mx-4 mb-4 sm:mb-0",
          "bg-panel rounded-3xl shadow-float border border-line p-6",
          "animate-in slide-in-from-bottom-4 duration-200",
        )}
      >
        <h2
          id={titleId}
          className="text-[17px] font-bold text-text mb-1 leading-snug"
        >
          {title}
        </h2>
        {description && (
          <p className="text-sm text-muted leading-relaxed mb-4">
            {description}
          </p>
        )}
        <input
          ref={inputRef}
          type={type}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="w-full h-12 rounded-xl bg-bg border border-line px-4 text-sm text-text placeholder:text-subtle outline-none focus:border-primary/60 transition-colors mb-4"
          autoComplete="off"
        />
        <div className="flex flex-col gap-2">
          <Button
            type="submit"
            className="w-full h-12 !bg-primary !text-white border-0"
          >
            {confirmLabel}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full h-12"
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}
