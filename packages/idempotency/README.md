# @sdxc/idempotency

Idempotency-Key requests: replay the first response, refuse conflicting reuse.

## Overview

A `POST` that times out leaves its client unsure whether the resource was created. The IETF
[Idempotency-Key draft](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/)
settles it: the client sends a unique `Idempotency-Key` with the request, the server runs it once
and stores the outcome, and every retry with that key gets the stored outcome back. This package
implements the server side as Remix v3 fetch-router middleware, plus the client helpers that mint
keys and put them on requests.

The one thing the server cannot do without is an atomic claim: of two concurrent requests with
the same key, exactly one may run the handler. The `IdempotencyStore` interface states that
contract, and the `remix/data-table` store meets it with a single conditional upsert, so it holds
on D1 (which has no interactive transactions) and on Durable Object SQLite alike. Workers KV
cannot meet it, so no KV store is offered.

Entry points:

- `@sdxc/idempotency` — the header helpers, `fingerprint`, the store contract, the errors and the
  problem catalog entries
- `@sdxc/idempotency/middleware` — `idempotency(options)`
- `@sdxc/idempotency/data-table` — `DataTableStore`, `idempotencyKeys`,
  `IDEMPOTENCY_KEYS_SCHEMA_SQL`, `purgeExpired`
- `@sdxc/idempotency/memory` — `MemoryStore`
- `@sdxc/idempotency/client` — `generateIdempotencyKey`, `deriveIdempotencyKey`,
  `withIdempotencyKey`, `applyIdempotencyKey`

## Usage

### Protecting Routes

```typescript
import { DataTableStore } from "@sdxc/idempotency/data-table";
import { idempotency } from "@sdxc/idempotency/middleware";

export const idempotent = idempotency({
	store: (ctx) => new DataTableStore(ctx.db),
	scope: (ctx) => `api-key:${ctx.apiKey.id}`,
	ttl: "24 hours",
	prefix: "public-api",
	problems: apiProblems,
});

// in a controller
create: {
	middleware: [requireApiKey("monitors:write"), idempotent],
	handler: async (ctx) => { /* runs once per key */ },
},
```

For each `POST` or `PATCH` carrying a key, the middleware:

| Situation                                         | Answer                                           |
| ------------------------------------------------- | ------------------------------------------------ |
| No header, `required` unset                       | the handler runs, unprotected                    |
| No header, `required: true`                       | `400` `idempotencyKeyMissing`                    |
| Unquoted, malformed, empty or over-long key       | `400` `idempotencyKeyInvalid`                    |
| First request with the key                        | the handler runs; its response is stored         |
| Same key while the first is still running         | `409` `idempotencyKeyInUse` with `Retry-After`   |
| Same key, same payload, after the first completed | the stored response, handler not called          |
| Same key, different method, path or body          | `422` `idempotencyKeyReused`                     |
| Store unreachable                                 | `503` (`failurePolicy: "closed"`) or unprotected |

The key is an sf-string, so clients send it quoted:

```http
POST /api/v1/monitors HTTP/1.1
Idempotency-Key: "8e03978e-40d5-43e8-bc93-6894a57f9324"
Content-Type: application/json
```

### Creating The Table

Paste `IDEMPOTENCY_KEYS_SCHEMA_SQL` into a migration of the host app, and purge expired records
from a scheduled job:

```typescript
import { purgeExpired } from "@sdxc/idempotency/data-table";

let purged = await purgeExpired(ctx.db); // Result<number, IdempotencyStoreError>
```

### Sending Keys

```typescript
import { generateIdempotencyKey, withIdempotencyKey } from "@sdxc/idempotency/client";
import { unwrap } from "@sdxc/result";

let key = generateIdempotencyKey(); // once per operation, reused by every retry
let init = unwrap(withIdempotencyKey({ method: "POST", body }, key));
let response = await fetch(url, init);
```

## API

### `"."`

#### `readIdempotencyKey(headers, options?): Result<string | null, IdempotencyKeyError>`

Reads the `Idempotency-Key` field as an RFC 9651 Item whose value is a non-empty sf-string.
Parameters are ignored. Succeeds with `null` when the header is absent. `options.maxLength`
bounds the key (default 255 characters); a longer one fails with `reason: "too-long"`, anything
else unacceptable with `reason: "invalid"`.

#### `formatIdempotencyKey(key): Result<string, IdempotencyKeyError>`

Serializes a key as the field value, quoted and escaped. Fails for an empty key or one with
characters outside printable ASCII.

#### `IDEMPOTENCY_KEY_HEADER`

`"Idempotency-Key"`.

#### `fingerprint(request): Promise<string>`

SHA-256 (hex) over the method, the path with its query, the content type's essence (no
parameters, lowercased) and the body bytes. The origin is excluded. It consumes the body, so pass
a clone.

#### `IdempotencyStore`

```typescript
interface IdempotencyStore {
	claim(request: ClaimRequest): Promise<Result<ClaimOutcome, IdempotencyStoreError>>;
	complete(
		id,
		lease,
		response: StoredResponse,
		expiresAt,
	): Promise<Result<void, IdempotencyStoreError>>;
	release(id, lease): Promise<Result<void, IdempotencyStoreError>>;
}
```

`claim` is atomic: of concurrent claims on one id, exactly one answers
`{ status: "claimed", lease }`; the others see `{ status: "in-flight", fingerprint }` or
`{ status: "completed", fingerprint, response }`. A record is claimable again once it expires, or
while in flight past its lease (an invocation that died). `complete` and `release` act only while
the lease still holds, so a resumed stale invocation cannot overwrite the outcome of the retry
that took its claim over; `release` also leaves a completed record alone.

#### `ClaimRequest`, `ClaimOutcome`, `StoredResponse`

The claim carries the record `id`, the request `fingerprint` (or `null`), `now`, `leaseMs` and
`expiresAt`, all in epoch milliseconds. A `StoredResponse` is plain JSON: `status`, lowercased
header pairs without `Set-Cookie`, and the body as base64.

#### `IdempotencyKeyError`, `IdempotencyStoreError`

The key the client sent is unacceptable (`reason` says why); the store could not answer.

#### `IDEMPOTENCY_PROBLEM_ENTRIES`

The four `@sdxc/problem` catalog entries — `idempotencyKeyMissing` (400), `idempotencyKeyInvalid`
(400), `idempotencyKeyInUse` (409) and `idempotencyKeyReused` (422) — to spread into an API's
`defineProblems` catalog.

### `"./middleware"`

#### `idempotency(options): Middleware`

| Option          | Default                | Meaning                                                                  |
| --------------- | ---------------------- | ------------------------------------------------------------------------ |
| `store`         | required               | an `IdempotencyStore`, or a function reading one off the request context |
| `scope`         | required               | who the key belongs to; records are never shared across scopes           |
| `ttl`           | required               | how long a completed outcome is replayed (`DurationInput`)               |
| `required`      | `false`                | answer `400` when the header is absent                                   |
| `lease`         | `"1 minute"`           | how long an in-flight claim holds before a retry may take it over        |
| `fingerprint`   | `fingerprint`          | payload comparison on reuse; `false` compares keys alone                 |
| `shouldStore`   | `status < 500`         | which outcomes are stored; the rest release the key                      |
| `maxBodyBytes`  | 1 MiB                  | a larger body is returned but not stored, releasing the key              |
| `failurePolicy` | `"closed"`             | `"closed"` answers `503`; `"open"` runs the handler unprotected          |
| `prefix`        | `"idempotency"`        | namespace for record ids                                                 |
| `problems`      | `about:blank` problems | the builders refusals are answered with, usually the app's catalog       |

The record id is SHA-256 of prefix, scope, method, pathname and key. A handler that throws
releases the key and the error propagates. Events go to the invocation's log
(`idempotency.replayed`, `idempotency.in_flight`, `idempotency.reused`,
`idempotency.store_unavailable`) without the key or the scope.

#### `IdempotencyProblems`, `IdempotencyOptions`

The builder set a catalog satisfies structurally, and the options above.

### `"./data-table"`

#### `new DataTableStore(db)`

A store over a `remix/data-table` `Database` whose schema includes `idempotency_keys`. `claim`
runs `insert … on conflict (id) do update … where` the row expired or is in flight past its
lease, then reads the row back: its lease equals the one just written exactly when this call
won. `complete` and `release` are single statements guarded by `id` and `lease`.

#### `idempotencyKeys`, `IdempotencyKeyRow`

The table definition and its row type.

#### `IDEMPOTENCY_KEYS_SCHEMA_SQL`

`create table` plus an index on `expires_at`, for the host's migration. Apply it through a
migration runner: D1's `exec()` treats each line as its own statement.

#### `purgeExpired(db, now?): Promise<Result<number, IdempotencyStoreError>>`

Deletes every record whose `expires_at` has passed and answers how many went.

### `"./memory"`

#### `new MemoryStore()`

An in-process store for tests and single-isolate development, atomic within one isolate.

### `"./client"`

#### `generateIdempotencyKey(): string`

A random UUID.

#### `deriveIdempotencyKey(...parts): Promise<string>`

SHA-256 (hex) of the parts, keeping part boundaries: the same parts always give the same key.

#### `withIdempotencyKey(init, key): Result<RequestInit, IdempotencyKeyError>`

A copy of `init` with the header set, other headers kept.

#### `applyIdempotencyKey(request, key?): Result<Request, IdempotencyKeyError>`

Sets the header on a `POST` or `PATCH` that has none, generating a UUID when `key` is omitted.
Other methods and requests that already carry a key come back unchanged.

## Patterns

### A Durable Object As The Store

When records belong next to a tenant's data, the object runs a `DataTableStore` over its own
SQLite and exposes the three methods over RPC; the Worker hands the middleware a thin adapter:

```typescript
idempotency({
	store: (ctx) => ({
		claim: (request) => ctx.tenantStub.idempotencyClaim(request),
		complete: (id, lease, response, expiresAt) =>
			ctx.tenantStub.idempotencyComplete(id, lease, response, expiresAt),
		release: (id, lease) => ctx.tenantStub.idempotencyRelease(id, lease),
	}),
	scope: (ctx) => `${ctx.caller.type}:${ctx.caller.id}`,
	ttl: "24 hours",
});
```

### Keys For Retried Jobs

A queue message id is the same on every delivery, so a key derived from it survives the job's
own retries with nothing stored:

```typescript
let key = await deriveIdempotencyKey(ctx.id, "create-monitor");
await fetch(url, unwrap(withIdempotencyKey({ method: "POST", body }, key)));
```

### An API Client Hook

`applyIdempotencyKey` keeps a key the caller already set, so a caller retrying by hand passes its
key in the request and a `before` hook fills in only the requests that have none.

## Related Packages

- [`@sdxc/structured-fields`](../structured-fields/README.md) parses and writes the header
- [`@sdxc/problem`](../problem/README.md) builds the refusals and the catalog the entries join
- [`@sdxc/data-table-d1`](../data-table-d1/README.md) and
  [`@sdxc/data-table-sqlstorage`](../data-table-sqlstorage/README.md) run the data-table store
- [`@sdxc/rate-limit`](../rate-limit/README.md) sits before this middleware

## Tips

- Place the middleware after authentication (the scope needs the caller) and after rate limiting
  (a replay still spends budget).
- Publish the `ttl` in the API docs; the draft asks servers to state when keys expire.
- A handler that commits a write and then answers `5xx` needs its own `shouldStore`, or a retry
  repeats the write.
- Clients must resend the same bytes: the same JSON with keys reordered fingerprints differently
  and gets `422`.
