import type { FC, ReactNode } from "react";

type SwipeToActionProps = {
  children?: ReactNode;
  className?: string;
  [key: string]: unknown;
};

declare const SwipeToAction: FC<SwipeToActionProps>;
export { SwipeToAction };
export default SwipeToAction;
