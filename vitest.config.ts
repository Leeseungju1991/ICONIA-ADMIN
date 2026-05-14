import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules", ".next", "dist"],
    coverage: {
      include: ["lib/**/*.ts", "middleware.ts"],
      exclude: ["**/*.test.ts", "**/*.test.tsx", "**/types.ts"],
    },
  },
});
