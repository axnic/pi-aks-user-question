import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "**/.demo/**",
      "**/.git/**",
      "**/.trunk/**",
      "**/node_modules/**",
      "**/scripts/**",
    ],
  },
});
