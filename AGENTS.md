# Agents Guidelines

This monorepo contains multiple applications in `apps/` and shared packages in `packages/`.

## Commands

Global commands to run from the repository root using Bun.

Static checks run through Vite+ (`vp`), configured entirely in the root `vite.config.ts`.
There are no `.oxlintrc.json` / `.oxfmtrc.json` files: per-package settings go in that file's
`lint.overrides` / `fmt.overrides` so one file describes how anything in the repo is checked.

```bash
bun check                       # Format, lint and type check in one pass. Runs through Vite
                                 # Task, so a re-run with nothing changed replays from a
                                 # content-based cache in ~250ms instead of ~9s. This is the
                                 # one to run before a commit; CI runs exactly this.
bun check:fix                   # Same, applying formatting and autofixes
bun format                      # Check formatting only (oxfmt)
bun format:fix                  # Fix formatting
bun lint                        # Check linting only (oxlint)
bun lint:fix                    # Fix linting issues
bun typecheck                   # Type check only, via the Oxlint type-aware path (tsgolint)
bun run test                    # Run every test, all of them under Vitest (`vp test run`).
                                 # CI runs exactly this.
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

A test that would otherwise stand in for a Cloudflare binding belongs in the Workers pool
instead: name it `*.workers.test.ts` and it runs inside workerd with real bindings, taken from
the app's own `wrangler.jsonc` (or, for a package, declared inline in the `packages-workers`
project). That is how a KV, D1 or R2 assertion gets checked against Cloudflare's implementation
rather than a hand-written stub — which is what caught `@sdxc/kv-cache` asserting a 30-second KV
TTL that a real binding rejects. `node:sqlite` does not exist in workerd, so a test whose
database comes from `@sdxc/cloudflare-mocks/sqlite` stays on the threads pool.

Nothing runs under `bun test` any more. Where a test needs a Bun-only API — `packages/spec`'s
`db` plugin connects through Bun's built-in SQL client, which has no Node equivalent — the
scenario runs in a Bun child process that reports what it observed as JSON, and the
expectations stay in the Vitest file. `db-e2e-probe.ts` beside `db.test.ts` is the pattern:
the probe records, the test asserts, so a failure names the expectation rather than a
subprocess exit code.

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
- MUST follow Conventional Commits for commit messages, with the workspace directory name as the scope (`feat(jwt): …`, `fix(uptime): …`)
- MUST keep every commit inside one package or one app (root and `docs/` files may ride along); a change that spans two workspaces is two commits. Release notes are built from the commits that touch a package, so a cross-workspace commit shows up under every package it touched. Dependency sweeps (`chore(deps): …`) are the accepted exception
- MUST write the commit title as what changed for a consumer of that workspace, and the body (when present) as the explanation a reader of the release notes needs; both are published verbatim in the daily GitHub Release (ADR-007)
- MUST commit directly on `main`; never create a branch unless explicitly asked (other sessions commit to `main` concurrently, and an unprompted branch strands their commits)
- MUST run `bun check` at the repo root before every commit, and `bun check:fix` to apply formatting and autofixes
- MUST preserve every individual commit when merging into `main` — use a fast-forward merge (`git merge --ff-only`), never squash and never create a merge commit
- MUST use `@sdxc/result` for error handling instead of throwing exceptions
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
- MUST use `@sdxc/logger`, never `console.log`
- MUST log through the invocation's log — `ctx.log` in route handlers and job handlers, `currentLog()` anywhere else — and never construct a logger per request; the worker configures one `createLogger()` and attaches it with `log(logger)` at the top of the router's middleware chain and as the job dispatcher's `logger` option (ADR-033)
- MUST use `@sdxc/jobs` for background jobs
- MUST validate external/untrusted data (loaders, actions, webhooks, env-derived input) with `remix/data-schema` via `@sdxc/validate`; do not add Zod to new code
- MUST use `const` only for module-level variables, and `let` for everything else, never use `const` for local variables inside functions or blocks
- MUST name module-level constant values in `ALL_UPPER_SNAKE_CASE` (e.g. `FIXED_STEP_MS`, `TYPE_MATCHUPS`, `PERSISTENT_WORLD_STORE_KEYS`); module-level functions stay `camelCase` and classes/namespaces/enums stay `PascalCase`
- MUST use `interface` when possible, and `type` only when necessary (e.g. for union types)
- MUST import `env` from `cloudflare:workers` and never from `process.env` or other sources
- MUST extend root `tsconfig.json` in all packages and applications
- MUST add a new app's formatting or lint exceptions to `fmt.overrides` / `lint.overrides` in the root `vite.config.ts`, never as a per-package config file
- MUST register every new app as a Vitest project in the root `vite.config.ts` and verify it with `vp test run --project <name>`; an app missing from `test.projects` collects none of its tests and still exits 0. Packages need no entry — one project covers `packages/*/src/**/*.test.ts?(x)`, so keep package tests under `src/`
- MUST add new rules to this document when necessary, and update existing ones if they become outdated or need clarification
- MUST follow the guidelines in this document, and suggest improvements when necessary
- MUST use `bunx` instead of `npx`, or any other package runner, to ensure consistent behavior across environments
- MUST use namespaces for types only; no runtime values, functions, or classes inside namespaces.
- MUST check what Remix v3 provides before hand-rolling middleware/helpers — prefer `remix/cop-middleware`, `remix/session-middleware`, `createAction`/`createController`, `remix/data-schema`, `remix/auth`, and `remix/ui` over custom equivalents
- MUST resolve app services (Database, API clients) through `@sdxc/service-container` (ADR-008) via `inject([...])` / `getServiceContainer()`; keep request-lifecycle values (session, current user, tenant, the invocation's log) in middleware/context, never in the container
- MUST render server HTML as `remix/ui` JSX with `css()` mixins; never build HTML from strings (`remix/html-template` or inline HTML template literals)
- MUST build application UI with `remix/ui`, not React components/hooks or Tailwind utility classes; style with `css()` mixins through `mix`, and attach behavior with Remix UI mixins or native HTML platform features
- MUST build dialogs, popovers, menus, tooltips, and disclosure UI with native HTML platform features instead of JavaScript: `<dialog>` (with `.showModal()`/`::backdrop`) for modals, the Popover API (`popover` + `popovertarget` attributes) for popovers/menus/tooltips, the Command Invoker API (`<button commandfor command>` with `command="show-modal"`/`"close"`/`"toggle-popover"`/`"show-popover"`/`"hide-popover"` or `command="--custom"` handled via the `command` event) to wire buttons to targets declaratively, and `<details>`/`<summary>` for disclosures — reach for JS only for behavior the platform genuinely cannot express, and prefer progressive enhancement over JS-driven open/close state
- MUST call the global `fetch` directly; never add an injectable fetch parameter (e.g. `fetchImpl: typeof fetch = fetch`)
- MUST describe code on its own terms in comments; never name another app or package as the source of a pattern (e.g. "mirrors the blog app")
- MUST keep `packages/*` app-agnostic: no imports from, or references to, `apps/*` in code or comments
- MUST keep public blog content package-agnostic: articles and tutorials must not mention internal package names, `@sdxc/*` imports, or `packages/*` paths; use public APIs or local example modules instead
- MUST write Remix tutorials with Remix v3 route contracts, controllers, middleware context, `remix/data-schema`, and `remix/ui`; do not use React Router route-module exports, `Route.*` types, `useLoaderData`, `useActionData`, React hooks, or top-level `remix` imports unless the post is explicitly about React or legacy React Router

### Publishing

Public packages ship to npm under the `@sdxc` scope through the daily release described in
[ADR-007](./docs/adr/ADR-007-publishable-package-releases.md): the commits since the previous
release decide which packages changed, every dependent of a changed package republishes with a
new exact pin, and the version is the UTC date of the run (`2026.9.4`). `bun run release` is a
dry run of exactly what the workflow does; `bun run release --publish` performs it.

- MUST write every relative import inside `packages/*` with its `.js` extension (`from "./parse.js"`), tests included; `test/import-extensions.test.ts` fails on any other form, because emitted JavaScript keeps specifiers verbatim and Node resolves only the extension form
- MUST keep `version` in every `package.json` as the `0.0.1` placeholder; the release writes the dated version into the generated publish manifest only, and nothing in the repo reads the field
- MUST keep a package `private: true` while it only runs under Vite (a `?raw` import, for example) or while its public surface is still moving; remove the flag only when the package is meant for npm consumers
- MUST, to make a package public: remove `private: true`, add a `description` (taken from the package README, per ADR-017) and a `LICENSE.md`, mark its row in the root README package table with ✅ in the untitled last column, make every package it depends on public first (`test/public-packages.test.ts` names each private dependency it reaches), run `bun run release:bootstrap @sdxc/<name>` from a developer machine so the package exists on npm as `0.0.0-pre.1` under the `alpha` tag (the registry also points `latest` at a first publish; the first dated release moves it), then configure its trusted publisher on npmjs.com (GitHub Actions, `sergiodxa/monorepo`, workflow `release.yml`); the next daily run publishes the dated version
- MUST keep the `npm` entry beside Bun in the root `devEngines.packageManager`; it is what lets `npm login`, `npm whoami`, `npm view` and the release script's registry reads run inside the repo, while `bun install` stays the only way to install

### Documentation

Comments are JSDoc, and a comment earns its place by answering **why**: the symbol's
name already says _what_ it is, and the code already says _how_ it works. Before writing
one, ask what a reader cannot recover from the name and the code — a constraint, a
guarantee, an invariant, an ordering requirement, a consequence, a deliberately handled
edge case. If the answer is nothing, write nothing.

- MUST start every module (every file) under `apps/` and `packages/` with a module-level JSDoc comment at the very top of the file, describing in ~3 lines what the module is, what it does, and why it exists, followed by `@author` and `@copyright` tags, using this exact style:

  ```
  /**
   * <what the module is, what it does, and why it exists — ~3 lines>
   *
   * @author [Sergio Xalambrí](https://sergiodxa.com)
   * @copyright Sergio Xalambrí 2026
   */
  ```

  The whole block stays within 10 lines, tag lines included. When a `#!` shebang must be first, place the block immediately after it.

- MUST write every comment as a JSDoc block (`/** … */`) attached to a symbol — never `//` line comments or plain `/* … */` blocks, inside function bodies included. When a step inside a function seems to need narration, the comment is describing WHAT/HOW: either the step is obvious and needs no comment, the reason belongs in the enclosing symbol's JSDoc, or the step deserves extraction into a named, documented function.
- MUST keep tooling directives as the only non-JSDoc comments: `@ts-expect-error`, `@ts-ignore`, `@ts-nocheck`, `oxlint-disable(-next-line)`, `biome-ignore`, `eslint-disable(-next-line)`, `prettier-ignore`, `/// <reference … />`, `@jsxImportSource`, `@vitest-environment`, coverage markers (`v8 ignore`, `c8 ignore`, `istanbul ignore`), and `#__PURE__`. Keep them verbatim — including the `-- reason` text oxlint requires — on the line directly above what they suppress.
- MUST write JSDoc comments for every exported class, function, method, variable, type, interface, and constant in this app or package.
- MUST write JSDoc comments for non-exported, non-private module symbols when they are part of a file's behavior contract (helpers, mappers, normalizers, comparators, etc.).
- MUST write JSDoc comments for every non-private member of exported classes (including static members, instance methods, getters/setters, and constructor when present).
- MUST write JSDoc comments for inline controller callbacks (middleware callbacks, action handlers, and route handlers) inside controller definitions.
- MUST make JSDoc state the why — intent, contract, guarantee, non-obvious invariant (fallbacks, ordering assumptions, publish/preview semantics, normalization rules, nullability contracts, redirect/404 behavior) — never the export mechanics ("Exports the module default value.") and never a re-reading of the signature or the code below it.
- MUST phrase comments affirmatively: describe what the code is, does, and guarantees — never what it is not, does not do, or deliberately avoids ("this is not cached", "unlike the sync version", "rather than using X"). When the point is an absence, state its positive consequence instead ("callers receive a freshly computed value on every call").
- MUST NOT document a symbol in terms of how it was built — the base class it extends, that base's types or behavior, the behavior it inherits or overrides, the alternative the author weighed; the reader is a caller who sees only this symbol. Write the contract they can rely on and stop there: `IdToken.subject` earns "OpenID Connect requires `sub` in an ID token", and drops "so the base class's `string | null` would put a null check at every call site".
- MUST keep a symbol JSDoc description within 3 prose lines; tag sections (`@param`, `@returns`, `@throws`, `@example`, `@template`, `@see`, `@deprecated`, `@default`) do not count toward the limit. Cut to the load-bearing why rather than wrapping tighter.
- MUST keep JSDoc examples hyper-focused and inline (no fenced Markdown code blocks inside `@example`).

- MAY include JSDoc `@param` tags with concise descriptions for each parameter when there are parameters.
- MAY include JSDoc `@returns` tags with concise descriptions when there's a return value.
- MAY include JSDoc `@template` tags with concise descriptions when there are generic type parameters.
- MAY include up to 3 JSDoc `@example` tags for practical usage snippets.

- SHOULD use `@param` and `@returns` on handlers/repository methods where request context, side effects, or response contracts are not obvious.
- SHOULD document edge-case behavior (empty inputs, invalid params, missing records, legacy data shapes) when a symbol intentionally handles those cases.
- SHOULD add `@yields` to a generator function's JSDoc — `jsdoc/require-yields` flags a documented generator without one.

- MUST use `@default` for default values, never `@defaultValue` — oxlint's `jsdoc/check-tag-names` rejects the latter.
- MUST NOT use placeholder or template wording in JSDoc (for example: "Defines ...", "Represents ...", or "Handles ..." without meaningful contract detail).
- MUST NOT duplicate type names or signatures in prose when that adds no new information.
- MUST NOT restate a symbol's name as its documentation — `/** Parent post id. */ post_id: string` says nothing the name doesn't; a self-evident field or local symbol carries no comment at all. When an exported symbol genuinely has no why beyond its name, state its contract or guarantee concisely instead of padding.

### Testing

- MUST back database tests with an in-memory adapter from `@sdxc/cloudflare-mocks/sqlite` that mirrors the production adapter, rather than mocking the query layer; that module absorbs the four ways `node:sqlite` diverges from `bun:sqlite`, so never re-fix those in app code
- MUST mock outbound HTTP with MSW (`setupServer` from `msw/node`) in tests; never stub `globalThis.fetch` or inject a fake
- MUST NOT hand-write a fake for a Cloudflare binding (`as unknown as KVNamespace` and the like). Name the file `*.workers.test.ts` and use the real binding from `cloudflare:test`; a fake diverges silently, and every one this repo had stubbed `list()` to an empty result
- MUST let the `cloudflareWorkersStub()` plugin supply `env`/bindings — it is on every project whose workspace uses Cloudflare bindings, so a test importing `cloudflare:workers` needs no mock of its own; reach for `vi.doMock` + `await import(...)` only to replace a module before the subject loads
- MUST keep `*.test.ts` files type-safe: they are included in typechecking, so every test file must pass `bun typecheck`
- MUST add a regression test for every bug fixed: a test that fails against the old (buggy) behavior and passes with the fix, kept alongside the module's other tests, so the bug can never silently return

### Data & transactions

- `db.transaction()` is atomic only on `@sdxc/data-table-sqlstorage` (Durable Object SQLite). `@sdxc/data-table-d1` has no interactive transactions, so any multi-step mutation that may run on D1 MUST be written D1-safe (single-statement/upsert or compensating operations)
- MUST isolate per-tenant caches by keying them on the tenant's `Database` instance, so one tenant's data can never leak to another
- MUST keep every migration chain applicable to an empty database, since that is how a new tenant is provisioned — `test/migration-replay.test.ts` replays each chain with SQLite's double-quoted string literals disabled and fails on anything new. Never `ALTER TABLE ADD COLUMN` for a column an earlier migration already creates, and when a table rebuild renames a column, the `SELECT` must read the **old** name: with DQS on, as the adapters run, `"new_name"` silently evaluates to the string `'new_name'` for every row instead of failing

### Security

- MUST verify OIDC ID tokens (JWKS signature plus `iss`/`aud`/`exp`/`nonce`) before trusting any claim
- MUST verify inbound webhook signatures and fail closed when the signing secret is missing or unset
- MUST enforce authorization/entitlement at the runtime boundary that actually receives the traffic (e.g. the tenant Durable Object, since `cf.hostMetadata` bypasses the control-plane database), not only in the control plane
