# ADR-146: Command-Line Entry Points for Middleware Packages

## Status

**Proposed** - 2026-10-15

## Background

`@sdxc/cli` (ADR-145) runs middleware before a command's handler, the way a `remix/router`
router and an `@sdxc/jobs` dispatcher do. An app's command line wants the same services its
routes and jobs read: `ctx.db`, `ctx.models`, `ctx.log`. Several packages already publish one
service for two hosts, a router and a job dispatcher, through thin entry points over a shared
core. This ADR adds the command line as a third host, starting with `@sdxc/data-model/cli`, and
decides which other middleware gets a `./cli` entry.

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
| `@sdxc/flags`                                                                                                                                                                                                                                                                                                                                                               | `./middleware/router`, `/dispatcher` | the subject, router only         | a client whose subject the handler binds, as in a job     |
| `@sdxc/authz`                                                                                                                                                                                                                                                                                                                                                               | `./middleware/router`, `/dispatcher` | the subject, router only         | a binder whose subject the handler binds, as in a job     |
| `@sdxc/i18n`                                                                                                                                                                                                                                                                                                                                                                | `./middleware`                       | `Accept-Language`, cookies, URL  | a locale from `LC_ALL`, `LC_MESSAGES`, `LANG`             |
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
`@sdxc/jobs/cli`), and `./middleware/cli` beside `./middleware/router` and
`./middleware/dispatcher` (`@sdxc/flags`, `@sdxc/authz`). A package with a single `./middleware`
entry gains `./middleware/cli`, and its existing entry stays the router one.

- Every entry is an adapter over the core the other entries share, and publishes under the same
  context key, so a model method, a policy or a service reads the same value in a route, a job
  or a command.
- `@sdxc/cli` is an optional peer dependency, as `remix` is for packages that serve both hosts.
  An app without a command line installs nothing new.
- Each entry has a test that runs a command through `@sdxc/cli/test`'s `invoke()`.

### 3. What each entry does

- **`@sdxc/data-model/cli`:** `models(registry, (ctx) => ({ db: ctx.db }), options?)`, identical
  to the job entry's contract.
- **`@sdxc/database-middleware/cli`:** `database(db)` publishes `ctx.db` under the `Database`
  key. Where the database comes from (a local file, a remote API) is the app's middleware's
  decision, as it is for routes.
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
- **`@sdxc/jobs/cli`:** `jobEnqueuer(queue)` publishes `ctx.jobs`. The queue is whatever the app
  passes; reaching a Cloudflare queue from outside the Worker needs a client of its own, the same
  constraint ADR-145 records for bindings.
- **`@sdxc/flags/middleware/cli`** and **`@sdxc/authz/middleware/cli`:** like their dispatcher
  entries, they publish a client or binder with the shared fact sources, and the handler binds the
  subject, typically from an `--as <user>` flag, so a command acting for a user is held to that
  user's flags and policies.
- **`@sdxc/i18n/middleware/cli`:** `i18n(options)` takes the router entry's resources and
  supported languages and picks the locale from `LC_ALL`, then `LC_MESSAGES`, then `LANG`
  (`es_AR.UTF-8` is `es-AR`), falling back to the fallback language, and publishes `ctx.locale`
  and `ctx.intl` as the router entry does.
- **`@sdxc/mail/middleware/cli`, `@sdxc/billing/middleware/cli`, `@sdxc/newsletter/middleware/cli`:**
  publish the configured provider, for commands such as resending an invitation or granting an
  entitlement by hand.

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

- **One service, three hosts.** A model, policy or mailer behaves the same in a route, a job and a
  command, published under one key.
- **Typed without casts.** Effects flow from each entry into the handler's `ctx`.
- **Commands are logged and traced** like requests and jobs, with no command-specific code.

### Negative

- **Eleven new entry points** to document, test and keep in step with their siblings.
- **`@sdxc/cli`'s context is constrained** to the job context's shape before the package ships.
- **Bindings are still the app's problem.** A `./cli` entry publishes what it is given; reaching
  Cloudflare storage and queues from outside the Worker waits on ADR-145's Phase 4.

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

1. `@sdxc/jobs/cli`, `@sdxc/flags/middleware/cli`, `@sdxc/authz/middleware/cli`.
2. `@sdxc/i18n/middleware/cli`, `@sdxc/mail/middleware/cli`, `@sdxc/billing/middleware/cli`,
   `@sdxc/newsletter/middleware/cli`.
3. Regenerate the `sdxc` export map.

## References

- [ADR-145: `@sdxc/cli` Package](./ADR-145-cli-package.md)
- [OpenTelemetry: Environment Variables as Context Propagation Carriers](https://opentelemetry.io/docs/specs/otel/context/env-carriers/)
- [POSIX locale environment variables](https://pubs.opengroup.org/onlinepubs/9799919799/basedefs/V1_chap08.html)

## Current Progress

- [ ] Phase 1: Context
- [ ] Phase 2: Services an app command reads first
- [ ] Phase 3: The rest
