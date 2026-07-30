# ADR-024: Cloudflare Binding Mocks Package

## Status

**Accepted** - 2026-07-29

## Background

Tests across the monorepo lean heavily on `mock.module()` to stand in for Cloudflare bindings and third-party clients. That mechanism permanently replaces a module for the rest of the process, which is why the root test command must pass `--isolate`, as documented in the repository guidelines.

The underlying problem is not the test runner: it is that there is no in-memory implementation of a KV namespace, a D1 database, a queue, or a Durable Object store, so a test that touches storage has no option except replacing the module that uses it.

## Context

### Current State

| Situation                                      | Consequence                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| `mock.module()` used broadly across test files | `--isolate` required for the whole suite; a fresh registry per file |
| No in-memory binding implementations           | Repository and job tests mock the code under test's collaborators   |
| MSW covers HTTP boundaries in two apps         | Works well, and shows the value of a real fake over a module mock   |
| Bindings differ per app                        | Each test file re-invents a partial stub of the same binding shapes |

### Issues Identified

| Issue                                           | Impact                                                                |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| Module mocks replace behavior, not data         | Tests assert on calls instead of outcomes, and pass when SQL is wrong |
| Partial stubs drift from the real binding shape | A stub that lacks `list` or `getWithMetadata` hides a real bug        |
| Every test file rebuilds the same fakes         | Duplication, and inconsistent fidelity between files                  |
| Isolation is mandatory rather than chosen       | Slower suite, and a footgun for anyone running `bun test` directly    |

## Decision

Create `@pkg/cloudflare-mocks`: in-memory, behavior-accurate implementations of the Cloudflare bindings the monorepo uses, intended for tests and local tooling only.

The name is deliberately narrow. This package is not a general test-utilities grab bag; it implements binding interfaces and nothing else. Request builders, factories, and assertion helpers stay in the apps or become separate packages if they ever justify one.

### 1. Storage Bindings Execute Real Behavior

```ts
import { createKVNamespace, createD1Database, createSqlStorage } from "@pkg/cloudflare-mocks";

let kv = createKVNamespace();
await kv.put("key", "value", { expirationTtl: 60 });
await kv.get("key"); // "value"
await kv.list({ prefix: "k" }); // real prefix filtering
```

`createD1Database()` and `createSqlStorage()` are backed by `bun:sqlite`, so SQL actually executes. That matters specifically because `@pkg/data-table-d1` and `@pkg/data-table-sqlstorage` generate SQL: a mock that returns canned rows cannot catch a malformed statement, while a real SQLite engine can.

### 2. Message And Event Bindings Record

```ts
let queue = createQueue();
await producer.send({ type: "check-http", monitorId });

assert.equal(queue.messages.length, 1);
await queue.consume(handler); // drives a consumer with ack/retry semantics
```

Recording bindings expose their captured values plus the semantics a consumer depends on:

| Binding                   | Behavior                                                       |
| ------------------------- | -------------------------------------------------------------- |
| `createQueue()`           | Records sends; `consume()` drives a handler with `ack`/`retry` |
| `createAnalyticsEngine()` | Records data points with blobs, doubles, and indexes           |
| `createRateLimit()`       | Real counters, so limit behavior is testable                   |
| `createSendEmail()`       | Records messages, pairing with the mail package's transport    |
| `createR2Bucket()`        | In-memory objects with metadata, `list`, and range reads       |

### 3. Runtime Objects

```ts
let ctx = createExecutionContext(); // records waitUntil promises, awaitable
await ctx.settled();
```

`createDurableObjectState()` provides `storage`, `blockConcurrencyWhile`, and a SQL-backed `storage.sql`, so Durable Object classes can be tested by construction rather than through a stub namespace.

### 4. Environment Assembly

```ts
let env = createEnv({
	DB: createD1Database(),
	CACHE: createKVNamespace(),
	QUEUE: createQueue(),
});
```

One call builds the `env` object a Worker expects, typed against the app's generated binding types, so a test sets up a world instead of intercepting modules.

### 5. A Test-Only Development Dependency

The package is `private` and declared as a development dependency, so it reaches tests and tooling and stops there. It implements the binding interfaces from `@cloudflare/workers-types`, so a mock that drifts from the real shape fails typecheck rather than at runtime.

## Consequences

### Positive

- **Tests assert outcomes** - a repository test can insert rows and read them back through real SQL.
- **SQL generation gets covered** - adapter bugs surface in unit tests instead of production.
- **Module mocks decline** - fewer `mock.module()` calls means less reliance on `--isolate`.
- **One fidelity standard** - every test uses the same KV semantics, including expiration and list behavior.
- **Type-checked fidelity** - implementing the real interfaces prevents partial stubs.

### Negative

- **A mock is not the platform** - D1 on SQLite behaves like SQLite, and the real D1 has its own limits (no interactive transactions, size limits) that a mock will happily allow.
- **Maintenance follows the platform** - new binding features must be added when code starts using them.
- **Temptation to over-scope** - the package must resist becoming a general test-helper dump.

### Neutral

- **`--isolate` stays in the root command** - adoption is incremental, and the flag remains correct while any module mocks exist.
- **MSW keeps its role** - HTTP boundaries stay with MSW; this package covers bindings.

## Implementation Plan

### Phase 1: Storage

**Priority:** High
**Estimated Effort:** 4 hours

1. `createKVNamespace()` with expiration, metadata, and list semantics.
2. `createD1Database()` and `createSqlStorage()` over `bun:sqlite`.
3. Verify the data-table adapters' own test suites pass against them.

### Phase 2: Messaging And Events

**Priority:** Medium
**Estimated Effort:** 3 hours

1. `createQueue()` with consumer driving, `createAnalyticsEngine()`, `createRateLimit()`, `createSendEmail()`, `createR2Bucket()`.

### Phase 3: Runtime And Adoption

**Priority:** Medium
**Estimated Effort:** 4 hours

1. `createExecutionContext()`, `createDurableObjectState()`, `createEnv()`.
2. Convert the highest-value module-mock test files, starting with repository and job tests.
3. Write the package README and add it to the root README table (ADR-017).

## Alternatives Considered

### 1. A Broad `@pkg/testing` Package

One package for binding fakes, request builders, factories, and assertion helpers.

**Rejected because**: the name invites unrelated helpers, and a test package that everything depends on becomes a bottleneck. Binding mocks are a coherent, bounded scope.

### 2. Cloudflare's Workers Test Pool

Run tests inside `workerd` with the vitest pool.

**Rejected because**: the monorepo standardizes on Bun's test runner, and adopting a second runner for a subset of tests would split the suite, the coverage story, and the commands.

### 3. Keep Using `mock.module()`

Accept module mocking as the testing strategy.

**Rejected because**: it is what forces `--isolate`, it asserts on interactions instead of results, and it cannot catch SQL or storage-semantics bugs.

## References

- [Cloudflare Workers bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/)
- [ADR-018: Mail Package With Pluggable Transports](./ADR-018-mail-package-with-pluggable-transports.md)
- [ADR-019: Adapter-Based Rate Limiting Package](./ADR-019-adapter-based-rate-limiting-package.md)

## Current Progress

- [x] Phase 1: Storage
- [x] Phase 2: Messaging And Events
- [ ] Phase 3: Runtime And Adoption

## Notes

- The D1 mock must reject what real D1 rejects where it is cheap to do so, and its README must state where it is more permissive than the platform.
- The package name was chosen over `@pkg/testing`, `@pkg/fakes`, and `@pkg/workers-mocks` because it says exactly what is inside and does not invite scope growth.
- Mocks are constructed per test, never shared module-level singletons, so no cleanup step can be forgotten.
