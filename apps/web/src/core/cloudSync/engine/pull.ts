import { syncApi } from "@shared/api";
import { applyModuleData } from "../state/moduleData";
import { setModuleVersion } from "../state/versions";
import type { EngineArgs, PullAllResponse } from "../types";
import { retryAsync } from "./retryAsync";

export type PullArgs = EngineArgs;

export async function pullAll(args: PullArgs): Promise<boolean> {
  const { user, onStart, onSuccess, onError, onSettled } = args;
  onStart();
  try {
    const { modules } = (await retryAsync(() => syncApi.pullAll(), {
      label: "pullAll",
    })) as PullAllResponse;
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
    args.onErrorRaw?.(err);
    onError(err instanceof Error ? err.message : String(err));
    return false;
  } finally {
    onSettled();
  }
}
