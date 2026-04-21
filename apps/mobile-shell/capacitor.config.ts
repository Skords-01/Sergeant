import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor shell над `@sergeant/web`.
 *
 * `webDir` вказує на існуючий артефакт Vite-білду, який лежить у
 * `apps/server/dist` (див. `apps/web/vite.config.js` → `build.outDir`).
 * Це дозволяє переюзати готовий production-бандл без копіювання.
 *
 * `appId` свідомо відрізняється від RN-апки (`com.sergeant.app`, див.
 * `apps/mobile/app.config.ts`), щоб PoC-shell і канонічна RN-апка могли
 * жити на одному пристрої пліч-о-пліч без колізії.
 *
 * Призначення PoC:
 *   - довести, що поточний веб-код запускається у WebView «з коробки»;
 *   - дати вимір «скільки саме зусиль треба», не чіпаючи `apps/web`.
 * Production-рішення (native push, bearer-auth, barcode scanner) —
 * окремими PR-ами після того, як shell стартує.
 */
const config: CapacitorConfig = {
  appId: "com.sergeant.shell",
  appName: "Sergeant Shell",
  webDir: "../server/dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
