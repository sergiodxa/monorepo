# ADR-128: Time-Ordered UUIDs for Entity IDs

## Status

**Accepted** - 2026-10-09

## Background

Every entity ID in the repo is a UUID. It is stored as-is in the database and shown to the
outside as a TypeID (`user_01h455vb4pex5vsknk084sn02q`) through `@sdxc/typeid`. Most of those
UUIDs are version 4: `generateUUID()` in `@sdxc/uuid` wraps `crypto.randomUUID()`, and several
blog repositories call `crypto.randomUUID()` directly.

A v4 UUID is 122 random bits, so the IDs of consecutive inserts land at random positions in the
primary-key index, and `ORDER BY id` returns rows in an arbitrary order. `@sdxc/uuid` already
ships `generateUUIDv7()`, but only auth-saas uses it. The rest of the repo uses v4 because that
is what the default-named function produces.

## Context

### Current state

| Generator                          | Version | Callers (non-test)                                                              |
| ---------------------------------- | ------- | ------------------------------------------------------------------------------- |
| `generateUUID()` from `@sdxc/uuid` | v4      | uptime (28), auth-saas (23), r3-auth (7), reader (4), demo (1)                  |
| `generateUUIDv7()`                 | v7      | auth-saas models (12)                                                           |
| `crypto.randomUUID()` for entities | v4      | blog: `post`, `post-meta`, `user`, `webmention`, `webmention-send` repositories |

Apps store IDs as `TEXT` primary keys in D1 and Durable Object SQLite. `@sdxc/typeid`
encodes the UUID's 128 bits in Crockford base32 and preserves their sort order, so a TypeID
sorts the same way as the UUID behind it.

### Issues identified

| Issue                                                    | Impact                                                                                                                                       |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Random inserts into the primary-key B-tree               | SQLite keeps a separate index for a `TEXT` primary key; random keys split pages across the whole tree and lose cache locality as tables grow |
| IDs carry no order                                       | Listing newest-first and cursor pagination need a `created_at` column, often with a composite index and a tiebreaker on `id`                 |
| Default name points at v4                                | The obvious call, `generateUUID()`, produces the unordered variant, so new code keeps choosing it                                            |
| Blog bypasses `@sdxc/uuid`                               | Its entity IDs skip the `UUID` brand and will not follow a change to the package's default                                                   |
| `generateUUIDv7()` is not monotonic within a millisecond | Workers freeze `Date.now()` between I/O, so every ID created in one request shares a timestamp and sorts randomly relative to the others     |

## Decision

Entity IDs are UUIDv7 (RFC 9562), created by `generateUUID()` from `@sdxc/uuid`. The
external TypeID form stays as it is and becomes time-ordered automatically.

### `@sdxc/uuid` API

| Function           | Produces                          | Use for                                          |
| ------------------ | --------------------------------- | ------------------------------------------------ |
| `generateUUID()`   | Monotonic UUIDv7                  | Every entity ID by default                       |
| `generateUUIDv4()` | UUIDv4 from `crypto.randomUUID()` | Entity IDs whose creation time must stay private |

`generateUUIDv7()` is removed, and its auth-saas callers move to `generateUUID()` in the same
release. Under the repo's breaking-change policy there is no deprecated alias.

### Monotonic within a millisecond

`generateUUID()` follows RFC 9562 §6.2 Method 1 (fixed-length dedicated counter bits), using
the 12 `rand_a` bits as a counter:

- On a new millisecond, the counter starts at a random value with its top bit cleared. This
  leaves at least 2048 increments before it overflows.
- Within the same millisecond, the counter increments. The 62 `rand_b` bits stay freshly
  random on every call, so IDs remain unguessable.
- On counter overflow, the timestamp field advances by one millisecond, as the RFC allows. A
  clock that moves backwards is treated the same way: the last timestamp is reused and the
  counter keeps incrementing.

The state (last timestamp and counter) lives at module scope and is updated only when
`generateUUID()` is called. It costs nothing at module load, which keeps the Worker
global-scope upload validation happy. Ordering is guaranteed per isolate. IDs created by two
isolates in the same millisecond are unique but have no defined order between them, which
matches the precision of a `created_at` column.

```typescript
let first = generateUUID();
let second = generateUUID();
first < second; // true, even when Date.now() did not advance
```

### Scope: entity IDs only

This decision covers values that identify stored rows. Values whose job is to be unguessable,
or that are never stored as keys, keep their random generator. A v7 value exposes its creation
time and has 74 random bits instead of 122.

| Value                                                     | Generator                        |
| --------------------------------------------------------- | -------------------------------- |
| Row primary keys (users, posts, monitors, tenants, ...)   | `generateUUID()` (v7)            |
| Rows whose creation time is private                       | `generateUUIDv4()`               |
| OAuth authorization codes, tokens, invite and reset links | Random secret, unchanged         |
| JWT `jti`, correlation IDs, MIME boundaries, leases       | `crypto.randomUUID()`, unchanged |

### Existing data

No migration rewrites existing IDs. v4 and v7 values are both valid UUIDs and share the same
`TEXT` columns, `assertUUID`, and TypeID encoding. Rows created before the switch keep their v4
IDs. As a result, ordering by `id` puts the time-ordered rows in sequence and leaves the old ones
interleaved by their random prefix. Queries that need a total chronological order over old data
keep ordering by `created_at`.

### Repo rule

`AGENTS.md` gains a rule: entity IDs come from `generateUUID()` in `@sdxc/uuid`, never from
`crypto.randomUUID()`. Use `generateUUIDv4()` only when the entity's creation time must stay
private.

## Consequences

### Positive

- **Append-mostly index writes** - new keys land at the right edge of the primary-key B-tree,
  so inserts touch a small, hot set of pages
- **IDs sort by creation** - `ORDER BY id` and keyset pagination on `id` alone give
  newest/oldest-first listings for new rows, including rows created in the same request
- **Sortable public IDs at no extra cost** - TypeIDs inherit the order, so a TypeID suffix
  behaves like a prefixed ULID
- **One obvious call** - the default-named function is the right one for entity IDs

### Negative

- **Creation time is public** - anyone holding a TypeID can decode when the entity was
  created. Entities where that matters must opt into `generateUUIDv4()`, which relies on the
  author noticing
- **Fewer random bits** - 74 instead of 122. This is ample for uniqueness, but rules out v7
  for anything used as a bearer secret
- **Mixed history** - tables keep a v4 prefix of old rows, so `id` order is only chronological
  for rows created after the switch
- **Module-level state** - the monotonic counter is per isolate and must be reset in tests that
  freeze time

### Neutral

- **Storage unchanged** - IDs remain 36-character `TEXT`. Storing them as 16-byte `BLOB`s
  would shrink indexes further, but that is a separate decision
- **Validation unchanged** - `isUUID`/`assertUUID` accept any version, as they do today

## Implementation Plan

### Phase 1: `@sdxc/uuid`

**Priority:** High

1. Make `generateUUID()` produce a monotonic UUIDv7, add `generateUUIDv4()`, and remove
   `generateUUIDv7()`
2. Tests: version and variant bits, ordering across milliseconds, ordering within a frozen
   millisecond, counter overflow advancing the timestamp, and a backwards clock
3. Update the README and the `@sdxc/typeid` examples that call `crypto.randomUUID()`

### Phase 2: Apps (one commit per app)

**Priority:** High

1. auth-saas: replace `generateUUIDv7()` with `generateUUID()`
2. blog: replace `crypto.randomUUID()` with `generateUUID()` in the `post`, `post-meta`,
   `user`, `webmention`, and `webmention-send` repositories
3. uptime, r3-auth, reader, demo: pick up v7 through the existing `generateUUID()` calls, and
   switch any entity whose creation time is private to `generateUUIDv4()`

### Phase 3: Repo rule

**Priority:** Medium

1. Add the entity-ID rule to `AGENTS.md`

## Alternatives Considered

### 1. ULID

ULID has the same layout (48-bit millisecond timestamp, 80 random bits) and the same sort and
locality behavior.

**Rejected because**: it is not a UUID. Adopting it would mean replacing the `UUID` brand,
`assertUUID`, and `TypeID.toUUID()` for no gain. TypeID over v7 already gives a ULID-like
public string.

### 2. Keep v4 and add `created_at` indexes

**Rejected because**: it keeps the random index writes and requires a composite index on every
table that paginates.

### 3. Integer sequences

**Rejected because**: they expose row counts and growth rate, and they are enumerable. A
per-tenant Durable Object database would also need a separate sequence per tenant, which
complicates any cross-tenant copy or import.

### 4. Non-monotonic v7 (the current `generateUUIDv7()`)

**Rejected because**: frozen time on Workers makes every ID in a request share a millisecond,
so the ordering guarantee would fail exactly where batches of related rows are created.

## References

- [RFC 9562 - Universally Unique IDentifiers (UUIDs)](https://www.rfc-editor.org/rfc/rfc9562)
- [TypeID specification](https://github.com/jetify-com/typeid)
- [ULID specification](https://github.com/ulid/spec)

## Current Progress

- [ ] Phase 1: `@sdxc/uuid`
- [ ] Phase 2: Apps
- [ ] Phase 3: Repo rule
