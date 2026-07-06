# Agents Guidelines

This monorepo contains multiple applications in `apps/` and shared packages in `packages/`.

## Commands

Global commands to run from the repository root using Bun.

```bash
bun format                      # Check formatting (oxfmt)
bun format:fix                  # Fix formatting
bun lint                        # Check linting (oxlint)
bun lint:fix                    # Fix linting issues
bun typecheck                   # TypeScript type checking
bun test                        # Run all tests
bun test file-path              # Run a single test file
bun test --watch                # Watch mode
```

Local commands to run from the app directory (e.g. `apps/blog`):

```bash
bun dev                         # Run dev server
bun build                       # Build for production
bun db:local:migrate            # Apply migrations locally
bun db:remote:migrate           # Apply migrations to production
bun orm:generate                # Generate Drizzle migrations
bun rr:typegen                  # Generate TypeScript types for React Router routes
bun cf:typegen                  # Generate TypeScript types for Cloudflare Workers bindings
bunx react-router routes --json # Extract React Router routes as JSON for AI agents
```

## Rules

- MUST use Bun to install dependencies, run scripts, and execute tests
- MUST follow Conventional Commits for commit messages
- MUST use `@pkg/result` for error handling instead of throwing exceptions
- MUST write using `bun:test`, never using external test runners like Jest or Mocha, or Node's built-in `assert` module
- MUST run tests from the root of the repository, never from individual package directories
- MUST use `oxfmt` for code formatting and `oxlint` for linting, never using other tools like Prettier or ESLint
- MUST generate Drizzle migrations using `bun run orm:generate` and apply them using `bun run db:local:migrate` or `bun run db:remote:migrate`, never using Drizzle CLI directly
- MUST write documentation for each shared package, following [](./docs/guides/package-documentation.md) as guidelines
- MUST write documentation for each application, following [](./docs/guides/app-documentation.md) as guidelines
- MUST write an ADR for any significant architectural decisions, following [](./docs/guides/adr-writing.md) as guidelines
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
- MUST use `interface` when possible, and `type` only when necessary (e.g. for union types)
- MUST import `env` from `cloudflare:workers` and never from `process.env` or other sources
- MUST extend root `tsconfig.json` in all packages and applications
- MUST update `.oxfmtrc.json` to include new apps with their Tailwind configuration
- MUST suggest new content for my blog when some pattern, package, feature, etc. could be interesting to write about and add it to [](./content/ideas.md)
- MUST add new rules to this document when necessary, and update existing ones if they become outdated or need clarification
- MUST follow the guidelines in this document, and suggest improvements when necessary
- MUST use `bunx` instead of `npx`, or any other package runner, to ensure consistent behavior across environments
- MUST use namespaces for types only; no runtime values, functions, or classes inside namespaces.
- MUST check what Remix v3 provides before hand-rolling middleware/helpers — prefer `remix/cop-middleware`, `remix/session-middleware`, `createAction`/`createController`, `remix/data-schema`, `remix/auth`, and `remix/ui` over custom equivalents
- MUST resolve app services (Database, API clients) through `@pkg/service-container` (ADR-008) via `inject([...])` / `getServiceContainer()`; keep request-lifecycle values (session, current user, tenant, request logger) in middleware/context, never in the container
- MUST render server HTML as `remix/ui` JSX with `css()` mixins; never build HTML from strings (`remix/html-template` or inline HTML template literals)
- MUST call the global `fetch` directly; never add an injectable fetch parameter (e.g. `fetchImpl: typeof fetch = fetch`), and stub `globalThis.fetch` in tests instead
- MUST describe code on its own terms in comments; never name another app or package as the source of a pattern (e.g. "mirrors the r3-blog app")
- MUST keep `packages/*` app-agnostic: no imports from, or references to, `apps/*` in code or comments

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
- MUST stub `globalThis.fetch` (save/restore) and use `mock.module("cloudflare:workers", …)` to supply `env`/bindings in tests, never an injected fake
- MUST keep `*.test.ts` files type-safe: they are included in typechecking, so every test file must pass `bun typecheck`

### Data & transactions

- `db.transaction()` is atomic only on `@pkg/data-table-sqlstorage` (Durable Object SQLite). `@pkg/data-table-d1` has no interactive transactions, so any multi-step mutation that may run on D1 MUST be written D1-safe (single-statement/upsert or compensating operations)
- MUST isolate per-tenant caches by keying them on the tenant's `Database` instance, so one tenant's data can never leak to another

### Security

- MUST verify OIDC ID tokens (JWKS signature plus `iss`/`aud`/`exp`/`nonce`) before trusting any claim
- MUST verify inbound webhook signatures and fail closed when the signing secret is missing or unset
- MUST enforce authorization/entitlement at the runtime boundary that actually receives the traffic (e.g. the tenant Durable Object, since `cf.hostMetadata` bypasses the control-plane database), not only in the control plane
