import type { FC, ReactNode } from "react";

type InputDialogProps = {
  children?: ReactNode;
  className?: string;
  [key: string]: unknown;
};

declare const InputDialog: FC<InputDialogProps>;
export { InputDialog };
export default InputDialog;
