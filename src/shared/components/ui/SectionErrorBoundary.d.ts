import type { FC, ReactNode } from "react";

type SectionErrorBoundaryProps = {
  children?: ReactNode;
  className?: string;
  [key: string]: unknown;
};

declare const SectionErrorBoundary: FC<SectionErrorBoundaryProps>;
export { SectionErrorBoundary };
export default SectionErrorBoundary;
