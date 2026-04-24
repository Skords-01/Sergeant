type SwRequest =
  | { type: "SW_DEBUG"; data?: { requestId: string } }
  | { type: "CLEAR_SW_CACHES"; data?: { requestId: string } }
  | { type: "SW_SET_DEBUG"; data?: { enabled: boolean } };

type SwResponse =
  | { type: "SW_DEBUG_RESULT"; requestId?: string | null; snapshot?: unknown }
  | {
      type: "CLEAR_SW_CACHES_RESULT";
      requestId?: string | null;
      result?: unknown;
    };

function makeRequestId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

async function postToSw(msg: SwRequest): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const ctl = navigator.serviceWorker.controller || reg.active;
  ctl?.postMessage?.(msg);
}

async function requestSw<T extends SwResponse["type"]>(
  msg: SwRequest,
  expectType: T,
  requestId: string,
  timeoutMs = 3000,
): Promise<Extract<SwResponse, { type: T }>> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("serviceWorker unsupported");
  }
  await navigator.serviceWorker.ready;

  return await new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error("SW request timeout"));
    }, timeoutMs);

    const onMessage = (event: MessageEvent) => {
      const data = event.data as SwResponse | undefined;
      if (!data || data.type !== expectType) return;
      if ((data.requestId || null) !== requestId) return;
      if (done) return;
      done = true;
      cleanup();
      resolve(data as Extract<SwResponse, { type: T }>);
    };

    const cleanup = () => {
      clearTimeout(timer);
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };

    navigator.serviceWorker.addEventListener("message", onMessage);
    void postToSw(msg).catch((err) => {
      if (done) return;
      done = true;
      cleanup();
      reject(err);
    });
  });
}

export async function swSetDebug(enabled: boolean) {
  await postToSw({ type: "SW_SET_DEBUG", data: { enabled } });
}

export async function swGetDebugSnapshot() {
  const requestId = makeRequestId("sw_debug");
  const res = await requestSw(
    { type: "SW_DEBUG", data: { requestId } },
    "SW_DEBUG_RESULT",
    requestId,
    4000,
  );
  return res.snapshot;
}

export async function swClearCaches() {
  const requestId = makeRequestId("sw_clear");
  const res = await requestSw(
    { type: "CLEAR_SW_CACHES", data: { requestId } },
    "CLEAR_SW_CACHES_RESULT",
    requestId,
    6000,
  );
  return res.result;
}
