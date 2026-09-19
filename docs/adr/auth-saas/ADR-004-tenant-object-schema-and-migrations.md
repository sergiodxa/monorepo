# ADR-004: Tenant Object Schema and Migrations

## Status

**Proposed** - 2026-09-18

## Background

[ADR-001](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) puts a tenant's subjects, clients,
sessions and signing keys in that tenant's own Durable Object, over the SQLite database the object
owns, and notes that an object has no filesystem: its schema is a registry of SQL strings applied
on boot rather than a directory a tool reads.

[ADR-003](./ADR-003-control-plane-schema.md) creates the tenant row and calls `provision` on the
new object, which is the first thing this schema survives. This ADR settles the registry's shape,
when it runs, what an interrupted migration leaves behind, how it is tested, what a tenant that
slept through several releases does on its next request, and which tables exist. Each table's
columns belong to the feature ADR that introduces it.

## Context

### There is one database per tenant and no deployment step

A deploy changes what the next boot applies and migrates nothing by itself. Each object wakes on
its own schedule, so the fleet reaches a new schema over the following days as traffic arrives,
and "the migration has run" is a per-object fact. The mechanism belongs to the object's startup
path, on the critical path of a request, so it has to be cheap when there is nothing to do.

### Atomicity is the turn, not the transaction

SQL storage rejects `BEGIN`, `COMMIT`, `SAVEPOINT` and `ROLLBACK`, and the
`@sdxc/data-table-sqlstorage` driver reports `transactionalDdl` as `false`. Writes made within one
turn of the object's event loop coalesce into a single atomic commit, and awaiting I/O ends the
turn. A multi-statement script is therefore a sequence with no rollback of its own, which makes
partial application the failure mode the design answers.

### Per-object storage is finite

ADR-001 states it plainly: a table that grows without bound needs a retention rule before it ships.
Three tables here grow with traffic rather than with customer action — audit, sessions, and the
artifacts of the token exchange — and those are what fill a tenant's database while the tenant does
nothing unusual.

## Decision

### The registry

```typescript
export interface Migration { id: string; sql: string }

export const MIGRATIONS: Migration[] = [
	{ id: "0001-init", sql: m0001 },
	{ id: "0002-passkeys", sql: m0002 },
];
```

The SQL bodies are `?raw` imports of files under `database/tenant-migrations/`, inlined into the
bundle at build time, which is what gives an object with no filesystem its schema. Order is list
order. An id is the file's name, fixed once the migration ships, and a shipped migration's SQL
stays as written, because the journal records the id rather than the text.

### The runner

The journal lives in the object beside the schema it describes:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL
);
```

It runs from the constructor inside `ctx.blockConcurrencyWhile`, so requests queue behind it and
none observes a half-applied schema. It reads the journal once, skips the ids already there, and
for each remaining migration hands the script to the driver's `executeScript` — which cuts it into
statements, since SQL storage executes one at a time — then writes the journal row. For an
up-to-date object the whole boot cost is a single read. `provision({ tenantId, issuer })` runs this
same runner and then writes the settings row, so a first boot and a catch-up boot take one path.

### An interrupted migration

The runner performs no I/O between applying a script and journaling it, so both land in the same
turn and commit together: an object never holds a journal row for a migration it did not finish,
and never finishes one it did not record. A script that throws partway leaves the statements that
ran, no journal row, and a rejected `blockConcurrencyWhile`, which discards the instance — so the
object serves nothing on a partial schema, and the next request boots fresh and retries from the
script's first statement, which is what every migration is written for:

- Creation is guarded: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`.
- A backfill carries a predicate that matches nothing the second time, or writes through
  `INSERT … ON CONFLICT DO NOTHING`.
- `ALTER TABLE … ADD COLUMN` has no guard in SQLite, so it is the only statement in its migration
  and applies whole or not at all.

### Booting several versions behind

An object that slept through four releases applies four scripts on its next request, inside the one
`blockConcurrencyWhile`, and the request that woke it waits for all of them. That stays affordable
because a migration changes schema and leaves data alone: work whose cost scales with a tenant's
row count is a job walking tenants from the control plane, one RPC operation each, while the
migration adds only the column that job fills.

### Testing the registry

The registry runs against a real SQLite database — `createSqlStorage` from `@sdxc/cloudflare-mocks`
behind `createSQLStorageDatabaseAdapter` — under four assertions: applied ids equal the registry in
order, a second run applies nothing, `sqlite_master` holds every table and index the scripts
declare, and `EXPLAIN QUERY PLAN` answers each paging read from an index. Each migration also runs
against a database at the version before it, catching a script that depends on a later one.

### The tables

| Table | What it holds | Why it is here |
| --- | --- | --- |
| `settings` | One row: the tenant id, its issuer, its creation time | The object mints tokens under its own issuer without asking anyone |
| `subjects` | The principal that authenticates | The thing every other table hangs off |
| `credentials` | One row per proof a subject can present | A new factor is a row type rather than a table |
| `sessions` | An authenticated browser, and its lifetime | Authentication survives the redirect to `/authorize` |
| `clients` | Relying parties and their secrets | A client is authorized inside the object that serves it |
| `grants` | What a subject granted a client, and the artifacts issued under it | Consent, codes and refresh tokens share one lifecycle |
| `keys` | Signing keys, current and retired | Private material stays where the signing happens |
| `audit` | The append-only record of what happened | The tenant's own history, retained by tier |

### Retention

| Table | Grows with | Rule |
| --- | --- | --- |
| `audit` | Every authentication event | The tier's window: 7, 30 or 90 days |
| `sessions` | Sign-ins | Removed at expiry |
| `grants` | Token exchanges | Codes expire in minutes; a refresh token goes at rotation and at absolute expiry |
| `keys` | Rotations | A retired key is kept one rotation period |
| `subjects`, `credentials`, `clients` | Customer action | Bounded by the plan's cap; a subject's rows go with the subject |

Sweeping runs from the object's own alarm, and the same migration that creates a table growing with
traffic creates the index its sweep reads: a table arrives with its rule.

### RPC surface

`provision({ tenantId, issuer })` returns the ids it applied and the issuer it recorded. `erase()`
destroys the object's storage for the purge job. Retention needs no method: the alarm is internal.

## Consequences

### Positive

- The schema ships with the code that reads it, so a tenant's database and the bundle serving it
  move together with no fleet-wide migration step to run or to watch.
- An object serves only on a schema it applied completely, a failed attempt costs one boot, and a
  tenant idle for months catches up on its next request with no operator action.
- The registry runs against a real SQLite in a unit test, so a broken script fails in CI.

### Negative

- Rolling the Worker back to earlier code leaves objects already carrying the newer schema, so a
  rollback is safe only while the older code tolerates columns it does not read.
- The registry is append-only and has no down direction: a mistake is corrected by another
  migration, including one that has already reached part of the fleet.
- The first request to an object behind by several releases pays for all of them, and every cold
  start reads the journal, a small cost paid by every tenant forever.
- Retention rests on the object's own alarm, so a tenant whose alarm is failing grows until someone
  notices, which makes alarm health something to watch.

### Neutral

- Two migration mechanisms — numbered files for D1, an inlined registry for the objects — is the
  permanent shape ADR-001 chose, and tables named here are shaped by the feature ADRs.

## Alternatives Considered

**One idempotent schema script with no journal.** The smallest possible runner: every statement
guarded, applied on every boot. It holds until the first column change, which needs an `ALTER`
that no guard covers and no record of whether it ran. Rejected: the journal is what makes the
second year of the schema possible.

**Migrating lazily, at the first query that needs a table.** A faster boot for objects that only
read. It puts a check at every call site and opens a window where two calls both migrate.
Rejected: the constructor is the one place where nothing else is running.

**Journaling per statement so a retry resumes mid-script.** It would allow an unguarded statement
anywhere in a script, at the price of a second SQL splitter beside the driver's and a resume
offset that goes wrong whenever a script is edited. Rejected for the three writing rules above.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) — the object, its boundary, and the storage ceiling
- [ADR-003: Control Plane Schema](./ADR-003-control-plane-schema.md) — who calls `provision` and `erase`
- [ADR-005: Hostname Resolution and Tenant Domains](./ADR-005-hostname-resolution-and-tenant-domains.md) — where the issuer in `settings` comes from
