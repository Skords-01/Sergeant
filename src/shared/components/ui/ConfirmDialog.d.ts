import type { FC, ReactNode } from "react";

type ConfirmDialogProps = {
  children?: ReactNode;
  className?: string;
  [key: string]: unknown;
};

declare const ConfirmDialog: FC<ConfirmDialogProps>;
export { ConfirmDialog };
export default ConfirmDialog;
