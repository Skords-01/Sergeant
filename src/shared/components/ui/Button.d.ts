import type { FC, ReactNode } from "react";

type ButtonProps = {
  children?: ReactNode;
  className?: string;
  [key: string]: unknown;
};

declare const Button: FC<ButtonProps>;
export { Button };
export default Button;
