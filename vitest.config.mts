import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// A non-UTC zone, so code that accidentally uses local time fails instead of passing by luck.
process.env.TZ = "Pacific/Auckland";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    restoreMocks: true,
    unstubEnvs: true,
  },
});
