import type { FC, ReactNode } from "react";

type InputProps = {
  children?: ReactNode;
  className?: string;
  [key: string]: unknown;
};

declare const Input: FC<InputProps>;
export { Input };
export default Input;
