---
title: Wire the App Into the Monorepo
impact: HIGH
tags: [apps, tooling, tsconfig, workspaces]
---

# Wire the App Into the Monorepo

A new app is a Bun workspace under `apps/*`, and the repo's tooling reaches it through
four conventions. Miss one and the app looks fine locally while being invisible to, or
rejected by, the checks CI runs.

## Why

- **`vp check` type-checks whatever the workspace tsconfig includes.** An app whose
  tsconfig does not extend the root one gets a different `jsxImportSource`, different
  `types`, and a different module resolution than every other workspace — and it is the
  root tsconfig that Bun reads when `bun test` runs from the repo root.
- **Test files are type-checked now.** They are not excluded anywhere, so a `*.test.ts`
  with a loose `as any` fails the same pass the source does.
- **A per-package lint or format config file makes the repo unreadable.** There is one
  file that says how anything here is checked, and it is the root `vite.config.ts`.

## Pattern

### Extend the root `tsconfig.json`

```json
// Bad — a standalone config; different JSX runtime, different types, silent drift
{ "compilerOptions": { "jsx": "react-jsx", "strict": true } }

// Good
{
	"extends": "../../tsconfig.json",
	"include": ["app/**/*", "bootstrap/**/*", "routes/**/*", "../../types/bun-test.d.ts"],
	"compilerOptions": { "noEmit": true, "paths": { "~/app/*": ["./app/*"] } }
}
```

`../../types/bun-test.d.ts` corrects the `bun:test` async matcher chains. Every workspace
that writes `await expect(p).rejects.toThrow()` adds it to `include`, rather than
duplicating the declaration.

### Take shared packages as `workspace:*`

```json
"dependencies": {
	"@pkg/result": "workspace:*",
	"@pkg/logger": "workspace:*",
	"remix": "3.0.0-beta.6"
}
```

Never a version range for a `@pkg/*`, and never an import of a package the manifest does
not list — it resolves through the root `node_modules` today and breaks the moment the
other app drops it.

### Keep test files inside the include

`*.test.ts` files sit next to the module they cover and are covered by the same
`app/**/*` glob. Do not add an `exclude` for them.

```json
// Bad — the pattern the old package template shipped
{ "include": ["src/**/*"], "exclude": ["src/**/*.test.ts"] }
```

### Put lint and format exceptions in the root `vite.config.ts`

```ts
// Bad: apps/team-ops/.oxlintrc.json
// Good: root vite.config.ts
lint: {
	overrides: [{ files: ["apps/team-ops/**"], rules: { "jsx_a11y/alt-text": "allow" } }];
}
```

`fmt.overrides` works the same way. There are no `.oxlintrc.json` / `.oxfmtrc.json` files
in this repo, and adding one is the exception being asked for, not the fix.

### Then run the checks from the root

```bash
bun install
vp check          # or `bun check`; `bun check:fix` applies formatting and autofixes
bun test --isolate
```

Tests run from the repo root, never from the app directory: `--isolate` is what keeps one
file's `mock.module()` out of every file that runs after it.

## Rules

1. Extend `../../tsconfig.json`; never write a standalone compiler config
2. Declare every `@pkg/*` the app imports, as `workspace:*`
3. Include `../../types/bun-test.d.ts` and keep `*.test.ts` inside the include — no test exclude
4. Add lint or format exceptions to `lint.overrides` / `fmt.overrides` in the root `vite.config.ts`, never as a file in the app
5. Run `vp check` and `bun test --isolate` from the repo root
