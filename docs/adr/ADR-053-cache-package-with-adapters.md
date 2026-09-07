# ADR-053: Cache Package With Adapters

## Status

**Implemented** - 2026-09-07

Revised twice. First after the instance-bound `Cache<T>` of the original draft was weighed
against a real call site, which is what moved the type parameter from the instance to each
method; [The type is per call](#the-type-is-per-call-not-per-instance) records that.

Then again after the package was built and its consumers migrated, because writing two adapters and
moving four call sites onto them found four things the design had wrong: `JSONSerializable` does not
work as a constraint, `JSONSerialized<T>` needs a depth bound, an error type nothing throws is not
worth exporting, and a deferred write needs ordering as well as a buffer. Each is marked below.

A third revision reverses the largest of those. The design had every method answer with a plain
value and degrade a store failure to a miss, against the repository's `@sdxc/result` rule, and that
deviation was raised for review three times rather than settled. It was settled by overruling it:
every method answers with a `Result`, and [Nothing throws](#nothing-throws) is what replaced
"failures degrade to misses". `CacheError` is the error type the second revision had just deleted.

## Background

[ADR-032](./ADR-032-kv-cache-package-rename.md) renamed `@sdxc/cache` to `@sdxc/kv-cache` so that
each of the three cache packages said what it cached and where. The rename was right about the
ambiguity and wrong about the shape it was naming: it treated "stored in KV" as a property of the
cache, when it is a property of one place a cache can put things.

Two costs have come due since. Nothing can cache without a KV namespace, so any code path that
caches can only be tested inside workerd against a real binding — the package's own suite is
`index.workers.test.ts` for exactly that reason. And the store holds strings, so every call site
brackets its value in `JSON.stringify` on the way in and an unchecked `JSON.parse(…) as T` on the
way out, which is the cast the type system exists to remove.

## Context

### What the package is today

One namespace, `Cache`, holding an `abstract class Store` and one concrete `KVStore` over
`KVNamespace`.

| Surface                                | Callers outside the package |
| -------------------------------------- | --------------------------- |
| `read(key)`                            | 2                           |
| `write(key, value, options)`           | 2                           |
| `fetch(key, load, options)`            | 2                           |
| `delete(key)`                          | 0                           |
| `exists(key)`                          | 0                           |
| `list(prefix, limit)`                  | 0                           |
| `CacheKey` as `{ cacheKey: string }`   | 0                           |
| `CacheKey` as `{ cacheKey(): string }` | 0                           |

The four consumers are `apps/blog` (`app/mcp/cache.ts` and `app/auth/issuer.ts`), `apps/reader` and
`apps/uptime` (`app/auth/issuer.ts` each), and `packages/auth`, which names the type in a test and
in an `@example`.

### Issues identified

| Issue                                       | Impact                                                                                                                        |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| A cache requires a KV binding               | A test of anything that caches needs workerd and a namespace; no unit test can exercise a hit and a miss                      |
| Runtime classes live inside a namespace     | `Cache.KVStore` is a class inside `namespace Cache`, against the repo rule that namespaces carry types only                   |
| The contract is an abstract class           | `Store` exists to share one `protected getKey`, and inheritance is what makes a second adapter a subclass rather than a peer  |
| Values are strings                          | `apps/blog/app/mcp/cache.ts` writes `JSON.stringify(await produce())` and reads `JSON.parse(text) as T` — an unchecked cast   |
| `write` resolves before the value is stored | It hands the put to `waitUntil` and returns; `fetch` awaits that, so two `fetch` calls on one key in one request both compute |
| Half the surface has no caller              | `delete`, `exists`, `list` and both object forms of `CacheKey` are carried, documented and maintained for nobody              |
| The key union is why the base class exists  | Removing the two unused forms removes `getKey`, which removes the only shared implementation inheritance was buying           |

### What `packages/auth` needs

`Issuer.CacheStore` is a structural three-method interface over strings — `read`, `write`, `fetch`,
with a `{ ttl?: DurationInput }` write option. It already demonstrates the contract this ADR wants,
and it must keep type-checking against whatever replaces `Cache.KVStore`.

## Decision

Build `@sdxc/cache`: a `Cache` interface, adapters implementing it at subpath exports, and one
conformance suite both adapters pass. Migrate the four consumers, then delete `@sdxc/kv-cache`.

The name goes back to `@sdxc/cache` because the package no longer names a store. ADR-032's
ambiguity is answered by the subpath instead of the package name: `@sdxc/cache/worker-kv` says where
it puts things, and `@sdxc/http/cache` and `@sdxc/workers-cache` remain distinguishable at the import
line, which was the whole of what ADR-032 asked for.

### The contract

```typescript
interface Cache {
	read<T = JSONValue>(key: string): Promise<Result<JSONSerialized<T> | null, CacheError>>;
	write<T>(key: string, value: T, options?: CacheWriteOptions): Promise<Result<void, CacheError>>;
	fetch<T>(
		key: string,
		load: () => Promise<T>,
		options?: CacheWriteOptions,
	): Promise<Result<JSONSerialized<T>, CacheError>>;
	delete(key: string): Promise<Result<void, CacheError>>;
}

interface CacheWriteOptions {
	/** A bare number is whole seconds; a duration string states its own unit. */
	ttl?: DurationInput;
}
```

Four methods. `exists` and `list` are not in it: neither has a caller, `exists` is `read` with the
value thrown away, and `list` is a prefix scan only some stores can perform. A store that can scan
may expose it as its own method, outside the contract.

Keys are strings. The two object forms went unused for the life of the package, and dropping them
deletes the key-normalization step that was the sole reason for a shared base class.

### The type is per call, not per instance

An instance is a store, not a type. `Cache` takes no type parameter; each method takes its own, so
one instance over one namespace caches whatever is asked of it.

Binding the type to the instance was the first draft of this ADR, and it was wrong on both counts it
was meant to be right on. It bought no safety — nothing verifies that a namespace holds what an
instance claims, so `Cache<CallToolResult>.read(key)` is exactly as unchecked as
`read<CallToolResult>(key)` — and it cost an instance per type. `apps/blog/app/mcp/cache.ts` is the
counterexample that settles it: one KV binding backs both a `cached<T>()` helper generic per call and
a `cacheToolResults()` middleware fixed to `CallToolResult`. Under an instance-bound type those are
two instances of the same store, or one `Cache<JSONValue>` and the casts back.

### What infers and what does not

`write` and `fetch` take the value's type from an argument, so neither needs an annotation:

```typescript
let post = await cache.fetch("post:1", async () => ({ id: 1, at: new Date() }));
//  post: { id: number; at: string }
```

That is inferred from `load` alone, and it is the method both real call sites use. `read` has no
argument to infer from, so `read<CallToolResult>(key)` is an assertion wearing a type parameter. It
is worth saying plainly rather than hiding: what the store holds under a key is a fact about the
past, and no signature can check it. The parameter puts the claim at the call site, next to the key
that justifies it, and defaults to `JSONValue` for a caller who would rather narrow the result.

### Values, and why the types are asymmetric

The reads answer with `JSONSerialized<T>` rather than `T`, because a cache round trip is not the
identity function. A `Date` can be written — `JSON.stringify` knows what to do with it — and what
comes back is the string it serialized to. Typing both ends as `T` would promise a `Date` the caller
will never receive.

`JSONSerialized<T>` is the missing third member of the family `@sdxc/types` already holds, joining
`JSONValue` and `JSONSerializable`, and it goes there rather than here: it describes a JSON round
trip, which is equally what a queue payload, a KV entry, and a `Response.json()` body undergo.

```typescript
type JSONSerialized<T> = T extends { toJSON(): infer R }
	? JSONSerialized<R>
	: T extends JSONValue
		? T
		: T extends readonly unknown[]
			? { [K in keyof T]: Written<T[K]> }
			: T extends (...args: never[]) => unknown
				? never
				: T extends object
					? {
							[K in keyof T as [JSONSerialized<T[K]>] extends [never] ? never : K]: JSONSerialized<
								T[K]
							>;
						}
					: never;
```

It models what `JSON.stringify` does to a value's shape: `toJSON` is applied, arrays map elementwise,
a property whose type cannot survive is dropped, and an array element that cannot survive becomes
`null`, since dropping a slot would change the length read back. It does not model the value-level
facts a type cannot carry, notably that a cycle throws and that `NaN` becomes `null`; those stay the
caller's business. It bounds its own recursion at nine levels of nesting and widens to `JSONValue`
below that, which is correct for a self-referential type and, before the constraint was dropped, was
what let the type appear in these signatures at all.

Because `JSONSerialized<string>` is `string`, a `Cache` satisfies `Issuer.CacheStore` structurally
with no adapter and no change to `packages/auth`: relating the two signatures, TypeScript infers
`T = string` from the target's own return type. This was checked against the compiler rather than
assumed, since a generic method satisfying a non-generic one is not obvious, and `packages/auth`'s
own test now makes the assertion against `Cache` itself.

### `JSONSerializable` is not usable as a constraint

The design had `T extends JSONSerializable` on `write` and `fetch`, to stop a `Map` or a function
being handed to a cache. Migrating the consumers is what showed it cannot: `CallToolResult`, the
type `apps/blog` caches and the reason the typed contract was worth building, fails the constraint
twice over.

| Why it fails                  | How general the problem is                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------- |
| It is an `interface`          | TypeScript gives no implicit index signature to an interface, so most named types fail      |
| `structuredContent?: unknown` | `unknown` is not assignable to anything narrower, and it is how "arbitrary JSON" is spelled |

Both are properties of ordinary, perfectly cacheable types. A constraint that rejects the payload
the package exists to hold is wrong about the domain rather than protective of it, so the type
parameters carry no bound. What it was buying is partly recovered anyway: a value JSON cannot write
throws on the write, which the conformance suite asserts, and `JSONSerialized<T>` of an unwritable
type is visibly useless at the call site.

### Adapters

| Export                    | Class           | Backed by           | For                                                                      |
| ------------------------- | --------------- | ------------------- | ------------------------------------------------------------------------ |
| `@sdxc/cache`             | —               | —                   | The `Cache` interface, `CacheWriteOptions`, and the errors               |
| `@sdxc/cache/memory`      | `MemoryCache`   | A `Map` and a clock | Tests, and the reference implementation a new adapter is written against |
| `@sdxc/cache/worker-kv`   | `WorkerKVCache` | `KVNamespace`       | Production on Workers                                                    |
| `@sdxc/cache/conformance` | —               | —                   | The Vitest suite that says what an adapter is                            |

They are plain exported classes, not members of a namespace, which is what the repo's namespace rule
requires and what the current `Cache.KVStore` breaks.

`MemoryCache` honours TTL against an injectable clock, so a test can expire an entry without
sleeping. Its map holds serialized JSON rather than the live object, so a `Date` written to it comes
back as a string exactly as it would from KV — an adapter that stored the object would disagree with
production on the one thing `JSONSerialized<T>` exists to describe. It is not a mock: it passes the
same suite `WorkerKVCache` does, and a test that caches against it is testing caching.

`WorkerKVCache` takes the namespace and an optional `waitUntil`.

### Writes resolve when the value is readable

Today `write` defers to `waitUntil` and resolves immediately, so the value is not there when the
promise settles. That is the one place the two adapters could not agree, and it is a live bug: it is
why `fetch` awaiting `write` guarantees nothing.

`write` resolves when the value is readable. Given a `waitUntil`, `WorkerKVCache` still hands the put
to it — a miss must not wait on KV — and holds the written value in an instance-local map until the
put settles, so a read on the same instance sees what was just written. The instance is per-request,
which is the scope over which read-your-writes is worth anything and the only scope over which it is
achievable.

A buffer alone is not enough, which running the suite against both write modes is what showed. Two
deferred puts to one key can land in either order, and a `delete` issued while a put is in flight can
land before it and be undone by it. So the map holds the in-flight put alongside the value: a second
write to a key chains after the first, and a delete waits for it. Both are cheap, and without them
the deferred mode answers differently from the awaited one — which is the whole thing the conformance
suite is for.

### Nothing throws

Every method answers with a `Result<_, CacheError>`, and `CacheError.code` is one of three things:

| Code            | Means                                                    | Reached by                |
| --------------- | -------------------------------------------------------- | ------------------------- |
| `unavailable`   | The store could not be reached, or refused the operation | `read`, `write`, `delete` |
| `invalid_value` | JSON could not write the value, or read the entry stored | every method              |
| `load_failed`   | The loader a `fetch` was given failed                    | `fetch`                   |

`unavailable` is the one a caller can ignore, and that is what the earlier design was reaching for:
the value is simply not cached, and computing it is the recovery a miss already asks for. What that
design got wrong was making the ignoring compulsory. A caller that wants to know cannot ask, and two
paths threw anyway — a loader's error and an unwritable value — so the package neither returned
`Result`s nor refrained from throwing.

Store failures are still recorded on the invocation's log, because store health is the package's own
to report and a caller is expected to discard those failures; a `load_failed` is not logged, because
it is the caller's and travels in the `Result`. Every failure carries the `key` and the original
error as `cause`, so a caller that would rather throw rethrows the cause and keeps its own error
type. That is what both real call sites do, and it is why the migration changed no observable
behavior: `packages/auth` still throws the same `AuthError` for an unreachable provider, and the
blog's MCP tools still throw whatever their loader threw.

**`fetch` absorbs everything the store does wrong.** This is the asymmetry that makes the contract
coherent. An unreachable store, an entry that is not JSON, and a refused write all still answer with
a value, because `fetch` can compute one. So a `fetch` failure means the value could not be produced
at all, which is the only thing a caller of `fetch` cannot route around. `read` reports store
failures because it has nothing else to answer with.

### The conformance suite

`@sdxc/cache/conformance` registers Vitest tests against a `create()` the caller supplies, the way
`@sdxc/billing/conformance` does. Both adapters run it, which is what makes `MemoryCache` a
substitute for `WorkerKVCache` rather than a thing that resembles one.

It asserts the round trip, that a miss is `null`, that `fetch` computes once and stores, that a
delete is idempotent, that a write replaces, that a write is readable when it resolves, that a stored
`null` is a hit for `fetch`, and that what a loader throws propagates. It asks for no TTL below 60
seconds: KV rejects `expirationTtl` under 60 with a 400, a limit the previous suite already records,
and a suite both adapters pass cannot assert what one of them is forbidden to do.

Expiry is a group of its own, registered only for an adapter that supplies an `expire` hook. An
adapter whose clock is injectable can be asked to expire an entry; KV can only be waited out, and no
suite is going to sit for a minute. `MemoryCache` therefore covers expiry for the contract, and
`WorkerKVCache` is held to the expiry KV itself recorded, read back from the namespace's own listing.

## Implementation Plan

### Phase 1 — Build

- `JSONSerialized<T>` in `@sdxc/types`, with type tests, including that `JSONSerialized<string>` is
  `string`, so a `Cache` still satisfies `Issuer.CacheStore`.
- `packages/cache`: the contract, the conformance suite, `MemoryCache`, `WorkerKVCache`.
- `MemoryCache` under Vitest; `WorkerKVCache` under workerd, carrying over the TTL-unit assertions
  from `packages/kv-cache/src/index.workers.test.ts`.
- README per the package documentation guide.

### Phase 2 — Migrate

| Consumer                         | Change                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `apps/blog/app/mcp/cache.ts`     | One `WorkerKVCache` for both helpers; `cached<T>` becomes `fetch<T>`, the `JSON.parse(…) as T` casts go |
| `apps/blog/app/auth/issuer.ts`   | `() => new WorkerKVCache(…)`                                                                            |
| `apps/reader/app/auth/issuer.ts` | `new WorkerKVCache(…)`                                                                                  |
| `apps/uptime/app/auth/issuer.ts` | `new WorkerKVCache(…)`                                                                                  |
| `packages/auth`                  | The `@example` and the `issuer.test.ts` type import; `CacheStore` itself is unchanged                   |

### Phase 3 — Remove

Delete `packages/kv-cache`, its root README row, and the cross-references in the `@sdxc/sitemap` and
`@sdxc/cloudflare-mocks` READMEs. `@sdxc/kv-cache` is `private: true` and has never been published,
so nothing outside the repo can be holding it.

ADR-032's status becomes **Superseded** by this ADR, so the name it argued for is not read as current.

## Consequences

### Positive

- **Caching is testable without workerd** — a unit test constructs `MemoryCache` and gets real hits,
  misses and expiry.
- **The cast at every read is gone** — `fetch` infers what comes back from the loader, with no
  annotation and no instance bound to a type.
- **No cache path throws** — the three failure kinds are one error type with a code, so the
  `@sdxc/result` rule holds here as it does everywhere else.
- **One instance per store** — a namespace is served by one cache, whatever mix of types goes into it.
- **A write means what it says** — `fetch` awaiting `write` now guarantees the value is readable.
- **A second store is a peer, not a subclass** — a Cache API or D1 adapter implements an interface.
- **The namespace rule is satisfied** — no runtime class inside a namespace.
- **Half the surface is gone** — three methods and two key forms nobody called.

### Negative

- **A rename, again** — the package is `@sdxc/cache`, which is what it was called before ADR-032.
  The ADR trail has to be read in order to make sense of that, which is what the link in ADR-032's
  status line is for.
- **`JSONSerialized<T>` is a recursive conditional type** — it is the kind of type that is hard to
  read when it misbehaves, and it will occasionally be wrong at the edges `JSON.stringify` is wrong
  at.
- **Nothing stops an unwritable value statically** — the constraint that would have is unusable, so
  a `Map` handed to `write` type-checks and fails at runtime as `invalid_value`.
- **Every call site unwraps** — a cache read is two lines where it was one, and a caller that only
  ever wanted to ignore a store failure pays for the choice not to.

### Neutral

- **Four consumers change import lines**, all inside this repo, all in one commit each.
- **`exists` and `list` are recoverable** — nothing calls them, and either can return to the
  contract or to one adapter when something does.

## Alternatives Considered

### Keep the name `@sdxc/kv-cache`

Zero consumer churn, and ADR-032 stands unamended. Rejected because the name would then describe one
of several adapters: `@sdxc/kv-cache/memory` reads as a contradiction, and every adapter added after
this makes the name less true. A name that has to be explained is the thing ADR-032 was trying to
fix.

### Bind the type to the instance, `Cache<T>`

The first draft of this ADR. Rejected once it was written down against a real call site: it is no
safer, because nothing checks what a namespace holds under either spelling, and it forces a caller
that caches two types in one namespace to hold two instances of the same store. The safety it
appeared to offer was the annotation being written once rather than per call.

### Keep values as strings

The smaller change, and it keeps every adapter free of serialization. Rejected because it does not
remove the cast — it relocates it to the call site, which is where it is today and where the type
information has already been lost. The blog's MCP cache is the proof: it is a `<T>`-generic function
wrapped around a string store, reconstructing by hand the typing the store declined to do.

### Degrade every failure to a miss, returning plain values

What the first two revisions decided, and what was built before this revision reversed it. The
argument was that a caller's only recovery from a failed cache read is to compute the value, so a
`Result` would be a branch with nothing to decide.

Rejected on review. It is true of `unavailable` and false of everything else: a loader that failed
has no value to offer, and both of those cases threw rather than returning anything, so the design
was neither Result-returning nor non-throwing. Making the ignoring compulsory also took the choice
away from the caller — `read` could not distinguish an empty cache from a broken one, which is the
distinction an operator wants first.

### `Result` only where it carries information

`read`, `write` and `delete` return `Result`; `fetch` keeps returning a value, since it absorbs
store failures and has one either way. Rejected because `read` and `write` alone already break
`Issuer.CacheStore`, so it saves no migration, and it leaves a half-`Result` contract — the
inconsistency the rule exists to remove.

### Extend `@sdxc/kv-cache` in place

Add an interface and a memory store to the existing package, no rename, no migration. Rejected
because it produces the same end state — an interface plus adapters — under a name that describes
one adapter, while leaving `Cache.KVStore`, the abstract base, and the unused surface in place to
keep the old callers working. The migration is four import lines; the alternative is carrying two
designs indefinitely to avoid touching them.

## References

- [ADR-032](./ADR-032-kv-cache-package-rename.md) — the rename this supersedes
- [ADR-043](./ADR-043-billing-package-with-pluggable-providers.md) — the contract-plus-adapters shape
  and the conformance-suite pattern this follows
- [ADR-022](./ADR-022-http-cache-policies-and-conditional-responses.md) — HTTP response caching
- [ADR-031](./ADR-031-workers-cache-tags-and-purging-package.md) — edge caching by tag
- [ADR-027](./ADR-027-duration-package.md) — `DurationInput`, the TTL type
- [`@sdxc/result`](../../packages/result) — the `Result` every method answers with
