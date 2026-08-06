/**
 * Test-time stand-in for the `server-only` package (aliased in
 * vitest.config.ts).
 *
 * `import "server-only"` is a build-time assertion, not runtime behaviour: the
 * real package resolves to a module that throws under a browser condition, so
 * that bundling a server module into a client bundle fails loudly. Vitest runs
 * under jsdom and resolves that same browser condition, which would make every
 * server-only module unloadable in tests.
 *
 * Next.js still enforces the boundary where it matters — at build time. This
 * file exists so the marker does not also break the test run.
 */
export {};
