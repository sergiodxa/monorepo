# ADR-082: Idempotency-Key Package

## Status

**Accepted** - 2026-09-24

## Background

A `POST` that times out leaves its client not knowing whether the monitor, subject or API key
it asked for was created. Retrying risks a duplicate; giving up risks losing the write. The IETF
draft [draft-ietf-httpapi-idempotency-key-header](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/)
standardizes what Stripe and others do: the client sends a unique `Idempotency-Key` with a
non-idempotent request, the server performs the request once, stores the outcome under that key,
and answers every repeat of it with the stored outcome.

The repo is on the client side of this contract already: `@sdxc/billing` sends idempotency keys
to Stripe and Mercado Pago so a double-submitted checkout creates one session. Its own public
APIs (uptime's `/api/v1/*` and auth-saas's management API) offer their clients nothing
equivalent, so a client retrying a create against them duplicates the resource.

## Context

### What the draft specifies

| Rule                                                                                                   | Consequence for the package                                                                                             |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `Idempotency-Key` is an Item Structured Header whose value is an sf-string: `Idempotency-Key: "8e03…"` | the key is read and written through `@sdxc/structured-fields` ([ADR-079](./ADR-079-structured-field-values-package.md)) |
| The key is meant for non-idempotent methods (`POST`, `PATCH`)                                          | the middleware applies to those methods and passes others through                                                       |
| Keys should be UUIDs or other random values with enough entropy                                        | the client helper generates UUIDs; the server treats the key as opaque and bounds its length                            |
| The resource should publish when a key expires                                                         | a required `ttl` option, which the API docs state                                                                       |
| A server may compute a request fingerprint and compare it on reuse                                     | a SHA-256 fingerprint of method, path, content type and body, on by default                                             |
| Missing key on a resource that requires one: `400 Bad Request`                                         | an `idempotencyKeyMissing` problem, sent only when `required: true`                                                     |
| Same key while the first request is still processing: `409 Conflict`                                   | an `idempotencyKeyInUse` problem, needing a store that can tell "in flight" apart atomically                            |
| Same key with a different payload: `422 Unprocessable Content`                                         | an `idempotencyKeyReused` problem, sent when fingerprints differ                                                        |
| Error responses should use problem details (RFC 9457)                                                  | every refusal is an `@sdxc/problem` response                                                                            |
| A key must not let one client obtain another's response                                                | records are scoped by a caller-supplied identity, never by the key alone                                                |

### Existing idempotency code

| Location                                               | Role                                                                                                                          |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `packages/billing/src/providers/stripe/index.ts`       | Sends `idempotency-key` with a raw value, derived as `${connection}:customer:${externalId}` or passed through from the caller |
| `packages/billing/src/providers/mercado-pago/index.ts` | Sends `X-Idempotency-Key`, derived from our own identifiers                                                                   |
| `packages/billing/src/providers/polar/index.ts`        | Polar reads no idempotency header, so the key travels in checkout metadata                                                    |
| `packages/billing/src/providers/stripe/map.ts`         | Maps Stripe's `idempotency_key_in_use` and `idempotency_error` to `conflict`                                                  |
| `packages/api-client/src/api-client.ts`                | `APIClient` with `before` and `after` hooks; it has no retry loop, and each `fetch` builds a fresh `Request`                  |
| `packages/auth/src/management-client.ts` (1770 lines)  | The management API's client; its private `#send` builds headers and calls `fetch` directly, outside `APIClient`               |

The billing providers speak each provider's own header convention (unquoted, sometimes
`X-`-prefixed), which is not the draft's sf-string. They stay as they are. No code in the repo
receives an idempotency key.

### The routes that need it

| App                               | Non-idempotent routes (files under `app/http/controllers/`)                                                                                                                                                                                                                                                                                                                                                                                                            | Deployed                  |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `apps/uptime` (`/api/v1/*`)       | the `*Create` actions in `api/monitors.ts`, `api/dns-monitors.ts`, `api/tcp-monitors.ts`, `api/flow-monitors.ts`, `api/cron-jobs.ts`, `api/alerts.ts`, `api/maintenance.ts`, `api/status-pages.ts`, `api/invites.ts`, `api/team-domains.ts`, `api/api-keys.ts`, `api/monitor-content-checks.ts`                                                                                                                                                                        | yes, as the `ping` worker |
| `apps/auth-saas` (management API) | `management/subjects/create.ts`, `management/clients/register.ts`, `management/clients/rotate-secret.ts`, `management/api-keys/create.ts`, `management/api-keys/rotate.ts`, `management/webhook-endpoints/register.ts`, `management/webhook-endpoints/rotate-secret.ts`, `management/webhook-endpoints/deliveries.ts` (replay), `management/roles/define.ts`, `management/tenants/members-invite.ts`, `management/subjects/import.ts`, `management/subjects/export.ts` | no                        |

Uptime keeps its data in D1 (`DB`, published as `ctx.db`) and its API caller as `ctx.apiKey` and
`ctx.apiTeam` (`app/http/middleware/require-api-key.ts`). auth-saas keeps each tenant's data in a
`Tenant` Durable Object (`database/tenant-do.ts`, SQLite through `@sdxc/data-table-sqlstorage`),
reached as `ctx.tenantStub`, with the caller as `ctx.managementCaller`
(`app/http/middleware/management-auth.ts`).

### Where the records can live

The one operation the server cannot do without is an atomic claim: of two concurrent requests
carrying the same key, exactly one may run the handler, and the other must learn that the first
is in flight.

| Store                                          | Atomic claim                                                                                             | Consistency                                                  | Verdict                          |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------- |
| Workers KV (directly or through `@sdxc/cache`) | none: no put-if-absent, no compare-and-set; `@sdxc/cache`'s interface is `read`/`write`/`fetch`/`delete` | eventual, up to 60 seconds between locations                 | cannot implement `409` or dedupe |
| D1 through `remix/data-table`                  | one `insert … on conflict do update … where` statement, whose affected-row count says who won            | strongly consistent at the primary                           | yes                              |
| Durable Object SQLite                          | the same statement, and the object serializes its own requests                                           | strongly consistent, co-located with the object's other data | yes                              |

KV fails the requirement outright, not only at the margin. Two retries arriving at two
Cloudflare locations within the propagation window both read "no record", both run the handler,
and the resource is created twice, which is the exact failure the header exists to prevent. Even
within one location, a read followed by a write leaves a gap a concurrent request falls through.
A KV-backed store could replay completed responses, but it could neither detect an in-flight
duplicate nor guarantee a single execution, so the package offers none.

## Decision

Add `@sdxc/idempotency`: Remix v3 fetch-router middleware that implements the draft on the
server, a store interface with a `remix/data-table` implementation that runs on D1 and on Durable
Object SQLite, and client helpers that mint keys and put them on requests.

### Package name

| Name                             | Trade-off                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **`@sdxc/idempotency`** (chosen) | Names the behavior a caller wants, and covers both the server middleware and the client helpers                                |
| `@sdxc/idempotency-key`          | Names the header exactly, but reads as a key generator and undersells the middleware and store                                 |
| `@sdxc/idempotent-requests`      | Descriptive, longer, and not a term the draft or other ecosystems use                                                          |
| Part of `@sdxc/http`             | No new package, but it would pull `remix/data-table`, `@sdxc/problem` and a stateful store into a package of stateless helpers |

`@sdxc/idempotency` wins because the package is the whole mechanism (header, store, replay), and
the header is one piece of it.

### Scope

The package includes:

- Reading and writing the `Idempotency-Key` header as an sf-string
- The request fingerprint
- The `idempotency()` middleware: claim, run, store, replay, and the `400`/`409`/`422` refusals
- The `IdempotencyStore` interface, a `remix/data-table` store with its schema SQL, and an
  in-memory store for tests
- Client helpers: key generation, deterministic keys for retried jobs, and setting the header on
  a `Request` or `RequestInit`

What stays out, and where it lives instead:

- Provider-specific idempotency headers (Stripe, Mercado Pago) live in `@sdxc/billing`
- Structured Field parsing lives in `@sdxc/structured-fields`
- Problem document building and each API's problem catalog live in `@sdxc/problem` and the
  catalog's owner (`apps/uptime/app/services/api-problems.ts`, `@sdxc/auth`'s management catalog)
- Retry policy (when and how often to resend) lives with the caller: a job's own retry through
  `@sdxc/jobs`, or the client code issuing the request
- Webhook delivery de-duplication, keyed by delivery id, lives in `@sdxc/webhooks` and
  `@sdxc/billing/webhooks`

### Exports

#### `"."`

```ts
import type { Result } from "@sdxc/result";

/** The `Idempotency-Key` header is absent, is not an sf-string Item, or exceeds the length bound. */
export class IdempotencyKeyError extends Error {
	override name: "IdempotencyKeyError";
	readonly reason: "invalid" | "too-long";
}

/** The store could not be reached or answered something unreadable. */
export class IdempotencyStoreError extends Error {
	override name: "IdempotencyStoreError";
}

export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";

/** Reads the key: success with `null` when the header is absent. */
export function readIdempotencyKey(
	headers: Headers,
	options?: { maxLength?: number }, // @default 255
): Result<string | null, IdempotencyKeyError>;

/** Serializes a key as the header's sf-string value, quoted and escaped. */
export function formatIdempotencyKey(key: string): Result<string, IdempotencyKeyError>;

/** SHA-256 over method, path with query, content-type essence and body bytes, as hex. */
export function fingerprint(request: Request): Promise<string>;

/** A stored outcome: enough to rebuild a byte-identical `Response`. */
export interface StoredResponse {
	status: number;
	headers: [string, string][]; // Set-Cookie excluded
	body: string; // base64
}

export interface ClaimRequest {
	id: string; // hash of prefix, scope, method, path and key
	fingerprint: string | null;
	now: number; // epoch milliseconds
	leaseMs: number; // how long an in-flight claim holds before it counts as abandoned
	expiresAt: number;
}

export type ClaimOutcome =
	| { status: "claimed"; lease: string }
	| { status: "in-flight"; fingerprint: string | null }
	| { status: "completed"; fingerprint: string | null; response: StoredResponse };

/**
 * Records one outcome per id. `claim` must be atomic: of concurrent claims on an id,
 * exactly one answers `claimed`. `complete` and `release` act only while `lease` still holds.
 */
export interface IdempotencyStore {
	claim(request: ClaimRequest): Promise<Result<ClaimOutcome, IdempotencyStoreError>>;
	complete(
		id: string,
		lease: string,
		response: StoredResponse,
		expiresAt: number,
	): Promise<Result<void, IdempotencyStoreError>>;
	release(id: string, lease: string): Promise<Result<void, IdempotencyStoreError>>;
}

/** Problem entries an app spreads into its own `defineProblems` catalog. */
export const IDEMPOTENCY_PROBLEM_ENTRIES: {
	idempotencyKeyMissing: { slug: "idempotency-key-missing"; status: 400; title: string };
	idempotencyKeyInvalid: { slug: "idempotency-key-invalid"; status: 400; title: string };
	idempotencyKeyInUse: { slug: "idempotency-key-in-use"; status: 409; title: string };
	idempotencyKeyReused: { slug: "idempotency-key-reused"; status: 422; title: string };
};
```

The lease token closes a race the lease timeout opens: when a Worker dies mid-request and a later
retry reclaims the abandoned key, the original invocation, should it resume, can no longer
overwrite the new outcome, because its lease no longer matches.

#### `"./middleware"`

```ts
import type { DurationInput } from "@sdxc/duration";
import type { IdempotencyStore } from "@sdxc/idempotency";
import type { Middleware, RequestContext } from "remix/router";

/** The builders the middleware answers refusals with; an app's catalog satisfies it structurally. */
export interface IdempotencyProblems {
	idempotencyKeyMissing(options?: { detail?: string }): Response;
	idempotencyKeyInvalid(options?: { detail?: string }): Response;
	idempotencyKeyInUse(options?: { detail?: string }): Response;
	idempotencyKeyReused(options?: { detail?: string }): Response;
}

export interface IdempotencyOptions {
	/** Where records live; a function reads a per-request service off the context (ADR-057). */
	store: IdempotencyStore | ((context: RequestContext) => IdempotencyStore);
	/**
	 * Who the key belongs to: an API key id, a client id, a tenant and actor. Required,
	 * because a key scoped too widely would let one caller replay another's response.
	 */
	scope: (context: RequestContext) => string | Promise<string>;
	/** How long a completed outcome is replayed. Stated in the API docs, as the draft asks. */
	ttl: DurationInput;
	/** Answer `400` when the header is absent. @default false */
	required?: boolean;
	/** How long an in-flight claim holds before a retry may take it over. @default "1 minute" */
	lease?: DurationInput;
	/** Compare payloads on reuse; `false` compares keys alone. @default fingerprint */
	fingerprint?: false | ((request: Request) => Promise<string>);
	/** Which outcomes are stored; the rest release the key so a retry runs again. @default status < 500 */
	shouldStore?: (response: Response) => boolean;
	/** Largest body stored; a larger one releases the key. @default 1 MiB */
	maxBodyBytes?: number;
	/** What a store failure does: refuse with 503, or run the handler without protection. @default "closed" */
	failurePolicy?: "open" | "closed";
	/** Stable namespace for record ids. */
	prefix?: string;
	problems?: IdempotencyProblems; // @default about:blank problems via `problem()`
}

export function idempotency(options: IdempotencyOptions): Middleware;
```

For each `POST` or `PATCH` in its scope, the middleware:

1. Reads the key. Absent: pass through, or `idempotencyKeyMissing` when `required`. Malformed or
   too long: `idempotencyKeyInvalid`, whose detail says the value must be a quoted sf-string.
2. Computes the fingerprint from `ctx.request.clone()` and the record id from prefix, scope,
   method, pathname and key.
3. Claims. `in-flight`: `idempotencyKeyInUse` with `Retry-After: 1`. `completed` with a different
   fingerprint: `idempotencyKeyReused`. `completed` with the same fingerprint: rebuild the stored
   response and return it without calling `next()`.
4. Runs `next()`. A stored-worthy response under `maxBodyBytes` is buffered, stored with
   `complete`, and returned rebuilt from the buffer. Otherwise, and when the handler throws, the
   claim is released so a retry runs the handler again.

Each step records an event on `ctx.log` (`idempotency.replayed`, `idempotency.in_flight`,
`idempotency.reused`, `idempotency.store_unavailable`) and never logs the key or the scope.

Placement: after authentication (the scope needs the caller) and after rate limiting (a replay
still spends budget), before the handler.

#### `"./data-table"`

```ts
import type { IdempotencyStore, IdempotencyStoreError } from "@sdxc/idempotency";
import type { Result } from "@sdxc/result";
import type { Database, Table } from "remix/data-table";

/** The `idempotency_keys` table: id, fingerprint, lease, state, response JSON, lease and expiry instants. */
export const idempotencyKeys: Table;

/** SQL creating the table and its expiry index, for the host's own migration. */
export const IDEMPOTENCY_KEYS_SCHEMA_SQL: string;

/** Claims with one upsert statement, so it is atomic on D1 and on Durable Object SQLite. */
export class DataTableStore implements IdempotencyStore {
	constructor(db: Database);
}

/** Deletes expired records; run from a scheduled job. Returns how many rows went. */
export function purgeExpired(
	db: Database,
	now?: number,
): Promise<Result<number, IdempotencyStoreError>>;
```

`claim` is `insert into idempotency_keys (…) values (…) on conflict (id) do update set …
where idempotency_keys.expires_at <= :now or (idempotency_keys.state = 'in-flight' and
idempotency_keys.lease_expires_at <= :now)`, then a read of the row by id. The row's lease equals
the one just written exactly when this call won, so no transaction is needed and the store
satisfies the repo's D1-safe rule for multi-step writes. `complete` and `release` are single
`update`/`delete` statements guarded by `where id = ? and lease = ?`.

#### `"./memory"`

```ts
/** An in-process store for tests and single-isolate development; atomic within one isolate. */
export class MemoryStore implements IdempotencyStore {
	constructor(options?: { now?: () => number });
}
```

#### `"./client"`

```ts
/** A random UUID, for a request the caller sends once and retries by hand. */
export function generateIdempotencyKey(): string;

/**
 * A stable key derived from the parts with SHA-256, for work retried by a system
 * that remembers its own identity: `deriveIdempotencyKey(ctx.id, "create-monitor")`.
 */
export function deriveIdempotencyKey(...parts: string[]): Promise<string>;

/** Sets the header on a copy of `init` (keeping any headers already there). */
export function withIdempotencyKey(init: RequestInit, key: string): RequestInit;

/** Sets the header on a `POST`/`PATCH` request that does not carry one, for an `APIClient#before` hook. */
export function applyIdempotencyKey(request: Request, key?: string): Request;
```

The key has to outlive the attempt, and that decides where it is minted. `APIClient#fetch`
builds a new `Request` and calls `before` on every call, so a key generated inside `before`
changes on every retry and protects nothing across them. `applyIdempotencyKey` therefore fills
the header only when the caller has not already set one: a caller that retries passes its key in
`init`, and `before` keeps it. For work run by `@sdxc/jobs`, the queue message id
(`JobContext#id`) is the same on every attempt, so `deriveIdempotencyKey(ctx.id, step)` gives
each outbound write a key that survives the job's own retries with nothing stored.

### Usage

#### Uptime `/api/v1/*`

A new `apps/uptime/app/http/middleware/idempotency.ts`:

```ts
import { idempotency } from "@sdxc/idempotency/middleware";
import { DataTableStore } from "@sdxc/idempotency/data-table";

import { apiProblems } from "~/app/services/api-problems";

export default idempotency({
	store: (ctx) => new DataTableStore(ctx.db),
	scope: (ctx) => `api-key:${ctx.apiKey.id}`,
	ttl: "24 hours",
	prefix: "uptime-api",
	problems: apiProblems,
});
```

Each `*Create` action in the table above lists it after the key check:

```ts
import idempotent from "~/app/http/middleware/idempotency";

monitorsCreate: {
	middleware: [requireApiKey("monitors:write"), idempotent],
	handler: async (ctx) => { /* unchanged */ },
},
```

- `apps/uptime/app/services/api-problems.ts` spreads `IDEMPOTENCY_PROBLEM_ENTRIES` into its
  catalog, and `/docs/api/errors` gains the four pages.
- A migration under `apps/uptime/database/migrations/` creates the table from
  `IDEMPOTENCY_KEYS_SCHEMA_SQL`.
- A cron job in `apps/uptime/app/jobs/` calls `purgeExpired(ctx.db)` daily.
- The key is optional (`required` unset), so existing API clients keep working.

Uptime's `internalError` problem ("The change was saved but could not be read back") is a `500`
after a committed write. Under the default `shouldStore`, it releases the key and a retry creates
a second resource. Those routes pass `shouldStore: (response) => response.status !== 503` or
return a `201` with what they have; the choice is made per route during adoption.

#### auth-saas management API

The tenant's own Durable Object holds its idempotency records, next to the data the requests
change. The `Tenant` class in `apps/auth-saas/database/tenant-do.ts` gains three RPC methods that
delegate to a `DataTableStore` over its SQLite, and a tenant migration under
`database/tenant-migrations/` creates the table. The Worker-side store is a thin adapter,
`apps/auth-saas/app/http/middleware/management-idempotency.ts`:

```ts
export const managementIdempotency = idempotency({
	store: (ctx) => ({
		claim: (request) => ctx.tenantStub.idempotencyClaim(request),
		complete: (id, lease, response, expiresAt) =>
			ctx.tenantStub.idempotencyComplete(id, lease, response, expiresAt),
		release: (id, lease) => ctx.tenantStub.idempotencyRelease(id, lease),
	}),
	scope: (ctx) => `${ctx.managementCaller.actor.type}:${ctx.managementCaller.actor.id}`,
	ttl: "24 hours",
	prefix: "management",
	problems: managementProblems,
});
```

Each action factory in the table adds it after `managementRateLimit(options.limiter, { bucket:
"write" })`. The tenant is already fixed by which Durable Object holds the record, so the scope
names only the actor. `@sdxc/auth` spreads `IDEMPOTENCY_PROBLEM_ENTRIES` into
`managementProblems`, and `ManagementClient#send` gains an `idempotencyKey` option, set by
`createTenantSubject`, `registerTenantClient` and the other create methods from an optional
argument, so an SDK user retries with the same key.

## Consequences

### Positive

- **Safe retries on the public APIs** - a client that loses a response retries with the same key
  and gets the original outcome, never a duplicate resource
- **Standard behavior** - status codes, header syntax and problem responses follow the draft, so
  clients built for other APIs that use it work unchanged
- **Correct under concurrency** - the claim is one atomic statement, so two simultaneous retries
  run the handler once, on D1 and on Durable Object SQLite alike
- **One mechanism for both apps** - the store interface lets auth-saas keep records inside each
  tenant's object and uptime keep them in D1, behind the same middleware

### Negative

- **Two extra writes per protected request** - a claim before the handler and a completion after
  it, on D1's primary for uptime, which adds latency to every create carrying a key
- **Buffered responses** - a protected response is read fully into memory to be stored, so
  streaming responses gain nothing and bodies over `maxBodyBytes` are not replayable
- **Fingerprint strictness** - the same JSON with keys in a different order fingerprints
  differently and gets `422`; clients must resend the same bytes, which retry loops do naturally
- **Server errors are not replayed by default** - a handler that commits a write and then answers
  `5xx` needs its own `shouldStore`, or a retry repeats the write
- **A table and a sweep to own** - each adopting app adds a migration and a scheduled purge

### Neutral

- **Opt-in for clients** - with `required` unset, requests without a key behave exactly as today
- **Billing is unchanged** - provider idempotency headers keep each provider's convention
- **Strict header syntax** - an unquoted key is `400`, as the draft's sf-string requires; the
  problem detail says how to quote it

## Implementation Plan

### Phase 1: Build the package

**Priority:** High
**Estimated Effort:** 6 hours

Depends on ADR-079's package existing.

1. Write the tests first: header parsing (quoted, unquoted, parameters ignored, too long), each
   middleware branch against `MemoryStore`, a lease expiring and being reclaimed, a stale
   `complete` refused by lease, and `shouldStore` and `maxBodyBytes` releasing the key
2. Write `data-table.test.ts` over `@sdxc/cloudflare-mocks/sqlite`, including two concurrent
   claims where exactly one wins, and a `data-table.workers.test.ts` against a real D1 binding
3. Implement the store, middleware and client helpers; write the README; add the root README row

### Phase 2: Adopt in uptime

**Priority:** High
**Estimated Effort:** 3 hours

Uptime goes first: it is deployed and its API is public.

1. Add the migration, the middleware module, the catalog entries and the purge job
2. Add the middleware to each `*Create` action; decide `shouldStore` for routes answering
   `internalError`
3. Document the header, the 24-hour window and the four problems in the API docs
4. Build, migrate, deploy

### Phase 3: Adopt in auth-saas and `@sdxc/auth`

**Priority:** Medium
**Estimated Effort:** 3 hours

Two commits, one per workspace.

1. `@sdxc/auth`: add the catalog entries and the `idempotencyKey` option on `ManagementClient`
2. auth-saas: add the tenant migration, the three `Tenant` RPC methods, the middleware, and the
   middleware on each non-idempotent management action

### Phase 4: Publish

**Priority:** Low
**Estimated Effort:** 30 minutes

1. Remove `private: true`, add `description` and `LICENSE.md` (after
   `@sdxc/structured-fields` is public)
2. `bun run release:bootstrap @sdxc/idempotency`, then configure the trusted publisher

## Current Progress

- [x] Phase 1: Build the package
  - [x] Header helpers, `fingerprint`, the store contract and `IDEMPOTENCY_PROBLEM_ENTRIES`
  - [x] `./middleware`, `./memory`, `./data-table` and `./client`
  - [x] One store contract suite run against `MemoryStore`, the D1 driver over a D1 mock, the
        Durable Object driver over a `SqlStorage` mock, and a real D1 binding in workerd
  - [x] README
- [ ] Phase 2: Adopt in uptime
- [ ] Phase 3: Adopt in auth-saas and `@sdxc/auth`
- [ ] Phase 4: Publish

## Notes

- Implementation: `remix/data-table` cannot express the claim. Its upsert takes `values`,
  `conflictTarget` and `update`, with no condition on the `do update`, so `DataTableStore#claim`
  runs the statement as ``db.exec(sql`…`)`` through whichever driver the `Database` wraps, then
  reads the row with `db.find`. `complete`, `release` and `purgeExpired` use the query API
  (`updateMany`, `deleteMany`). The raw statement passes unchanged on the D1 driver, on the
  Durable Object SQLite driver and on a real D1 binding; the shared contract suite, including ten
  concurrent claims of which exactly one wins, runs on all three.
- Implementation: `withIdempotencyKey` and `applyIdempotencyKey` return
  `Result<RequestInit | Request, IdempotencyKeyError>` in place of the bare value. A key an
  sf-string cannot carry (non-ASCII, a control character, empty) has no valid header, and the
  repo reports failures as `Result`. Keys from `generateIdempotencyKey` and
  `deriveIdempotencyKey` always format.
- Implementation: `MemoryStore` takes no options. Every expiry is judged against the
  `ClaimRequest`'s `now`, which the middleware reads from `Date.now()`, so a test controls time
  with `vi.setSystemTime` and the store needs no clock of its own.
- Implementation: the middleware logs through `currentLog()` from `@sdxc/logger`, the same
  invocation log `ctx.log` exposes, and records nothing when no log is bound. `idempotency.store_unavailable`
  is a warning under both failure policies, with the policy as a field. A `503` from a
  closed policy carries `Retry-After: 1`.
- Implementation: `prefix` defaults to `"idempotency"`, a fixed value, because record ids are
  persisted and must stay stable across deploys.
- Implementation: `IDEMPOTENCY_KEYS_SCHEMA_SQL` must go through a migration runner. D1's
  `exec()` reads each line as its own statement and fails on the multi-line `create table`; the
  D1 mock in `@sdxc/cloudflare-mocks` accepts it, which only the Workers-pool test showed.
- Implementation: the package depends on `@sdxc/duration` (`ttl` and `lease` are
  `DurationInput`) and `@sdxc/logger`, and tests on `@sdxc/cloudflare-mocks`,
  `@sdxc/data-table-d1`, `@sdxc/data-table-sqlstorage` and `@cloudflare/workers-types`. The
  Workers-pool test uses the `DB` D1 binding the `packages-workers` project already declares.
- Implementation: `readIdempotencyKey` also refuses an empty sf-string (`""`), which cannot tell
  two operations apart; `formatIdempotencyKey` refuses an empty key to match.

## Alternatives Considered

### 1. Store records in KV through `@sdxc/cache`

**Rejected because**: KV has no conditional write and propagates eventually, so it cannot detect
an in-flight duplicate or guarantee a single execution; it would replay completed outcomes while
still letting concurrent retries create duplicates.

### 2. A dedicated idempotency Durable Object exported by the package

One object per scope, used by any app.

**Rejected because**: uptime already has a strongly consistent store in D1, and auth-saas already
routes every management request to the tenant's object; a third object adds a hop and a
`wrangler.jsonc` migration for no gain. The store interface leaves room for one later.

### 3. Make every create handler idempotent by natural keys

Deduplicate on the resource's own fields (a monitor's URL, a subject's email).

**Rejected because**: many resources have no natural unique key (two monitors on one URL are
legitimate), and it gives no answer for in-flight duplicates or for non-create operations such as
secret rotation.

### 4. Generate the key inside `APIClient#before`

**Rejected because**: `before` runs on every attempt with a new `Request`, so the key would change
on each retry; the key must be minted once per logical operation, by the caller.

## References

- [draft-ietf-httpapi-idempotency-key-header](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/)
- [RFC 9651 - Structured Field Values for HTTP](https://www.rfc-editor.org/rfc/rfc9651)
- [RFC 9457 - Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457)
- [Cloudflare Workers KV: how KV works](https://developers.cloudflare.com/kv/concepts/how-kv-works/)
- [ADR-057: Request Context Instead of a Service Container](./ADR-057-request-context-instead-of-a-service-container.md)
- [ADR-077: Problem Details Package](./ADR-077-problem-details-package.md)
- [ADR-079: Structured Field Values Package](./ADR-079-structured-field-values-package.md)
