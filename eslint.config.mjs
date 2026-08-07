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

// AccessScope minters are restricted to the DAL (design.md: "the only
// producers are mintAdminScope/mintResellerScope, and lint restricts
// importing them to identity/application/dal.ts"). `importNames` keeps the
// AccessScope TYPE importable everywhere — shared/db/tenant.ts and the 4.7
// repository factory need the type — while sealing the mint functions
// themselves. This restriction lives in EVERY zone below (plus a catch-all
// first), because flat config REPLACES a rule's options when two matching
// configs both set it; dal.ts is the single exception, re-declared later
// without this restriction.
const noMintersOutsideDal = {
  paths: [
    {
      name: "@/modules/identity/domain/access-scope",
      importNames: ["mintAdminScope", "mintResellerScope", "mintCustomerScope"],
      message:
        "AccessScope minters may only be imported by src/modules/identity/application/dal.ts — the DAL mints scopes from a DB-verified session row.",
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
  // Catch-all first: everywhere EXCEPT the zones below (and dal.ts, which
  // is re-declared after its zone), importing an AccessScope minter is an
  // error.
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", noMintersOutsideDal],
    },
  },
  {
    files: ["src/modules/identity/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [...noDrizzleInDomain.paths, ...noMintersOutsideDal.paths],
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
      "no-restricted-imports": [
        "error",
        {
          paths: [...noMintersOutsideDal.paths],
          patterns: [...noCatalogEntityImport.patterns],
        },
      ],
    },
  },
  // The repository factory is the sanctioned cross-module gate: it consumes
  // identity's unforgeable AccessScope and returns catalog's role-narrowed
  // repository PORT types — interfaces, not entity types, so design.md's
  // "no module imports another module's entity type" boundary is untouched.
  // Declared AFTER the identity/{application,infrastructure} zone so it
  // replaces that zone's rule for this one file (keeping the
  // AccessScope-minter restriction).
  {
    files: ["src/modules/identity/infrastructure/repository-factory.ts"],
    rules: {
      "no-restricted-imports": ["error", { paths: [...noMintersOutsideDal.paths] }],
    },
  },
  // The single sanctioned minter importer: the DAL. Declared AFTER the
  // application/infrastructure zone so it replaces that zone's rule for
  // this one file (dropping only the mint restriction, keeping the rest).
  {
    files: ["src/modules/identity/application/dal.ts"],
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
          paths: [...noDrizzleInDomain.paths, ...noMintersOutsideDal.paths],
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
      "no-restricted-imports": [
        "error",
        {
          paths: [...noMintersOutsideDal.paths],
          patterns: [...noIdentityEntityImport.patterns],
        },
      ],
    },
  },
  // Wallet gets the same two guards every other module has. Without an
  // explicit zone the new module would fall through to the catch-all, which
  // seals only the AccessScope minters — `wallet/domain` would be free to
  // import Drizzle, and the ORM would leak into the domain layer of the one
  // module that holds the money.
  {
    files: ["src/modules/wallet/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [...noDrizzleInDomain.paths, ...noMintersOutsideDal.paths],
          patterns: [
            ...noDrizzleInDomain.patterns,
            ...noIdentityEntityImport.patterns,
            ...noCatalogEntityImport.patterns,
          ],
        },
      ],
    },
  },
  // `infrastructure/` may reference identity's SCHEMA for the `created_by`
  // foreign key and its AccessScope TYPE for scoping — the same two things
  // catalog's adapters already do. Entity types stay barred.
  {
    files: ["src/modules/wallet/{application,infrastructure}/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [...noMintersOutsideDal.paths],
          patterns: [...noCatalogEntityImport.patterns],
        },
      ],
    },
  },
  // Ordering gets the same guards. Its `infrastructure/` legitimately
  // references catalog, identity and wallet SCHEMAS for its four foreign
  // keys — DDL is where foreign keys are declared — while entity types stay
  // barred from `domain/`.
  {
    files: ["src/modules/ordering/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [...noDrizzleInDomain.paths, ...noMintersOutsideDal.paths],
          patterns: [
            ...noDrizzleInDomain.patterns,
            ...noIdentityEntityImport.patterns,
            ...noCatalogEntityImport.patterns,
          ],
        },
      ],
    },
  },
  {
    files: ["src/modules/ordering/{application,infrastructure}/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { paths: [...noMintersOutsideDal.paths] }],
    },
  },
  // Provider-accounts gets the same guards as wallet (design.md "Decision:
  // provider-accounts is its own module"). `domain/` bars Drizzle plus
  // catalog's and identity's entity types; `infrastructure/` legitimately
  // references catalog's and identity's SCHEMAS (the `service_id` and
  // `created_by` foreign keys) via relative imports, which these `@/`-alias
  // patterns do not match at all — entity types stay barred everywhere else.
  {
    files: ["src/modules/provider-accounts/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [...noDrizzleInDomain.paths, ...noMintersOutsideDal.paths],
          patterns: [
            ...noDrizzleInDomain.patterns,
            ...noIdentityEntityImport.patterns,
            ...noCatalogEntityImport.patterns,
          ],
        },
      ],
    },
  },
  {
    files: ["src/modules/provider-accounts/{application,infrastructure}/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [...noMintersOutsideDal.paths],
          patterns: [...noCatalogEntityImport.patterns],
        },
      ],
    },
  },
  // Test files are the second sanctioned AccessScope minting site: the
  // minters' "dal.ts only" seal protects PRODUCTION code paths from forging
  // scopes, but the isolation contract suite (4.8) and the reseller-surface
  // suite (4.9) must mint REAL scopes at runtime to exercise
  // `factory.for(scope)` and the scoped adapters. Because flat config
  // REPLACES a rule's options when two matching configs both set it, this
  // LAST zone drops every import restriction for tests — they may cross
  // module boundaries and import drizzle freely; every production zone
  // above is untouched.
  {
    files: ["tests/**/*.{ts,tsx}", "**/*.{test,spec}.{ts,tsx}"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
]);

export default eslintConfig;
