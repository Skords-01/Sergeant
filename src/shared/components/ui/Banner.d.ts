import type { FC, ReactNode } from "react";

type BannerProps = {
  children?: ReactNode;
  className?: string;
  [key: string]: unknown;
};

declare const Banner: FC<BannerProps>;
export { Banner };
export default Banner;
