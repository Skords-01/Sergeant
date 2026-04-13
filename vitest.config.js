import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.js"],
    passWithNoTests: false,
  },
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "src/shared"),
      "@finyk": resolve(__dirname, "src/modules/finyk"),
      "@fizruk": resolve(__dirname, "src/modules/fizruk"),
    },
  },
});
