# ADR-057: Request Context Instead Of A Service Container

## Status

**Implemented** - 2026-09-11

## Background

[ADR-008](./ADR-008-service-container-for-remix-v3.md) introduced `@sdxc/service-container`: a
class-keyed container with application and request lifetimes, a `ServiceProvider` registration
contract, an async-local scope, and an `inject([Keys], handler)` helper for resolving dependencies
inside a Remix v3 handler. Eight workspaces adopted it, and `AGENTS.md` makes it the mandated way
for an app to reach its services.

Three months of use have settled what the container is actually carrying. Every app registers its
services as singletons or pre-built instances; nothing registers a factory whose value has to differ
between two units of work in the same isolate. Across the repository, 239 of roughly 270
`inject([…])` sites resolve exactly one key, `Database`, and 148 of 163 `getServiceContainer().get()`
calls resolve that same key. No application module rebinds a service inside an open scope.

Meanwhile Remix v3 grew the capability the container was built to supply. `createContextKey()` plus
a middleware that calls `context.set(Key, value, { property: "db" })` publishes a value onto the
request context as `context.db`, typed through the middleware's own generic and reachable from any
handler the router runs. `@sdxc/jobs` carries the same mechanism for a job context. Two apps already
resolve their database this way and then hand it straight back to the container.

## Context

### The container is one indirection around one service

`apps/uptime` registers three services — `Database`, `Mailer`, `ManagementClient` — all singletons.
`apps/books` registers one. The other apps register between one and five. What the container
provides over a module-level function is a lifetime model none of them use and a substitution seam
for tests, which is the only reason the indirection survives.

### The substitution seam is what the test files are really buying

A controller test builds its own router and, today, wraps the fetch in a container scope so the
handler resolves the test's in-memory database:

```ts
let container = new ServiceContainer();
container.instance(Database, db);

let router = createRouter({ middleware: [asyncContext()] });
router.map(routes.app.team.alerts.index, { middleware: [seedTeam(team, membership)], handler });

return container.scope(() => router.fetch(request));
```

The router already has a middleware list. A middleware that publishes the database is the same seam
in one fewer concept.

### Two engine packages use the container as a host handoff

`createProviderRouter(db, options)` in `@sdxc/oidc-provider` and `createBlogEngine(config)` in
`@sdxc/blog-engine` each build a private container solely to make the host's database reachable from
their own controllers. Both already build their own router with its own middleware chain, so the
value can travel the same way every other per-request value in those routers travels.

### Jobs have arrived at the answer already

`apps/uptime`, `apps/r3-auth` and `apps/blog-saas` each run a `database()` job middleware that
publishes `ctx.database`. `apps/uptime`'s version constructs the database directly; the other two
resolve it from the container and immediately put it on the context. The handlers read
`ctx.database` either way and name no container.

### What the container costs

| Cost                                 | Impact                                                                                                                                             |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| A second dependency mechanism        | Every app has both a container and a request context, and a reader has to know which services live where                                           |
| `inject` wraps the handler           | A handler's real signature is hidden behind a tuple, and the context arrives through `getContext()` rather than as the parameter the router passes |
| An async-local scope per entry point | `fetch`, `scheduled` and `queue` each open one, and a unit of work outside a scope fails at resolve time rather than at compile time               |
| Resolution is unchecked              | A key that was never registered is a runtime `ServiceNotFoundError`; a context property is a type error                                            |

## Decision

Remove `@sdxc/service-container`. Every service it carries moves to the mechanism that already
carries the rest of a request's values: the request context, published by middleware.

### The database travels on the context

Each app owns a module exporting the constructor the container used to register, under whichever
directory that app already keeps its wiring in:

```ts
let database: Database | undefined;

export function createDatabase(): Database {
	return (database ??= new Database(
		createD1DatabaseAdapter(env.DB, { onStatement: recordD1Statement }),
		{
			now: () => Date.now(),
		},
	));
}
```

The instance is memoized per isolate, which is the lifetime `container.singleton` gave it.

Each app owns `app/http/middleware/database.ts`, which publishes it and declares what it publishes:

```ts
export const Database = createContextKey<DataTable>();

declare module "remix/router" {
	interface RequestContext {
		/** The app's database, published by the global `database()` middleware. */
		db: DataTable;
	}
}

export function database(source: () => DataTable): Middleware {
	return (ctx, next) => {
		ctx.set(Database, source(), { property: "db" });
		return next();
	};
}
```

The middleware takes a factory rather than a database so that the binding is read when a request
runs, never when a module loads, whether the router is built once or per request.

`bootstrap/app.tsx` installs `database(createDatabase)` in the router's global middleware. A test
installs `database(() => db)` in the router it builds. The `declare module` augmentation follows the
same convention `require-team` and `config/router-context.d.ts` already use for globally installed
middleware, so `ctx.db` types at every call site without a reader function or a cast.

### Handlers take the context they were always given

```ts
// Before
export default createAction(
	routes.articles,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let articles = await ArticlePost.listItems(db, { includePreview: isAdmin() });
		return ctx.render(ArticlesView, ArticlesViewModel.index(articles));
	}),
);

// After
export default createAction(routes.articles, async (ctx) => {
	let articles = await ArticlePost.listItems(ctx.db, { includePreview: isAdmin() });
	return ctx.render(ArticlesView, ArticlesViewModel.index(articles));
});
```

### Everything else moves the same way, or stops moving

A service a test substitutes gets a middleware and a context property, exactly as the database does.
A service no test substitutes becomes a memoized module function the caller imports — `mailer()`,
`managementClient()` — with no key, no registration and no scope.

| Service                             | Where it lands                                                                               |
| ----------------------------------- | -------------------------------------------------------------------------------------------- |
| `Database` (every app)              | `ctx.db` for requests, `ctx.database` for jobs                                               |
| `Mailer` (uptime, r3-auth)          | `ctx.mailer` on a job context; requests already read `ctx.email` from the mail middleware    |
| `ManagementClient` (uptime)         | `app/lib/management-client.ts`, a memoized function                                          |
| `Buttondown` (books)                | `app/lib/buttondown.ts`, a module function; the three suites that script it mock that module |
| `RateLimiters` (r3-auth, auth-saas) | `app/lib/rate-limiters.ts`, a memoized function                                              |
| `RedirectsService` (blog)           | `app/lib/redirects.ts`, a memoized function                                                  |
| `BlogProvisioner` (blog-saas)       | Already on the context as `ctx.provisioner`                                                  |
| `HostnameClient` (blog-saas)        | Already on the context as `ctx.hostnames`                                                    |

### Engine packages take the database as middleware

`createProviderRouter(db, options)` and `createBlogEngine(config)` keep their signatures. Each
installs a `database(() => db)` middleware at the head of the router it already builds, and its
controllers read the context. No host changes.

### The entry points stop opening scopes

`bootstrap/worker.ts` in each app drops its `container.scope(…)` wrapper from `fetch`, `scheduled`
and `queue`. The cost ledger's own `trackCost(…)` scope is unrelated and stays.

### Phases

| Phase | Work                                                                                                              |
| ----- | ----------------------------------------------------------------------------------------------------------------- |
| 1     | `apps/books` — the smallest app, one service, proves the shape end to end                                         |
| 2     | `@sdxc/oidc-provider` and `@sdxc/blog-engine` — the engines define the seam their hosts sit behind                |
| 3     | `apps/blog`, `apps/blog-saas`, `apps/auth-saas`, `apps/r3-auth`                                                   |
| 4     | `apps/uptime` — 113 source files and 143 test files, mechanical by this point                                     |
| 5     | Delete `packages/service-container`, its eight `workspace:*` dependencies, and the documentation that mandates it |

### Out of scope

The `logger`, `mail`, `billing`, `session` and `cop` middleware chains are untouched: they already
own their values on the context. No app's service is renamed, and no service's construction changes
beyond where it is written.

## Consequences

### Positive

- **One mechanism** — a request's values all arrive the same way, and a reader has one place to look.
- **Resolution is type-checked** — a service that is not installed is a compile error, not a
  `ServiceNotFoundError` at the moment a handler runs.
- **Handlers keep their signature** — `async (ctx) => …` is the handler the router calls, with no
  wrapper between the route and the function.
- **Tests lose a concept** — a test installs a middleware in the router it was already building.
- **An entry point is what it looks like** — no async-local scope has to be open for a worker's
  `fetch`, `scheduled` or `queue` to resolve anything.
- **One fewer package** — and one fewer mandated pattern in `AGENTS.md`.

### Negative

- **Roughly 395 files change** — 243 source and 152 test, most of them a mechanical two-line edit.
- **A non-handler helper needs the database passed to it** — anything that reached for
  `getServiceContainer()` from outside a handler takes a parameter instead. Every such call site
  today is inside a controller, middleware or job.
- **ADR-008 is superseded three months after it was accepted**, along with the cross-references to it
  in nine other ADRs.

### Neutral

- **Service lifetimes are unchanged** — a memoized module function is the isolate-wide singleton the
  container registered, reached without a key.
- **`ctx.db` and `ctx.database`** — requests keep the property `apps/blog` established, jobs keep the
  one `@sdxc/jobs` established. Neither is renamed for symmetry.

## Alternatives Considered

**Keep the container for non-database services.** Rejected: the container's cost is having a second
mechanism at all, and a container carrying two mailers is the same cost for a fraction of the use.

**Make the database a module-level function everywhere, with no middleware.** Simplest for source,
but it removes the seam 152 test files use to hand in an in-memory database. Those tests would have
to mock a module instead of installing a middleware, which is a worse trade in both directions.

**Keep `inject` as a thin wrapper over the context.** Rejected: it preserves the wrapper without the
container behind it, so a handler still does not look like a handler.

**Leave `apps/uptime` on the container and remove it everywhere else.** Rejected: uptime is more than
half the call sites, so this keeps the package, the `AGENTS.md` rule, and the double mechanism while
paying most of the migration cost.

## References

- [ADR-008: Service Container For Remix V3](./ADR-008-service-container-for-remix-v3.md) — superseded by this ADR
- [ADR-044: Function-Defined Jobs With Declarative Schedules](./ADR-044-function-defined-jobs-with-declarative-schedules.md) — the job context this reuses
- [ADR-007: Publishable Package Releases](./ADR-007-publishable-package-releases.md) — `@sdxc/service-container` is private and has never been published
