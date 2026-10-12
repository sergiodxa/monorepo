# @sdxc/cloudflare-mocks

In-memory, behavior-accurate Cloudflare binding mocks for tests.

Storage bindings really store and SQL bindings run real SQL on the runtime's own SQLite, so a
malformed statement or a constraint violation fails in the test. Every factory returns an
isolated instance typed against the platform interface it stands in for.

## Installation

```sh
npm add -D @sdxc/cloudflare-mocks
```

The binding interfaces come from
[`@cloudflare/workers-types`](https://www.npmjs.com/package/@cloudflare/workers-types); install
it alongside. SQL runs on `bun:sqlite` under Bun and `node:sqlite` under Node.

## Usage

### Storage that really stores

```typescript
import { createD1Database, createKVNamespace } from "@sdxc/cloudflare-mocks";

let kv = createKVNamespace();
await kv.put("user:1", JSON.stringify({ name: "Ada" }), { metadata: { version: 2 } });
await kv.get<{ name: string }>("user:1", "json"); // { name: "Ada" }
await kv.list({ prefix: "user:" }); // keys with their metadata

let db = createD1Database();
await db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL)");
let result = await db.prepare("INSERT INTO users VALUES (?, ?)").bind(1, "ada@example.com").run();
result.meta.changes; // 1, reported by SQLite
await db.prepare("SELCT * FROM users").all(); // rejects: the typo is real SQL
```

### Assemble an env

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

Pass the generated `Env` type so each mock is checked against the binding it fills.

### Record what a Worker sent

```typescript
import { createFetcher, createQueue, createSendEmail } from "@sdxc/cloudflare-mocks";

let queue = createQueue<{ id: string }>();
let mailer = createSendEmail();
let api = createFetcher(() => Response.json({ ok: true }));

await queue.send({ id: "a" });
await mailer.send({ from: "noreply@example.com", to: "user@example.com", subject: "Hi" });
await api.fetch("https://api.example.com/sync", { method: "POST" });

queue.messages; // [{ id, body: { id: "a" }, attempts: 0, ... }]
mailer.messages[0]?.to; // ["user@example.com"]
api.requests[0]?.method; // "POST"
```

### Drain deferred work

```typescript
import { createExecutionContext } from "@sdxc/cloudflare-mocks";

let ctx = createExecutionContext();
let response = await worker.fetch(request, env, ctx);
await ctx.settled(); // every waitUntil promise, including ones registered while draining
```

`settled()` rejects with the first failure, so broken background work fails the test.

### Open the SQLite engine directly

```typescript
import { openDatabase } from "@sdxc/cloudflare-mocks/sqlite";

let sqlite = openDatabase(":memory:");
sqlite.exec("CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT)");
sqlite.query("INSERT INTO posts (title) VALUES (?)").run("Hello");
sqlite.query("SELECT title FROM posts").all(); // [{ title: "Hello" }]
```

The `./sqlite` entry point resolves to `bun:sqlite` or `node:sqlite` through the `bun` export
condition, so one test file runs under either runtime.

## API

Every factory below is exported from `@sdxc/cloudflare-mocks`. A mock that records or stores
adds `reset()`, which empties it in place for a binding held at module scope.

### `createKVNamespace(options?: KVNamespaceMockOptions): KVNamespace`

Workers KV with `get` (per `type`, or by key array), `put`, `delete`, `getWithMetadata` and
cursor-paginated prefix `list`, plus metadata, absolute and TTL expiration and the 60 second
`expirationTtl` floor. `options.now` is a clock in milliseconds, so a test can step past an
expiration. Adds `reset()`.

### `createD1Database(options?: D1DatabaseMockOptions): D1Database`

D1 over a fresh SQLite database. `all`, `run`, `first` and `raw` execute real SQL and report
`meta` from the engine; statements autocommit, `batch()` is atomic and `exec()` takes a
`;`-separated script. `options.filename` defaults to `:memory:`. Adds `reset()`, which drops
every table, index, view and trigger.

### `createSqlStorage(options?: SqlStorageMockOptions): SqlStorage`

A Durable Object `SqlStorage` whose `exec` runs synchronously and answers a single-pass cursor
(`toArray`, `one`, `next`, `raw`, `columnNames`, `rowsRead`, `rowsWritten`). `BEGIN`, `COMMIT`,
`ROLLBACK` and `SAVEPOINT` throw the runtime's own error; `transactionSync` on
`createDurableObjectState()` is the atomic path. `MockSqlStorageCursor` and
`MockSqlStorageStatement` are the classes behind it.

### `createR2Bucket(): R2BucketMock`

R2 with real MD5 etags, `md5` checksum verification, `range` and `onlyIf` reads, `list` with
`prefix`, `delimiter`, `cursor`, `startAfter` and `include`, and multipart uploads. Adds `keys`
and `reset()`.

### `createQueue<Body>(options?: QueueMockOptions): QueueMock<Body>`

A `Queue` that records sends in `messages` (pending), `sent` (all) and `deadLetter`.
`options.name` is reported as `batch.queue`; `maxBatchSize` defaults to 10 and `maxRetries` to 3.

`consume(handler, options?)` delivers one batch and answers `{ delivered, acked, retried,
deadLettered }`. A message the handler leaves undecided is acked; when the handler throws, every
unacked message is retried and the error rethrown. `options.context` is drained before decisions
are read, for a handler that acks inside `waitUntil`.

### `createSendEmail(options?: SendEmailMockOptions): SendEmailMock`

A `SendEmail` that records raw `EmailMessage`s and builder messages alike into `messages` as
`SentEmailRecord`s. With `options.verifiedDestinations`, sending elsewhere throws. Adds `reset()`.

### `createAnalyticsEngine(): AnalyticsEngineMock`

An `AnalyticsEngineDataset` recording `dataPoints`. A data point over the platform's limits (20
blobs, 20 doubles, one index, 5 KiB of blobs, a 96 byte index) throws. Adds `reset()`.

### `createRateLimit(options?: RateLimitMockOptions): RateLimitMock`

A `RateLimit` with per-key counters over a fixed window: `options.limit` (100), `options.period`
(`10` or `60`, default 60) and `options.now`. Adds `count(key)` and `reset()`.

### `createSecretsStoreSecret(options?: SecretsStoreSecretMockOptions): SecretsStoreSecretMock`

A `SecretsStoreSecret` whose `get()` resolves `options.value`, or rejects with
`Secret "<name>" not found` when it has none. Adds `reads`, `set(value)`, `fail(error?)` and
`reset()`.

### `createDurableObjectState<Props>(options?: DurableObjectStateMockOptions<Props>): DurableObjectStateMock<Props>`

A `DurableObjectState` to pass to a Durable Object's constructor, with `options.name`,
`options.id` and `options.props`. `storage` covers key-value reads and writes (structured-cloned),
`transaction`, `transactionSync` across SQL and key-value, alarms, `storage.kv` and
`storage.sql`; `blockConcurrencyWhile` serializes callers. Adds `waitUntilPromises`,
`abortReason` and `settled()`.

### `createDurableObjectNamespace<T>(createStub: DurableObjectStubFactory): DurableObjectNamespaceMock<T>`

A `DurableObjectNamespace` where `createStub(name)` builds the object a name routes to: a fetch
handler, or an object with RPC methods. A name always reaches the same stub, by `getByName` or
`idFromName` then `get`. `jurisdiction()` gives a scoped view that refuses ids minted outside
it. Adds `names`, `resolutions` (with `locationHint` and `jurisdiction`) and `reset()`.

### `createFetcher(handler: FetcherHandler): FetcherMock`

A `Fetcher` for a service or assets binding. Every call reaches `handler` as a `Request` and is
recorded in `requests` first, even when the handler throws. `connect()` throws. Adds `reset()`.

### `createExecutionContext<Props>(options?: ExecutionContextMockOptions<Props>): ExecutionContextMock<Props>`

An `ExecutionContext` with `options.props` as `ctx.props`. Adds `waitUntilPromises`,
`passedThroughOnException`, `aborted`, `abortReason` and `settled()`.

### `createEnv<Env>(bindings, options?: EnvMockOptions): Env`

The `env` a Worker reads, built from the bindings by name; a getter stays live on every read.
Reading a missing binding throws by name; `options.strict: false` answers `undefined` instead.

### `openDatabase(filename: string): SqliteDatabase` from `./sqlite`

Opens SQLite on the current runtime's built-in module. `SqliteDatabase` has `query(sql)`,
`exec(sql, ...values)` and `close()`; a `SqliteStatement` has `all`, `get` (`null` on a miss),
`run` and `columnNames`. Bindings are positional, and an integral number binds as `INTEGER`.

### Types

Each factory's options and mock interface are exported under the matching names
(`RateLimitMockOptions`, `RateLimitMock`, and so on). `QueueMessageRecord<Body>`,
`QueueConsumeResult<Body>` and `SentEmailRecord` are the shapes assertions read;
`QueueConsumer`, `QueueConsumeOptions` and `DeferredWork` type a consumer and the `context` it
drains; `DurableObjectStubFactory` and `FetcherHandler` type the handlers a test supplies.

### Where a mock differs from the platform

- D1 runs a local SQLite build, so SQL that SQLite accepts and D1 refuses passes; size and time
  limits are unenforced and `dump()` throws.
- Durable Object storage enforces no size quota, and an alarm runs when the test calls the
  object's `alarm()`.
- KV is immediately consistent and keys sort by JavaScript string comparison.
- R2 verifies only `md5` checksums and ignores SSE-C keys.
- A queue delivers only when `consume()` runs; `delaySeconds` is recorded.
- `ExecutionContext.exports`, `ExecutionContext.tracing`, `DurableObjectState.exports` and
  `DurableObjectState.facets` throw. Hyperdrive, Vectorize, Workers AI and Browser Rendering
  have no mock.

## Pattern: A Data Layer Against Real SQL

Point a data-table adapter at the mock and apply the migration file as it stands; generated SQL
runs through SQLite, so a bad query fails in the unit test.

```typescript
import { readFile } from "node:fs/promises";

import { createD1Database } from "@sdxc/cloudflare-mocks";
import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { column as c, Database, table } from "remix/data-table";
import { beforeEach, expect, test } from "vitest";

let users = table({
	name: "users",
	columns: { id: c.integer().primaryKey(), email: c.varchar(255) },
});

let db: Database;

beforeEach(async () => {
	let binding = createD1Database();
	await binding.exec(await readFile("./migrations/0001_users.sql", "utf8"));
	db = new Database(createD1DatabaseAdapter(binding));
});

test("finds a user by email", async () => {
	await db.create(users, { id: 1, email: "ada@example.com" });
	expect(await db.findOne(users, { where: { email: "ada@example.com" } })).toMatchObject({ id: 1 });
});
```

## Pattern: A Producer And Its Consumer

```typescript
import { createEnv, createQueue } from "@sdxc/cloudflare-mocks";
import { expect, test } from "vitest";

test("a job that keeps failing is dead-lettered", async () => {
	let queue = createQueue<{ id: string }>({ maxRetries: 1 });
	let env = createEnv<Env>({ JOBS: queue });

	await scheduleJobs(env);
	expect(queue.messages).toHaveLength(1);

	await expect(queue.consume((batch) => handleJobs(batch, env))).rejects.toThrow();
	expect(queue.messages[0]?.attempts).toBe(1);

	let result = await queue.consume((batch) => batch.retryAll());
	expect(result.deadLettered).toHaveLength(1);
	expect(queue.deadLetter).toHaveLength(1);
});
```

Bindings that answer a promise reject rather than throw, so an expected failure reads as
`await expect(…).rejects`.

## Pattern: Background Work And Deferred Acks

```typescript
import { createExecutionContext, createKVNamespace, createQueue } from "@sdxc/cloudflare-mocks";
import { expect, test } from "vitest";

test("caches the response after replying", async () => {
	let cache = createKVNamespace();
	let ctx = createExecutionContext();

	await handleRequest(new Request("https://example.com/"), { CACHE: cache }, ctx);
	expect(await cache.get("https://example.com/")).toBeNull();

	await ctx.settled();
	expect(await cache.get("https://example.com/")).not.toBeNull();
});

test("a consumer acks once its deferred work finishes", async () => {
	let ctx = createExecutionContext();
	let queue = createQueue<{ id: string }>();
	await queue.send({ id: "a" });

	let result = await queue.consume(
		(batch) => {
			for (let message of batch.messages) {
				ctx.waitUntil(process(message.body).then(() => message.ack()));
			}
		},
		{ context: ctx },
	);

	expect(result.acked).toHaveLength(1);
});
```

`context` accepts anything with `settled(): Promise<void>`.

## Pattern: A Durable Object By Construction

```typescript
import { createDurableObjectState, createEnv } from "@sdxc/cloudflare-mocks";
import { expect, test } from "vitest";

test("counts and persists", async () => {
	let state = createDurableObjectState({ name: "tenant-1" });
	let counter = new Counter(state, createEnv<Env>({}));

	await counter.increment();
	await counter.increment();
	expect(await state.storage.get<number>("count")).toBe(2);

	state.storage.sql.exec("CREATE TABLE events (id INTEGER PRIMARY KEY, kind TEXT)");
	expect(() => state.storage.sql.exec("BEGIN")).toThrow(); // as the runtime refuses it
	state.storage.transactionSync(() => {
		state.storage.sql.exec("INSERT INTO events (kind) VALUES (?)", "increment");
		state.storage.kv.put("last", "increment");
	});
});
```

## Pattern: Service Bindings And Durable Object Namespaces

A fetcher answers with whatever its handler returns; a namespace routes each name to the stub
`createStub` builds, and records where it was placed.

```typescript
import { createDurableObjectNamespace, createEnv, createFetcher } from "@sdxc/cloudflare-mocks";
import { expect, test } from "vitest";

test("routes a tenant to its shard in the EU", async () => {
	let shards = createDurableObjectNamespace((name) => async () => Response.json({ name }));
	let billing = createFetcher(() => Response.json({ plan: "pro" }));
	let env = createEnv<Env>({ SHARDS: shards, BILLING: billing });

	await handleTenant("tenant-1", env);

	expect(shards.resolutions).toEqual([
		{ name: "tenant-1", locationHint: "weur", jurisdiction: "eu" },
	]);
	expect(new URL(billing.requests[0]!.url).pathname).toBe("/plans/tenant-1");
});
```

An id minted by `shards.idFromName()` is refused by `shards.jurisdiction("eu").get()`, as the
platform refuses it, so deriving ids from the unscoped binding fails here.

## Pattern: Module-Scoped Bindings Reset Per Test

When code under test captures `env` on import, keep one set of mocks and empty them in
`beforeEach`; a getter swaps a binding between cases.

```typescript
import {
	createD1Database,
	createEnv,
	createKVNamespace,
	createSecretsStoreSecret,
} from "@sdxc/cloudflare-mocks";
import { beforeEach } from "vitest";

let db = createD1Database();
let cache = createKVNamespace();
let token = createSecretsStoreSecret({ name: "API_TOKEN", value: "token-1" });
let flags = createKVNamespace();

export let env = createEnv<Env>({
	DB: db,
	CACHE: cache,
	API_TOKEN: token,
	get FLAGS() {
		return flags;
	},
});

beforeEach(() => {
	db.reset();
	cache.reset();
	token.reset();
	flags = createKVNamespace();
});
```

`token.fail()` makes the next `get()` reject and `token.reads` counts the reads, so a test can
prove the secret is read at its point of use.

## Pattern: Limits On A Clock

```typescript
import { createAnalyticsEngine, createKVNamespace, createRateLimit } from "@sdxc/cloudflare-mocks";
import { expect, test } from "vitest";

test("a window and a TTL roll over", async () => {
	let clock = 0;
	let limiter = createRateLimit({ limit: 2, period: 10, now: () => clock });
	let kv = createKVNamespace({ now: () => clock });

	await limiter.limit({ key: "ip" }); // { success: true }
	await limiter.limit({ key: "ip" }); // { success: true }
	expect(await limiter.limit({ key: "ip" })).toEqual({ success: false });

	await kv.put("session", "1", { expirationTtl: 60 });
	clock += 61_000;
	expect(limiter.count("ip")).toBe(0);
	expect(await kv.get("session")).toBeNull();

	let analytics = createAnalyticsEngine();
	expect(() => analytics.writeDataPoint({ indexes: ["a", "b"] })).toThrow();
});
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
