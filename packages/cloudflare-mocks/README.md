# @pkg/cloudflare-mocks

In-memory, behavior-accurate implementations of the Cloudflare bindings used across this monorepo, for tests and local tooling.

## Overview

Tests that touch storage usually have no choice but to replace the module that reads it,
because there is no in-memory KV namespace, D1 database, queue, or Durable Object store to
hand the code under test. That makes tests assert on calls instead of outcomes, and it hides
whole bug classes: a mock that returns canned rows cannot notice that the SQL was malformed.

This package supplies the missing piece. Storage bindings really store: KV honours
expiration, metadata, and cursor-paginated prefix listing, and `createD1Database()` /
`createSqlStorage()` run SQL through [`bun:sqlite`](https://bun.sh/docs/api/sqlite), so a
bad statement, a constraint violation, or a value that should have been JSON-encoded fails
exactly where it would in production. Message and event bindings record what a Worker sent
and, for queues, drive a consumer with the platform's `ack`/`retry` rules.

Every factory returns a value typed against the corresponding interface from
[`@cloudflare/workers-types`](https://github.com/cloudflare/workerd/tree/main/npm/workers-types),
so a mock that drifts from the platform's shape fails typecheck rather than at runtime.
Mocks are constructed per call and never shared at module level, so no test can inherit
another's state and no cleanup step can be forgotten. The package is `private` and belongs
in `devDependencies`.

## Usage

### Storage that really stores

```typescript
import { createD1Database, createKVNamespace } from "@pkg/cloudflare-mocks";

let kv = createKVNamespace();
await kv.put("user:1", JSON.stringify({ name: "Ada" }), { metadata: { version: 2 } });

await kv.get<{ name: string }>("user:1", "json"); // { name: "Ada" }
await kv.list({ prefix: "user:" }); // real prefix filtering, with metadata

let db = createD1Database();
await db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL)");

let result = await db.prepare("INSERT INTO users VALUES (?, ?)").bind(1, "ada@example.com").run();
result.meta.changes; // 1, reported by SQLite
```

### Recording what a Worker sent

```typescript
import { createQueue } from "@pkg/cloudflare-mocks";

let queue = createQueue<{ type: string; monitorId: string }>();
await producer.send({ type: "check-http", monitorId: "abc" });

expect(queue.messages).toHaveLength(1);

// Drive the consumer, then assert on what it decided.
await queue.consume(async (batch) => {
	for (let message of batch.messages) message.retry();
});

expect(queue.messages[0]?.attempts).toBe(1);
```

### Assembling an env

```typescript
import { createD1Database, createEnv, createKVNamespace, createQueue } from "@pkg/cloudflare-mocks";

let env = createEnv<Env>({
	DB: createD1Database(),
	CACHE: createKVNamespace(),
	QUEUE: createQueue(),
});
```

Reading a binding that was not supplied throws by name, so a forgotten binding fails at the
access that needed it rather than surfacing later as `undefined is not a function`.

### Deferred work

```typescript
import { createExecutionContext } from "@pkg/cloudflare-mocks";

let ctx = createExecutionContext();
await handler(request, env, ctx);
await ctx.settled(); // awaits every waitUntil promise, including nested ones
```

## API

### `createKVNamespace(options?: KVNamespaceMockOptions): KVNamespace`

An in-memory Workers KV namespace with real `get`, `put`, `delete`, `list`, and
`getWithMetadata` semantics: value decoding per `type` (`text`, `json`, `arrayBuffer`,
`stream`), bulk reads by key array, absolute and TTL expiration, metadata round-tripping,
and cursor-paginated prefix listing.

**Parameters:**

- `options.now`: Clock in milliseconds since the epoch, used to evaluate expiration

**Returns:**

- A `KVNamespace` binding backed by an isolated map

**Example:**

```typescript
let clock = 0;
let kv = createKVNamespace({ now: () => clock });

await kv.put("key", "value", { expirationTtl: 60 });
clock += 61_000;
await kv.get("key"); // null
```

Because the mock enforces the platform's 60 second `expirationTtl` floor, an injected clock
is the only way to observe expiry without waiting a real minute.

### `createD1Database(options?: D1DatabaseMockOptions): D1Database`

A `D1Database` over a fresh in-memory SQLite database. `prepare().bind().all()/run()/
first()/raw()` all execute real SQL and report `meta` from the engine: `changes`,
`rows_read`, `rows_written`, `last_row_id`, `changed_db`, `size_after`, and `duration`.
Statements autocommit individually, exactly as D1's do, and `batch()` is the one atomic
primitive — it wraps every statement in a real transaction and rolls the whole batch back on
failure.

**Parameters:**

- `options.filename`: SQLite file to open; defaults to `:memory:`

**Returns:**

- A `D1Database` binding whose SQL really runs

**Example:**

```typescript
let db = createD1Database();
await db.exec("CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT)");

await expect(db.prepare("SELCT * FROM posts").all()).rejects.toThrow();
```

### `createSqlStorage(options?: SqlStorageMockOptions): SqlStorage`

A Durable Object `SqlStorage` over a fresh in-memory SQLite database. `exec` runs
synchronously and returns a single-pass cursor with `toArray`, `one`, `next`, `raw`,
`columnNames`, `rowsRead`, and `rowsWritten`. `BEGIN`/`COMMIT`/`ROLLBACK` and `SAVEPOINT`
work, so transaction atomicity can be tested for real.

**Parameters:**

- `options.filename`: SQLite file to open; defaults to `:memory:`

**Returns:**

- A `SqlStorage` binding whose SQL really runs

**Example:**

```typescript
let sql = createSqlStorage();
sql.exec("CREATE TABLE counters (name TEXT PRIMARY KEY, value INTEGER)");
sql.exec("INSERT INTO counters VALUES (?, ?)", "hits", 1);

sql.exec("SELECT value FROM counters WHERE name = ?", "hits").one(); // { value: 1 }
```

### `createQueue<Body>(options?: QueueMockOptions): QueueMock<Body>`

A `Queue` that records sends and can drive a consumer.

**Parameters:**

- `options.name`: Queue name reported to consumers as `batch.queue`
- `options.maxBatchSize`: Deliveries per `consume()` pass; defaults to 10
- `options.maxRetries`: Retries before a message is dead-lettered; defaults to 3

**Returns:**

- A `QueueMock` with `messages` (pending), `sent` (full history), `deadLetter`, and
  `consume()`

`consume(handler, options?)` delivers one batch and then applies the handler's decisions:
messages the handler neither acked nor retried are acked, and when the handler throws every
unacked message is retried and the error is rethrown so the test sees it. It resolves to
`{ delivered, acked, retried, deadLettered }`.

**Example:**

```typescript
let queue = createQueue<{ id: string }>({ maxRetries: 1 });
await queue.send({ id: "a" });

await queue.consume((batch) => batch.retryAll()); // requeued, attempts = 1
let result = await queue.consume((batch) => batch.retryAll());

result.deadLettered; // the message, now past its retry budget
```

### `createAnalyticsEngine(): AnalyticsEngineMock`

An `AnalyticsEngineDataset` that records every `writeDataPoint` call.

**Returns:**

- An `AnalyticsEngineMock` exposing `dataPoints`, each a detached copy of what was written

`writeDataPoint` is fire-and-forget on the platform, so an over-budget data point is lost
silently in production. This mock throws instead: more than 20 blobs, more than 20 doubles,
more than one index, blobs over 5 KiB combined, or an index over 96 bytes all fail.

### `createRateLimit(options?: RateLimitMockOptions): RateLimitMock`

A `RateLimit` binding with real per-key counters over a fixed window.

**Parameters:**

- `options.limit`: Requests allowed per window; defaults to 100
- `options.period`: Window length in seconds, `10` or `60`; defaults to 60
- `options.now`: Clock in milliseconds since the epoch, so a test can roll the window over

**Returns:**

- A `RateLimitMock` with `limit()`, plus `count(key)` and `reset()` for assertions

**Example:**

```typescript
let limiter = createRateLimit({ limit: 2 });

await limiter.limit({ key: "ip" }); // { success: true }
await limiter.limit({ key: "ip" }); // { success: true }
await limiter.limit({ key: "ip" }); // { success: false }
```

### `createSendEmail(options?: SendEmailMockOptions): SendEmailMock`

A `SendEmail` binding that records messages instead of delivering them. It accepts both
shapes the platform accepts — a raw MIME `EmailMessage` and the field-based builder — and
normalizes them into one `SentEmailRecord` with recipients flattened to plain addresses.

**Parameters:**

- `options.verifiedDestinations`: When set, sending to an address outside the list throws,
  the way the platform rejects unverified destinations

**Returns:**

- A `SendEmailMock` exposing `messages`

**Example:**

```typescript
let mailer = createSendEmail({ verifiedDestinations: ["user@example.com"] });

await mailer.send({ from: "noreply@example.com", to: "user@example.com", subject: "Hi" });

mailer.messages[0]?.subject; // "Hi"
```

### `createR2Bucket(): R2BucketMock`

An in-memory `R2Bucket`. Writes compute a real MD5 etag and verify any checksum the caller
supplied; reads honour `range` (offset/length, `suffix`, or a `Range` header) and `onlyIf`,
returning the object without a body when a condition fails. `list` implements `prefix`,
`delimiter` grouping into `delimitedPrefixes`, `limit`, `cursor`, `startAfter`, and
`include`. Multipart uploads buffer parts and assemble them in part-number order on
`complete`.

**Returns:**

- An `R2BucketMock` exposing `keys` alongside the binding surface

**Example:**

```typescript
let bucket = createR2Bucket();
await bucket.put("posts/a.md", "# Hello", { httpMetadata: { contentType: "text/markdown" } });

let object = await bucket.get("posts/a.md", { range: { offset: 0, length: 1 } });
await object?.text(); // "#"
```

### `createExecutionContext<Props>(options?): ExecutionContextMock<Props>`

An `ExecutionContext` that records deferred work.

**Parameters:**

- `options.props`: Value exposed as `ctx.props`

**Returns:**

- An `ExecutionContextMock` with `waitUntilPromises`, `passedThroughOnException`, and
  `settled()`

`settled()` awaits every registered promise, including promises registered while it is
awaiting, and rejects with the first failure so broken background work fails the test.

### `createDurableObjectState<Props>(options?): DurableObjectStateMock<Props>`

A `DurableObjectState` usable directly as a Durable Object constructor argument.

**Parameters:**

- `options.name`: Name the id reports
- `options.id`: Hex id string
- `options.props`: Value exposed as `state.props`

**Returns:**

- A `DurableObjectStateMock` with `waitUntilPromises`, `abortReason`, and `settled()`

`storage` implements `get`/`put`/`delete`/`list`/`deleteAll` with real ordering and bounds,
`transaction` with rollback on throw and on `rollback()`, `transactionSync` covering both SQL
and key-value writes, alarms, the synchronous `storage.kv` API over the same store, and a
SQL-backed `storage.sql`. Values are structured-cloned on write and read, so a stored object
cannot be mutated through the reference the caller kept. `blockConcurrencyWhile` serializes
overlapping callers.

**Example:**

```typescript
let state = createDurableObjectState({ name: "tenant-1" });
let object = new Counter(state, env);

await object.increment();
await state.storage.get<number>("count"); // 1
```

### `createEnv<Env>(bindings, options?): Env`

Builds the `env` object a Worker expects from the bindings a test supplies. Pass the app's
generated binding type as the type argument to have the bindings checked against it.

**Parameters:**

- `bindings`: Bindings to expose, keyed by binding name
- `options.strict`: Whether reading an unsupplied binding throws; defaults to `true`

**Returns:**

- An object usable as a Worker's `env`

**Example:**

```typescript
let env = createEnv<Env>({ CACHE: createKVNamespace() });

env.DB; // throws: env.DB was not provided to createEnv()
```

### Types

#### `QueueMessageRecord<Body>`

```typescript
interface QueueMessageRecord<Body = unknown> {
	id: string;
	timestamp: Date;
	body: Body;
	attempts: number;
	contentType?: QueueContentType;
	delaySeconds?: number;
}
```

#### `QueueConsumeResult<Body>`

```typescript
interface QueueConsumeResult<Body = unknown> {
	delivered: QueueMessageRecord<Body>[];
	acked: QueueMessageRecord<Body>[];
	retried: QueueMessageRecord<Body>[];
	deadLettered: QueueMessageRecord<Body>[];
}
```

#### `SentEmailRecord`

```typescript
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

`MockSqlStorageCursor` and `MockSqlStorageStatement` are exported as well, so a test can
assert a cursor's identity if it needs to.

## Where the mock is more permissive than the platform

A mock is not the platform. These are the differences that matter, so a test that passes here
is not mistaken for a guarantee about production.

**D1**

- **SQLite is not D1.** The engine is a local SQLite build, so anything SQLite accepts and D1
  rejects will pass here: unsupported SQL, `ATTACH`, extension functions, and larger result
  sets than D1 will return.
- **`batch()` uses a real transaction.** Statements outside a batch autocommit individually
  like D1's, and there are still no interactive transactions, but the atomicity a batch gets
  comes from SQLite rather than from D1's own batching.
- **No size or time limits.** D1 caps database size, statement duration, response size, and
  the number of bound parameters. None of that is enforced.
- **No replication.** `withSession()` is a pass-through that advances a synthetic bookmark;
  there are no read replicas and no consistency window to observe.
- **`run()` returns rows.** Both `run()` and `all()` resolve to the same `D1Result`.
- **`exec()` splits on semicolons.** D1 splits scripts by newline; this splits on statement
  boundaries, ignoring semicolons inside literals and comments.
- **`dump()` throws.** The deprecated alpha-only dump is not implemented.

**Durable Object SQL and storage**

- **Booleans are accepted.** Durable Object SQL takes only `null`, numbers, strings, and byte
  buffers; this folds booleans to `1`/`0` for convenience.
- **`exec` runs scripts.** A statement with no result columns and no bindings runs as a whole
  `;`-separated script, so a migration executes in full instead of silently dropping
  everything after the first statement.
- **No key or value size limits, and no storage quota.**
- **Alarms never fire.** `setAlarm` records a time; a test calls the object's `alarm()`
  handler itself, which is what makes the timing assertable.
- **Bookmarks are synthetic.** `getCurrentBookmark`, `getBookmarkForTime`, and
  `onNextSessionRestoreBookmark` return placeholder strings and restore nothing.
- **WebSocket hibernation is bookkeeping only.** Sockets, tags, auto-response pairs, and the
  event timeout are recorded; nothing hibernates and no auto-response is ever sent.

**KV**

- **Expiration is exact and immediate.** A key disappears the instant its expiration passes,
  whereas the platform is eventually consistent and may serve an expired or stale value for a
  short window.
- **Reads are immediately consistent.** A `put` is visible to the next `get`, with no
  propagation delay and no `cacheTtl` behavior; `cacheStatus` is always `null`.
- **List order is UTF-16.** Keys sort by JavaScript string comparison rather than by UTF-8
  byte order, which differs for some non-BMP keys.

**R2**

- **Only MD5 is computed.** A supplied `sha1`/`sha256`/`sha384`/`sha512` is accepted without
  being verified; only `md5` is checked.
- **No SSE-C.** `ssecKey` is ignored and `ssecKeyMd5` is never reported.
- **No part-size rules, storage classes, or lifecycle.** Multipart parts may be any size, and
  `storageClass` is stored verbatim without being validated.
- **`Range` header parsing is limited** to a single `bytes=` range.

**Queues, Analytics Engine, rate limiting, email**

- **Delivery is manual.** `delaySeconds` is recorded but never waited on, and nothing is
  delivered until `consume()` is called.
- **Rate limiting uses a fixed window** keyed on the clock, so it approximates rather than
  reproduces the platform's algorithm.
- **Email is never sent, and MIME is never parsed.** A raw message's body is captured as text.

**Not implemented at all**

Reading `ExecutionContext.exports`, `ExecutionContext.tracing`, `DurableObjectState.exports`,
or `DurableObjectState.facets` throws, because none of them has an in-memory equivalent.
Bindings this monorepo does not use — Hyperdrive, Vectorize, Workers AI, Browser Rendering,
service bindings, Durable Object namespaces and stubs — are absent by design; add one when
code starts needing it.

## Pattern: testing a repository against real SQL

The point of a SQL-backed mock is that generated SQL is covered by ordinary unit tests.

```typescript
import { createD1Database } from "@pkg/cloudflare-mocks";
import { expect, test } from "bun:test";

test("finds a user by email", async () => {
	let binding = createD1Database();
	await binding.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL)");

	let repository = createUserRepository(binding);
	await repository.create({ id: 1, email: "ada@example.com" });

	// A malformed statement or an unencoded value would throw here, not in production.
	expect(await repository.findByEmail("ada@example.com")).toMatchObject({ id: 1 });
});
```

## Pattern: testing a producer and its consumer together

```typescript
import { createEnv, createKVNamespace, createQueue } from "@pkg/cloudflare-mocks";
import { expect, test } from "bun:test";

test("a failed check is retried", async () => {
	let queue = createQueue<CheckJob>();
	let env = createEnv<Env>({ CHECKS: queue, CACHE: createKVNamespace() });

	await scheduleChecks(env);
	expect(queue.messages).toHaveLength(1);

	await expect(queue.consume((batch) => handleChecks(batch, env))).rejects.toThrow();

	// The handler failed, so the message is back with one attempt spent.
	expect(queue.messages[0]?.attempts).toBe(1);
});
```

## Pattern: testing a Durable Object by construction

```typescript
import { createDurableObjectState, createEnv } from "@pkg/cloudflare-mocks";
import { expect, test } from "bun:test";

test("counts within a window", async () => {
	let state = createDurableObjectState({ name: "tenant-1" });
	let counter = new Counter(state, createEnv<Env>({}));

	await counter.increment();
	await counter.increment();

	// Reads go through the same storage the object wrote to.
	expect(await state.storage.get<number>("count")).toBe(2);
});
```

## Pattern: asserting on background work

```typescript
import { createExecutionContext, createKVNamespace } from "@pkg/cloudflare-mocks";
import { expect, test } from "bun:test";

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

## Related Packages

- [`@pkg/data-table-d1`](/packages/data-table-d1) - `DatabaseAdapter` over a `D1Database`;
  its generated SQL is covered by the parity tests in this package
- [`@pkg/data-table-sqlstorage`](/packages/data-table-sqlstorage) - `DatabaseAdapter` over a
  Durable Object `SqlStorage`, including real transaction atomicity
- [`@pkg/kv-cache`](/packages/kv-cache) - Caching over a KV namespace
- [`@pkg/session-storage-kv`](/packages/session-storage-kv) - Session storage over a KV
  namespace

## Tips

1. **Construct a mock per test** - every factory returns isolated state, so a fresh call in
   `beforeEach` removes any need for a cleanup step.
2. **Inject a clock to test time** - `createKVNamespace` and `createRateLimit` accept `now`;
   this is the only way to observe KV expiry, since the real 60 second `expirationTtl` floor
   is enforced.
3. **Create your schema through the binding** - `db.exec("CREATE TABLE …")` on the D1 mock and
   `sql.exec(…)` on the SqlStorage mock accept `;`-separated scripts, so a migration file can
   be applied as-is.
4. **Let `createEnv` be strict** - the default throw on an unsupplied binding names the
   binding; only pass `{ strict: false }` when the code genuinely treats one as optional.
5. **Always `await ctx.settled()`** - a `waitUntil` promise that rejects is silent otherwise,
   and `settled()` surfaces it as a test failure.
6. **Expect errors as rejections** - the asynchronous bindings reject rather than throwing
   synchronously, matching the platform, so use `await expect(…).rejects`.
7. **Read the permissiveness list before trusting a passing test** - D1 on SQLite will accept
   plenty that D1 rejects, and no size or time limit is enforced anywhere.
8. **Keep the scope narrow** - this package implements binding interfaces and nothing else;
   request builders, factories, and assertion helpers belong elsewhere.
