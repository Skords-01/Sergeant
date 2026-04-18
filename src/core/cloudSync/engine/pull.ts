import { applyModuleData } from "../state/moduleData";
import { setModuleVersion } from "../state/versions";
import type { CurrentUser } from "../types";
import type { Transport } from "./transport";

export interface PullArgs {
  user: CurrentUser | null | undefined;
  transport: Transport;
  onStart(): void;
  onSuccess(when: Date): void;
  onError(message: string): void;
  onSettled(): void;
}

export async function pullAll(args: PullArgs): Promise<boolean> {
  const { user, transport, onStart, onSuccess, onError, onSettled } = args;
  onStart();
  try {
    const res = await transport.pullAll();
    if (!res.ok) throw new Error("Pull failed");
    const { modules } = await res.json();
    if (modules) {
      for (const [mod, payload] of Object.entries(modules)) {
        if (payload?.data) {
          applyModuleData(mod, payload.data);
          if (user?.id && payload.version) {
            setModuleVersion(user.id, mod, payload.version);
          }
        }
      }
    }
    onSuccess(new Date());
    return true;
  } catch (err) {
    onError(err instanceof Error ? err.message : String(err));
    return false;
  } finally {
    onSettled();
  }
}
