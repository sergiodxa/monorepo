# @sdxc/idempotency

Idempotency-Key requests: replay the first response, refuse conflicting reuse.

A `POST` that times out leaves its client unsure whether the resource was created. The IETF
[Idempotency-Key draft](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/)
settles it: the client sends a unique `Idempotency-Key`, the server runs the request once and
stores the outcome, and every retry with that key gets the stored outcome back. This package is
the server side as router middleware, plus client helpers that mint keys and put them on
requests.

## Installation

```sh
npm add @sdxc/idempotency
```

The middleware runs on the [`remix`](https://www.npmjs.com/package/remix) router and the durable
store on `remix/data-table`. Refusals are
[`@sdxc/problem`](https://www.npmjs.com/package/@sdxc/problem) documents, durations are
[`@sdxc/duration`](https://www.npmjs.com/package/@sdxc/duration) inputs, and fallible calls
answer [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) values.

## Usage

### Send a key

```typescript
import { generateIdempotencyKey, withIdempotencyKey } from "@sdxc/idempotency/client";
import { unwrap } from "@sdxc/result";

let key = generateIdempotencyKey(); // once per operation, reused by every retry
let response = await fetch(url, unwrap(withIdempotencyKey({ method: "POST", body }, key)));
// Idempotency-Key: "8e03978e-40d5-43e8-bc93-6894a57f9324"
```

The key is an RFC 9651 sf-string, so it travels quoted.

### Protect a route

```typescript
import { MemoryStore } from "@sdxc/idempotency/memory";
import { idempotency } from "@sdxc/idempotency/middleware";

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
| No header                                         | the handler runs, unprotected                    |
| No header, `required: true`                       | `400` `idempotencyKeyMissing`                    |
| Unquoted, malformed, empty or over-long key       | `400` `idempotencyKeyInvalid`                    |
| First request with the key                        | the handler runs; its response is stored         |
| Same key while the first is still running         | `409` `idempotencyKeyInUse` with `Retry-After`   |
| Same key, same payload, after the first completed | the stored response, without running the handler |
| Same key, different method, path or body          | `422` `idempotencyKeyReused`                     |
| Store unreachable                                 | `503` (`failurePolicy: "closed"`) or unprotected |

### Store records in SQL

```typescript
import {
	DataTableStore,
	IDEMPOTENCY_KEYS_SCHEMA_SQL,
	purgeExpired,
} from "@sdxc/idempotency/data-table";
import { idempotency } from "@sdxc/idempotency/middleware";

let idempotent = idempotency({
	store: (ctx) => new DataTableStore(ctx.get(Db)), // a remix/data-table Database
	scope: (ctx) => `api-key:${ctx.get(Caller).id}`,
	ttl: "24 hours",
});

// In a migration: IDEMPOTENCY_KEYS_SCHEMA_SQL
// In a scheduled job:
let purged = await purgeExpired(db); // Result<number, IdempotencyStoreError>
```

`DataTableStore` claims with a single conditional upsert, so it works on Cloudflare D1 and Durable
Object SQLite alike.

## API

### `@sdxc/idempotency`

#### `readIdempotencyKey(headers: Headers, options?: ReadIdempotencyKeyOptions): Result<string | null, IdempotencyKeyError>`

Reads the `Idempotency-Key` field as a non-empty sf-string, succeeding with `null` when the header
is absent. `options.maxLength` bounds the key, 255 characters by default.

#### `formatIdempotencyKey(key: string): Result<string, IdempotencyKeyError>`

Serializes a key as the quoted, escaped field value. Fails for an empty key or one outside
printable ASCII.

#### `IDEMPOTENCY_KEY_HEADER`

`"Idempotency-Key"`.

#### `fingerprint(request: Request): Promise<string>`

SHA-256 (hex) over the method, the path with its query, the content type's essence and the body
bytes. It reads the body, so pass `request.clone()`.

#### `IdempotencyStore`

The contract the middleware claims through:

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

`claim` is atomic: of concurrent claims on one id, exactly one answers `claimed` with a lease. A
record is claimable again once it expires, or while in flight past its lease. `complete` and
`release` act only while that lease still holds, and `release` leaves a completed record alone.

#### `IdempotencyKeyError`

The client's key is unacceptable; `reason` is `"invalid"` or `"too-long"`.

#### `IdempotencyStoreError`

The store could not answer, or read back a record it could not parse.

#### `IDEMPOTENCY_PROBLEM_ENTRIES`

The four `@sdxc/problem` entries, `idempotencyKeyMissing` (400), `idempotencyKeyInvalid` (400),
`idempotencyKeyInUse` (409) and `idempotencyKeyReused` (422), to spread into a `defineProblems`
catalog. Their slugs are the wire contract clients match on.

### `@sdxc/idempotency/middleware`

#### `idempotency(options: IdempotencyOptions): Middleware`

Claims, runs, stores and replays keyed `POST` and `PATCH` requests; other methods pass through.

| Option          | Default                | Meaning                                                                  |
| --------------- | ---------------------- | ------------------------------------------------------------------------ |
| `store`         | required               | an `IdempotencyStore`, or a function reading one off the request context |
| `scope`         | required               | who the key belongs to; records never cross scopes                       |
| `ttl`           | required               | how long a completed outcome is replayed                                 |
| `required`      | `false`                | answer `400` when the header is absent                                   |
| `lease`         | `"1 minute"`           | how long an in-flight claim holds before a retry may take it over        |
| `fingerprint`   | `fingerprint`          | payload comparison on reuse; `false` compares keys alone                 |
| `shouldStore`   | `status < 500`         | which outcomes are stored; the rest release the key                      |
| `maxBodyBytes`  | 1 MiB                  | a larger body is returned but not stored, releasing the key              |
| `failurePolicy` | `"closed"`             | `"closed"` answers `503`; `"open"` runs the handler unprotected          |
| `prefix`        | `"idempotency"`        | namespace for record ids, keeping two registrations on one table apart   |
| `problems`      | `about:blank` problems | the builders refusals are answered with, usually a problem catalog       |

A record is identified by prefix, scope, method, pathname and key. A handler that throws releases
the key and the error propagates. Events (`idempotency.replayed`, `idempotency.in_flight`,
`idempotency.reused`, `idempotency.store_unavailable`) go to the invocation's
[`@sdxc/logger`](https://www.npmjs.com/package/@sdxc/logger) log, without the key or the scope.

### `@sdxc/idempotency/data-table`

#### `new DataTableStore(db: Database)`

An `IdempotencyStore` over a `remix/data-table` database whose schema includes `idempotency_keys`.

#### `idempotencyKeys`

The `remix/data-table` table definition.

#### `IDEMPOTENCY_KEYS_SCHEMA_SQL`

`create table idempotency_keys` plus an index on `expires_at`, for a migration. It holds two
statements, so apply it through a migration runner that splits statements.

#### `purgeExpired(db: Database, now?: number): Promise<Result<number, IdempotencyStoreError>>`

Deletes every expired record and answers how many went. Expired records are already ignored, so
the purge only reclaims storage.

### `@sdxc/idempotency/memory`

#### `new MemoryStore()`

An in-process store for tests and single-isolate development, atomic within one isolate.

### `@sdxc/idempotency/client`

#### `generateIdempotencyKey(): string`

A random UUID, minted once per operation.

#### `deriveIdempotencyKey(...parts: string[]): Promise<string>`

SHA-256 (hex) of the parts with their boundaries kept: the same parts always give the same key.

#### `withIdempotencyKey(init: RequestInit, key: string): Result<RequestInit, IdempotencyKeyError>`

A copy of `init` with the header set and every other header kept.

#### `applyIdempotencyKey(request: Request, key?: string): Result<Request, IdempotencyKeyError>`

Sets the header on a `POST` or `PATCH` that has none, generating a UUID when `key` is omitted.
Other methods and requests that already carry a key come back unchanged.

### Types

- `ReadIdempotencyKeyOptions`: `{ maxLength?: number }`.
- `ClaimRequest`: the record `id`, the request `fingerprint` (or `null`), `now`, `leaseMs` and
  `expiresAt`, in epoch milliseconds.
- `ClaimOutcome`: `{ status: "claimed", lease }`, `{ status: "in-flight", fingerprint }` or
  `{ status: "completed", fingerprint, response }`.
- `StoredResponse`: plain JSON holding `status`, lowercased header pairs without `Set-Cookie`, and
  the body as base64.
- `IdempotencyOptions`: the middleware options above.
- `IdempotencyProblems`: the four builders `problems` takes; a catalog containing
  `IDEMPOTENCY_PROBLEM_ENTRIES` satisfies it.
- `IdempotencyKeyRow`: a row of `idempotencyKeys`.

## Pattern: Refusals From Your Problem Catalog

Give each refusal a `type` under your API's error reference, and require a key on every call.

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
replay still spends budget. State the `ttl` in your API reference; the draft asks servers to say
when keys expire.

## Pattern: Tuning What Is Compared And Stored

A client must resend the same bytes: the same JSON with its keys reordered fingerprints
differently and gets `422`. Normalize the body before hashing to accept that, and store every
answer from a handler that commits its write before it can fail.

```typescript
import { fingerprint } from "@sdxc/idempotency";
import { MemoryStore } from "@sdxc/idempotency/memory";
import { idempotency } from "@sdxc/idempotency/middleware";

function sortKeys(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortKeys);
	if (value === null || typeof value !== "object") return value;
	return Object.fromEntries(
		Object.entries(value)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, item]) => [key, sortKeys(item)]),
	);
}

let idempotent = idempotency({
	store: new MemoryStore(),
	scope: (ctx) => ctx.get(Caller).id,
	ttl: "24 hours",
	lease: "5 minutes", // the handler can run that long
	async fingerprint(request) {
		let body = JSON.stringify(sortKeys(await request.json()));
		return fingerprint(new Request(request.url, { method: request.method, body }));
	},
	shouldStore: () => true, // the write commits first, so even a 5xx is final
	maxBodyBytes: 256 * 1024,
	failurePolicy: "open", // keep serving when the store is down
	prefix: "orders",
});
```

## Pattern: A Durable Object As The Store

When records belong beside one tenant's data, the object runs a `DataTableStore` over its own
SQLite and exposes the three methods over RPC; the Worker hands the middleware a thin adapter.

```typescript
import type { ClaimRequest, IdempotencyStore, StoredResponse } from "@sdxc/idempotency";

import { DataTableStore } from "@sdxc/idempotency/data-table";
import { idempotency } from "@sdxc/idempotency/middleware";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { DurableObject } from "cloudflare:workers";
import { Database } from "remix/data-table";

export class Tenant extends DurableObject {
	#store = new DataTableStore(new Database(createSQLStorageDatabaseAdapter(this.ctx.storage.sql))); // the object's migrations apply IDEMPOTENCY_KEYS_SCHEMA_SQL

	idempotencyClaim(request: ClaimRequest) {
		return this.#store.claim(request);
	}

	idempotencyComplete(id: string, lease: string, response: StoredResponse, expiresAt: number) {
		return this.#store.complete(id, lease, response, expiresAt);
	}

	idempotencyRelease(id: string, lease: string) {
		return this.#store.release(id, lease);
	}
}

let idempotent = idempotency({
	store: (ctx): IdempotencyStore => {
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
own retries with nothing stored.

```typescript
import { deriveIdempotencyKey, withIdempotencyKey } from "@sdxc/idempotency/client";
import { unwrap } from "@sdxc/result";

let key = await deriveIdempotencyKey(message.id, "create-order");
await fetch(url, unwrap(withIdempotencyKey({ method: "POST", body }, key)));
```

## Pattern: A Key On Every Write Of An API Client

[`@sdxc/api-client`](https://www.npmjs.com/package/@sdxc/api-client) runs `before` on every
attempt; `applyIdempotencyKey` keys each `POST` and `PATCH` there and keeps a key the caller
already set, so a retry the caller drives reuses its own key.

```typescript
import { APIClient } from "@sdxc/api-client";
import { applyIdempotencyKey } from "@sdxc/idempotency/client";
import { unwrap } from "@sdxc/result";

class Payments extends APIClient {
	constructor() {
		super(new URL("https://api.payments.example.com"));
	}

	protected override async before(request: Request): Promise<Request> {
		return unwrap(applyIdempotencyKey(request));
	}
}
```

## Pattern: Forward The Client's Key Upstream

A handler that calls a payment provider on the client's behalf passes the client's key along, so
the client's retry is also safe upstream.

```typescript
import { readIdempotencyKey } from "@sdxc/idempotency";
import { withIdempotencyKey } from "@sdxc/idempotency/client";
import { isFailure, unwrap } from "@sdxc/result";

async function charge(request: Request): Promise<Response> {
	let key = readIdempotencyKey(request.headers, { maxLength: 64 });
	if (isFailure(key)) return Response.json({ reason: key.error.reason }, { status: 400 });

	let init: RequestInit = { method: "POST", body: await request.text() };
	if (key.data !== null) init = unwrap(withIdempotencyKey(init, `charge:${key.data}`));
	return fetch("https://api.payments.example.com/charges", init);
}
```

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
