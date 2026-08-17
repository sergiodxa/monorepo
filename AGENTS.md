# Agents Guidelines

This monorepo contains multiple applications in `apps/` and shared packages in `packages/`.

## Commands

Global commands to run from the repository root using Bun.

Static checks run through Vite+ (`vp`), configured entirely in the root `vite.config.ts`.
There are no `.oxlintrc.json` / `.oxfmtrc.json` files: per-package settings go in that file's
`lint.overrides` / `fmt.overrides` so one file describes how anything in the repo is checked.

```bash
bun check                       # Format, lint and type check in one pass (~8s). This is the
                                 # one to run before a commit; CI runs exactly this.
bun check:fix                   # Same, applying formatting and autofixes
bun format                      # Check formatting only (oxfmt)
bun format:fix                  # Fix formatting
bun lint                        # Check linting only (oxlint)
bun lint:fix                    # Fix linting issues
bun typecheck                   # Type check only, via the Oxlint type-aware path (tsgolint)
bun run test                    # Run every test: Vitest for the whole repo, then the one
                                 # remaining bun file. CI runs exactly this.
bun run test:vitest             # Vitest only (`vp test run`)
bun run test:bun                # The single bun file only
vp test run <path>              # Scope Vitest to a path while iterating
vp test watch                   # Watch mode
vp lint <path>                  # Scope a static check to one workspace while iterating
```

Tests run under Vitest, configured as one project per app plus one covering every package
in the root `vite.config.ts`. Each app gets its own project so the app's own tsconfig supplies
its `~/*` aliases and `jsxImportSource`, which a root-rooted run cannot see. Use `vi.doMock` +
`await import(...)` where a test needs to replace a module before the subject loads; a second
`vi.doMock` for the same specifier in one file has no effect, because the second dynamic import
resolves to the instance already in the registry.

`packages/spec/src/plugins/db.test.ts` is the one file still on `bun:test`. Its end-to-end block
connects through Bun's built-in SQL client, which has no Node equivalent, so it keeps its own
runner rather than losing the coverage.

`bun typecheck` no longer shells out to `tsc` per workspace. It runs the same type-aware pass
`vp check` does, which covers every file the workspace's tsconfig includes — test files
included. `tsc --noEmit` still works inside a package when you want a second opinion; the two
agree except for compound-component expando assignments, which tsgolint does not model.

Local commands to run from the app directory (e.g. `apps/blog`):

```bash
bun dev                         # Run dev server
bun build                       # Build for production
bun db:local:migrate            # Apply migrations locally
bun db:remote:migrate           # Apply migrations to production
bun cf:typegen                  # Generate TypeScript types for Cloudflare Workers bindings
```

## Rules

- MUST use Bun to install dependencies and run scripts; tests execute through Vite+ (`vp test`)
- MUST follow Conventional Commits for commit messages
- MUST commit directly on `main`; never create a branch unless explicitly asked (other sessions commit to `main` concurrently, and an unprompted branch strands their commits)
- MUST run `bun check` at the repo root before every commit, and `bun check:fix` to apply formatting and autofixes
- MUST preserve every individual commit when merging into `main` — use a fast-forward merge (`git merge --ff-only`), never squash and never create a merge commit
- MUST use `@pkg/result` for error handling instead of throwing exceptions
- MUST write tests with Vitest, never Jest, Mocha, or Node's built-in `assert` module
- MUST run tests from the root of the repository, never from individual package directories — `vp test run <path>` scopes a run without changing directory
- MUST use Vite+ (`vp check`) for formatting, linting and type checking, never other tools like Prettier, ESLint or a direct `tsc` run in CI
- MUST apply migrations using `bun run db:local:migrate` or `bun run db:remote:migrate`, never invoking `wrangler d1 migrations` directly
- MUST write documentation for each shared package, following [](./docs/guides/package-documentation.md) as guidelines
- MUST write documentation for each application, following [](./docs/guides/app-documentation.md) as guidelines
- MUST write an ADR for any significant architectural decisions, following [](./docs/guides/adr-writing.md) as guidelines
- MUST write a short ADR whenever the user corrects an agent about the architecture of the repo or of a specific app/package, documenting the corrected decision so the mistake never repeats — place it in `docs/adr/` (or the app's subdirectory, e.g. `docs/adr/<app>/`, when scoped to one app) and follow [](./docs/guides/adr-writing.md)
- MUST `build`, `migrate` and `deploy` applications when necessary, in that order, may skip migration if not application
- MUST build before migrate, so deploy can be done in a single step after migration, without extra waiting time for build
- MUST deploy after migration, to ensure the latest code is running with the new database schema
- MUST NOT deploy before migration, to avoid running old code with an incompatible database schema
- MUST use `bunx wrangler` when running commands, never use `wrangler` directly
- MUST use `@pkg/logger`, never `console.log`
- MUST use RequestLogger for logging inside worker fetch handlers
- MUST use `@pkg/jobs` for background jobs
- MUST validate external/untrusted data (loaders, actions, webhooks, env-derived input) with `remix/data-schema` via `@pkg/validate`; do not add Zod to new code
- MUST use `const` only for module-level variables, and `let` for everything else, never use `const` for local variables inside functions or blocks
- MUST name module-level constant values in `ALL_UPPER_SNAKE_CASE` (e.g. `FIXED_STEP_MS`, `TYPE_MATCHUPS`, `PERSISTENT_WORLD_STORE_KEYS`); module-level functions stay `camelCase` and classes/namespaces/enums stay `PascalCase`
- MUST use `interface` when possible, and `type` only when necessary (e.g. for union types)
- MUST import `env` from `cloudflare:workers` and never from `process.env` or other sources
- MUST extend root `tsconfig.json` in all packages and applications
- MUST add a new app's formatting or lint exceptions to `fmt.overrides` / `lint.overrides` in the root `vite.config.ts`, never as a per-package config file
- MUST add new rules to this document when necessary, and update existing ones if they become outdated or need clarification
- MUST follow the guidelines in this document, and suggest improvements when necessary
- MUST use `bunx` instead of `npx`, or any other package runner, to ensure consistent behavior across environments
- MUST use namespaces for types only; no runtime values, functions, or classes inside namespaces.
- MUST check what Remix v3 provides before hand-rolling middleware/helpers — prefer `remix/cop-middleware`, `remix/session-middleware`, `createAction`/`createController`, `remix/data-schema`, `remix/auth`, and `remix/ui` over custom equivalents
- MUST resolve app services (Database, API clients) through `@pkg/service-container` (ADR-008) via `inject([...])` / `getServiceContainer()`; keep request-lifecycle values (session, current user, tenant, request logger) in middleware/context, never in the container
- MUST render server HTML as `remix/ui` JSX with `css()` mixins; never build HTML from strings (`remix/html-template` or inline HTML template literals)
- MUST build application UI with `remix/ui`, not React components/hooks or Tailwind utility classes; style with `css()` mixins through `mix`, and attach behavior with Remix UI mixins or native HTML platform features
- MUST build dialogs, popovers, menus, tooltips, and disclosure UI with native HTML platform features instead of JavaScript: `<dialog>` (with `.showModal()`/`::backdrop`) for modals, the Popover API (`popover` + `popovertarget` attributes) for popovers/menus/tooltips, the Command Invoker API (`<button commandfor command>` with `command="show-modal"`/`"close"`/`"toggle-popover"`/`"show-popover"`/`"hide-popover"` or `command="--custom"` handled via the `command` event) to wire buttons to targets declaratively, and `<details>`/`<summary>` for disclosures — reach for JS only for behavior the platform genuinely cannot express, and prefer progressive enhancement over JS-driven open/close state
- MUST call the global `fetch` directly; never add an injectable fetch parameter (e.g. `fetchImpl: typeof fetch = fetch`)
- MUST describe code on its own terms in comments; never name another app or package as the source of a pattern (e.g. "mirrors the blog app")
- MUST keep `packages/*` app-agnostic: no imports from, or references to, `apps/*` in code or comments
- MUST keep public blog content package-agnostic: articles and tutorials must not mention internal package names, `@pkg/*` imports, or `packages/*` paths; use public APIs or local example modules instead
- MUST write Remix tutorials with Remix v3 route contracts, controllers, middleware context, `remix/data-schema`, and `remix/ui`; do not use React Router route-module exports, `Route.*` types, `useLoaderData`, `useActionData`, React hooks, or top-level `remix` imports unless the post is explicitly about React or legacy React Router

### Documentation

- MUST start every module (every file) under `apps/` and `packages/` with a module-level JSDoc comment at the very top of the file, describing in ~3 lines what the module is, what it does, and why it exists, followed by `@author` and `@copyright` tags, using this exact style:

  ```
  /**
   * <what the module is, what it does, and why it exists — ~3 lines>
   *
   * @author [Sergio Xalambrí](https://sergiodxa.com)
   * @copyright Sergio Xalambrí 2026
   */
  ```

  When a `#!` shebang must be first, place the block immediately after it.

- MUST write JSDoc comments for every exported class, function, method, variable, type, interface, and constant in this app or package.
- MUST write JSDoc comments for non-exported, non-private module symbols when they are part of a file's behavior contract (helpers, mappers, normalizers, comparators, etc.).
- MUST write JSDoc comments for every non-private member of exported classes (including static members, instance methods, getters/setters, and constructor when present).
- MUST write JSDoc comments for inline controller callbacks (middleware callbacks, action handlers, and route handlers) inside controller definitions.
- MUST make JSDoc describe the exported symbol behavior/purpose, never the export mechanics (for example, avoid comments like "Exports the module default value.").
- MUST make JSDoc explain intent and contract (the why/guarantee), not only restate syntax or obvious code behavior.
- MUST document non-obvious behavior and invariants when relevant (fallbacks, ordering assumptions, publish/preview semantics, normalization rules, nullability contracts, redirect/404 behavior).
- MUST keep JSDoc descriptions short and focused (1 to 3 lines when a description is needed).
- MUST keep JSDoc examples hyper-focused and inline (no fenced Markdown code blocks inside `@example`).

- MAY include JSDoc `@param` tags with concise descriptions for each parameter when there are parameters.
- MAY include JSDoc `@returns` tags with concise descriptions when there's a return value.
- MAY include JSDoc `@template` tags with concise descriptions when there are generic type parameters.
- MAY include up to 3 JSDoc `@example` tags for practical usage snippets.

- SHOULD use `@param` and `@returns` on handlers/repository methods where request context, side effects, or response contracts are not obvious.
- SHOULD document edge-case behavior (empty inputs, invalid params, missing records, legacy data shapes) when a symbol intentionally handles those cases.

- MUST NOT use placeholder or template wording in JSDoc (for example: "Defines ...", "Represents ...", or "Handles ..." without meaningful contract detail).
- MUST NOT duplicate type names or signatures in prose when that adds no new information.

### Testing

- MUST back database tests with an in-memory adapter (`bun:sqlite`) that mirrors the production adapter, rather than mocking the query layer
- MUST mock outbound HTTP with MSW (`setupServer` from `msw/node`) in tests, and use `mock.module("cloudflare:workers", …)` to supply `env`/bindings; never stub `globalThis.fetch` or inject a fake
- MUST keep `*.test.ts` files type-safe: they are included in typechecking, so every test file must pass `bun typecheck`
- MUST add a regression test for every bug fixed: a test that fails against the old (buggy) behavior and passes with the fix, kept alongside the module's other tests, so the bug can never silently return

### Data & transactions

- `db.transaction()` is atomic only on `@pkg/data-table-sqlstorage` (Durable Object SQLite). `@pkg/data-table-d1` has no interactive transactions, so any multi-step mutation that may run on D1 MUST be written D1-safe (single-statement/upsert or compensating operations)
- MUST isolate per-tenant caches by keying them on the tenant's `Database` instance, so one tenant's data can never leak to another

### Security

- MUST verify OIDC ID tokens (JWKS signature plus `iss`/`aud`/`exp`/`nonce`) before trusting any claim
- MUST verify inbound webhook signatures and fail closed when the signing secret is missing or unset
- MUST enforce authorization/entitlement at the runtime boundary that actually receives the traffic (e.g. the tenant Durable Object, since `cf.hostMetadata` bypasses the control-plane database), not only in the control plane
