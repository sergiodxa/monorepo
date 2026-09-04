---
title: The `exports` Map Is the Public Surface
impact: HIGH
tags: [packages, structure, exports]
---

# The `exports` Map Is the Public Surface

A package has no `main`, no `types`, and no `files`. `exports` points straight at
TypeScript source — the release script compiles a published package into `dist/` and
rewrites these targets in the generated manifest — and it is the complete list of import
paths a consumer may write. Everything under `src/` that is not named in the map is internal.

## Why

- **Source-pointing exports mean no drift between what is tested and what is imported.**
  The workspace consumer resolves `./src/index.ts`, the test imports `./index.js`,
  `vp check` type-checks both, and the published `dist/` is emitted from that same source
  at release time.
- **An `exports` map with one entry per file is not a surface, it is a directory
  listing.** Deliberate entries are what let a package reorganize `src/` without breaking
  a consumer.
- **Subpath entries carry meaning.** `@sdxc/logger/middleware` says "this is the middleware
  form" at the import site, which a named export off the root does not.

## Pattern

### One entry point — the default

```json
"exports": {
	".": "./src/index.ts"
}
```

```text
packages/slugify/src/
├── index.ts          # the implementation, or the barrel
└── index.test.ts
```

### Several entry points, one per distinct surface

```json
"exports": {
	".": "./src/index.ts",
	"./middleware": "./src/middleware.ts",
	"./request": "./src/request-logger.ts",
	"./batched": "./src/batched-logger.ts"
}
```

The key and the filename need not match — `./request` maps to `request-logger.ts` — so the
import path can read well without the file being named for the URL.

### Entry points with no root

A package that is only ever imported by subpath has no `"."` at all:

```json
"exports": {
	"./content-type": "./src/content-type.ts",
	"./status-code": "./src/status-code.ts",
	"./response/json": "./src/response/json.ts",
	"./middleware/head-requests": "./src/middleware/head-requests.ts"
}
```

### Wildcards, for a large catalog

```json
"exports": {
	".": "./src/index.ts",
	"./layout": "./src/layout/index.ts",
	"./layout/*": "./src/layout/*.ts",
	"./theme.css": "./src/theme.css"
}
```

A `.css` file is exported the same way and imported by consumers as
`@sdxc/ui/theme.css?url`.

### `src/` layout

```text
packages/result/src/
├── index.ts          # re-export barrel, explicit, no `export *`
├── types.ts
├── success.ts        ├── success.test.ts
├── failure.ts        ├── failure.test.ts
└── …                 └── …
```

One concept per file, its test beside it, and a barrel that names what it re-exports:

```ts
// Bad: `export *` — the surface changes whenever a file grows an export
export * from "./success.js";

// Good: explicit, and type exports separated from value exports
export type { Success, Failure, Result } from "./types.js";
export { success } from "./success.js";
export { failure } from "./failure.js";
```

Type-only imports and value imports are always separate statements — never
`import { type Schema, object } from …`.

Nest a subdirectory when a group of files is one topic (`src/response/`,
`src/middleware/`), and give the group an `index.ts` if it has a subpath entry.

## Rules

1. `exports` points at `./src/*.ts` source; no `main`, `types`, `files`, or build step
2. Add a subpath entry when a surface is genuinely distinct, not once per file
3. A package imported only by subpath needs no `"."` entry
4. Barrel files re-export explicitly; no `export *`
5. Keep type imports and value imports in separate statements
6. Colocate `*.test.ts` with the module it covers
