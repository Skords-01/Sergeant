import type { FC, ReactNode } from "react";

type IconProps = {
  children?: ReactNode;
  className?: string;
  [key: string]: unknown;
};

declare const Icon: FC<IconProps>;
export { Icon };
export default Icon;
