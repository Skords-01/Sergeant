import type { FC, ReactNode } from "react";

type CardProps = {
  children?: ReactNode;
  className?: string;
  [key: string]: unknown;
};

declare const Card: FC<CardProps>;
export { Card };
export default Card;
