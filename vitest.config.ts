import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // PGlite (real Postgres in WASM) boot time compounds when several test
    // files run in parallel worker threads, each booting its own instance.
    // The default 5s timeout was fine with slice 2's single PGlite file;
    // slice 3b adds several more (contract suite x2 adapters, catalog
    // round-trip), which made cold boots under parallel load flaky, not
    // incorrect — this is I/O-bound headroom, not a hang.
    testTimeout: 20_000,
  },
});
