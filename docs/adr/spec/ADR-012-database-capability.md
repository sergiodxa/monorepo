# ADR-012: Database Capability on Bun's SQL Client

## Status

**Proposed** - 2026-08-09

This ADR adds a database capability to the v1 runtime. Like
[ADR-010](./ADR-010-browser-capability-on-agent-browser.md) and
[ADR-009](./ADR-009-v1-typescript-implementation.md), it is an implementation
ADR: not standalone, free to reference this monorepo's packages and
conventions, and bound by the design suite
([ADR-001](./ADR-001-executable-specification-language.md) through
[ADR-008](./ADR-008-environments-and-compatibility.md)) rather than amending
it. Its behavioral authorities are
[ADR-004](./ADR-004-runtime-and-plugin-protocol.md) (the plugin protocol),
[ADR-006](./ADR-006-isolated-test-workspaces.md) (isolation), and
[ADR-007](./ADR-007-deny-by-default-permissions.md) (permissions). Nothing here
promotes a design-suite **Open** item into a decision; every choice forced by
shipping is recorded as **v1 provisional** — binding on this implementation,
invisible to the design record, cheap to revisit.

## Context

The runtime shipped `fs`, `cli`, `http` (ADR-009), and `browser` (ADR-010) as
built-in plugins behind one protocol. A great deal of what teams want to
specify is the effect of code on a database: a migration created a table, a
handler inserted exactly one row, a query returns the records it should. None
of the existing capabilities reach a database, and expressing database checks
through `cli.run` on a `psql`/`sqlite3` binary would push every assertion into
shell-string parsing — the opposite of what `expect` is for.

Two things make a first-class database capability cheap now. First, Bun ships
a built-in SQL client (`import { SQL } from "bun"`) that speaks Postgres,
MySQL, and SQLite behind one API, selecting the driver from the connection
string's scheme, so the plugin is a thin mapping rather than a driver.
Second, the plugin protocol and the central permission gate were built to
absorb a new namespace of typed tools, and ADR-010 added the optional
`dispose` hook the runner already calls after a run — exactly the seam a
pooled connection needs to be closed.

The design constraint that shapes everything below: a specification must not
choose which database it talks to. A `.spec` that could name a host would be a
`.spec` that could exfiltrate to one. The destination has to be
operator-supplied, and the notation has to stay portable — the same spec running
against a developer's SQLite file, CI's ephemeral database, and a staging
Postgres, changing nothing but an environment variable.

## Decision

Ship `db` as a built-in plugin
(`packages/spec/src/plugins/db.ts`, `createDbPlugin`) registered after
`browser` in the runner and exported from the package index. It exposes one
tool, backed by Bun's SQL client, reading its destination from an environment
variable.

### 1. One tool: `db.query`

```
when { let result = db.query """<sql>""" }
then { expect result.affected_rows 1 }
```

`db.query sql` takes one string argument — the raw SQL, typically a
`"""multiline"""` string — and returns a value object with three fields:

| Field           | Meaning                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| `rows`          | The records a `SELECT` returned, as row objects; empty `[]` for DML/DDL |
| `affected_rows` | Rows changed by DML, or rows returned by a `SELECT`                     |
| `count`         | `rows.length`                                                           |

So an `INSERT` of one row reads `affected_rows == 1` and `count == 0`, while a
`SELECT` returning N rows reads `affected_rows == count == N`. `affected_rows`
is the driver's own count (Bun attaches it to the result array); `count` is the
length of `rows`. Row field values are coerced into the JSON-shaped runtime
value model — dates to ISO strings, binary to base64, out-of-range bigints to
strings — so every row a spec touches is a plain value the runtime can compare
and print.

**Why exactly one tool.** A raw-SQL runner already covers DDL, DML, and DQL; it
is the whole relational surface. A split into `db.execute`/`db.select`/… would
add names without adding capability, and the language already distinguishes the
cases through the returned fields (`affected_rows` for a mutation, `rows`/
`count` for a query) — the runtime never needs the caller to pre-declare which
kind a statement is. Keeping the surface to one tool is the ADR-002 "small,
composable" intent applied to databases.

**`db.query` is an action, not an observable.** A raw SQL string can mutate, so
the tool is classed `action`: it may not run inside `eventually` (a retried
mutation is not a retried assertion, per ADR-005/GRAMMAR) and cannot head the
observable form of `expect`. Assertions read the returned value in `expect`'s
value form (`expect result.affected_rows 1`), which is where a query's result
belongs. v1's grammar has no array-literal syntax, so a spec asserts on the
scalar `count`/`affected_rows` fields (a filtered `SELECT ... WHERE` whose
`count` is 1 is a precise content assertion); richer row-collection assertions
are an open question below, not a v1 tool.

`describe()` returns the tool set as a static constant and never opens a
connection, so a suite that never calls `db.*` costs nothing and needs no
`DATABASE_URL` — the same static-describe discipline ADR-010 established.

### 2. Permissions: env only, because the destination is operator-controlled

`db.query` declares `requires: "env"` and reads its connection string from the
`DATABASE_URL` environment variable. It requires **no `net` and no `run`**, and
that is the substantive decision, not an omission.

The reasoning is the operator-controlled-destination argument, the
environment-variable analogue of ADR-007 §4's trusted-vs-spec-requested
distinction. A spec never names where the database is — it names `db.query` and
writes SQL. The connection target is supplied entirely by the operator through
`DATABASE_URL`. So the grant that reveals that variable _is_ the complete
authorization: once the caller has said "this run may read `DATABASE_URL`", the
run can reach exactly the one destination the operator chose and no other. There
is nothing a `net` grant would add, because the spec cannot express an
alternate host to scope; there is nothing a `run` grant would add, because the
spec spawns no process (the SQL client is trusted plugin machinery, like
ADR-010's `agent-browser`). Adding `net`/`run` would be security theater —
flags that appear on every database spec and gate nothing the spec controls.

The check is enforced in two layers, and the layers report differently on
purpose:

- **The runtime's central gate** (ADR-009's `executor.ts`) refuses the call
  before the plugin runs when the `env` family is denied outright — no
  `--allow-env` at all. Its remedy is the coarse `spec run --allow-env`,
  because at that point the runtime knows only the family, exactly as a denied
  `--allow-run` reports the bare flag.
- **The plugin then calls `ctx.permissions.checkEnv("DATABASE_URL")`**, which
  refines the grant to the one variable the plugin actually reads. A caller who
  granted some _other_ variable (`--allow-env=OTHER`) passes the coarse gate but
  is refused here, with the precise remedy `spec run --allow-env=DATABASE_URL`.

This mirrors how `cli.run` reports `run` denials — bare `--allow-run` when the
family is denied, scoped `--allow-run=echo` when a different executable was
granted — so the database capability is consistent with the rest of the
runtime rather than special. The env permission already matches a granted name
against `process.env` regardless of origin, so both a system-wide exported
`DATABASE_URL` and the per-call `DATABASE_URL=… spec run
--allow-env=DATABASE_URL` form work with no permission-engine change; this ADR
confirms that, it does not touch the permission code.

Once the permission layer is satisfied, the plugin reads
`process.env.DATABASE_URL`. An unset or empty value is a `ToolError` — a
configuration error, distinct from a permission denial — that names the
variable and shows the per-call form, so the failure tells the operator exactly
what to set. Only after that does the plugin attempt a connection.

### 3. Connection lifecycle: lazy, pooled, disposed

The connection is created lazily on the first `db.query`, from the
`DATABASE_URL` in force at that moment, and cached in the plugin instance for
the rest of the run — Bun's SQL client pools underlying connections, so reusing
one client across the whole suite is both correct and cheap. It is closed once,
in the `dispose()` hook ADR-010 added, which the runner calls for every plugin
in a `finally` after the whole run. `dispose` detaches the cached handle before
awaiting `close()`, so it is idempotent and best-effort: a slow or throwing
close never turns a completed run into a failure, and a suite that never
queried holds nothing to release. A SQL or connection error at query time
surfaces as a `ToolError` carrying the database's own message, so the failing
test reports what the database said.

Because one connection is shared across the run and (for a file/server
database) state persists between tests, tests are **not** isolated at the data
layer the way they are at the filesystem layer (ADR-006). v1 does not paper
over this: the example suite writes order-independent specs (each sets up and
clears its own table, or seeds through a shared command/fixture). Per-test data
isolation is an open question below, not a v1 promise.

### 4. SQLite in CI, so the capability is tested for real

The CI-safe `spec/db.spec` meta-tests specify the whole permission-and-config
surface **without a database**: each writes an inner one-file suite, runs the
real CLI against it, and asserts that (a) with no `--allow-env` the call is
denied naming the tool, (b) with an unrelated env grant it is still refused
naming `--allow-env=DATABASE_URL`, and (c) with `DATABASE_URL` granted but
unset it is a `ToolError` naming the variable. All three fail before a
connection is attempted, so they run anywhere.

The connecting layer runs against SQLite. Bun's SQL client has a SQLite driver,
so `db-example.test.ts` sets `DATABASE_URL=sqlite://<temp-file>` in a child
environment and runs `spec run examples/db --allow-env=DATABASE_URL` — the
per-call form, end to end — covering `CREATE TABLE`, an `INSERT` asserting
`affected_rows 1`, a `SELECT` asserting `rows`/`count`, a fixture that drives
the database and returns its result, and a command that seeds data. Choosing
SQLite over a gated external server means the functional path actually executes
in CI with no service dependency; the test skips only if a future Bun ships
without the SQLite driver, and the plugin unit tests likewise exercise real
SQLite row/count shaping and the connection lifecycle.

## Consequences

### Positive

- ADR-009's additivity claim holds again: the database family landed as one
  plugin plus a one-line registration and one index export, with no change to
  the lexer, parser, executor semantics, or permission engine.
- The env-only permission model makes database specs read honestly: the one
  flag a reader sees, `--allow-env=DATABASE_URL`, is the one thing that actually
  authorizes the run, and the destination is unmistakably the operator's.
- The capability is exercised for real in CI against SQLite — row/count shaping,
  fixtures and commands driving the database, and the connection lifecycle —
  not merely typechecked.

### Negative

- One shared connection means no data isolation between tests; specs must be
  written to tolerate shared state (or reset what they touch). This is the cost
  of a pooled connection and is called out for authors rather than hidden.
- v1 reads exactly one variable name (`DATABASE_URL`) and offers exactly one
  tool with no parameter binding, so a spec cannot address two databases at
  once or bind values into SQL. These are deliberate v1 scope limits, listed
  below.

### Neutral

- The plugin binds v1's database access to Bun's SQL client and the schemes it
  supports (`sqlite`, `postgres`, `mysql`). A future plugin could satisfy `db`
  over another driver with the same tool surface.
- The functional example test skips cleanly when SQLite is unavailable, so CI
  stays green on any Bun while running the full CI-safe meta surface regardless.

## Open Questions

These are v1-provisional pressure points, not reopenings of the design suite.

- **Per-test data isolation.** The filesystem gets a fresh workspace per test
  (ADR-006); the database does not. Whether v1's successor wraps each test in a
  rolled-back transaction, a fresh schema, or a fresh SQLite file — and how that
  interacts with a fixture that must see its own writes — is the biggest open
  question and is left until the isolation model is designed rather than
  guessed.
- **Multiple and other databases.** One tool reading one `DATABASE_URL` cannot
  address a second database in the same run. A namespaced-connection or
  multi-URL scheme is deferred until a real spec needs two.
- **A configurable variable name.** `DATABASE_URL` is hard-coded. If a project
  needs another name (or several), a manifest- or flag-level mapping would be
  the natural home — related to the environments mechanism ADR-008 defers.
- **Parameter binding and richer result assertions.** `db.query` takes a raw
  string only; there is no way to bind values into SQL, and no array-literal
  syntax to compare whole `rows` collections. Parameterized queries and a
  first-class collection assertion are the obvious next increments once the
  language grows the syntax to express them.
- **Transactions.** Bun's SQL client exposes `begin`/`transaction`; v1 exposes
  neither, so a spec cannot wrap statements in a transaction or assert rollback
  behavior. Deferred with the isolation work, which will likely want the same
  machinery.
