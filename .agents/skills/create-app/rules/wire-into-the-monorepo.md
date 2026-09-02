---
title: Wire the App Into the Monorepo
impact: HIGH
tags: [apps, tooling, tsconfig, workspaces]
---

# Wire the App Into the Monorepo

A new app is a Bun workspace under `apps/*`, and the repo's tooling reaches it through
five conventions. Miss one and the app looks fine locally while being invisible to, or
rejected by, the checks CI runs.

## Why

- **`vp check` type-checks whatever the workspace tsconfig includes.** An app whose
  tsconfig does not extend the root one gets a different `jsxImportSource`, different
  `types`, and a different module resolution than every other workspace.
- **An app with no Vitest project runs no tests, and says nothing.** `vp test run` collects
  only what a project's `include` matches, so a `*.test.ts` in an unregistered app is not
  reported as skipped — it is not seen. A guaranteed-failing test placed in an app that was
  missing from `test.projects` left the suite at exit 0.
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
	"include": ["app/**/*", "bootstrap/**/*", "routes/**/*"],
	"compilerOptions": { "noEmit": true, "paths": { "~/app/*": ["./app/*"] } }
}
```

Copy the `include` and `types` from a sibling app rather than deciding them per app.

### Register the app as a Vitest project

Add an entry to `test.projects` in the root `vite.config.ts`. This is the step with no
feedback when you skip it, so do it when the app is created, not when its first test is.

```ts
{
	// Rooted at the app so its own tsconfig supplies the `~/*` aliases and `jsxImportSource`,
	// which a root-rooted run cannot see.
	root: "apps/team-ops",
	plugins: [cloudflareWorkersStub()],
	resolve: { tsconfigPaths: true },
	test: {
		name: "team-ops",
		include: ["**/*.test.ts?(x)"],
		pool: "threads",
		// A project does not inherit a `testTimeout` set beside `projects`; without this the
		// 5s default applies, and the slowest files spend ~4s on migrations first.
		testTimeout: 20_000,
	},
}
```

Drop `cloudflareWorkersStub()` only if nothing in the app imports `cloudflare:workers`.
Then confirm the project is live — a new name in the list is the proof:

```bash
vp test run --project team-ops
```

### Take shared packages as `workspace:*`

```json
"dependencies": {
	"@pkg/result": "workspace:*",
	"@pkg/logger": "workspace:*",
	"remix": "3.0.0-rc.1"
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
bun run test
```

Tests run from the repo root, never from the app directory. `vp test run <path>` scopes a
run while iterating without changing directory.

## Rules

1. Extend `../../tsconfig.json`; never write a standalone compiler config
2. Add the app to `test.projects` in the root `vite.config.ts`, and verify with `vp test run --project <name>`
3. Declare every `@pkg/*` the app imports, as `workspace:*`
4. Keep `*.test.ts` inside the tsconfig `include` — no test exclude
5. Add lint or format exceptions to `lint.overrides` / `fmt.overrides` in the root `vite.config.ts`, never as a file in the app
6. Run `vp check` and `bun run test` from the repo root
