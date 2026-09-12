# @sdxc/cloudflare-mocks

In-memory, behavior-accurate Cloudflare binding mocks for tests.

Storage bindings really store, and SQL bindings really run SQL through the runtime's own
SQLite, so a malformed statement or a constraint violation fails in the test rather than in
production. Every factory returns an isolated instance typed against the matching platform
interface, so a mock that drifts from the platform's shape fails typecheck.

## Installation

```bash
npm add -D @sdxc/cloudflare-mocks
```

The binding interfaces come from
[`@cloudflare/workers-types`](https://www.npmjs.com/package/@cloudflare/workers-types), which
installs alongside this package.

## Usage

### Storage That Really Stores

```typescript
import { createD1Database, createKVNamespace } from "@sdxc/cloudflare-mocks";

let kv = createKVNamespace();
await kv.put("user:1", JSON.stringify({ name: "Ada" }), { metadata: { version: 2 } });

await kv.get<{ name: string }>("user:1", "json"); // { name: "Ada" }
await kv.list({ prefix: "user:" }); // real prefix filtering, with metadata

let db = createD1Database();
await db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL)");

let result = await db.prepare("INSERT INTO users VALUES (?, ?)").bind(1, "ada@example.com").run();
result.meta.changes; // 1, reported by SQLite
```

### Recording What A Worker Sent

```typescript
import { createQueue } from "@sdxc/cloudflare-mocks";

let queue = createQueue<{ type: string; id: string }>();
await queue.send({ type: "refresh", id: "abc" });

queue.messages.length; // 1

// Drive the consumer, then assert on what it decided.
await queue.consume(async (batch) => {
	for (let message of batch.messages) message.retry();
});

queue.messages[0]?.attempts; // 1
```

### Assembling An Env

```typescript
import {
	createD1Database,
	createEnv,
	createKVNamespace,
	createQueue,
} from "@sdxc/cloudflare-mocks";

let env = createEnv<Env>({
	DB: createD1Database(),
	CACHE: createKVNamespace(),
	QUEUE: createQueue(),
});

env.MAILER; // throws: env.MAILER was not provided to createEnv()
```

Reading a binding that was not supplied throws by name, so a forgotten binding fails at the
access that needed it rather than surfacing later as `undefined is not a function`. Bindings
are copied by property descriptor, so a binding defined as a getter is re-read on every access
and a test can swap what it resolves to between cases.

### Deferred Work

```typescript
import { createExecutionContext } from "@sdxc/cloudflare-mocks";

let ctx = createExecutionContext();
await handler(request, env, ctx);
await ctx.settled(); // awaits every waitUntil promise, including nested ones
```

## API

Every factory returns isolated state, so calling one in `beforeEach` removes any need for a
cleanup step. When a binding has to live at module scope because the code under test captured
`env` on import, call `reset()` in `beforeEach` instead — every stateful factory has one.

### `createKVNamespace(options?: KVNamespaceMockOptions): KVNamespace`

An in-memory Workers KV namespace with real `get`, `put`, `delete`, `list`, and
`getWithMetadata` semantics: value decoding per `type` (`text`, `json`, `arrayBuffer`,
`stream`), bulk reads by key array, absolute and TTL expiration, metadata round-tripping, and
cursor-paginated prefix listing. Adds `reset()`.

`options.now` is a clock in milliseconds since the epoch. Because the mock enforces the
platform's 60 second `expirationTtl` floor, an injected clock is the only way to observe
expiry without waiting a real minute:

```typescript
let clock = 0;
let kv = createKVNamespace({ now: () => clock });

await kv.put("key", "value", { expirationTtl: 60 });
clock += 61_000;
await kv.get("key"); // null
```

### `createD1Database(options?: D1DatabaseMockOptions): D1Database`

A `D1Database` over a fresh in-memory SQLite database. `prepare().bind().all()`, `run()`,
`first()`, and `raw()` all execute real SQL and report `meta` from the engine: `changes`,
`rows_read`, `rows_written`, `last_row_id`, `changed_db`, `size_after`, and `duration`.
Statements autocommit individually, exactly as D1's do, and `batch()` is the one atomic
primitive — it wraps every statement in a real transaction and rolls the whole batch back on
failure.

`options.filename` is the SQLite file to open, `:memory:` by default. Adds `reset()`, which
drops every table, index, view, and trigger so a migration can be applied again.

```typescript
let db = createD1Database();
await db.exec("CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT)");

await db.prepare("SELCT * FROM posts").all(); // rejects: the typo is real SQL, and it fails
```

### `createSqlStorage(options?: SqlStorageMockOptions): SqlStorage`

A Durable Object `SqlStorage` over a fresh in-memory SQLite database. `exec` runs
synchronously and returns a single-pass cursor with `toArray`, `one`, `next`, `raw`,
`columnNames`, `rowsRead`, and `rowsWritten`. `BEGIN`/`COMMIT`/`ROLLBACK` and `SAVEPOINT`
work, so transaction atomicity can be tested for real. `options.filename` behaves as it does
for D1.

```typescript
let sql = createSqlStorage();
sql.exec("CREATE TABLE counters (name TEXT PRIMARY KEY, value INTEGER)");
sql.exec("INSERT INTO counters VALUES (?, ?)", "hits", 1);

sql.exec("SELECT value FROM counters WHERE name = ?", "hits").one(); // { value: 1 }
```

`MockSqlStorageCursor` and `MockSqlStorageStatement` are exported as well, so a test can
assert a cursor's identity when it needs to.

### `createR2Bucket(): R2BucketMock`

An in-memory `R2Bucket`. Writes compute a real MD5 etag and verify any checksum the caller
supplied; reads honor `range` (offset/length, `suffix`, or a `Range` header) and `onlyIf`,
returning the object without a body when a condition fails. `list` implements `prefix`,
`delimiter` grouping into `delimitedPrefixes`, `limit`, `cursor`, `startAfter`, and `include`.
Multipart uploads buffer parts and assemble them in part-number order on `complete`. Exposes
`keys` and `reset()` alongside the binding surface.

```typescript
let bucket = createR2Bucket();
await bucket.put("posts/a.md", "# Hello", { httpMetadata: { contentType: "text/markdown" } });

let object = await bucket.get("posts/a.md", { range: { offset: 0, length: 1 } });
await object?.text(); // "#"
```

### `createQueue<Body>(options?: QueueMockOptions): QueueMock<Body>`

A `Queue` that records sends and can drive a consumer. `options.name` is reported to consumers
as `batch.queue`, `options.maxBatchSize` is the deliveries per `consume()` pass (10 by
default), and `options.maxRetries` is the retry budget before a message is dead-lettered (3 by
default). Exposes `messages` (pending), `sent` (full history), `deadLetter`, `consume()`, and
`reset()`.

`consume(handler, options?)` delivers one batch and then applies the handler's decisions:
messages the handler neither acked nor retried are acked, and when the handler throws every
unacked message is retried and the error is rethrown so the test sees it. It resolves to
`{ delivered, acked, retried, deadLettered }`.

```typescript
let queue = createQueue<{ id: string }>({ maxRetries: 1 });
await queue.send({ id: "a" });

await queue.consume((batch) => batch.retryAll()); // requeued, attempts = 1
let result = await queue.consume((batch) => batch.retryAll());

result.deadLettered; // the message, now past its retry budget
```

`options.context` covers the handler that does its real work in `waitUntil`. Such a handler
has decided nothing by the time it returns, so draining that work first is what lets the pass
read the ack it eventually makes:

```typescript
let ctx = createExecutionContext();
let queue = createQueue<{ id: string }>();
await queue.send({ id: "a" });

let result = await queue.consume(
	(batch) => {
		for (let message of batch.messages) ctx.waitUntil(run(message).then(() => message.ack()));
	},
	{ context: ctx },
);

result.acked; // the message, because its deferred work ran first
```

Anything with a `settled(): Promise<void>` works, so a Worker calling a module-level
`waitUntil` can pass whatever collects those promises instead of an execution context.

### `createSendEmail(options?: SendEmailMockOptions): SendEmailMock`

A `SendEmail` binding that records messages instead of delivering them. It accepts both shapes
the platform accepts — a raw MIME `EmailMessage` and the field-based builder — and normalizes
them into one `SentEmailRecord` with recipients flattened to plain addresses. With
`options.verifiedDestinations` set, sending to an address outside the list throws, the way the
platform rejects unverified destinations. Exposes `messages` and `reset()`.

```typescript
let mailer = createSendEmail({ verifiedDestinations: ["user@example.com"] });

await mailer.send({ from: "noreply@example.com", to: "user@example.com", subject: "Hi" });

mailer.messages[0]?.subject; // "Hi"
```

### `createAnalyticsEngine(): AnalyticsEngineMock`

An `AnalyticsEngineDataset` that records every `writeDataPoint` call, exposing `dataPoints`
(each a detached copy of what was written) and `reset()`. `writeDataPoint` is fire-and-forget
on the platform, so an over-budget data point is lost silently in production; this mock throws
instead. More than 20 blobs, more than 20 doubles, more than one index, blobs over 5 KiB
combined, or an index over 96 bytes all fail.

### `createRateLimit(options?: RateLimitMockOptions): RateLimitMock`

A `RateLimit` binding with real per-key counters over a fixed window. `options.limit` is the
requests allowed per window (100 by default), `options.period` the window length in seconds,
`10` or `60` (60 by default), and `options.now` a clock in milliseconds so a test can roll the
window over. Adds `count(key)` and `reset()` for assertions.

```typescript
let limiter = createRateLimit({ limit: 2 });

await limiter.limit({ key: "ip" }); // { success: true }
await limiter.limit({ key: "ip" }); // { success: true }
await limiter.limit({ key: "ip" }); // { success: false }
```

### `createSecretsStoreSecret(options?: SecretsStoreSecretMockOptions): SecretsStoreSecretMock`

A `SecretsStoreSecret` whose answer can be switched between tests. `options.name` is used in
the not-found error, and `options.value` is what `get()` resolves with; omitted, the secret
reads as missing. Exposes `reads`, `set()`, `fail()`, and `reset()`.

The value is only reachable through an awaited `get()`, exactly as the platform requires, so
code that treats the binding as a string fails here rather than in production. `reads` is what
lets a test prove the secret was read lazily, at its point of use.

```typescript
let token = createSecretsStoreSecret({ name: "API_TOKEN", value: "sk_live_1" });
let env = createEnv<Env>({ API_TOKEN: token });

await env.API_TOKEN.get(); // "sk_live_1"

token.fail(); // the store cannot answer
await env.API_TOKEN.get(); // rejects: Secret "API_TOKEN" not found
```

### `createDurableObjectState<Props>(options?: DurableObjectStateMockOptions<Props>): DurableObjectStateMock<Props>`

A `DurableObjectState` usable directly as a Durable Object constructor argument.
`options.name` is the name the id reports, `options.id` a hex id string, and `options.props`
the value exposed as `state.props`. Exposes `waitUntilPromises`, `abortReason`, and
`settled()`.

`storage` implements `get`/`put`/`delete`/`list`/`deleteAll` with real ordering and bounds,
`transaction` with rollback on throw and on `rollback()`, `transactionSync` covering both SQL
and key-value writes, alarms, the synchronous `storage.kv` API over the same store, and a
SQL-backed `storage.sql`. Values are structured-cloned on write and read, so a stored object
cannot be mutated through the reference the caller kept. `blockConcurrencyWhile` serializes
overlapping callers.

```typescript
let state = createDurableObjectState({ name: "tenant-1" });
let object = new Counter(state, env);

await object.increment();
await state.storage.get<number>("count"); // 1
```

### `createDurableObjectNamespace<T>(createStub: DurableObjectStubFactory): DurableObjectNamespaceMock<T>`

A `DurableObjectNamespace` that routes names to stubs the caller supplies. `createStub` builds
the object a name routes to: return a handler for a stub that only answers `fetch`, or an
object for one that also exposes RPC methods. Exposes `names` (distinct, resolved so far),
`resolutions` (every resolution with its placement), and `reset()`.

A name resolves to the same stub every time, which is the property the platform guarantees and
the one code under test relies on when it addresses an object by name from more than one place.
Ids carry the name they were derived from, so `idFromName` then `get` reaches the same object
as `getByName`. Pass the branded Durable Object type as `T` — usually inferred from the `Env`
the binding is assigned into — to have RPC methods typed on the stub.

```typescript
let shards = createDurableObjectNamespace((name) => async () => Response.json({ name }));
let env = createEnv<Env>({ SHARDS: shards });

await (await shards.getByName("acme").fetch("https://do/")).json(); // { name: "acme" }
shards.names; // ["acme"]
```

Placement is the one thing a caller decides that cannot be read back off the stub, so
`resolutions` records it. `jurisdiction()` returns a view over the same objects that tags what
it resolves, and an id minted under one jurisdiction is refused by a view scoped to another,
exactly as the platform refuses it — which is the mistake sharding code actually makes,
deriving the id from the unscoped binding and resolving it through a scoped one:

```typescript
shards.jurisdiction("eu").getByName("tenant-1", { locationHint: "weur" });

shards.resolutions; // [{ name: "tenant-1", locationHint: "weur", jurisdiction: "eu" }]
```

### `createFetcher(handler: FetcherHandler): FetcherMock`

A `Fetcher` for a service binding or the static-asset binding, backed by a handler that
produces the response for each request. Exposes `requests` (what it was asked for) and
`reset()`.

Every call is normalized to a `Request` whatever the caller passed, so assertions on method,
path, and headers read the same as they would against the deployed Worker. A request is
recorded before the handler runs, so a handler that throws still leaves evidence of the call.
`connect()` throws: raw sockets have no in-memory equivalent.

```typescript
let assets = createFetcher(() => new Response(null, { status: 404 }));
let env = createEnv<Env>({ ASSETS: assets });

await env.ASSETS.fetch("https://example.com/logo.png");
assets.requests[0]?.url; // "https://example.com/logo.png"
```

### `createExecutionContext<Props>(options?: ExecutionContextMockOptions<Props>): ExecutionContextMock<Props>`

An `ExecutionContext` that records deferred work, with `options.props` exposed as `ctx.props`.
Exposes `waitUntilPromises`, `passedThroughOnException`, `aborted`, `abortReason`, and
`settled()`.

`settled()` awaits every registered promise, including promises registered while it is
awaiting, and rejects with the first failure so broken background work fails the test.

### `createEnv<Env>(bindings, options?: EnvMockOptions): Env`

Builds the `env` object a Worker expects from the bindings a test supplies, keyed by binding
name. Pass the generated binding type as the type argument to have the bindings checked
against it. `options.strict` decides whether reading an unsupplied binding throws, and defaults
to `true`; pass `false` only when the code under test genuinely treats a binding as optional.

### Types

`QueueMessageRecord<Body>`, `QueueConsumeResult<Body>`, and `SentEmailRecord` are the shapes
assertions read:

```typescript
interface QueueMessageRecord<Body = unknown> {
	id: string;
	timestamp: Date;
	body: Body;
	attempts: number;
	contentType?: QueueContentType;
	delaySeconds?: number;
}

interface QueueConsumeResult<Body = unknown> {
	delivered: QueueMessageRecord<Body>[];
	acked: QueueMessageRecord<Body>[];
	retried: QueueMessageRecord<Body>[];
	deadLettered: QueueMessageRecord<Body>[];
}

interface SentEmailRecord {
	messageId: string;
	from: string;
	to: string[];
	cc: string[];
	bcc: string[];
	subject?: string;
	replyTo?: string;
	headers?: Record<string, string>;
	text?: string;
	html?: string;
	attachments?: EmailAttachment[];
	raw?: string;
}
```

Each factory's options and mock interfaces are exported under the matching names, so
`createRateLimit` takes a `RateLimitMockOptions` and returns a `RateLimitMock`.

## SQLite Engine

`createD1Database()` and `createSqlStorage()` run real SQL, and Bun and Node ship different
built-in SQLite modules that cannot resolve each other. The `@sdxc/cloudflare-mocks/sqlite`
subpath resolves to whichever the current runtime has through the `bun` export condition, so
the same test file runs under either without the other's module appearing in its graph.

Both implementations satisfy one narrow interface, and the Node side normalizes the
differences that would otherwise change results between runners: a missed `get()` reads as
`null`, a statement with no result columns reports an empty column list, integral bindings are
bound as INTEGER so integer division truncates, and bindings passed as a single array are
flattened to a positional list. Both enable SQLite's legacy double-quoted string literals, so
an identifier that does not resolve degrades to a string — worth knowing when a query returns a
column name where you expected a value.

## Where A Mock Is More Permissive Than The Platform

A mock is not the platform. These are the differences that matter, so a test that passes here
is not mistaken for a guarantee about production.

**D1.** The engine is a local SQLite build, so anything SQLite accepts and D1 rejects passes
here: unsupported SQL, `ATTACH`, extension functions, and larger result sets than D1 returns.
A batch's atomicity comes from a SQLite transaction rather than from D1's own batching. Size
and time limits — database size, statement duration, response size, bound parameter count —
are unenforced, `withSession()` is a pass-through that advances a synthetic bookmark, `run()`
and `all()` resolve to the same `D1Result`, `exec()` splits scripts on statement boundaries
rather than newlines, and `dump()` throws.

**Durable Object SQL and storage.** Booleans are folded to `1`/`0` where the platform takes
only `null`, numbers, strings, and byte buffers. A statement with no result columns and no
bindings runs as a whole `;`-separated script, so a migration executes in full. Key and value
sizes and the storage quota are unenforced. `setAlarm` records a time and the test calls the
object's `alarm()` handler itself, which is what makes the timing assertable. Bookmarks are
placeholder strings, and WebSocket hibernation is bookkeeping: sockets, tags, auto-response
pairs, and the event timeout are recorded, and nothing hibernates.

**KV.** A key disappears the instant its expiration passes, where the platform is eventually
consistent and may serve a stale value for a short window. A `put` is visible to the next
`get`, with no propagation delay and no `cacheTtl` behavior; `cacheStatus` is always `null`.
Keys sort by JavaScript string comparison rather than UTF-8 byte order, which differs for some
non-BMP keys.

**R2.** Only `md5` is verified; a supplied `sha1`/`sha256`/`sha384`/`sha512` is accepted as
given. `ssecKey` is ignored and `ssecKeyMd5` is never reported. Multipart parts may be any
size, `storageClass` is stored verbatim, and `Range` header parsing covers a single `bytes=`
range.

**Queues, Analytics Engine, rate limiting, email.** Delivery is manual: `delaySeconds` is
recorded, and nothing is delivered until `consume()` is called. Rate limiting uses a fixed
window keyed on the clock, so it approximates the platform's algorithm. Email is recorded
rather than sent, and a raw MIME message's body is captured as text.

**Namespaces, fetchers, and secrets.** A namespace routes; the object behind a name is whatever
the caller supplied, so pair it with `createDurableObjectState` to exercise the object itself.
A `locationHint` and a `jurisdiction` are recorded on `resolutions` while every object lives in
the same process. `idFromName` produces an id whose string form is the name rather than the
platform's opaque 64-hex-digit id. `Fetcher.connect()` throws, and
`createSecretsStoreSecret` models one binding's read, with no store, rotation, or caching
window.

**Absent.** Reading `ExecutionContext.exports`, `ExecutionContext.tracing`,
`DurableObjectState.exports`, or `DurableObjectState.facets` throws, because none has an
in-memory equivalent. Hyperdrive, Vectorize, Workers AI, and Browser Rendering have no mock.

## Pattern: Testing A Repository Against Real SQL

The point of a SQL-backed mock is that generated SQL is covered by ordinary unit tests.

```typescript
import { createD1Database } from "@sdxc/cloudflare-mocks";
import { expect, test } from "vitest";

test("finds a user by email", async () => {
	let binding = createD1Database();
	await binding.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL)");

	let repository = createUserRepository(binding);
	await repository.create({ id: 1, email: "ada@example.com" });

	// A malformed statement or an unencoded value would throw here, not in production.
	expect(await repository.findByEmail("ada@example.com")).toMatchObject({ id: 1 });
});
```

`db.exec()` accepts a `;`-separated script, so a migration file can be applied as it stands.

## Pattern: Testing A Producer And Its Consumer Together

```typescript
import { createEnv, createKVNamespace, createQueue } from "@sdxc/cloudflare-mocks";
import { expect, test } from "vitest";

test("a failed job is retried", async () => {
	let queue = createQueue<Job>();
	let env = createEnv<Env>({ JOBS: queue, CACHE: createKVNamespace() });

	await scheduleJobs(env);
	expect(queue.messages).toHaveLength(1);

	await expect(queue.consume((batch) => handleJobs(batch, env))).rejects.toThrow();

	// The handler failed, so the message is back with one attempt spent.
	expect(queue.messages[0]?.attempts).toBe(1);
});
```

Asynchronous bindings reject rather than throwing synchronously, matching the platform, so an
expected failure reads as `await expect(…).rejects`.

## Pattern: Testing A Durable Object By Construction

```typescript
import { createDurableObjectState, createEnv } from "@sdxc/cloudflare-mocks";
import { expect, test } from "vitest";

test("counts within a window", async () => {
	let state = createDurableObjectState({ name: "tenant-1" });
	let counter = new Counter(state, createEnv<Env>({}));

	await counter.increment();
	await counter.increment();

	// Reads go through the same storage the object wrote to.
	expect(await state.storage.get<number>("count")).toBe(2);
});
```

## Pattern: Asserting On Background Work

```typescript
import { createExecutionContext, createKVNamespace } from "@sdxc/cloudflare-mocks";
import { expect, test } from "vitest";

test("caches the response after replying", async () => {
	let cache = createKVNamespace();
	let ctx = createExecutionContext();

	await handleRequest(new Request("https://example.com/"), { CACHE: cache }, ctx);

	// Nothing is cached until the deferred work runs.
	expect(await cache.get("https://example.com/")).toBeNull();
	await ctx.settled();
	expect(await cache.get("https://example.com/")).not.toBeNull();
});
```

Awaiting `settled()` is also what surfaces a rejected `waitUntil` promise, which is otherwise
silent.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"devDependencies": {
		"@sdxc/cloudflare-mocks": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
