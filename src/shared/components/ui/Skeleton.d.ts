import type { FC, ReactNode } from "react";

type SkeletonProps = {
  children?: ReactNode;
  className?: string;
  [key: string]: unknown;
};

declare const Skeleton: FC<SkeletonProps>;
export { Skeleton };
export default Skeleton;
