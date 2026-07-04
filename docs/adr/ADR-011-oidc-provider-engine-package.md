# ADR-011: OIDC Provider Engine Package

## Status

**Implemented** - 2026-07-04

`@pkg/oidc-provider` (plus the `@pkg/data-table-sqlstorage` / `@pkg/data-table-d1`
adapter extractions) exists and is consumed by `apps/auth-saas`; all packages and
the app typecheck clean, 292 tests pass, and the app builds and passes
`wrangler deploy --dry-run`. Deviations from the design as written:

- **Migrations** keep the existing `?raw` SQL files, run through a small journaled
  runner (`adapter.executeScript` + an `oidc_migrations` table) rather than a
  registry of inline SQL strings — same effect (idempotent, ordered), and the model
  tests keep loading the `.sql` files directly.
- **Imports**: the package uses relative imports, not a `~/` alias — a consuming
  project resolves the package's `.ts` sources against its own tsconfig paths, so a
  `~/` alias would break there.
- The provider exposes **`ensureSigningKeys()` and `cleanup()`** lifecycle hooks
  (for the DO's boot and alarm) alongside `fetch`/`migrate`.
- The package is **fully self-contained**: it vendors every lib helper it needs
  (not only the tenant-only ones); the dashboard keeps its own copies of the generic
  wrappers, while `internal-auth` ships from the package as the single owner of the
  platform↔tenant token contract.

## Background

[ADR-009](./ADR-009-blog-saas-platform.md) established a pattern for the blog platform: the blog application is a host-agnostic workspace package (`@pkg/blog-engine`) that runs identically inside a Cloudflare Durable Object (the multi-tenant platform) or on a plain Worker with D1 (self-hosted), the way WordPress core is independent of WordPress.com. The host injects a `remix/data-table` `DatabaseAdapter`; the engine never imports Durable Object APIs.

`apps/auth-saas` has the same shape but inverted: its OIDC provider — the entire `src/tenant/` tree — already runs inside a per-tenant Durable Object, but it lives _inside the app_, not as a reusable package. [ADR-010](./ADR-010-auth-saas-completion-and-tenant-migration.md) completed and stabilized that provider in place (it now typechecks, tests, and builds), which makes this a good moment to apply the ADR-009 pattern: extract the provider into `@pkg/oidc-provider` so it can be self-hosted or run as a platform tenant.

## Context

### The Provider Is Already Decoupled

Unlike the greenfield blog-engine, the OIDC provider already exists and works, and it is already close to host-agnostic:

- `src/tenant/router.ts` is a factory `(db: Database, logger: Logger) => Router` — storage and logging are already parameters, not globals.
- `src/tenant/index.ts` (the Durable Object) is a thin wrapper: it builds `createSQLStorageDatabaseAdapter(this.ctx.storage.sql)`, calls `createDatabase(adapter)`, runs migrations, and forwards `fetch` to `createRouter(db, logger)`.
- Controllers read `db` from the request context (via the `database(db)` middleware), not from a global.

An audit of `src/tenant/**` (61 non-test files) found only three couplings to the Cloudflare runtime:

| Coupling                                                 | Where                                                                  | Notes                                                |
| -------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------- |
| `env.INTERNAL_SECRET`                                    | `src/tenant/middleware/management-auth.ts` (via `~/lib/internal-auth`) | HMAC secret for platform→tenant Management API calls |
| `AnalyticsService` (`env.ANALYTICS`)                     | `~/app/services/analytics`, called from auth/register verify           | Writes MAU/auth events to Analytics Engine           |
| `createSQLStorageDatabaseAdapter` + `cloudflare:workers` | `src/tenant/index.ts` only                                             | The DO wrapper itself — stays in the app             |
| Migrations via `import("./migrations/NNNN.sql?raw")`     | `src/tenant/index.ts`                                                  | Vite-specific raw import                             |

`src/tenant/index.ts` is the only file besides `management-auth.ts` that imports `cloudflare:workers`, and it is the wrapper that stays in the app. So the provider body reads exactly one binding (`INTERNAL_SECRET`) and one service (`AnalyticsService`) from the runtime — both easily injected.

### Shared Library Helpers

The tenant imports 17 helpers from `~/lib`. Some are also used by the dashboard (`src/app/`), which creates the boundary tension this ADR must resolve:

| Helper                                                                                                                                     | Tenant | Dashboard              | Nature                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ---------------------- | ---------------------------------------------- |
| `action`, `middleware`, `form`                                                                                                             | yes    | yes (17 / 7 / 3 files) | Thin typed wrappers over `remix/fetch-router`  |
| `db-errors`                                                                                                                                | yes    | yes (4)                | `remix/data-table` error classes               |
| `internal-auth`, `crypto-utils`                                                                                                            | yes    | yes (1 / 2)            | Platform↔tenant token contract (create/verify) |
| `user-agent`, `request-handler`                                                                                                            | yes    | yes (1 / 1)            | Small utilities                                |
| `schema-checks`, `safe-json`, `timestamp`, `uri-validation`, `parse-basic-auth`, `reject`, `css-sanitizer`, `user-rate-limit`, `base64url` | yes    | no                     | Tenant-only utilities                          |

### Relationship to Existing Decisions

- ADR-009 already proposes extracting the storage adapters to `@pkg/data-table-sqlstorage` (from `src/lib/sql-storage-adapter.ts`) and `@pkg/data-table-d1` (from r3-blog). The OIDC provider depends on neither — it sees only the `DatabaseAdapter` interface — but the hosts (the DO wrapper, a self-hosted worker) use them. Those extractions are shared with the blog work.
- ADR-010's completion work (router refactor, `Handle`-pattern components, `@simplewebauthn`/adapter API realignment, provisioning `POST /api/setup`) all lands _inside_ the code being extracted, so this ADR builds directly on it.

## Decision

Extract the OIDC provider from `apps/auth-saas/src/tenant/` into a new workspace package **`@pkg/oidc-provider`** exposing `createOidcProvider(config)`, host-agnostic and consumed by both a self-hosted worker and the auth-saas tenant Durable Object. Follow the `@pkg/blog-engine` design from ADR-009 and the extraction conventions from [ADR-001](./ADR-001-new-package-extraction.md).

### Target Topology

```
 sso.acme.com (self-hosted)              auth.sergiodxa.com / sso.sergiodxa.com (platform)
        |                                          |
        v                                          v
+------------------------+              +-------------------------------+
| Plain Worker           |              | apps/auth-saas worker         |
| createOidcProvider({   |              |  - entry.worker.ts routing    |
|   database: D1 adapter, |              |  - dashboard (control plane)  |
|   internalSecret, ...   |              |  - Tenant DO wrapper:         |
| })                     |              |    createOidcProvider({       |
+------------------------+              |      database: SqlStorage      |
        |                              |      adapter, internalSecret,  |
        v                              |      analytics, ...            |
+------------------------+             |    })                          |
| D1 (SQLite)            |             +-------------------------------+
+------------------------+                        |
                                                  v
                                        +-------------------------+
                                        | Tenant DO SQLite        |
                                        +-------------------------+

              both call the SAME @pkg/oidc-provider
```

### Package Structure

```
packages/oidc-provider/
|-- package.json
|-- tsconfig.json                 # extends ../../tsconfig.json
|-- README.md
+-- src/
    |-- index.ts                  # createOidcProvider + config types + internal-auth re-exports
    |-- provider.ts               # container/router assembly (from src/tenant/router.ts)
    |-- routes.ts                 # route map (from src/tenant/routes.ts)
    |-- controllers/              # oauth/, oidc/, webauthn/, discover/, api/, verify-email, index
    |-- models/                   # subject, client, session, passkey, signing-key, ... , tenant-meta
    |-- values/                   # access-token, id-token, logout-token
    |-- components/               # server-rendered views (Handle<Props> pattern)
    |-- client/                   # webauthn client entries
    |-- middleware/               # db, logger, management-auth
    |-- database/
    |   |-- migrations.ts         # programmatic registry (SQL as TS strings)
    |   +-- schema/               # table() definitions (optional export)
    +-- lib/                      # tenant-only helpers moved verbatim
        |-- schema-checks.ts, safe-json.ts, timestamp.ts, uri-validation.ts,
        |-- parse-basic-auth.ts, reject.ts, css-sanitizer.ts, user-rate-limit.ts,
        |-- base64url.ts, crypto-utils.ts, internal-auth.ts, db-errors.ts,
        +-- action.ts, middleware.ts, form.ts, request-handler.ts, user-agent.ts
```

`apps/auth-saas` keeps the DO wrapper (`src/tenant/index.ts`, rewritten to consume the package), the control-plane dashboard (`src/app/`), the entry worker, and app-only lib (`platform-session`, `rate-limit`, `host-metadata`).

### Public API

```typescript
// packages/oidc-provider/src/index.ts
import type { DatabaseAdapter } from "remix/data-table";
import type { Logger } from "@pkg/logger/request";

/** Sink for authentication/registration analytics events (host-provided). */
export interface AnalyticsSink {
	trackAuthentication(tenantId: string, subjectId: string): void;
	trackRegistration(tenantId: string, subjectId: string): void;
}

export interface OidcProviderConfig {
	/** SQL access. DO host: @pkg/data-table-sqlstorage. Self-hosted: @pkg/data-table-d1. */
	database: DatabaseAdapter;

	/** HMAC secret shared with the control plane for Management API internal tokens. */
	internalSecret: string;

	/** Optional analytics sink; a no-op sink is used when omitted (self-hosted default). */
	analytics?: AnalyticsSink;

	/** "auto" (default): migrate lazily before first request. "manual": host calls migrate(). */
	migrations?: "auto" | "manual";

	logger?: Logger;
}

export interface OidcProvider {
	/** Handles one request. Pure Fetch: Workers, DOs, Bun, Node. */
	fetch(request: Request): Promise<Response>;
	/** Applies pending engine-owned migrations. Idempotent (journaled). */
	migrate(): Promise<{ applied: string[] }>;
}

export function createOidcProvider(config: OidcProviderConfig): OidcProvider;

// The platform↔tenant token contract ships from here so the control plane and the
// provider always agree on algorithm + claims (previously src/lib/internal-auth.ts).
export { createInternalToken, verifyInternalToken } from "./lib/internal-auth";
```

Injected by the host vs stored in the tenant's own database:

| Injected (runtime/secret material) | Stored in the tenant DB (already there today) |
| ---------------------------------- | --------------------------------------------- |
| `DatabaseAdapter`                  | issuer (`tenant_meta`), tenant id             |
| `internalSecret`                   | OAuth clients, secrets, redirect/logout URIs  |
| `analytics` sink (optional)        | subjects, passkeys, sessions, grants          |
| logger                             | signing keys, branding, resources             |

Everything the provider needs at request time other than the four injected values is already read from its own SQLite (issuer from `tenant_meta`, keys from `signing_keys`, etc.), which is exactly why the provider is portable.

### Coupling Breaks

1. **`env.INTERNAL_SECRET`** — `management-auth.ts` takes the secret from config instead of `env`. Because middleware is constructed in `provider.ts` where config is in scope, pass it through (e.g. `managementAuth(config.internalSecret)`).
2. **`AnalyticsService`** — replace the direct `~/app/services/analytics` import with the injected `config.analytics` sink (default no-op). The auth-saas DO wrapper passes an adapter that forwards to the existing Analytics Engine `AnalyticsService`; self-hosted installs omit it.
3. **Storage adapter** — already external (the provider receives `database`). The DO wrapper builds `createSQLStorageDatabaseAdapter(ctx.storage.sql)`; self-hosted builds `createD1DataTableAdapter(env.DB)`. Both from the ADR-009 adapter packages.
4. **Migrations via `?raw`** — a Durable Object has no filesystem, so migrations become a programmatic registry of SQL strings (`createMigrationRegistry`, exactly as ADR-009 specifies for blog-engine), run by `provider.migrate()`. The existing `src/tenant/migrations/*.sql` bodies move into `database/migrations.ts` as registered entries; the DO wrapper's hand-rolled `PRAGMA user_version` loop (added in ADR-010) is replaced by the journaled runner.

### Shared Library Helpers

The helpers split three ways:

- **Tenant-only helpers move into the package** (`src/lib/`), verbatim: `schema-checks`, `safe-json`, `timestamp`, `uri-validation`, `parse-basic-auth`, `reject`, `css-sanitizer`, `user-rate-limit`, `base64url`.
- **The platform↔tenant contract ships from the package**: `internal-auth` + `crypto-utils` move into `@pkg/oidc-provider` and are re-exported from its entry. The dashboard's `TenantApiService` imports `createInternalToken` from `@pkg/oidc-provider` instead of `~/lib/internal-auth`, guaranteeing the app and the provider agree on the token format.
- **Generic Remix v3 wrappers** (`action`, `middleware`, `form`, `db-errors`, `request-handler`, `user-agent`) are used by both the dashboard and the provider. Recommendation: **the package vendors its own copies** (they are ~10-line typed wrappers over `remix/fetch-router`, plus `db-errors` over `remix/data-table`), and the dashboard keeps its app-local copies. Duplicating a handful of tiny wrappers is cheaper and lower-risk than a second shared package, and it keeps the provider self-contained. A follow-up may extract a `@pkg/r3-http` for these once a third consumer appears (r3-blog has equivalents too) — noted as an open question, not done here.

### Migrations

Primary mechanism (both hosts): a programmatic registry, because a DO has no filesystem.

```typescript
// packages/oidc-provider/src/database/migrations.ts
import { createMigrationRegistry } from "remix/data-table/migrations";

export const migrationRegistry = createMigrationRegistry();
migrationRegistry.register({ id: "0001", name: "init", up: /* sql */ `...` });
// ... 0002-0007 ported from src/tenant/migrations/*.sql
```

`provider.migrate()` runs it through `createMigrationRunner(adapter, migrationRegistry)`, journaled. Self-hosters who prefer `wrangler d1 migrations apply` get a generated `.sql` set from a small script (TS stays the source of truth) — same dual-mode as blog-engine.

### Self-Hosted Worker Example

```typescript
// bootstrap/worker.ts of a self-hosted OIDC provider (template candidate)
import { createOidcProvider, type OidcProvider } from "@pkg/oidc-provider";
import { createD1DataTableAdapter } from "@pkg/data-table-d1";

let provider: OidcProvider | null = null;

export default {
	async fetch(request, env, ctx) {
		provider ??= createOidcProvider({
			database: createD1DataTableAdapter(env.DB),
			internalSecret: await env.INTERNAL_SECRET.get(),
			// no analytics, no platform — a single-tenant OIDC provider
		});
		return provider.fetch(request);
	},
} satisfies ExportedHandler<Env>;
```

The issuer, clients, subjects, and signing keys live in this worker's own D1, so it is a complete standalone IdP. (A self-hosted install still needs a one-time setup call or seed to write its issuer into `tenant_meta`, just as the platform does via `POST /api/setup`.)

### How apps/auth-saas Consumes It

The tenant DO wrapper shrinks to construction + config:

```typescript
// apps/auth-saas/src/tenant/index.ts (rewritten)
import { DurableObject } from "cloudflare:workers";
import { env } from "cloudflare:workers";
import { createOidcProvider, type OidcProvider } from "@pkg/oidc-provider";
import { createSQLStorageDatabaseAdapter } from "@pkg/data-table-sqlstorage";
import { AnalyticsService } from "~/app/services/analytics";

export default class Tenant extends DurableObject<Cloudflare.Env> {
	#provider: OidcProvider;

	constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
		super(ctx, env);
		this.#provider = createOidcProvider({
			database: createSQLStorageDatabaseAdapter(ctx.storage.sql),
			internalSecret: env.INTERNAL_SECRET,
			analytics: {
				trackAuthentication: (t, s) => AnalyticsService.trackAuthentication(t, s),
				trackRegistration: (t, s) => AnalyticsService.trackRegistration(t, s),
			},
			migrations: "manual",
		});
		ctx.blockConcurrencyWhile(() => this.#provider.migrate().then(() => {}));
	}

	override fetch(request: Request) {
		return this.#provider.fetch(request);
	}

	override async alarm() {
		/* cleanup via a provider-exposed hook + reschedule */
	}
}
```

The control plane, dashboard, entry worker, and D1 platform schema are unchanged except for importing `createInternalToken` from `@pkg/oidc-provider`.

## Consequences

### Positive

- **The OIDC provider becomes self-hostable**: one package serves the platform tenant DO, a self-hosted Worker with D1, and any Fetch runtime with a SQL database — the same portability property blog-engine has.
- **One provider version fleet-wide**: deploying auth-saas upgrades every tenant; a shared package means self-hosted installs and the platform share exactly one implementation.
- **The platform↔tenant token contract has one home**: `internal-auth` shipping from the package removes the risk of the app and the provider drifting on token format (a class of the `tenant_id`/`tenantId` bug fixed earlier).
- **Sharpens the boundary**: the extraction forces the last runtime couplings (`INTERNAL_SECRET`, analytics) to become explicit config, which is good hygiene regardless.
- **Low risk relative to size**: the provider is already `(db, logger) => router`; most of the work is moving files and rewiring imports, not redesigning behavior. Its 200+ existing tests move with it and keep proving it.

### Negative

- **Large mechanical move**: ~60 provider files + ~15 helpers change location, and every `~/...` import inside them is rewritten. Even mechanical moves of this size risk churn and merge pain.
- **Duplicated generic wrappers**: `action`/`middleware`/`form`/`db-errors` exist in both the package and the dashboard until a `@pkg/r3-http` extraction happens.
- **Migration-registry rewrite**: the `.sql?raw` imports become registry entries; the porting must preserve exact SQL and ordering (the tests and a fresh-DB migration run guard this).
- **Analytics indirection**: the provider no longer calls Analytics Engine directly; the DO wrapper must wire the sink, and a missed wiring silently drops metrics (mitigated by a wrapper test).

### Neutral

- **Storage-adapter packages are shared with blog work**: `@pkg/data-table-sqlstorage` / `@pkg/data-table-d1` are prerequisites already owned by ADR-009; this ADR consumes them.
- **apps/auth-saas stays the platform**: the control plane, billing, custom domains, and dashboard remain an app; only the provider engine is extracted.
- **No behavior change**: endpoints, flows, and the tenant DB schema are identical before and after; this is a repackaging, not a feature change.

## Implementation Plan

### Phase 0: Adapter Packages (shared with ADR-009)

**Priority:** High — **Effort:** 2-3 days
Extract `@pkg/data-table-sqlstorage` and `@pkg/data-table-d1`; point apps/auth-saas at them. (If ADR-009 lands first, this is already done.)

### Phase 1: Scaffold the Package

**Priority:** High — **Effort:** 1 day
Create `packages/oidc-provider` (package.json, tsconfig, exports map). Move the tenant-only lib helpers and `internal-auth`/`crypto-utils` in; add the generic-wrapper copies.

### Phase 2: Move the Provider

**Priority:** High — **Effort:** 3-4 days
Move `src/tenant/{controllers,models,values,components,client,middleware,routes}` into the package; rewrite imports to package-internal paths. Convert `router.ts` into `provider.ts` + `createOidcProvider`. Port migrations into the programmatic registry.

### Phase 3: Break the Couplings

**Priority:** High — **Effort:** 1-2 days
`managementAuth(config.internalSecret)`; injected `analytics` sink with no-op default; `migrate()` via the journaled runner.

### Phase 4: Rewire apps/auth-saas

**Priority:** High — **Effort:** 1 day
Rewrite the DO wrapper to construct `createOidcProvider`; repoint `TenantApiService` to import `createInternalToken` from the package; delete the moved files from the app. Keep typecheck + tests + build green.

### Phase 5: Self-Hosted Example + Docs

**Priority:** Medium — **Effort:** 1 day
Add a `templates/` (or example app) self-hosted worker; README; note the `wrangler d1` migration-generation script.

## Alternatives Considered

### 1. Leave the provider inside apps/auth-saas

**Rejected**: it cannot be self-hosted, and it forecloses the WordPress-core property the blog work committed to. The provider is already decoupled enough that keeping it embedded wastes that.

### 2. Extract to an internal module boundary, not a package

Keep it in the app but enforce a "no runtime imports" lint boundary (like a folder convention).

**Rejected**: a folder can't be depended on by a _separate_ self-hosted app; a workspace package is the only thing that composes across apps, which is the whole point.

### 3. Extract the shared generic helpers into `@pkg/r3-http` now

Move `action`/`middleware`/`form`/`db-errors` into a shared package consumed by the dashboard, the provider, and r3-blog.

**Deferred, not rejected**: worth doing once there is a clear third consumer, but bundling it into this extraction widens the blast radius. The provider vendors its copies for now; a follow-up ADR can consolidate.

### 4. One provider deployment per tenant (Workers for Platforms)

**Rejected** for the same reasons as ADR-006/009: identical code per tenant, deploy fan-out, higher cost; the DO-per-tenant model already isolates data and compute.

## Risks

| Risk                                                | Mitigation                                                                                                                               |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Large move introduces import/wiring regressions     | The provider's existing ~200 tests move with it; run them plus a fresh-DB migration run and `wrangler deploy --dry-run` after each phase |
| Migration porting changes SQL/ordering              | Port bodies verbatim; assert `PRAGMA user_version` progression and a clean fresh-DB boot                                                 |
| Analytics sink left unwired in the DO host          | A wrapper-level test asserting `trackAuthentication` fires on login                                                                      |
| Generic-wrapper duplication drifts                  | Keep the copies byte-identical; track the `@pkg/r3-http` follow-up                                                                       |
| `remix/data-table/migrations` registry availability | Confirm `createMigrationRegistry`/`createMigrationRunner` exist in the pinned beta before Phase 2 (same dependency blog-engine assumes)  |

## References

- [ADR-001: New Package Extraction](./ADR-001-new-package-extraction.md)
- [ADR-006: Auth SaaS Platform](./ADR-006-auth-saas-platform.md)
- [ADR-008: Service Container For Remix V3](./ADR-008-service-container-for-remix-v3.md)
- [ADR-009: Blog SaaS Platform](./ADR-009-blog-saas-platform.md) — the `@pkg/blog-engine` pattern this mirrors, and the source of the shared adapter packages
- [ADR-010: Auth SaaS Completion and Tenant Migration](./ADR-010-auth-saas-completion-and-tenant-migration.md) — stabilized the provider being extracted

## Notes

- The provider is already `(db, logger) => Router`, and only `env.INTERNAL_SECRET` + `AnalyticsService` couple it to the runtime — the extraction is mostly moving files, not decoupling logic.
- `internal-auth`/`crypto-utils` shipping from the package is deliberate: the control plane (`TenantApiService`) and the provider (`management-auth`) must agree on the internal-token format, so the contract should have exactly one owner.
- The tenant DB schema and every endpoint are unchanged; this is a repackaging. A tenant DO created before the extraction keeps working after it (same SQLite, same migrations, same routes).
- This ADR depends on the ADR-009 adapter extractions (`@pkg/data-table-sqlstorage`, `@pkg/data-table-d1`); sequence whichever platform lands first to do that extraction, and the other consumes it.
- Naming: `@pkg/oidc-provider` describes what it is (an OIDC/OAuth2 provider) rather than paralleling `@pkg/blog-engine`'s role-based name — chosen deliberately for precision.
