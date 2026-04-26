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

export { Avatar } from "./Avatar";
export type { AvatarProps, AvatarSize, AvatarStatus } from "./Avatar";

export { EmptyState } from "./EmptyState";
export type { EmptyStateProps } from "./EmptyState";

export { EmptyStateIllustration } from "./EmptyStateIllustration";
export type {
  EmptyStateIllustrationProps,
  IllustrationVariant,
} from "./EmptyStateIllustration";

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
  SectionHeaderVariant,
  SectionHeadingProps,
  SectionHeadingSize,
  SectionHeadingVariant,
} from "./SectionHeading";

export { Segmented } from "./Segmented";
export type {
  SegmentedItem,
  SegmentedProps,
  SegmentedSize,
  SegmentedStyle,
  SegmentedVariant,
} from "./Segmented";

export { Select } from "./Select";
export type { SelectProps, SelectSize, SelectVariant } from "./Select";

export { Popover, PopoverDivider, PopoverItem } from "./Popover";
export type {
  PopoverItemProps,
  PopoverPlacement,
  PopoverProps,
} from "./Popover";

export { Skeleton, SkeletonText } from "./Skeleton";
export type { SkeletonProps } from "./Skeleton";

export { SkeletonCard, SkeletonList } from "./SkeletonCard";
export type { SkeletonCardProps, SkeletonListProps } from "./SkeletonCard";

export { SkipLink } from "./SkipLink";
export type { SkipLinkProps } from "./SkipLink";

export { Spinner } from "./Spinner";
export type { SpinnerProps, SpinnerSize } from "./Spinner";

export { Switch } from "./Switch";
export type { SwitchProps } from "./Switch";

export { Stat } from "./Stat";
export type { StatProps, StatSize, StatVariant } from "./Stat";

export { Tabs } from "./Tabs";
export type {
  TabItem,
  TabsProps,
  TabsSize,
  TabsStyle,
  TabsVariant,
} from "./Tabs";

export { ToastContainer } from "./Toast";

export type { FormVariant, SmallMediumLarge } from "./types";
