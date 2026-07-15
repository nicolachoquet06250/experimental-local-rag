import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["src/constants.ts", "src/functions.ts", "src/main.ts"],
      exclude: ["src/global.d.ts"],
      all: true,
    },
  },
});
