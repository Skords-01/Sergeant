import type { FC, ReactNode } from "react";

type ProgressRingProps = {
  children?: ReactNode;
  className?: string;
  [key: string]: unknown;
};

declare const ProgressRing: FC<ProgressRingProps>;
export { ProgressRing };
export default ProgressRing;
