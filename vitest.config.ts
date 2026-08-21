import path from "path";
import { defineConfig } from "vitest/config";

// Mirrors the path aliases in tsconfig.json so unit tests can import
// application code via "@..." specifiers.
export default defineConfig({
  resolve: {
    alias: {
      "@config": path.resolve(__dirname, "src/config"),
      "@modules": path.resolve(__dirname, "src/modules"),
      "@middleware": path.resolve(__dirname, "src/middleware"),
      "@services": path.resolve(__dirname, "src/services"),
      "@utils": path.resolve(__dirname, "src/utils"),
      "@types": path.resolve(__dirname, "src/types"),
      "@jobs": path.resolve(__dirname, "src/jobs"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
