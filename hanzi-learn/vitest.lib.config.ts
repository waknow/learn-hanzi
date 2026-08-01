import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "./vitest.config";

export default defineConfig(
  mergeConfig(baseConfig, {
    test: {
      include: ["src/lib/**/*.test.{ts,tsx}"],
      coverage: {
        include: ["src/lib/**"],
        exclude: ["src/lib/types.ts"],
        thresholds: {
          lines: 80,
          functions: 80,
          statements: 80,
          branches: 75,
        },
      },
    },
  }),
);
