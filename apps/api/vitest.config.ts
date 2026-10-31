import { defineConfig } from "vitest/config";

export default defineConfig({
  root: __dirname,
  css: {
    postcss: false,
  },
  test: {
    environment: "node",
    globals: true,
  },
});
