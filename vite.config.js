import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { visualizer } from "rollup-plugin-visualizer";
import { resolve } from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget = (
    env.VITE_API_PROXY_TARGET || "http://127.0.0.1:3000"
  ).replace(/\/$/, "");

  // Opt-in via `ANALYZE=1 npm run build` so regular builds stay fast and we
  // don't litter dist/ with the report in CI.
  const analyze = env.ANALYZE === "1" || process.env.ANALYZE === "1";

  return {
    plugins: [
      react(),
      VitePWA({
        strategies: "injectManifest",
        srcDir: "src",
        filename: "sw.js",
        registerType: "prompt",
        includeAssets: [
          "icon.svg",
          "icon-192.png",
          "icon-512.png",
          "apple-touch-icon.png",
        ],
        manifest: {
          name: "Sergeant — Твій персональний хаб життя",
          short_name: "Sergeant",
          description: "Персональний хаб: фінанси, спорт, звички та харчування",
          start_url: "/",
          display: "standalone",
          orientation: "portrait",
          background_color: "#fdf9f3",
          theme_color: "#fdf9f3",
          lang: "uk",
          shortcuts: [
            {
              name: "Додати витрату",
              short_name: "Витрата",
              description: "Швидко додати нову витрату у Фінік",
              url: "/?module=finyk&action=add_expense",
              icons: [
                { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
              ],
            },
            {
              name: "Розпочати тренування",
              short_name: "Тренування",
              description: "Розпочати нове тренування у Фізрук",
              url: "/?module=fizruk&action=start_workout",
              icons: [
                { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
              ],
            },
            {
              name: "Додати прийом їжі",
              short_name: "Їжа",
              description: "Записати прийом їжі у Харчування",
              url: "/?module=nutrition&action=add_meal",
              icons: [
                { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
              ],
            },
          ],
          icons: [
            {
              src: "/icon-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
            {
              src: "/icon.svg",
              sizes: "any",
              type: "image/svg+xml",
              purpose: "any",
            },
          ],
        },
        injectManifest: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        },
      }),
      analyze &&
        visualizer({
          filename: "dist/bundle-report.html",
          template: "treemap",
          gzipSize: true,
          brotliSize: true,
          open: false,
        }),
    ].filter(Boolean),
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id) return;
            if (id.includes("node_modules")) {
              if (
                id.includes("/node_modules/react/") ||
                id.includes("/node_modules/react-dom/")
              )
                return "vendor-react";
              if (id.includes("/node_modules/scheduler/"))
                return "vendor-react";
              if (id.includes("/node_modules/react-is/")) return "vendor-react";
              if (id.includes("/node_modules/use-sync-external-store/"))
                return "vendor-react";
              if (id.includes("react-router")) return "vendor-router";
              if (id.includes("react-virtuoso")) return "vendor-virtuoso";
              if (id.includes("@zxing")) return "vendor-zxing";
              if (id.includes("react-markdown")) return "vendor-markdown";
              // Ізольований chunk для Sentry, щоб SDK (~30–40 KB gzip) не
              // потрапляв у загальний `vendor`, який шериться між eager-
              // імпортами main bundle. Див. правило 2.3 у
              // `.agents/skills/vercel-react-best-practices/AGENTS.md`.
              if (id.includes("@sentry")) return "vendor-sentry";
              return "vendor";
            }
          },
        },
      },
    },
    server: {
      host: true,
      allowedHosts: true,
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
    resolve: {
      alias: {
        "@shared": resolve(__dirname, "src/shared"),
        "@finyk": resolve(__dirname, "src/modules/finyk"),
        "@fizruk": resolve(__dirname, "src/modules/fizruk"),
        "@routine": resolve(__dirname, "src/modules/routine"),
        "@nutrition": resolve(__dirname, "src/modules/nutrition"),
      },
    },
    test: {
      environmentMatchGlobs: [
        ["server/**", "node"],
        ["src/**", "jsdom"],
      ],
    },
  };
});
