import type { Meta, StoryObj } from "@storybook/react-vite";
import { InputDialog } from "./InputDialog";

/**
 * `InputDialog` — модалка з одним input-полем (zod-валідований через
 * `useApiForm`). Stories покривають дефолтну форму, password-варіант і
 * закритий стан. Initiative 0007 Phase 2 — shared/ui story.
 */
const meta: Meta<typeof InputDialog> = {
  title: "Shared / InputDialog",
  component: InputDialog,
  parameters: {
    layout: "fullscreen",
    chromatic: { viewports: [375, 768, 1280] },
  },
  tags: ["autodocs"],
  args: {
    open: true,
    title: "Назва шаблону",
    description: "Вкажи коротку назву — її буде видно у списку.",
    placeholder: "Тренування ніг",
    confirmLabel: "Зберегти",
    cancelLabel: "Скасувати",
    onConfirm: () => {},
    onCancel: () => {},
  },
};
export default meta;

type Story = StoryObj<typeof InputDialog>;

/** Стандартний text-input із title + description. */
export const Default: Story = {};

/** Password-варіант — `type="password"` маскує введення. */
export const Password: Story = {
  args: {
    title: "Введи пароль",
    description: "Цей пароль використовується для розшифрування backup-у.",
    type: "password",
    placeholder: "••••••••",
    confirmLabel: "Розшифрувати",
  },
};

/** З defaultValue — поле попередньо заповнене. */
export const WithDefaultValue: Story = {
  args: {
    defaultValue: "Тренування ніг",
  },
};

/** Закритий стан — компонент рендерить `null`. */
export const Closed: Story = {
  args: { open: false },
};
