import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      // `server-only` is a build-time tripwire: its package exports throw the
      // moment a client bundle imports it. Vitest resolves the browser
      // condition (environment: "jsdom"), so it throws for server modules too
      // — a module marking itself server-only would become untestable, which
      // is the opposite of what the marker is for. Next enforces the real
      // boundary at build time; here the import is a no-op.
      "server-only": new URL("./tests/support/server-only-stub.ts", import.meta.url).pathname,
    },
  },
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
    // Same reason, applied to the hooks that actually pay the boot cost:
    // every PGlite suite creates its instance in `beforeEach`, and
    // `hookTimeout` does NOT inherit from `testTimeout` — it stays at 10s.
    // Slice 5b added three more PGlite-booting suites (session verifier,
    // login, admin deactivation), and the extra parallel pressure started
    // timing out cold boots in hooks while every assertion still passed.
    hookTimeout: 20_000,
  },
});
