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
                                 # CI runs it once per app and package, as
                                 # `bun run test "$PWD/<workspace>/"`, plus `--project root`.
vp test run <path>              # Scope Vitest to a path while iterating. A relative path
                                 # matches as a substring (`packages/u` also runs `ui`,
                                 # `uuid`…); `"$PWD/packages/u/"` runs exactly that workspace
vp test watch                   # Watch mode
vp lint <path>                  # Scope a static check to one workspace while iterating
bun run doctor                  # Run `sdxc doctor` from this checkout's kit in every app; CI
                                 # runs it after typegen and fails when any app fails. Extra
                                 # flags reach every run (`bun run doctor --only migrations`)
bun run kit:reference           # Rewrite the command reference in packages/kit/README.md from
                                 # the sdxc contract; the kit's tests fail until it runs after a
                                 # command, argument or flag changes
bun run kit:registry            # Write sdxc ui's component registry into packages/kit, so a
                                 # kit run from this checkout (a global `sdxc` linked to
                                 # packages/kit/src/bin.ts) can list and copy components
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
rather than a hand-written stub — which is what caught a cache asserting a 30-second KV TTL that
a real binding rejects. `node:sqlite` does not exist in workerd, so a test whose
database comes from `@sdxc/cloudflare-mocks/sqlite` stays on the threads pool.

A test that needs a DOM runs in a real browser: name it `*.browser.test.ts(x)` and it runs in
headless Chromium through [Vitest Browser Mode](https://vitest.dev/guide/browser/), collected by
the workspace's `<name>-browser` project (`browserProject()` in the root `vite.config.ts`). That
gives it the layout, nested CSS, cascade layers and platform APIs a visitor's browser has, so a
test never stubs `CSSStyleSheet.prototype.insertRule` or a missing API to get a component to
render. Mount a component with `render()` from `remix/component/test` and assert on the live
DOM — computed styles and layout included — rather than parsing `renderToString` output; render
on the server only when the test is about server output or hydrating it with `run()`. Run
`bunx playwright install chromium` once before the first local run. Browser tests
import nothing that only runs on a server (`node:*`, `AsyncLocalStorage`, a whole app router);
a test that renders server HTML and only reads the markup stays on the threads pool and parses
it with `@sdxc/html/document`.

Nothing runs under `bun test` any more — `bunfig.toml` preloads `scripts/reject-bun-test.ts`,
so typing it prints the Vitest commands and exits rather than pointing Bun's runner at files
whose `vi` calls its shim does not implement. Where a test needs a Bun-only API —
`packages/spec`'s `db` plugin connects through Bun's built-in SQL client, which has no Node
equivalent — the scenario runs in a Bun child process that reports what it observed as JSON,
and the expectations stay in the Vitest file. `db-e2e-probe.ts` beside `db.test.ts` is the pattern:
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
sdxc run db migrate             # Apply migrations to the local database
sdxc run db migrate --remote    # Apply migrations to production
sdxc run db console             # SQL prompt over the local database
sdxc run typegen                # Generate TypeScript types for Cloudflare Workers bindings
sdxc run about                  # Print the app's name and the versions it runs on
sdxc deploy --dry-run           # Build and print the plan: pending migrations, what deploys
sdxc deploy                     # Build, migrate production, then deploy (asks first)
sdxc deploy --skip migrate      # The same for an app without a database (books, sdxc-site)
```

## Rules

- MUST use Bun to install dependencies and run scripts; tests execute through Vite+ (`vp test`)
- MUST follow Conventional Commits for commit messages, with the workspace directory name as the scope and a summary that starts with a capital letter (`feat(jwt): Add ES512 signing keys`, `fix(uptime): Retry a failed check once`); release notes print the summary without its `type(scope):` prefix, so it must read as a sentence on its own, and the `commit-msg` hook and CI reject a lowercase one (ADR-166) — including every commit on a pull-request branch, because GitHub **rebase-and-merges** PRs onto `main` and the release script publishes those subjects verbatim (ADR-007, ADR-134)
- MUST keep every commit inside one package or one app (root and `docs/` files may ride along); a change that spans two workspaces is two commits (they may share one PR under rebase-and-merge). Release notes are built from the commits that touch a package, so a cross-workspace commit shows up under every package it touched. Dependency sweeps (`chore(deps): …`) are the accepted exception
- MUST write the commit title as what changed for a consumer of that workspace, and MUST give every commit a body written as the public release note for that change: a new feature says how to use it with a short code example, a breaking change (`type(scope)!:`) lists every migration step with the code before and after, a fix states the behavior before and after and whether consumers must act, and a change with no consumer effect says so in one sentence. Write it for a reader outside the repo, using published package names and never `packages/*` paths. Titles and bodies are published verbatim in the daily GitHub Release and become the instructions `sdxc upgrade` hands an AI agent (ADR-007, ADR-140). `bun install` installs a `commit-msg` hook that rejects a commit without a body, and CI re-checks every pushed commit; a published note is corrected by a new commit (it may be `--allow-empty`) with a `Release-Note-For: <sha>` trailer and the full replacement note as its body
- MUST commit directly on `main`; never create a branch unless explicitly asked (other sessions commit to `main` concurrently, and an unprompted branch strands their commits). Cloud sessions that open a PR still write Conventional, one-workspace commits on that branch (ADR-134)
- MUST run `bun check` at the repo root before every commit, and `bun check:fix` to apply formatting and autofixes
- MUST preserve every individual commit when merging into `main` — rebase-and-merge on GitHub, or a local fast-forward (`git merge --ff-only`); never squash-merge and never create a merge commit (ADR-134)
- MUST use `@sdxc/result` for error handling instead of throwing exceptions
- MUST write tests with Vitest, never Jest, Mocha, or Node's built-in `assert` module
- MUST run tests from the root of the repository, never from individual package directories — `vp test run <path>` scopes a run without changing directory
- MUST use Vite+ (`vp check`) for formatting, linting and type checking, never other tools like Prettier, ESLint or a direct `tsc` run in CI
- MUST apply migrations with `sdxc run db migrate` (add `--remote` for production), never invoking `cf d1 migrations` or `wrangler d1 migrations` directly; `sdxc` runs the app's `bun run cli` (`bootstrap/cli.ts`), so `bun run cli db migrate` works where `sdxc` is not on PATH
- MUST write documentation for each shared package, following [](./docs/guides/package-documentation.md) as guidelines
- MUST write documentation for each application, following [](./docs/guides/app-documentation.md) as guidelines
- MUST write an ADR for any significant architectural decisions, following [](./docs/guides/adr-writing.md) as guidelines
- MUST write a short ADR whenever the user corrects an agent about the architecture of the repo or of a specific app/package, documenting the corrected decision so the mistake never repeats — place it in `docs/adr/` (or the app's subdirectory, e.g. `docs/adr/<app>/`, when scoped to one app) and follow [](./docs/guides/adr-writing.md)
- MUST ship an app with `sdxc deploy`, run from the app's directory and only when asked to deploy: it builds, runs the app's `db migrate --remote`, then the app's own `deploy` command, in that order and behind one confirmation, so new code never runs against an old schema. Print the plan with `sdxc deploy --dry-run` first, and never run `cf deploy`, `wrangler deploy` or a remote migration by hand
- MUST pass `--skip migrate` for an app without a database (`books`, `sdxc-site`); every other step stays
- MUST change how an app migrates or deploys in its own `app/commands/db/migrate.ts` and `app/commands/deploy.ts`, which `sdxc deploy` runs
- MUST configure a Worker in `cloudflare.config.ts` and run it through the app's `cf` scripts; the apps with a `*.workers.test.ts` project stay on `wrangler.jsonc` and `bunx wrangler` until the Workers test pool reads `cloudflare.config.ts` (ADR-100)
- MUST declare every secret a deployed Worker reads with `bindings.secret()`: `cf deploy` uploads the Worker with exactly the declared secrets and removes any other, and fails when a declared one is missing remotely — so set a new secret with `cf workers secrets update` before the first deploy that declares it
- MUST use `@sdxc/logger`, never `console.log`
- MUST log through the invocation's log — `ctx.log` in route handlers and job handlers, `currentLog()` anywhere else — and never construct a logger per request; the worker configures one `createLogger()` and attaches it with `log(logger)` at the top of the router's middleware chain and as the job dispatcher's `logger` option (ADR-033)
- MUST use `@sdxc/jobs` for background jobs
- MUST validate external/untrusted data (loaders, actions, webhooks, env-derived input) with `remix/data-schema` via `@sdxc/validate`; do not add Zod to new code
- MUST use `const` only for module-level variables, and `let` for everything else, never use `const` for local variables inside functions or blocks
- MUST name module-level constant values in `ALL_UPPER_SNAKE_CASE` (e.g. `FIXED_STEP_MS`, `TYPE_MATCHUPS`, `PERSISTENT_WORLD_STORE_KEYS`); module-level functions, and objects whose members are functions (a catalog of builders like `defineProblems(…)`'s result), stay `camelCase`, and classes/namespaces/enums stay `PascalCase`
- MUST use `interface` when possible, and `type` only when necessary (e.g. for union types)
- MUST import `env` from `cloudflare:workers` and never from `process.env` or other sources
- MUST extend root `tsconfig.json` in all packages and applications
- MUST add a new app's formatting or lint exceptions to `fmt.overrides` / `lint.overrides` in the root `vite.config.ts`, never as a per-package config file
- MUST NOT silence size, nesting, complexity, or shape Oxlint rules with `oxlint-disable` / `oxlint-disable-next-line` / `oxlint-disable-line` in source; fix the code or adjust `lint.overrides` / thresholds in the root `vite.config.ts` (ADR-171)
- MUST prefer `@sdxc/iife` when a nested ternary (banned by `eslint/no-nested-ternary`) or other statement-only control flow must produce a single value in an expression position — `let x = iife(() => { … })` — instead of an outer mutable `let` filled by `if`/`else`; extract a named function when the callback outgrows a short block (ADR-172)
- MUST register every new app as a Vitest project in the root `vite.config.ts` and verify it with `vp test run --project <name>`; an app missing from `test.projects` collects none of its tests and still exits 0. Packages need no entry — one project covers `packages/*/src/**/*.test.ts?(x)`, so keep package tests under `src/`
- MUST add new rules to this document when necessary, and update existing ones if they become outdated or need clarification
- MUST follow the guidelines in this document, and suggest improvements when necessary
- MUST use `bunx` instead of `npx`, or any other package runner, to ensure consistent behavior across environments
- MUST use namespaces for types only; no runtime values, functions, or classes inside namespaces.
- MUST check what Remix v3 provides before hand-rolling middleware/helpers — prefer `remix/cop-middleware`, `remix/session-middleware`, `createAction`/`createController`, `remix/data-schema`, `remix/auth`, and `remix/component` over custom equivalents
- MUST publish app services (Database, API clients) onto the request or job context from middleware (ADR-057), so a handler reads `ctx.db` / `ctx.database` and a test installs its own; a service nothing substitutes is a module function the caller imports
- MUST render server HTML as `remix/component` JSX with `css()` mixins; never build HTML from strings (`remix/html-template` or inline HTML template literals)
- MUST build application UI with `remix/component`, not React components/hooks or Tailwind utility classes; style with `css()` mixins through `mix`, and attach behavior with Remix UI mixins or native HTML platform features
- MUST build dialogs, popovers, menus, tooltips, and disclosure UI with native HTML platform features instead of JavaScript: `<dialog>` (with `.showModal()`/`::backdrop`) for modals, the Popover API (`popover` + `popovertarget` attributes) for popovers/menus/tooltips, the Command Invoker API (`<button commandfor command>` with `command="show-modal"`/`"close"`/`"toggle-popover"`/`"show-popover"`/`"hide-popover"` or `command="--custom"` handled via the `command` event) to wire buttons to targets declaratively, and `<details>`/`<summary>` for disclosures — reach for JS only for behavior the platform genuinely cannot express, and prefer progressive enhancement over JS-driven open/close state
- MUST call the global `fetch` directly; never add an injectable fetch parameter (e.g. `fetchImpl: typeof fetch = fetch`)
- MUST create record ids with `generateUUID` from `@sdxc/uuid/v7`, other identifiers (JWT `jti`, request and correlation ids, job ids, test fixtures) with `generateUUID` from `@sdxc/uuid/v4`, and secrets (tokens, tickets, client secrets, OAuth `state`, authorization codes) with `randomToken` from `@sdxc/crypto`; never use a UUID as a secret, and never reference `crypto.randomUUID()` outside `@sdxc/uuid/v4`, tests and docs included — `test/random-uuid.test.ts` fails on any other reference
- MUST describe code on its own terms in comments; never name another app or package as the source of a pattern (e.g. "mirrors the blog app")
- MUST NOT cite ADRs in code comments or JSDoc (ADR-168); the comment states the contract, and the decision lives under `docs/adr/`
- MUST keep `packages/*` app-agnostic: no imports from, or references to, `apps/*` in code or comments
- MUST expose a package's `remix/component` components through a `./ui` entry point backed by `src/ui.tsx` (`@sdxc/honeypot/ui`, `@sdxc/captcha/turnstile/ui`), never `./component` or another name, so every package's UI imports from the same subpath
- MUST write public blog content against what a reader can install: articles and tutorials may name and import the published `@sdxc/*` packages from npm, and must not reference `packages/*` paths, `workspace:*` versions, or anything that exists only inside this repo
- MUST write Remix tutorials with Remix v3 route contracts, controllers, middleware context, `remix/data-schema`, and `remix/component`; do not use React Router route-module exports, `Route.*` types, `useLoaderData`, `useActionData`, React hooks, or top-level `remix` imports unless the post is explicitly about React or legacy React Router

### App layout

Every app is organised by kind of code, one home per kind ([ADR-129](./docs/adr/ADR-129-app-folder-layout.md)).
Apps listed in `CONVERTED_APPS` in `test/app-layout.ts` are held to it by `test/app-layout.test.ts`;
the rest convert one app at a time, completely, before the next starts.

| If the code…                                                                                                             | It goes in                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| is the Worker, browser, command-line or REPL entry point                                                                 | `bootstrap/worker.ts`, `bootstrap/browser.ts`, `bootstrap/cli.ts`, `bootstrap/console.ts`                                                              |
| is a Durable Object class                                                                                                | by role: `app/models/` when it owns stored state, `app/services/` when it does not; `bootstrap/worker.ts` re-exports it under its binding's class name |
| builds the one instance of something (logger, router, dispatcher, MCP handler, database, billing, flags, mailer, assets) | `app/initializers/`                                                                                                                                    |
| handles HTTP: controllers, middleware, input validators                                                                  | `app/http/{controllers,middleware,validators}/`                                                                                                        |
| is a background job, an MCP tool, an email template                                                                      | `app/jobs/`, `app/mcp/`, `app/emails/`                                                                                                                 |
| is a command-line command, run with `bun run cli` or `sdxc run`                                                          | `app/commands/`                                                                                                                                        |
| reads or writes stored state, in any storage (D1, KV, R2, Durable Object)                                                | `app/models/`                                                                                                                                          |
| is a rule about one model                                                                                                | a method on that model                                                                                                                                 |
| is business logic across models or package instances, or a rule about none                                               | `app/services/`                                                                                                                                        |
| is an authorization rule                                                                                                 | `app/policies/`                                                                                                                                        |
| is a view, component, layout, stylesheet or translation                                                                  | `resources/` (`resources/locales/` for translations)                                                                                                   |
| is a route contract, a migration or schema, a test factory, the seed                                                     | `routes/`, `database/`, `database/factories/`, `database/seed.ts`                                                                                      |
| is static app configuration (site profile, product catalog, security.txt, security headers policy)                       | `config/`                                                                                                                                              |
| is any other test helper                                                                                                 | `app/test/`                                                                                                                                            |
| is generic, with no knowledge of the app                                                                                 | a package                                                                                                                                              |

- MUST keep `bootstrap/` to entry points, and never import from it outside `bootstrap/`; a Durable Object class lives where its role puts it and `bootstrap/worker.ts` re-exports it in one line, with no pass-through file; no tsconfig declares a `~/bootstrap/*` alias
- MUST read the `sdxc-cli` skill (`.agents/skills/sdxc-cli`, linked from `.claude/skills`) before driving `sdxc`; the global `sdxc` runs this checkout's `packages/kit`, so a kit edit takes effect on the next call. A convention with a fixed shape is enforced as an `sdxc doctor` check (in `packages/kit/src/doctor/` for every `@sdxc/*` project, in `.config/sdxc/checks/` for this repository only), not as a skill
- MUST start a new app with `sdxc create <directory>` run from `apps/`, and MUST write the files a feature needs with `sdxc make <kind> <name>` (controller, middleware, validator, job, model, migration, factory, service, policy, initializer, email, mcp, command) and then fill them in, instead of writing those files by hand: `make` puts each file where the layout says, writes its test, and declares and maps jobs, controllers, MCP tools and commands. `sdxc` is the `@sdxc/kit` command line in `packages/kit`; where it is not on PATH, run `bun packages/kit/src/bin.ts <command>`
- MUST NOT create `app/lib/`, `app/repositories/`, `app/data/` or any folder outside the table; an instance of a package is an initializer, a store is a model, generic code is a package (proposed to the user before it is created)
- MUST lay `app/mcp/` out like routes: declarations in `tools/index.ts` and `resources/index.ts`, one handler file per tool or resource beside them (`tools/search-jobs.ts`, `resources/posting.ts`, each a default-exported `createTool(toolset.x, …)` / `createResource(resourceset.x, …)`), and the wiring in `app/initializers/mcp.ts`, which only creates the handler and calls `mcp.tools.map` / `mcp.resources.map` once per handler file; a handler never lives inline in the initializer, and shaping shared by several handlers goes in a module beside the folders (`app/mcp/postings.ts`)
- MUST lay `app/commands/` out like `app/mcp/`: the contract in `app/commands/index.ts` (a default-exported `commands({ … })`, nesting a `commands({ … })` group per folder), one handler file per command beside it (`users/grant.ts`, a default-exported `createCommand(commandset.users.grant, …)`), and the wiring in `app/initializers/cli.ts`, which creates the command line with `createCLI` and maps each handler through `lazy()`; `bootstrap/cli.ts` only runs it, so a command never ships in the Worker build and a test calls `invoke()` on the initializer's instance
- MUST lay `app/emails/` out like `app/mcp/`: the declarations in `app/emails/index.ts` (a default-exported `emails({ … })` of `email({ props: schema })` entries), one template file per email beside it (`teams/invite.tsx`, a default-exported `createEmail(emails.teams.invite, …)`), and the wiring in `app/initializers/mail.ts`, which creates the registry with `createMail({ translator })` and maps each template through `lazy()`. Send with `ctx.email.send`/`later`/`queue(emails.x, { to, locale, props })`, passing the reader's `locale` rather than a translator, so a queued delivery stays plain JSON (ADR-167); an app still on email classes converts all of its emails at once
- MUST export a singleton from an initializer, or a function when the instance needs per-request or async input
- MUST name a router initializer after the route contract it maps, as a named export: a factory is `create<Contract>Router` (`createWebRouter` for `routes/web.ts`), a module-level singleton is `<contract>Router` (`tenantRouter` for `routes/tenant.ts`); it builds a router, so never `application`
- MUST write the router's global middleware inline in `createRouter({ middleware: [...] })` and derive `AppContext` as `RouterContext` of that router; a stored `Middleware[]` erases what each middleware publishes
- MUST map every route through `lazy()` from `@sdxc/lazy-route`, so a request imports only the controller it reaches; a route group's guards go in `lazy()`'s second argument and answer before the module loads
- MUST give each MCP tool and resource handler its own default-exported file in `app/mcp/tools/` or `app/mcp/resources/`, with the declarations in each folder's `index.ts`, and map every handler through `lazy()` from `@sdxc/mcp`; set `cacheScope: "public"` when no handler declares `available`, since lazy handlers make lists `"private"` by default
- MUST render pages through `render({ assets })` from `remix/middleware/render`, with `assets(...)` from `@sdxc/assets-middleware` before it in the router (or, when the router also serves an API, in the page chain every page controller declares, ADR-153) so `ctx.assets` carries the document's stylesheets, entry script and CSP nonce; a page passes them to its document explicitly (`<Document assets={ctx.assets}>`), and an app whose document needs its own renderer writes it as middleware in `app/http/middleware/` reading `ctx.assets`
- SHOULD group a crowded layer by feature with the same folder name in every layer (`app/jobs/trials/`, `app/services/trials/`), so `**/trials/**` finds the whole feature

### Publishing

Every package ships to npm under the `@sdxc` scope through the daily release described in
[ADR-007](./docs/adr/ADR-007-publishable-package-releases.md): the commits since the previous
release decide which packages changed, every dependent of a changed package republishes with a
new exact pin, and the version is the UTC date of the run (`2026.9.4`). `bun run release` is a
dry run of exactly what the workflow does; `bun run release --publish` performs it.

- MUST write every relative import inside `packages/*` with its `.js` extension (`from "./parse.js"`), tests included; `test/import-extensions.test.ts` fails on any other form, because emitted JavaScript keeps specifiers verbatim and Node resolves only the extension form
- MUST keep `version` in every `package.json` as the `0.0.1` placeholder; the release writes the dated version into the generated publish manifest only, and nothing in the repo reads the field
- MUST, when adding a package: give it a `description` (taken from the package README, per ADR-017) and a `LICENSE.md`, add its row to the root README package table, run `bun run release:bootstrap @sdxc/<name>` from a developer machine so the package exists on npm as `0.0.0-pre.1` under the `alpha` tag (the registry also points `latest` at a first publish; the first dated release moves it), then configure its trusted publisher on npmjs.com (GitHub Actions, `sergiodxa/monorepo`, workflow `release.yml`); the next daily run publishes the dated version. `test/public-packages.test.ts` fails on a package missing any of the repo-side pieces. Also add its directory to the right group in `apps/sdxc-site/resources/content/groups.ts` (an ungrouped package lands under "Everything else" on sdxc.dev), and cover it in a guide under `apps/sdxc-site/resources/docs/` when it solves a problem no guide covers yet
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
- MUST make JSDoc state the why — intent, contract, guarantee, non-obvious invariant (fallbacks, ordering assumptions, publish/preview semantics, normalization rules, nullability contracts, redirect/404 behavior) — never the export mechanics ("Exports the module default value."), never a re-reading of the signature or the code below it, and never an ADR citation (ADR-168).
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
- MUST mock outbound HTTP with MSW in tests — `setupServer` from `msw/node`, or `setupWorker` from `msw/browser` in a `*.browser.test.ts(x)` file; never stub `globalThis.fetch` or inject a fake
- MUST run a test that needs a DOM in Vitest Browser Mode as a `*.browser.test.ts(x)` file; never use a simulated DOM (`@vitest-environment happy-dom` or `jsdom`)
- MUST NOT hand-write a fake for a Cloudflare binding (`as unknown as KVNamespace` and the like). Name the file `*.workers.test.ts` and use the real binding from `cloudflare:test`; a fake diverges silently, and every one this repo had stubbed `list()` to an empty result
- MUST let the `cloudflareWorkersStub()` plugin supply `env`/bindings — it is on every project whose workspace uses Cloudflare bindings, so a test importing `cloudflare:workers` needs no mock of its own; reach for `vi.doMock` + `await import(...)` only to replace a module before the subject loads
- MUST keep `*.test.ts` files type-safe: they are included in typechecking, so every test file must pass `bun typecheck`
- MUST add a regression test for every bug fixed: a test that fails against the old (buggy) behavior and passes with the fix, kept alongside the module's other tests, so the bug can never silently return

### Data & transactions

- `db.transaction()` is atomic on neither Cloudflare adapter: `@sdxc/data-table-d1` commits every statement as it runs and rollback discards nothing, and `@sdxc/data-table-sqlstorage` rejects it outright, because Durable Object SQLite coalesces every write of one event-loop turn into one commit and has no `BEGIN`. Any multi-step mutation MUST be written adapter-safe (single-statement/upsert, or compensating operations), and a scope that must be atomic on sqlstorage MUST NOT await network I/O between its writes
- MUST isolate per-tenant caches by keying them on the tenant's `Database` instance, so one tenant's data can never leak to another
- MUST keep every migration chain applicable to an empty database, since that is how a new tenant is provisioned — `test/migration-replay.test.ts` replays each chain with SQLite's double-quoted string literals disabled and fails on anything new. Never `ALTER TABLE ADD COLUMN` for a column an earlier migration already creates, and when a table rebuild renames a column, the `SELECT` must read the **old** name: with DQS on, as the adapters run, `"new_name"` silently evaluates to the string `'new_name'` for every row instead of failing

### Security

- MUST verify OIDC ID tokens (JWKS signature plus `iss`/`aud`/`exp`/`nonce`) before trusting any claim
- MUST verify inbound webhook signatures and fail closed when the signing secret is missing or unset
- MUST enforce authorization/entitlement at the runtime boundary that actually receives the traffic (e.g. the tenant Durable Object, since `cf.hostMetadata` bypasses the control-plane database), not only in the control plane
