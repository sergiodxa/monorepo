# @sdxc/idempotency

Idempotency-Key requests: replay the first response, refuse conflicting reuse.

## Installation

```bash
npm add @sdxc/idempotency
```

The middleware runs on the [`remix`](https://www.npmjs.com/package/remix) router, the durable
store over `remix/data-table`; refusals are
[`@sdxc/problem`](https://www.npmjs.com/package/@sdxc/problem) documents, durations are
[`@sdxc/duration`](https://www.npmjs.com/package/@sdxc/duration) inputs, and results are
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) values. All install alongside this
package.

A `POST` that times out leaves its client unsure whether the resource was created. The IETF
[Idempotency-Key draft](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/)
settles it: the client sends a unique `Idempotency-Key` with the request, the server runs it once
and stores the outcome, and every retry with that key gets the stored outcome back. This package
implements the server side as router middleware, plus the client helpers that mint keys and put
them on requests. The server depends on one guarantee from its store, an atomic claim: of two
concurrent requests with the same key, exactly one runs the handler.

## Usage

### Send A Key

```typescript
import { generateIdempotencyKey, withIdempotencyKey } from "@sdxc/idempotency/client";
import { unwrap } from "@sdxc/result";

let key = generateIdempotencyKey(); // once per operation, reused by every retry
let response = await fetch(url, unwrap(withIdempotencyKey({ method: "POST", body }, key)));
// Idempotency-Key: "8e03978e-40d5-43e8-bc93-6894a57f9324"
```

The key is an RFC 9651 sf-string, so it travels quoted.

### Protect A Route

```typescript
import { idempotency } from "@sdxc/idempotency/middleware";
import { MemoryStore } from "@sdxc/idempotency/memory";

let idempotent = idempotency({
	store: new MemoryStore(),
	scope: (ctx) => ctx.get(Caller).id, // whoever your authentication middleware identified
	ttl: "24 hours",
});

router.post(routes.orders.create, {
	middleware: [idempotent],
	handler: async (ctx) => createOrder(ctx), // runs once per key
});
```

For each `POST` or `PATCH`, the middleware answers:

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

### Store Records In SQL

```typescript
import { DataTableStore, purgeExpired } from "@sdxc/idempotency/data-table";
import { idempotency } from "@sdxc/idempotency/middleware";

let idempotent = idempotency({
	store: (ctx) => new DataTableStore(ctx.get(Db)), // a remix/data-table Database
	scope: (ctx) => `api-key:${ctx.get(Caller).id}`,
	ttl: "24 hours",
});

let purged = await purgeExpired(db); // from a scheduled job: Result<number, IdempotencyStoreError>
```

Create the table by pasting `IDEMPOTENCY_KEYS_SCHEMA_SQL` into a migration.

## API

### `@sdxc/idempotency`

#### `readIdempotencyKey(headers, options?)`

Reads the `Idempotency-Key` field as an RFC 9651 Item whose value is a non-empty sf-string, into a
`Result<string | null, IdempotencyKeyError>`. Parameters are ignored, and an absent header
succeeds with `null`. `options.maxLength` (`ReadIdempotencyKeyOptions`) bounds the key, 255
characters by default.

#### `formatIdempotencyKey(key)`

Serializes a key as the field value, quoted and escaped, into a
`Result<string, IdempotencyKeyError>`. Fails for an empty key or one with characters outside
printable ASCII.

#### `IDEMPOTENCY_KEY_HEADER`

`"Idempotency-Key"`.

#### `fingerprint(request)`

Resolves to the SHA-256 (hex) over the method, the path with its query, the content type's
essence (no parameters, lowercased) and the body bytes. The origin is excluded. It consumes the
body, so pass a clone.

#### `IdempotencyStore`

The contract the middleware claims through, three methods each resolving to a `Result` with an
`IdempotencyStoreError` failure:

```typescript
interface IdempotencyStore {
	claim(request: ClaimRequest): Promise<Result<ClaimOutcome, IdempotencyStoreError>>;
	complete(
		id: string,
		lease: string,
		response: StoredResponse,
		expiresAt: number,
	): Promise<Result<void, IdempotencyStoreError>>;
	release(id: string, lease: string): Promise<Result<void, IdempotencyStoreError>>;
}
```

`claim` is atomic: of concurrent claims on one id, exactly one answers
`{ status: "claimed", lease }`; the others see `{ status: "in-flight", fingerprint }` or
`{ status: "completed", fingerprint, response }`. A record is claimable again once it expires, or
while in flight past its lease (an invocation that died). `complete` and `release` act only while
the lease still holds, so a resumed stale invocation never overwrites the outcome of the retry
that took its claim over; `release` also leaves a completed record alone.

#### `ClaimRequest`, `ClaimOutcome`, `StoredResponse`

A claim carries the record `id`, the request `fingerprint` (or `null`), `now`, `leaseMs` and
`expiresAt`, all in epoch milliseconds. A `StoredResponse` is plain JSON: `status`, lowercased
header pairs without `Set-Cookie`, and the body as base64.

#### `IdempotencyKeyError`, `IdempotencyStoreError`

The key the client sent is unacceptable, with `reason` `"invalid"` or `"too-long"`; the store
could not answer.

#### `IDEMPOTENCY_PROBLEM_ENTRIES`

The four `@sdxc/problem` catalog entries, `idempotencyKeyMissing` (400), `idempotencyKeyInvalid`
(400), `idempotencyKeyInUse` (409) and `idempotencyKeyReused` (422), to spread into a
`defineProblems` catalog. Their slugs are the wire contract clients match on.

### `@sdxc/idempotency/middleware`

#### `idempotency(options)`

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
| `problems`      | `about:blank` problems | the builders refusals are answered with, usually a problem catalog       |

The record id is the SHA-256 of prefix, scope, method, pathname and key. A handler that throws
releases the key and the error propagates. Events go to the invocation's
[`@sdxc/logger`](https://www.npmjs.com/package/@sdxc/logger) log (`idempotency.replayed`,
`idempotency.in_flight`, `idempotency.reused`, `idempotency.store_unavailable`) without the key
or the scope.

#### `IdempotencyOptions`, `IdempotencyProblems`

The options above, and the four builders `problems` takes, which a catalog containing
`IDEMPOTENCY_PROBLEM_ENTRIES` satisfies.

### `@sdxc/idempotency/data-table`

#### `DataTableStore`

`new DataTableStore(db)` stores records in a `remix/data-table` `Database` whose schema includes
`idempotency_keys`. `claim` is one conditional upsert followed by a read, so it stays atomic on
databases without interactive transactions, such as Cloudflare D1, as well as on Durable Object
SQLite. `complete` and `release` are single statements guarded by `id` and `lease`.

#### `idempotencyKeys`, `IdempotencyKeyRow`

The table definition and its row type.

#### `IDEMPOTENCY_KEYS_SCHEMA_SQL`

`create table` plus an index on `expires_at`, for a migration. Apply it through a migration
runner: D1's `exec()` treats each line as its own statement.

#### `purgeExpired(db, now?)`

Deletes every record whose `expires_at` has passed and resolves to how many went, as a
`Result<number, IdempotencyStoreError>`.

### `@sdxc/idempotency/memory`

#### `MemoryStore`

`new MemoryStore()` is an in-process store for tests and single-isolate development, atomic
within one isolate.

### `@sdxc/idempotency/client`

#### `generateIdempotencyKey()`

A random UUID.

#### `deriveIdempotencyKey(...parts)`

Resolves to the SHA-256 (hex) of the parts, keeping part boundaries: the same parts always give
the same key.

#### `withIdempotencyKey(init, key)`

A copy of `init` with the header set, other headers kept, as a
`Result<RequestInit, IdempotencyKeyError>`.

#### `applyIdempotencyKey(request, key?)`

Sets the header on a `POST` or `PATCH` that has none, generating a UUID when `key` is omitted, as
a `Result<Request, IdempotencyKeyError>`. Other methods and requests that already carry a key
come back unchanged.

## Pattern: Refusals From Your Problem Catalog

```typescript
import { IDEMPOTENCY_PROBLEM_ENTRIES } from "@sdxc/idempotency";
import { DataTableStore } from "@sdxc/idempotency/data-table";
import { idempotency } from "@sdxc/idempotency/middleware";
import { defineProblems } from "@sdxc/problem";

const PROBLEMS = defineProblems("https://docs.example.com/errors/", {
	...IDEMPOTENCY_PROBLEM_ENTRIES,
	notFound: { slug: "not-found", status: 404, title: "The resource does not exist" },
});

let idempotent = idempotency({
	store: (ctx) => new DataTableStore(ctx.get(Db)),
	scope: (ctx) => `api-key:${ctx.get(Caller).id}`,
	ttl: "24 hours",
	required: true,
	problems: PROBLEMS,
});
```

Mount it after authentication, since the scope needs the caller, and after rate limiting, so a
replay still spends budget. Publish the `ttl` in the API reference; the draft asks servers to
state when keys expire.

## Pattern: A Durable Object As The Store

When records belong next to one tenant's data, the object runs a `DataTableStore` over its own
SQLite and exposes the three methods over RPC; the Worker hands the middleware a thin adapter:

```typescript
idempotency({
	store: (ctx) => {
		let stub = ctx.get(TenantStub);
		return {
			claim: (request) => stub.idempotencyClaim(request),
			complete: (id, lease, response, expiresAt) =>
				stub.idempotencyComplete(id, lease, response, expiresAt),
			release: (id, lease) => stub.idempotencyRelease(id, lease),
		};
	},
	scope: (ctx) => ctx.get(Caller).id,
	ttl: "24 hours",
});
```

## Pattern: Keys For Retried Jobs

A queue message id is the same on every delivery, so a key derived from it survives the job's
own retries with nothing stored:

```typescript
import { deriveIdempotencyKey, withIdempotencyKey } from "@sdxc/idempotency/client";
import { unwrap } from "@sdxc/result";

let key = await deriveIdempotencyKey(message.id, "create-order");
await fetch(url, unwrap(withIdempotencyKey({ method: "POST", body }, key)));
```

Clients must resend the same bytes: the same JSON with keys reordered fingerprints differently
and gets `422`. A handler that commits a write and then answers `5xx` needs its own
`shouldStore`, or a retry repeats the write.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/idempotency": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
