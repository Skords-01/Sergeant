// Backward-compatible barrel. The real implementation lives in
// `./cloudSync/` (see that directory's index.ts for module-by-module
// layout). This file exists so existing consumers and tests — which import
// from `./useCloudSync.js` — keep working unchanged.
export * from "./cloudSync/index";
