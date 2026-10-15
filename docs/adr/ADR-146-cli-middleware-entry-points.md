# ADR-146: Command-Line Entry Points for Middleware Packages

## Status

**Proposed** - 2026-10-15

## Background

`@sdxc/cli` (ADR-145) runs middleware before a command's handler, the way a `remix/router`
router and an `@sdxc/jobs` dispatcher do. An app's command line wants the same services its
routes and jobs read: `ctx.db`, `ctx.models`, `ctx.log`. Several packages already publish one
service for two hosts, a router and a job dispatcher, through thin entry points over a shared
core. This ADR adds the command line as a third host, starting with `@sdxc/data-model/cli`,
decides which other middleware gets a `./cli` entry, and proposes the package that reaches
Cloudflare's services from outside a Worker, which those entries need against production.

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
- **`@sdxc/jobs/cli`:** `jobEnqueuer(queue)` publishes `ctx.jobs`, and what enqueuing means is
  the queue the app passes:
  - **Locally,** `@sdxc/jobs/memory`'s queue, drained through the app's own dispatcher in the
    command's process once the handler returns. The job runs where the developer is watching:
    its logs, errors and retries show in the terminal, against the same local database.
  - **Against production (`--remote`),** a Cloudflare queue reached through the Queues HTTP API
    (section 4), so the deployed consumer runs the job exactly as if a request had enqueued it.
    A backfill command enqueues one job per batch and returns; the Worker does the work.
- **`@sdxc/i18n/middleware/cli`:** `i18n(options)` takes the router entry's resources and
  supported languages and publishes `ctx.translate`, the `createTranslator` factory, for text a
  command writes to users: `ctx.translate(user.language).t("invite.subject")`, recording the
  `locale` it bound to. It also publishes `ctx.intl` for the command's own output, in the
  developer's language from `LC_ALL`, `LC_MESSAGES` or `LANG` (`es_AR.UTF-8` is `es-AR`).
- **`@sdxc/mail/middleware/cli`:** publishes the mailer the app configures, so a command resends
  an invitation or a receipt with the same templates a route uses. `@sdxc/mail`'s
  `CloudflareTransport` already takes a `SendEmailBinding`; given the Email Service adapter from
  section 4 it sends from a command unchanged. Locally the app passes `MemoryTransport` or one that
  prints each message, so a command run on a laptop never emails a real user.
- **`@sdxc/billing/middleware/cli`, `@sdxc/newsletter/middleware/cli`:** publish the configured
  provider, for granting an entitlement or subscribing an address by hand. Both providers are
  already HTTP APIs, so they work from a command as they are, with the same secrets.

`@sdxc/flags` and `@sdxc/authz` get no entry: a command line is a developer's tool, and the
developer running it already has every permission those packages would check.

The HTTP-only middleware in the table gets no entry.

### 4. Cloudflare's services from outside a Worker

Add `packages/cloudflare-api`, published as `@sdxc/cloudflare-api` (the package still needs the
user's approval before it is created): the Workers binding interfaces implemented over
Cloudflare's REST API, so code written against a binding runs unchanged in a command.

```typescript
import { d1, emailSender, queue } from "@sdxc/cloudflare-api";

let api = { accountId: env.CLOUDFLARE_ACCOUNT_ID, token: env.CLOUDFLARE_API_TOKEN };

let db = d1(api, { databaseId }); // D1Database, for @sdxc/data-table-d1
let jobs = queue(api, { queueId }); // Queue, for @sdxc/jobs/cloudflare
let email = emailSender(api); // SendEmailBinding, for @sdxc/mail/cloudflare
```

| Binding            | Endpoint                                                | Status                      |
| ------------------ | ------------------------------------------------------- | --------------------------- |
| `D1Database`       | `/accounts/<account>/d1/database/<id>/query`            | general availability        |
| `Queue`            | `/accounts/<account>/queues/<id>/messages` (and batch)  | general availability        |
| `SendEmailBinding` | `/accounts/<account>/email/sending/send`                | public beta, Workers Paid   |
| `KVNamespace`      | `/accounts/<account>/storage/kv/namespaces/<id>/values` | later, when a command needs |
| `R2Bucket`         | R2's S3-compatible API                                  | later, when a command needs |

- Each implements the interface `@cloudflare/workers-types` declares, with the binding's own
  semantics: a failed call rejects as the binding's does, so callers written for the binding
  handle it the same way.
- Account and resource ids come from the app's `cloudflare.config.ts`; the token comes from
  `CLOUDFLARE_API_TOKEN` and is never read from a file in the project.
- Where the REST API differs from the binding, the difference is the adapter's documented
  contract: Email Service answers per-recipient status where the binding answers one message
  id, and D1's `batch()` atomicity over HTTP is checked in a spike before the adapter claims it.
- Durable Objects, service bindings and other bindings without a public API stay out; a command
  that needs one calls the deployed Worker over HTTP.

The local half needs no adapter: D1 is Miniflare's SQLite file (ADR-145, section 8), jobs run
through the memory queue, and mail goes to a memory or printing transport.

### 5. What an app's command line looks like

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

- **Nine new entry points** and a new package to document, test and keep in step with their siblings.
- **`@sdxc/cli`'s context is constrained** to the job context's shape before the package ships.
- **A second implementation of each binding** to keep in step with Cloudflare's, over APIs some
  of which (Email Service) are still in beta.
- **Commands against production hold an API token** with write access to the account's D1,
  Queues and email; ADR-145's confirmation before a `--remote` run is the guard.

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

### 3. Wrangler's platform proxy for remote bindings

Wrangler can hand a Node process binding objects that proxy to their remote resources, which
covers every binding type with one mechanism.

**Rejected because**: it ties every command to Wrangler and a proxy Worker it deploys, where the
repo runs Workers through its own `cf` CLI, and its behaviour is Wrangler's rather than a
documented API's. Revisit if a command needs a binding with no REST API.

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

### Phase 4: `@sdxc/cloudflare-api`

1. With the user's approval of the package: `d1`, after a spike against a real database
   (statements, `batch()`, errors), then `queue` and `emailSender`.
2. README, `LICENSE.md`, root README row, docs-site group.

## References

- [ADR-145: `@sdxc/cli` Package](./ADR-145-cli-package.md)
- [OpenTelemetry: Environment Variables as Context Propagation Carriers](https://opentelemetry.io/docs/specs/otel/context/env-carriers/)
- [Cloudflare Queues: publish via HTTP](https://developers.cloudflare.com/queues/examples/publish-to-a-queue-via-http/)
- [Cloudflare Email Service REST API](https://developers.cloudflare.com/email-service/api/send-emails/rest-api/)
- [POSIX locale environment variables](https://pubs.opengroup.org/onlinepubs/9799919799/basedefs/V1_chap08.html)

## Current Progress

- [ ] Phase 1: Context
- [ ] Phase 2: Services an app command reads first
- [ ] Phase 3: The rest
- [ ] Phase 4: `@sdxc/cloudflare-api`
