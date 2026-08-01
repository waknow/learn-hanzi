import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "./vitest.config";

// mergeConfig 继承主配置的 plugins/alias/setup/jsdom 环境。
// 注意：mergeConfig 对数组字段执行拼接（[...existing, ...value]），
// 而 lib 配置要求 include/exclude 严格限定于 src/lib，
// 因此这三个数组字段必须在合并结果上显式覆盖。
const config = mergeConfig(baseConfig, {
  test: {
    coverage: {
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 75,
      },
    },
  },
});

config.test!.include = ["src/lib/**/*.test.{ts,tsx}"];
config.test!.coverage!.include = ["src/lib/**"];
config.test!.coverage!.exclude = ["src/lib/types.ts"];

export default defineConfig(config);
