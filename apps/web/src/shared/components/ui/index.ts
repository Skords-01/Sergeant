/**
 * Sergeant Design System — UI primitives barrel.
 *
 * Prefer importing from `@shared/components/ui` instead of deep paths so
 * renames stay cheap and IDE autocomplete surfaces the full API:
 *
 *   import { Card, Button, IconButton, Badge } from "@shared/components/ui";
 *
 * Deep imports (`@shared/components/ui/Card`) still work and remain the
 * recommended pattern for large files where tree-shaking clarity matters.
 */

export { Badge } from "./Badge";
export type { BadgeProps, BadgeSize, BadgeTone, BadgeVariant } from "./Badge";

export { Banner } from "./Banner";
export type { BannerProps, BannerVariant } from "./Banner";

export { Button } from "./Button";
export type { ButtonProps, ButtonSize, ButtonVariant } from "./Button";

export { IconButton } from "./IconButton";
export type { IconButtonProps } from "./IconButton";

export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./Card";
export type {
  CardPadding,
  CardProps,
  CardRadius,
  CardTitleProps,
  CardVariant,
} from "./Card";

export { EmptyState } from "./EmptyState";
export type { EmptyStateProps } from "./EmptyState";

export { FormField, Label } from "./FormField";
export type { FormFieldProps, LabelProps } from "./FormField";

export { Icon, ICON_NAMES } from "./Icon";
export type { IconName, IconProps } from "./Icon";

export { Input, Textarea } from "./Input";
export type {
  InputProps,
  InputSize,
  InputVariant,
  TextareaProps,
} from "./Input";

export { SectionHeader, SectionHeading } from "./SectionHeading";
export type {
  SectionHeaderProps,
  SectionHeaderSize,
  SectionHeadingProps,
  SectionHeadingSize,
} from "./SectionHeading";

export { Segmented } from "./Segmented";
export type {
  SegmentedAccent,
  SegmentedItem,
  SegmentedProps,
  SegmentedSize,
  SegmentedTone,
} from "./Segmented";

export { Select } from "./Select";
export type { SelectProps, SelectSize, SelectVariant } from "./Select";

export { Skeleton, SkeletonText } from "./Skeleton";
export type { SkeletonProps } from "./Skeleton";

export { SkipLink } from "./SkipLink";
export type { SkipLinkProps } from "./SkipLink";

export { Spinner } from "./Spinner";
export type { SpinnerProps, SpinnerSize } from "./Spinner";

export { Stat } from "./Stat";
export type { StatProps, StatSize, StatTone } from "./Stat";

export { Tabs } from "./Tabs";
export type {
  TabItem,
  TabsAccent,
  TabsProps,
  TabsSize,
  TabsTone,
} from "./Tabs";

export { ToastContainer } from "./Toast";
