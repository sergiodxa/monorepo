---
title: Wire the Package Into the Monorepo
impact: HIGH
tags: [packages, tooling, tsconfig, workspaces]
---

# Wire the Package Into the Monorepo

A new package is a Bun workspace under `packages/*`, and the repo's tooling reaches it
through four conventions. Miss one and the package looks fine locally while being invisible
to, or rejected by, the checks CI runs.

## Why

- **`vp check` type-checks whatever the workspace tsconfig includes.** A package that does
  not extend the root config gets a different `jsxImportSource`, different `types`, and a
  different module resolution than every other workspace.
- **Test files are type-checked now.** The old package template excluded them, which is
  exactly backwards: a `*.test.ts` has to pass the same pass the source does.
- **A per-package lint or format config file makes the repo unreadable.** There is one
  file that says how anything here is checked, and it is the root `vite.config.ts`.

## Pattern

### Extend the root `tsconfig.json`

```json
// Bad — standalone, and excluding the tests the repo type-checks
{ "include": ["src/**/*"], "exclude": ["src/**/*.test.ts"] }

// Good
{
	"extends": "../../tsconfig.json",
	"include": ["src/**/*", "../../types/bun-test.d.ts"]
}
```

`../../types/bun-test.d.ts` corrects `bun-types`' async matcher chains, so
`await expect(p).rejects.toThrow()` type-checks with the `await` that Vitest will require.
Every workspace adds it to `include` rather than duplicating the declaration.

Add `compilerOptions` only to override something specific:

```json
// packages/cloudflare-mocks/tsconfig.json — builds Workers test doubles
{
	"extends": "../../tsconfig.json",
	"include": ["src/**/*", "../../types/bun-test.d.ts"],
	"compilerOptions": { "types": ["@cloudflare/workers-types", "bun"] }
}
```

### Take shared packages as `workspace:*`

```json
"dependencies": {
	"@pkg/result": "workspace:*",
	"remix": "3.0.0-beta.6"
}
```

Never a version range for a `@pkg/*`, and never an import of a package the manifest does
not list — it resolves through the root `node_modules` today and breaks the moment its
real dependent drops it. A package used only by the tests goes in `devDependencies`.

### Put lint and format exceptions in the root `vite.config.ts`

```ts
// Bad: packages/slugify/.oxlintrc.json
// Good: root vite.config.ts
lint: {
	overrides: [{ files: ["packages/slugify/**"], rules: { "unicorn/no-null": "allow" } }];
}
```

`fmt.overrides` works the same way. There are no `.oxlintrc.json` / `.oxfmtrc.json` files
in this repo, and adding one is the exception being asked for, not the fix.

### Then run the checks from the root

```bash
bun install
vp check                          # or `bun check`; `bun check:fix` applies autofixes
vp lint packages/slugify          # scope a check to one workspace while iterating
bun run test                      # the whole suite, from the repo root
vp test run packages/slugify      # a single scope, still from the root
```

A package needs no entry in `test.projects`: one Vitest project covers them all through
`packages/*/src/**/*.test.ts?(x)`, because no package uses a `~/*` alias or ships its own
Vite config. Keep tests under `src/` — that glob is what collects them, and a test outside
it is not reported as skipped, it is never seen. Apps are the opposite case and each need
their own project entry.

## Rules

1. Extend `../../tsconfig.json`; never write a standalone compiler config
2. Include `../../types/bun-test.d.ts`, and never add an `exclude` for test files
3. Declare every dependency the package imports; `@pkg/*` as `workspace:*`, test-only ones under `devDependencies`
4. Add lint or format exceptions to `lint.overrides` / `fmt.overrides` in the root `vite.config.ts`, never as a file in the package
5. Keep tests under `src/`, so the packages Vitest project collects them
6. Run `vp check` and `bun run test` from the repo root
