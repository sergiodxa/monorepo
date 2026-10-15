# ADR-146: Command-Line Entry Points for Middleware Packages

## Status

**Proposed** - 2026-10-15

## Background

`@sdxc/cli` (ADR-145) runs middleware before a command's handler, the way a `remix/router`
router and an `@sdxc/jobs` dispatcher do. An app's command line wants the same services its
routes and jobs read: `ctx.db`, `ctx.models`, `ctx.log`. Several packages already publish one
service for two hosts, a router and a job dispatcher, through thin entry points over a shared
core. This ADR adds the command line as a third host, starting with `@sdxc/data-model/cli`,
and decides which other middleware gets a `./cli` entry.

## Context

### How a package serves two hosts today

`@sdxc/data-model` ships `./router` and `./jobs`. Each is about 50 lines and differs only in the
context type it accepts:

```typescript
// @sdxc/data-model/jobs
export function models(registry, context: (ctx: AnyJobContext) => RegistryContextInit, options?) {
	return async (ctx, next) => {
		ctx.set(
			Models,
			bindLazily(registry, () => context(ctx), ctx, options),
			{ property: "models" },
		);
		await next();
	};
}
```

Both publish under the same context key (`Models`), so code that reads `ctx.get(Models)` works in
either host, and both declare their effect in the middleware's type, so the host derives
`ctx.models`'s type with no cast. `@sdxc/database-middleware`, `@sdxc/flags` and `@sdxc/authz`
follow the same split; the job context's `set(key, value, { property })` matches the request
context's.

### What each middleware reads

| Package                                                                                                                                                                                                                                                                                                                                                                     | Entries today                        | Reads from the request           | On a command line                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------- | --------------------------------------------------------- |
| `@sdxc/data-model`                                                                                                                                                                                                                                                                                                                                                          | `./router`, `./jobs`                 | nothing                          | the same models, bound to the command's database          |
| `@sdxc/database-middleware`                                                                                                                                                                                                                                                                                                                                                 | `.` (router), `./jobs`               | nothing                          | `ctx.db`                                                  |
| `@sdxc/logger`                                                                                                                                                                                                                                                                                                                                                              | `./middleware` (router)              | route and method, recorded after | one log per run, recording the command path and exit code |
| `@sdxc/trace-context`                                                                                                                                                                                                                                                                                                                                                       | `./middleware` (router)              | the `traceparent` header         | a trace per run, continued from a `TRACEPARENT` variable  |
| `@sdxc/jobs`                                                                                                                                                                                                                                                                                                                                                                | `./router` (`jobEnqueuer`)           | nothing                          | enqueue a job from a command                              |
| `@sdxc/flags`, `@sdxc/authz`                                                                                                                                                                                                                                                                                                                                                | `./middleware/router`, `/dispatcher` | the subject, router only         | nothing: the developer running a command has full access  |
| `@sdxc/i18n`                                                                                                                                                                                                                                                                                                                                                                | `./middleware`                       | `Accept-Language`, cookies, URL  | text in each recipient's language                         |
| `@sdxc/mail`, `@sdxc/billing`, `@sdxc/newsletter`                                                                                                                                                                                                                                                                                                                           | `./middleware`                       | nothing                          | the configured provider, for admin commands               |
| `@sdxc/assets-middleware`, `@sdxc/attribution`, `@sdxc/captcha`, `@sdxc/catch-response-middleware`, `@sdxc/get-client-ip`, `@sdxc/honeypot`, `@sdxc/http` (`head-requests`), `@sdxc/idempotency`, `@sdxc/no-www-middleware`, `@sdxc/rate-limit`, `@sdxc/security-headers`, `@sdxc/trailing-slash-middleware`, `@sdxc/user-agent`, `@sdxc/well-known`, `@sdxc/workers-cache` | `./middleware`                       | the request or response itself   | nothing: each exists to shape an HTTP exchange            |

## Decision

### 1. `@sdxc/cli`'s context matches the job context

The command context implements `get(key)`, `has(key)` and `set(key, value, { property })` with
the job context's semantics, and `@sdxc/cli` exports `CommandMiddleware<Effect>` and
`AnyCommandContext`, carrying the same type-only effect as `JobMiddleware`. `createCLI({
middleware })` derives the handler context from those effects. This is a requirement on ADR-145's
Phase 1, which is in progress.

### 2. A `./cli` entry beside each existing host entry

A package that publishes a service adds a command-line entry named like its other host entries:
`./cli` beside `./router` and `./jobs` (`@sdxc/data-model/cli`, `@sdxc/database-middleware/cli`,
`@sdxc/jobs/cli`). A package with a single `./middleware` entry gains `./middleware/cli`, and its
existing entry stays the router one.

- Every entry is an adapter over the core the other entries share, and publishes under the same
  context key, so a model method or a service reads the same value in a route, a job
  or a command.
- An entry depends on nothing platform-specific. It publishes the service the app passes, so a
  Node or Bun app passes its own connection and a Cloudflare app passes one over its bindings,
  locally or, with `--remote`, through ADR-147's adapters.
- `@sdxc/cli` is an optional peer dependency, as `remix` is for packages that serve both hosts.
  An app without a command line installs nothing new.
- Each entry has a test that runs a command through `@sdxc/cli/test`'s `invoke()`.

### 3. What each entry does

- **`@sdxc/data-model/cli`:** `models(registry, (ctx) => ({ db: ctx.db }), options?)`, identical
  to the job entry's contract.
- **`@sdxc/database-middleware/cli`:** `database(db)` publishes `ctx.db` under the `Database`
  key. Where the database comes from (a local file, a remote API) is the app's middleware's
  decision, as it is for routes. The entry also exports a `db` command an app mounts in its own
  contract: an interactive SQL prompt over `ctx.db`'s `exec`, or one statement with
  `--execute "SELECT …"`, working on whatever database the middleware connected.
- **`@sdxc/logger/middleware/cli`:** `log(logger)` opens a `command` log for the run, joining the
  current one when a host already opened it, and records the command path (`users find`), its
  duration and exit code once the handler returns, as the router entry records route and method.
  `currentLog()` works inside handlers, so the rule that code logs through the invocation's log
  holds in commands too. The logger's transport is the app's choice; a command line that keeps
  stderr for tasks configures one that writes to a file or stays quiet without `--verbose`.
- **`@sdxc/trace-context/middleware/cli`:** `trace()` continues the trace in a `TRACEPARENT`
  environment variable, OpenTelemetry's carrier for processes, or starts one, publishes
  `ctx.trace`, and stamps the run's log. Jobs a command enqueues carry it, so a backfill and the
  jobs it starts share one trace.
- **`@sdxc/jobs/cli`:** `jobEnqueuer(queue)` publishes `ctx.jobs`, and what enqueuing means is
  the queue the app passes:
  - **Locally,** `@sdxc/jobs/memory`'s queue, drained through the app's own dispatcher in the
    command's process once the handler returns. The job runs where the developer is watching:
    its logs, errors and retries show in the terminal, against the same local database.
  - **Against production (`--remote`),** the production queue, so the deployed consumer runs the
    job exactly as if a request had enqueued it; on Cloudflare that queue is reached through
    ADR-147's Queues adapter. A backfill command enqueues one job per batch and returns, and the
    deployed app does the work.
- **`@sdxc/i18n/middleware/cli`:** `i18n(options)` takes the router entry's resources and
  supported languages and publishes `ctx.translate`, the `createTranslator` factory, for text a
  command writes to users: `ctx.translate(user.language).t("invite.subject")`, recording the
  `locale` it bound to. It also publishes `ctx.intl` for the command's own output, in the
  developer's language from `LC_ALL`, `LC_MESSAGES` or `LANG` (`es_AR.UTF-8` is `es-AR`).
- **`@sdxc/mail/middleware/cli`:** publishes the mailer the app configures, so a command resends
  an invitation or a receipt with the same templates a route uses, through the production
  transport with `--remote` (on Cloudflare, `CloudflareTransport` over ADR-147's Email Service
  adapter). Locally the app passes `MemoryTransport` or one that prints each message, so a command
  run on a laptop never emails a real user.
- **`@sdxc/billing/middleware/cli`, `@sdxc/newsletter/middleware/cli`:** publish the configured
  provider, for granting an entitlement or subscribing an address by hand. Both providers are
  already HTTP APIs, so they work from a command as they are, with the same secrets.

`@sdxc/flags` and `@sdxc/authz` get no entry: a command line is a developer's tool, and the
developer running it already has every permission those packages would check.

The HTTP-only middleware in the table gets no entry.

### 4. What an app's command line looks like

```typescript
let cli = createCLI({
	name: "app",
	commands: COMMANDS,
	middleware: [log(logger), trace(), database(db), models(registry, (ctx) => ({ db: ctx.db }))],
});
```

The order matches a router's: the log first, the trace stamping it, then services.

## Consequences

### Positive

- **One service, three hosts.** A model or mailer behaves the same in a route, a job and a
  command, published under one key.
- **Typed without casts.** Effects flow from each entry into the handler's `ctx`.
- **Commands are logged and traced** like requests and jobs, with no command-specific code.

### Negative

- **Nine new entry points** to document, test and keep in step with their siblings.
- **`@sdxc/cli`'s context is constrained** to the job context's shape before the package ships.
- **Production is the app's wiring.** Each entry publishes what it is given; choosing and
  guarding the production connection stays in the app's middleware.

### Neutral

- Packages whose middleware only shapes HTTP stay router-only.

## Alternatives Considered

### 1. Accept any of the three contexts in one entry

One `models()` typed against a union of request, job and command contexts.

**Rejected because**: each host has its own middleware type and effect channel, so one function
would need casts at every call site, and the `./router` entry would import `@sdxc/jobs` and
`@sdxc/cli` types into every app that uses neither.

### 2. Run commands through the router

Build a `Request` per command and reuse the router middleware unchanged.

**Rejected because**: middleware that reads URLs, headers or cookies would see a fabricated
request, and the router's response types say nothing a command line can use.

## Implementation Plan

### Phase 1: Context

1. `@sdxc/cli`'s `get`, `has`, `set` with `property`, `CommandMiddleware<Effect>`,
   `AnyCommandContext`, and effect-derived handler contexts (ADR-145 Phase 1).

### Phase 2: Services an app command reads first

1. `@sdxc/data-model/cli` and `@sdxc/database-middleware/cli`.
2. `@sdxc/logger/middleware/cli` and `@sdxc/trace-context/middleware/cli`.

### Phase 3: The rest

1. `@sdxc/jobs/cli`, with the memory queue drained in process.
2. `@sdxc/i18n/middleware/cli`, `@sdxc/mail/middleware/cli`, `@sdxc/billing/middleware/cli`,
   `@sdxc/newsletter/middleware/cli`.
3. Regenerate the `sdxc` export map.

## References

- [ADR-145: `@sdxc/cli` Package](./ADR-145-cli-package.md)
- [OpenTelemetry: Environment Variables as Context Propagation Carriers](https://opentelemetry.io/docs/specs/otel/context/env-carriers/)
- [ADR-147: Cloudflare API Adapters](./ADR-147-cloudflare-api-adapters.md)
- [POSIX locale environment variables](https://pubs.opengroup.org/onlinepubs/9799919799/basedefs/V1_chap08.html)

## Current Progress

- [x] Phase 1: Context — `@sdxc/cli`'s `get`/`has`/`set` with `property`,
      `CommandMiddleware<Effect>` and `AnyCommandContext`, shipped with ADR-145 Phase 1
- [x] Phase 2: Services an app command reads first — `@sdxc/data-model/cli`,
      `@sdxc/database-middleware/cli` (with the `db` command: `DB_COMMAND` and `dbHandler`),
      `@sdxc/logger/middleware/cli`, `@sdxc/trace-context/middleware/cli`
- [x] Phase 3: The rest — `@sdxc/jobs/cli` (a memory queue drained through the app's dispatcher
      after the handler), `@sdxc/i18n/middleware/cli`, `@sdxc/mail/middleware/cli`,
      `@sdxc/billing/middleware/cli`, `@sdxc/newsletter/middleware/cli`; the i18n, mail, billing and
      newsletter router entries now publish under context keys too; `sdxc` export map regenerated
