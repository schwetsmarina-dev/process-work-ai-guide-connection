// Separate from vite.config.js on purpose: the main config loads the Base44
// vite plugin, which expects an app runtime context that isn't present when
// running unit tests (CI, local `npm test`). Keeping a minimal, dependency-free
// config here means tests never depend on Base44 platform state.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{js,jsx}"],
    passWithNoTests: false,
  },
});
