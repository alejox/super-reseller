import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// EB: Domain Layer Has No ORM Dependency — domain/ never imports Drizzle or
// a generated schema type, in either module.
const noDrizzleInDomain = {
  paths: [
    {
      name: "drizzle-orm",
      message:
        "domain/ must not import Drizzle (EB: Domain Layer Has No ORM Dependency).",
    },
    {
      name: "@/shared/db",
      message:
        "domain/ must not import shared/db (Drizzle-backed) — only shared/money is allowed.",
    },
  ],
  patterns: [
    {
      group: ["drizzle-orm/*", "@/shared/db/*"],
      message:
        "domain/ must not import Drizzle or generated schema types (EB: Domain Layer Has No ORM Dependency).",
    },
  ],
};

// Cross-module references are by id only — no module imports another
// module's entity type (design.md: "Technical Approach").
const noCatalogEntityImport = {
  patterns: [
    {
      group: ["@/modules/catalog/*", "@/modules/catalog"],
      message:
        "identity/ must not import catalog's entity types — reference by id only.",
    },
  ],
};

const noIdentityEntityImport = {
  patterns: [
    {
      group: ["@/modules/identity/*", "@/modules/identity"],
      message:
        "catalog/ must not import identity's entity types — reference by id only.",
    },
  ],
};

// NOTE: each files-glob below is mutually exclusive by design. ESLint flat
// config REPLACES (not merges) a rule's options when two matching configs
// both set the same rule name — a `domain/**` zone and a broader
// `identity/**` zone that both set `no-restricted-imports` would silently
// drop one of the two restrictions. Keeping domain vs. non-domain zones
// disjoint avoids that trap.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: ["src/modules/identity/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [...noDrizzleInDomain.paths],
          patterns: [
            ...noDrizzleInDomain.patterns,
            ...noCatalogEntityImport.patterns,
          ],
        },
      ],
    },
  },
  {
    files: [
      "src/modules/identity/{application,infrastructure}/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": ["error", noCatalogEntityImport],
    },
  },
  {
    files: ["src/modules/catalog/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [...noDrizzleInDomain.paths],
          patterns: [
            ...noDrizzleInDomain.patterns,
            ...noIdentityEntityImport.patterns,
          ],
        },
      ],
    },
  },
  {
    files: ["src/modules/catalog/{application,infrastructure}/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", noIdentityEntityImport],
    },
  },
]);

export default eslintConfig;
