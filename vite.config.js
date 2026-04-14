import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget = (env.VITE_API_PROXY_TARGET || "http://127.0.0.1:3000").replace(/\/$/, "");

  return {
  plugins: [react()],
  server: {
    host: true,
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
    },
  },
  };
});
