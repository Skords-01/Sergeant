import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.{js,jsx,ts,tsx}", "server/api/**/*.test.{js,ts}"],
    passWithNoTests: false,
    setupFiles: ["src/test/setup.js"],
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
});
