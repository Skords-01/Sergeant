import { useState, type ReactNode } from "react";
import { cn } from "@shared/lib/cn";
import {
  Badge,
  Banner,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  EmptyState,
  FormField,
  Icon,
  ICON_NAMES,
  IconButton,
  Input,
  SectionHeading,
  Segmented,
  Select,
  Skeleton,
  SkeletonText,
  Spinner,
  Stat,
  Tabs,
  Textarea,
} from "@shared/components/ui";
import { Modal } from "@shared/components/ui/Modal";
import { Sheet } from "@shared/components/ui/Sheet";
import { ConfirmDialog } from "@shared/components/ui/ConfirmDialog";
import { ModuleBottomNav } from "@shared/components/ui/ModuleBottomNav";
import { useDarkMode } from "@shared/hooks/useDarkMode";

// ─── Local helpers ─────────────────────────────────────────────────────────

function Sec({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-16">
      <h2 className="text-xl font-extrabold text-text mb-6 pb-3 border-b border-line">
        {title}
      </h2>
      <div className="space-y-8">{children}</div>
    </section>
  );
}

function Group({
  label,
  children,
  row = false,
}: {
  label: string;
  children: ReactNode;
  row?: boolean;
}) {
  return (
    <div>
      <SectionHeading size="xs" variant="subtle" className="mb-3">
        {label}
      </SectionHeading>
      <div className={row ? "flex flex-wrap items-center gap-3" : ""}>
        {children}
      </div>
    </div>
  );
}

function ColorSwatch({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={cn(
          "w-14 h-14 rounded-2xl border border-line shadow-card",
          className,
        )}
      />
      <span className="text-2xs text-subtle text-center font-mono">
        {label}
      </span>
    </div>
  );
}

const NAV_SECTIONS = [
  { id: "colors", label: "Кольори" },
  { id: "typography", label: "Типографіка" },
  { id: "buttons", label: "Кнопки" },
  { id: "badges", label: "Бейджі" },
  { id: "cards", label: "Карти" },
  { id: "forms", label: "Форми" },
  { id: "data", label: "Дані" },
  { id: "navigation", label: "Навігація" },
  { id: "overlays", label: "Overlays" },
  { id: "feedback", label: "Фідбек" },
] as const;

// ─── Main ──────────────────────────────────────────────────────────────────

export function DesignShowcase() {
  const { dark, toggle: toggleDark } = useDarkMode();
  const [tabVal, setTabVal] = useState("overview");
  const [segVal, setSegVal] = useState<"day" | "week" | "month">("day");
  const [navActive, setNavActive] = useState("home");
  const [modal, setModal] = useState<"sm" | "md" | "lg" | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-bg">
      {/* ── Sticky nav ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-[100] bg-panel/90 backdrop-blur-md border-b border-line">
        <div className="max-w-3xl mx-auto px-5 h-12 flex items-center gap-4">
          <h1 className="font-extrabold text-text text-sm shrink-0">
            Design System
          </h1>
          <nav
            aria-label="Розділи дизайн-системи"
            className="flex items-center gap-0.5 overflow-x-auto flex-1 min-w-0 scrollbar-hide"
          >
            {NAV_SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold text-muted hover:text-text hover:bg-panelHi transition-colors"
              >
                {s.label}
              </a>
            ))}
          </nav>
          <button
            type="button"
            onClick={toggleDark}
            aria-label={dark ? "Світла тема" : "Темна тема"}
            className="shrink-0 p-2 rounded-xl text-muted hover:text-text hover:bg-panelHi transition-colors"
          >
            <Icon name={dark ? "sun" : "moon"} size={16} />
          </button>
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────── */}
      <main className="max-w-3xl mx-auto px-5 py-10 space-y-20 pb-24">
        {/* ── 1. COLORS ──────────────────────────────────────────── */}
        <Sec id="colors" title="Кольори та токени">
          <Group label="Semantic — Поверхні">
            <div className="flex flex-wrap gap-4">
              <ColorSwatch label="bg-bg" className="bg-bg" />
              <ColorSwatch label="bg-panel" className="bg-panel" />
              <ColorSwatch label="bg-panelHi" className="bg-panelHi" />
              <ColorSwatch label="bg-line" className="bg-line" />
            </div>
          </Group>

          <Group label="Semantic — Текст">
            <div className="flex gap-8 items-baseline">
              <div className="flex flex-col gap-1.5">
                <span className="text-base font-semibold text-text">
                  text-text
                </span>
                <span className="text-base text-muted">text-muted</span>
                <span className="text-base text-subtle">text-subtle</span>
              </div>
            </div>
          </Group>

          <Group label="Brand & Status">
            <div className="flex flex-wrap gap-4">
              <ColorSwatch label="accent" className="bg-accent" />
              <ColorSwatch label="success" className="bg-success" />
              <ColorSwatch label="warning" className="bg-warning" />
              <ColorSwatch label="danger" className="bg-danger" />
              <ColorSwatch label="info" className="bg-info" />
            </div>
            <div className="flex flex-wrap gap-4 mt-3">
              <ColorSwatch label="success-soft" className="bg-success-soft" />
              <ColorSwatch label="warning-soft" className="bg-warning-soft" />
              <ColorSwatch label="danger-soft" className="bg-danger-soft" />
              <ColorSwatch label="info-soft" className="bg-info-soft" />
            </div>
          </Group>

          <Group label="Module Brands">
            <div className="flex flex-wrap gap-4">
              <ColorSwatch label="finyk" className="bg-finyk" />
              <ColorSwatch label="fizruk" className="bg-fizruk" />
              <ColorSwatch label="routine" className="bg-routine" />
              <ColorSwatch label="nutrition" className="bg-nutrition" />
            </div>
            <div className="flex flex-wrap gap-4 mt-3">
              <ColorSwatch label="finyk-soft" className="bg-finyk-soft" />
              <ColorSwatch label="fizruk-soft" className="bg-fizruk-soft" />
              <ColorSwatch
                label="routine-surface"
                className="bg-routine-surface"
              />
              <ColorSwatch
                label="nutrition-soft"
                className="bg-nutrition-soft"
              />
            </div>
          </Group>

          <Group label="Тіні">
            <div className="flex flex-wrap gap-4">
              <div className="shadow-soft bg-panel rounded-2xl border border-line px-4 py-3 text-xs text-muted font-mono">
                shadow-soft
              </div>
              <div className="shadow-card bg-panel rounded-2xl border border-line px-4 py-3 text-xs text-muted font-mono">
                shadow-card
              </div>
              <div className="shadow-float bg-panel rounded-2xl border border-line px-4 py-3 text-xs text-muted font-mono">
                shadow-float
              </div>
            </div>
          </Group>
        </Sec>

        {/* ── 2. TYPOGRAPHY ──────────────────────────────────────── */}
        <Sec id="typography" title="Типографіка">
          <Group label="Розміри тексту">
            <div className="space-y-1.5">
              <div className="flex items-baseline gap-4">
                <span className="text-5xl font-semibold text-text">
                  text-5xl
                </span>
                <span className="text-2xs text-subtle">48px / 1</span>
              </div>
              <div className="flex items-baseline gap-4">
                <span className="text-4xl font-semibold text-text">
                  text-4xl
                </span>
                <span className="text-2xs text-subtle">36px / 40px</span>
              </div>
              <div className="flex items-baseline gap-4">
                <span className="text-3xl font-semibold text-text">
                  text-3xl
                </span>
                <span className="text-2xs text-subtle">30px / 36px</span>
              </div>
              <div className="flex items-baseline gap-4">
                <span className="text-2xl font-semibold text-text">
                  text-2xl
                </span>
                <span className="text-2xs text-subtle">24px / 32px</span>
              </div>
              <div className="flex items-baseline gap-4">
                <span className="text-xl font-semibold text-text">text-xl</span>
                <span className="text-2xs text-subtle">20px / 28px</span>
              </div>
              <div className="flex items-baseline gap-4">
                <span className="text-lg font-semibold text-text">text-lg</span>
                <span className="text-2xs text-subtle">18px / 28px</span>
              </div>
              <div className="flex items-baseline gap-4">
                <span className="text-base font-semibold text-text">
                  text-base
                </span>
                <span className="text-2xs text-subtle">16px / 24px</span>
              </div>
              <div className="flex items-baseline gap-4">
                <span className="text-sm font-semibold text-text">text-sm</span>
                <span className="text-2xs text-subtle">14px / 20px</span>
              </div>
              <div className="flex items-baseline gap-4">
                <span className="text-xs font-semibold text-text">text-xs</span>
                <span className="text-2xs text-subtle">12px / 16px</span>
              </div>
              <div className="flex items-baseline gap-4">
                <span className="text-2xs font-semibold text-text">
                  text-2xs
                </span>
                <span className="text-2xs text-subtle">10px / 14px</span>
              </div>
              <div className="flex items-baseline gap-4">
                <span className="text-3xs font-semibold text-text">
                  text-3xs
                </span>
                <span className="text-2xs text-subtle">9px / 12px</span>
              </div>
            </div>
          </Group>

          <Group label="Font weight">
            <div className="flex flex-wrap gap-6">
              {([400, 500, 600, 700, 900] as const).map((w) => (
                <div key={w} className="flex flex-col items-center gap-1">
                  <span
                    style={{ fontWeight: w }}
                    className="text-2xl text-text"
                  >
                    Аа
                  </span>
                  <span className="text-2xs text-subtle">{w}</span>
                </div>
              ))}
            </div>
          </Group>

          <Group label="SectionHeading — розміри">
            <div className="space-y-2">
              <SectionHeading size="xs">
                SectionHeading xs — eyebrow
              </SectionHeading>
              <SectionHeading size="sm">
                SectionHeading sm — eyebrow
              </SectionHeading>
              <SectionHeading size="md">SectionHeading md</SectionHeading>
              <SectionHeading size="lg">SectionHeading lg</SectionHeading>
              <SectionHeading size="xl">SectionHeading xl</SectionHeading>
            </div>
          </Group>

          <Group label="SectionHeading — тони" row>
            <SectionHeading size="xs" variant="subtle">
              subtle
            </SectionHeading>
            <SectionHeading size="xs" variant="muted">
              muted
            </SectionHeading>
            <SectionHeading size="xs" variant="text">
              text
            </SectionHeading>
            <SectionHeading size="xs" variant="accent">
              accent
            </SectionHeading>
            <SectionHeading size="xs" variant="finyk">
              finyk
            </SectionHeading>
            <SectionHeading size="xs" variant="fizruk">
              fizruk
            </SectionHeading>
            <SectionHeading size="xs" variant="routine">
              routine
            </SectionHeading>
            <SectionHeading size="xs" variant="nutrition">
              nutrition
            </SectionHeading>
          </Group>
        </Sec>

        {/* ── 3. BUTTONS ─────────────────────────────────────────── */}
        <Sec id="buttons" title="Кнопки">
          <Group label="Основні варіанти × розміри">
            <div className="space-y-3">
              {(
                [
                  "primary",
                  "secondary",
                  "ghost",
                  "danger",
                  "destructive",
                  "success",
                ] as const
              ).map((variant) => (
                <div
                  key={variant}
                  className="flex flex-wrap items-center gap-2"
                >
                  <span className="text-2xs text-subtle w-24 shrink-0 font-mono">
                    {variant}
                  </span>
                  {(["xs", "sm", "md", "lg"] as const).map((size) => (
                    <Button key={size} variant={variant} size={size}>
                      {size}
                    </Button>
                  ))}
                </div>
              ))}
            </div>
          </Group>

          <Group label="Module variants">
            <div className="space-y-3">
              {(
                [
                  "finyk",
                  "fizruk",
                  "routine",
                  "nutrition",
                  "finyk-soft",
                  "fizruk-soft",
                  "routine-soft",
                  "nutrition-soft",
                ] as const
              ).map((variant) => (
                <div
                  key={variant}
                  className="flex flex-wrap items-center gap-2"
                >
                  <span className="text-2xs text-subtle w-32 shrink-0 font-mono">
                    {variant}
                  </span>
                  {(["sm", "md", "lg"] as const).map((size) => (
                    <Button key={size} variant={variant} size={size}>
                      {size}
                    </Button>
                  ))}
                </div>
              ))}
            </div>
          </Group>

          <Group label="Стани" row>
            <Button loading>Завантаження</Button>
            <Button disabled>Вимкнено</Button>
            <Button variant="secondary" loading>
              Secondary
            </Button>
            <Button variant="ghost" disabled>
              Ghost
            </Button>
          </Group>

          <Group label="IconButton">
            <div className="flex flex-wrap gap-3">
              {(["ghost", "secondary", "primary", "danger"] as const).map((v) =>
                (["sm", "md", "lg"] as const).map((s) => (
                  <IconButton
                    key={`${v}-${s}`}
                    variant={v}
                    size={s}
                    aria-label={`${v} ${s}`}
                  >
                    <Icon
                      name="plus"
                      size={s === "sm" ? 14 : s === "md" ? 16 : 18}
                    />
                  </IconButton>
                )),
              )}
            </div>
          </Group>
        </Sec>

        {/* ── 4. BADGES ──────────────────────────────────────────── */}
        <Sec id="badges" title="Бейджі">
          {(["soft", "solid", "outline"] as const).map((badgeTone) => (
            <Group key={badgeTone} label={`tone="${badgeTone}"`} row>
              {(
                [
                  "neutral",
                  "accent",
                  "success",
                  "warning",
                  "danger",
                  "info",
                  "finyk",
                  "fizruk",
                  "routine",
                  "nutrition",
                ] as const
              ).map((variant) => (
                <Badge key={variant} variant={variant} tone={badgeTone}>
                  {variant}
                </Badge>
              ))}
            </Group>
          ))}

          <Group label="Розміри та dot" row>
            <Badge variant="accent" size="xs">
              xs
            </Badge>
            <Badge variant="accent" size="sm">
              sm
            </Badge>
            <Badge variant="accent" size="md">
              md
            </Badge>
            <Badge variant="success" dot>
              Активний
            </Badge>
            <Badge variant="danger" dot>
              Критично
            </Badge>
            <Badge variant="warning" dot size="md">
              Увага
            </Badge>
          </Group>
        </Sec>

        {/* ── 5. CARDS ───────────────────────────────────────────── */}
        <Sec id="cards" title="Карти">
          <Group label="Основні варіанти">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {(
                ["default", "interactive", "flat", "elevated", "ghost"] as const
              ).map((variant) => (
                <Card key={variant} variant={variant} padding="md" radius="lg">
                  <div className="text-xs font-semibold text-text">
                    {variant}
                  </div>
                  <div className="text-2xs text-muted mt-1">
                    variant=&quot;{variant}&quot;
                  </div>
                </Card>
              ))}
            </div>
          </Group>

          <Group label="Module hero cards">
            <div className="grid grid-cols-2 gap-4">
              {(["finyk", "fizruk", "routine", "nutrition"] as const).map(
                (variant) => (
                  <Card key={variant} variant={variant} padding="lg">
                    <div className="text-sm font-bold">{variant}</div>
                    <div className="text-2xs text-muted mt-1">Module hero</div>
                  </Card>
                ),
              )}
              {(
                [
                  "finyk-soft",
                  "fizruk-soft",
                  "routine-soft",
                  "nutrition-soft",
                ] as const
              ).map((variant) => (
                <Card key={variant} variant={variant} padding="md">
                  <div className="text-xs font-semibold text-text">
                    {variant}
                  </div>
                </Card>
              ))}
            </div>
          </Group>

          <Group label="Padding">
            <div className="flex flex-wrap gap-3">
              {(["sm", "md", "lg", "xl"] as const).map((padding) => (
                <Card
                  key={padding}
                  variant="default"
                  padding={padding}
                  radius="lg"
                  className="text-xs text-muted font-mono"
                >
                  padding=&quot;{padding}&quot;
                </Card>
              ))}
            </div>
          </Group>

          <Group label="Повний layout">
            <Card variant="elevated" padding="lg" radius="xl">
              <CardHeader>
                <CardTitle>Заголовок картки</CardTitle>
                <Badge variant="accent">Новий</Badge>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Опис або довільний вміст картки — кілька рядків для
                  демонстрації структури CardHeader / CardContent / CardFooter.
                </CardDescription>
              </CardContent>
              <CardFooter>
                <Button size="sm" variant="secondary">
                  Скасувати
                </Button>
                <Button size="sm">Зберегти</Button>
              </CardFooter>
            </Card>
          </Group>
        </Sec>

        {/* ── 6. FORMS ───────────────────────────────────────────── */}
        <Sec id="forms" title="Форми">
          <Group label="Input — варіанти та розміри">
            <div className="space-y-3">
              {(["default", "filled", "ghost"] as const).map((variant) => (
                <div
                  key={variant}
                  className="flex flex-wrap items-center gap-3"
                >
                  <span className="text-2xs text-subtle w-14 shrink-0 font-mono">
                    {variant}
                  </span>
                  {(["sm", "md", "lg"] as const).map((size) => (
                    <Input
                      key={size}
                      variant={variant}
                      size={size}
                      placeholder={`size=${size}`}
                      className="w-36"
                    />
                  ))}
                </div>
              ))}
            </div>
          </Group>

          <Group label="Input — стани" row>
            <Input placeholder="Default" className="w-40" />
            <Input placeholder="Error" error className="w-40" />
            <Input placeholder="Success" success className="w-40" />
            <Input
              placeholder="З іконкою"
              icon={<Icon name="search" size={16} className="text-muted" />}
              className="w-40"
            />
          </Group>

          <Group label="Textarea">
            <Textarea
              placeholder="Введіть текст…"
              rows={3}
              className="w-full max-w-sm"
            />
          </Group>

          <Group label="Select — розміри та error" row>
            {(["sm", "md", "lg"] as const).map((size) => (
              <Select
                key={size}
                size={size}
                className="w-40"
                aria-label={`Приклад Select, розмір ${size}`}
              >
                <option>Варіант 1</option>
                <option>Варіант 2</option>
              </Select>
            ))}
            <Select
              className="w-40"
              error
              aria-label="Приклад Select, стан error"
            >
              <option>Error стан</option>
            </Select>
          </Group>

          <Group label="FormField">
            <div className="space-y-4 max-w-sm">
              <FormField
                label="Стандартне поле"
                helperText="Підказка під полем"
              >
                <Input placeholder="Введіть значення" />
              </FormField>
              <FormField label="З помилкою" error="Поле обов'язкове">
                <Input placeholder="Помилка" error />
              </FormField>
              <FormField label="Необов'язкове" optional>
                <Input placeholder="Можна пропустити" />
              </FormField>
              <FormField
                label="Normal case label"
                normalCaseLabel
                helperText="Звичайний стиль мітки"
              >
                <Input placeholder="Текст" />
              </FormField>
            </div>
          </Group>
        </Sec>

        {/* ── 7. DATA DISPLAY ────────────────────────────────────── */}
        <Sec id="data" title="Відображення даних">
          <Group label="Stat — варіанти">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {(
                [
                  "default",
                  "success",
                  "warning",
                  "danger",
                  "finyk",
                  "fizruk",
                  "routine",
                  "nutrition",
                ] as const
              ).map((variant) => (
                <Card key={variant} variant="default" padding="md" radius="lg">
                  <Stat
                    label={variant}
                    value="1 234"
                    sublabel="+5%"
                    variant={variant}
                  />
                </Card>
              ))}
            </div>
          </Group>

          <Group label="Stat — розміри та вирівнювання">
            <div className="flex flex-wrap gap-8">
              <Stat label="size=sm" value="42" size="sm" />
              <Stat label="size=md" value="42" size="md" />
              <Stat label="size=lg" value="42" size="lg" />
              <Stat label="з icon" value="82 кг" icon="⚡" size="md" />
              <Stat label="center" value="7/10" align="center" size="md" />
              <Stat label="right" value="98%" align="right" size="md" />
            </div>
          </Group>

          <Group label="Banner">
            <div className="space-y-2">
              <Banner variant="info">
                Banner variant=&quot;info&quot; — інформаційне повідомлення
              </Banner>
              <Banner variant="success">
                Banner variant=&quot;success&quot; — успішна операція
              </Banner>
              <Banner variant="warning">
                Banner variant=&quot;warning&quot; — попередження
              </Banner>
              <Banner variant="danger">
                Banner variant=&quot;danger&quot; — помилка або небезпека
              </Banner>
            </div>
          </Group>

          <Group label="EmptyState">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card variant="flat" padding="none" radius="lg">
                <EmptyState
                  icon={<Icon name="search" size={24} />}
                  title="Нічого не знайдено"
                  description="Спробуйте змінити пошуковий запит або скинути фільтри."
                  action={
                    <Button size="sm" variant="secondary">
                      Скинути
                    </Button>
                  }
                />
              </Card>
              <Card variant="flat" padding="none" radius="lg">
                <EmptyState
                  compact
                  icon={<Icon name="bar-chart" size={18} />}
                  title="Compact EmptyState"
                  description="Менший варіант для inline-контексту всередині картки."
                />
              </Card>
            </div>
          </Group>

          <Group label="Іконки">
            <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
              {ICON_NAMES.map((name) => (
                <div
                  key={name}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-panelHi transition-colors"
                >
                  <Icon name={name} size={20} className="text-text" />
                  <span className="text-2xs text-subtle text-center leading-tight font-mono break-all">
                    {name}
                  </span>
                </div>
              ))}
            </div>
          </Group>
        </Sec>

        {/* ── 8. NAVIGATION ──────────────────────────────────────── */}
        <Sec id="navigation" title="Навігація">
          <Group label="Tabs — underline">
            <Tabs
              items={[
                {
                  value: "overview",
                  label: "Огляд",
                  icon: <Icon name="home" size={14} />,
                },
                {
                  value: "stats",
                  label: "Статистика",
                  badge: (
                    <Badge variant="accent" size="xs" tone="solid">
                      3
                    </Badge>
                  ),
                },
                { value: "settings", label: "Налаштування" },
                { value: "disabled", label: "Disabled", disabled: true },
              ]}
              value={tabVal}
              onChange={setTabVal}
              style="underline"
            />
          </Group>

          <Group label="Tabs — pill × accents">
            <div className="space-y-3">
              {(
                ["brand", "finyk", "fizruk", "routine", "nutrition"] as const
              ).map((variant) => (
                <div key={variant} className="flex items-center gap-3">
                  <span className="text-2xs text-subtle font-mono w-20 shrink-0">
                    {variant}
                  </span>
                  <Tabs
                    items={[
                      { value: "a", label: "Перший" },
                      { value: "b", label: "Другий" },
                      { value: "c", label: "Третій" },
                    ]}
                    value={
                      tabVal === "overview" ||
                      tabVal === "stats" ||
                      tabVal === "settings"
                        ? "a"
                        : tabVal
                    }
                    onChange={setTabVal}
                    style="pill"
                    variant={variant}
                  />
                </div>
              ))}
            </div>
          </Group>

          <Group label="Segmented — solid та soft">
            <div className="space-y-5">
              {(["solid", "soft"] as const).map((segStyle) => (
                <div key={segStyle}>
                  <div className="text-2xs text-subtle font-mono mb-2">
                    style=&quot;{segStyle}&quot;
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {(
                      [
                        "brand",
                        "finyk",
                        "fizruk",
                        "routine",
                        "nutrition",
                      ] as const
                    ).map((variant) => (
                      <Segmented
                        key={variant}
                        items={[
                          { value: "day", label: "День" },
                          { value: "week", label: "Тиждень" },
                          { value: "month", label: "Місяць" },
                        ]}
                        value={segVal}
                        onChange={(v) =>
                          setSegVal(v as "day" | "week" | "month")
                        }
                        style={segStyle}
                        variant={variant}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Group>

          <Group label="ModuleBottomNav — 4 модулі">
            <div className="space-y-3">
              {(["finyk", "fizruk", "routine", "nutrition"] as const).map(
                (mod) => (
                  <div
                    key={mod}
                    className="rounded-2xl overflow-hidden border border-line"
                  >
                    <ModuleBottomNav
                      module={mod}
                      ariaLabel={`ModuleBottomNav (${mod})`}
                      items={[
                        {
                          id: "home",
                          label: "Головна",
                          icon: <Icon name="home" size={20} />,
                        },
                        {
                          id: "stats",
                          label: "Статистика",
                          icon: <Icon name="bar-chart" size={20} />,
                          badge: mod === "finyk",
                        },
                        {
                          id: "settings",
                          label: "Налаштування",
                          icon: <Icon name="settings" size={20} />,
                        },
                      ]}
                      activeId={navActive}
                      onChange={setNavActive}
                    />
                  </div>
                ),
              )}
            </div>
          </Group>
        </Sec>

        {/* ── 9. OVERLAYS ────────────────────────────────────────── */}
        <Sec id="overlays" title="Overlays">
          <Group label="Modal — розміри" row>
            {(["sm", "md", "lg"] as const).map((size) => (
              <Button
                key={size}
                variant="secondary"
                size="sm"
                onClick={() => setModal(size)}
              >
                Modal {size}
              </Button>
            ))}
          </Group>

          <Group label="Sheet та ConfirmDialog" row>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSheetOpen(true)}
            >
              Відкрити Sheet
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirmOpen(true)}
            >
              ConfirmDialog
            </Button>
          </Group>

          <Modal
            open={modal !== null}
            onClose={() => setModal(null)}
            size={modal ?? "md"}
            title="Приклад Modal"
            description="Демонстраційний modal зі штатними підкомпонентами дизайн-системи."
            footer={
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setModal(null)}
                >
                  Скасувати
                </Button>
                <Button size="sm" onClick={() => setModal(null)}>
                  Підтвердити
                </Button>
              </div>
            }
          >
            <p className="text-sm text-muted leading-relaxed">
              Тіло модального вікна. Може містити форми, списки або будь-який
              вміст. Розмір:{" "}
              <span className="font-mono font-semibold text-text">{modal}</span>
              .
            </p>
          </Modal>

          <Sheet
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            title="Приклад Sheet"
            description="Bottom sheet — основний паттерн для мобільних форм і детальних панелей."
            footer={
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  variant="ghost"
                  onClick={() => setSheetOpen(false)}
                >
                  Скасувати
                </Button>
                <Button className="flex-1" onClick={() => setSheetOpen(false)}>
                  Зберегти
                </Button>
              </div>
            }
          >
            <p className="text-sm text-muted leading-relaxed py-4">
              Вміст аркуша. Прокручується, якщо контент не вміщується у
              viewport. Фокус-пастка та Escape закривають аркуш автоматично.
            </p>
          </Sheet>

          <ConfirmDialog
            open={confirmOpen}
            title="Видалити запис?"
            description="Цю дію неможливо скасувати. Запис буде видалено назавжди."
            confirmLabel="Видалити"
            cancelLabel="Скасувати"
            onConfirm={() => setConfirmOpen(false)}
            onCancel={() => setConfirmOpen(false)}
          />
        </Sec>

        {/* ── 10. FEEDBACK ───────────────────────────────────────── */}
        <Sec id="feedback" title="Фідбек">
          <Group label="Spinner — розміри" row>
            {(["xs", "sm", "md", "lg"] as const).map((size) => (
              <div key={size} className="flex flex-col items-center gap-2">
                <Spinner size={size} />
                <span className="text-2xs text-subtle font-mono">{size}</span>
              </div>
            ))}
          </Group>

          <Group label="Skeleton">
            <div className="space-y-2 max-w-sm">
              <Skeleton className="h-24 w-full" />
              <SkeletonText className="w-3/4" />
              <SkeletonText className="w-1/2" />
              <SkeletonText className="w-2/3" />
            </div>
          </Group>

          <Group label="Анімації">
            <div className="flex flex-wrap gap-4">
              <Card
                variant="default"
                padding="sm"
                radius="lg"
                className="motion-safe:animate-fade-in text-xs font-mono text-muted"
              >
                fade-in
              </Card>
              <Card
                variant="default"
                padding="sm"
                radius="lg"
                className="motion-safe:animate-slide-up text-xs font-mono text-muted"
              >
                slide-up
              </Card>
              <Card
                variant="default"
                padding="sm"
                radius="lg"
                className="motion-safe:animate-scale-in text-xs font-mono text-muted"
              >
                scale-in
              </Card>
              <Card
                variant="default"
                padding="sm"
                radius="lg"
                className="motion-safe:animate-pulse-soft text-xs font-mono text-muted"
              >
                pulse-soft
              </Card>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center motion-safe:animate-success-pulse shrink-0">
                  <Icon name="check" size={16} className="text-white" />
                </div>
                <span className="text-xs text-muted font-mono">
                  success-pulse
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center shrink-0">
                  <Icon
                    name="check"
                    size={16}
                    className="text-white motion-safe:animate-check-pop"
                  />
                </div>
                <span className="text-xs text-muted font-mono">check-pop</span>
              </div>
            </div>
          </Group>
        </Sec>
      </main>
    </div>
  );
}
