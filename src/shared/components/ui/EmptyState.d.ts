import type { FC, ReactNode } from "react";

type EmptyStateProps = {
  children?: ReactNode;
  className?: string;
  [key: string]: unknown;
};

declare const EmptyState: FC<EmptyStateProps>;
export { EmptyState };
export default EmptyState;
