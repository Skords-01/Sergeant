import type { FC, ReactNode } from "react";

type VoiceMicButtonProps = {
  children?: ReactNode;
  className?: string;
  [key: string]: unknown;
};

declare const VoiceMicButton: FC<VoiceMicButtonProps>;
export { VoiceMicButton };
export default VoiceMicButton;
