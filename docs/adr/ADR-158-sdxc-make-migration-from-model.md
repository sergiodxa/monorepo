# ADR-158: `sdxc make migration --from-model`

## Status

**Accepted** - 2026-10-18

## Background

A model in `app/models/` declares its table with `remix/data-table`'s `table({ name, columns })`,
and the migration that creates or changes that table is written by hand. The two drift: a column
added to the model and forgotten in SQL fails at runtime, and hand-written table rebuilds are where
this repo has lost data before (a copy step reading a column under its new name silently wrote the
column's name into every row, which `test/migration-replay.test.ts` now guards against). ADR-143
gave `sdxc make migration <name>` an empty numbered file; this ADR records how the same command
writes the SQL itself from a model.

## Context

- A data-table column carries its type, `.nullable()`, `.default()` / `.defaultNow()` /
  `.defaultSql()`, `.primaryKey()`, `.unique(name?)`, `.references(table, column, name)` with
  `.onDelete()` / `.onUpdate()`, `.check(expression, name)`, `.computed()`, `.collate()` and
  `.autoIncrement()`. A table has a primary key (default `["id"]`). Data-table has no notion of a
  non-unique index, and its SQLite adapter compiles no DDL.
- A chain is a folder of numbered SQL files (`make.migrations`), applied by `sdxc run db migrate`
  to D1 or a Durable Object's SQLite. D1 always enforces foreign keys; `PRAGMA foreign_keys = OFF`
  is ignored there, and `PRAGMA defer_foreign_keys = on` is the only switch a migration has.
- SQLite's `ALTER TABLE` can add a column only when it is no primary key and not unique, has no
  `CURRENT_*` or parenthesised default, has a non-null default when `NOT NULL`, has a null default
  when it references another table, and is not a stored generated column. It can drop a column
  that no index, key, or foreign key uses. Everything else needs a table rebuild.
- When foreign keys are on, `DROP TABLE` runs an implicit `DELETE FROM` that fires `ON DELETE`
  actions even under `defer_foreign_keys`. Rebuilding a table another table references with
  `ON DELETE CASCADE` deletes the child rows; `RESTRICT` fails the migration.

## Decision

`sdxc make migration <name> --from-model <model> [--chain <chain>] [--dry-run]` writes the next
migration of the chain with exactly the statements that bring the chain's schema in step with
the tables `app/models/<model>.ts` exports.

### 1. Read the model in the project's runtime

The model module is imported in a child process with the runtime `sdxc run` uses (`bun -e` for a
Bun project, `node --input-type=module -e` otherwise, the module's file URL in `SDXC_MODEL`),
with the project root as working directory, so its own `tsconfig` paths
and dependencies resolve. The child prints every exported table's name, primary key and column
definitions as JSON. Tables are recognised by the description of data-table's metadata symbol, so
the project's copy of `remix/data-table` and the kit's need not be the same instance. A model that
exports no table is an error.

### 2. Rebuild the current schema by replaying the chain

Every file of the chain is applied in order of its leading number to an in-memory `node:sqlite`
database with double-quoted string literals disabled, the rule `test/migration-replay.test.ts`
enforces. A statement that fails stops the command and names the file: diffing against a schema
the chain does not produce would write a wrong migration. The schema is read back with
`PRAGMA table_xinfo`, `index_list`, `index_xinfo`, `foreign_key_list` and `sqlite_master`. Each
chain is replayed alone, so `--chain` diffs against that chain's schema only.

### 3. Diff and choose the cheapest safe statement

| Model vs. replayed schema                                                         | Statement                                                    |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Table absent                                                                      | `CREATE TABLE` + `CREATE UNIQUE INDEX` per unique column     |
| New column SQLite can add                                                         | `ALTER TABLE … ADD COLUMN`                                   |
| New `.unique()` on an existing column                                             | `CREATE UNIQUE INDEX`                                        |
| Column gone from the model, used by no index, key or foreign key                  | `ALTER TABLE … DROP COLUMN`                                  |
| Type affinity, nullability, default, generation, key, foreign keys or named check | table rebuild                                                |
| New column SQLite cannot add (`NOT NULL` without default, `CURRENT_TIMESTAMP` …)  | table rebuild                                                |
| Nothing differs                                                                   | nothing is written; the command says the chain is up to date |

Types compare by SQLite affinity, not spelling: a column declared `VARCHAR(255)` matches
`c.text()`, `BOOLEAN` matches `c.boolean()`, `DATETIME` matches `c.timestamp()`, `DECIMAL` or
`REAL` match `c.decimal()`. Defaults compare after stripping outer parentheses, with `true`/`false`
read as `1`/`0` and numbers compared by value. Key columns are always written `NOT NULL` and their
nullability is not compared, since data-table never writes a null key and SQLite reports an
`INTEGER PRIMARY KEY` as nullable.

**A rebuild** is announced with every reason that forced it (`posts is rebuilt (create, copy,
drop, rename) because posts.views changes its default from 0 to 1`). It creates `__sdxc_new_<table>` from the model, copies every column the old and new
tables share by name (generated columns excluded) with `INSERT … SELECT` reading the **old**
names, drops the old table, renames the new one, then recreates the old table's indexes and
triggers (skipping, with a warning, any index on a dropped column) and every unique constraint the
model does not declare, as a unique index. A column that becomes `NOT NULL` with a literal default
is copied through `COALESCE(old, default)`; one without a default is copied as is, with a warning
that rows holding `NULL` fail the migration.

**Foreign keys pointing at a rebuilt table.** When every reference is `NO ACTION`, the rebuild is
wrapped in `PRAGMA defer_foreign_keys = on` / `off`. When any reference (another table's or the
table's own) is `ON DELETE CASCADE`, `SET NULL`, `SET DEFAULT` or `RESTRICT`, the command refuses
with an error naming the references and the change that needs the rebuild, because on D1 the
`DROP TABLE` would delete or rewrite the child rows. That migration is written by hand.

**What is never removed.** Indexes the model cannot express (non-unique, multi-column, partial,
expression) are kept, and so is a unique index or constraint on a column the model does not mark
`.unique()`: the command warns instead of dropping a constraint that protects data. Tables the
model does not declare are never touched. A rebuild cannot carry what a model cannot declare and what
SQLite does not report by name: a multi-column foreign key or an unnamed `CHECK` is dropped by it,
and the command warns so, naming each.

### 4. Renames are drop + add, loudly

A model carries no history, so a renamed column is indistinguishable from a dropped column and a
new one. The command treats it as both and prints a warning naming the table, the dropped and the
added columns, and that the dropped column's data is deleted; the generated file carries the same
warning as a SQL comment. Inferring renames by type or position would guess, and a wrong guess
moves data into the wrong column silently, which is worse than a loud loss on a reviewed file.

### 5. Verify before writing

The generated SQL is applied to the replayed database and the diff is run again. A statement
that errors, or a second diff that is not empty, fails the command instead of writing the file.

### Shared renderer

`packages/kit/src/make/schema.ts` exports `createTableStatement(table)`, the `CREATE TABLE` plus
unique indexes for a data-table table, which every generator that creates a table uses. Types map
`text`/`varchar`/`uuid`/`enum`/`json`/`date`/`time`/`timestamp` to `TEXT`,
`integer`/`bigint`/`boolean` to `INTEGER`, `decimal` to `NUMERIC` and `binary` to `BLOB`; columns
are `NOT NULL` unless `.nullable()`; `defaultNow()` is `CURRENT_TIMESTAMP`; foreign keys and checks
are named table constraints; a `.unique()` column gets `CREATE UNIQUE INDEX
"<name ?? table_column_unique>"`.

## Consequences

### Positive

- The common changes (new table, new nullable or defaulted column, new unique column) are one
  command and one reviewed file, with no chance of re-adding a column an earlier migration made.
- Rebuilds read old names in their copy step, keep indexes, triggers and unique constraints, and
  are checked against the replayed schema before the file exists.
- The D1 cascade trap on rebuilds is caught instead of shipped.

### Negative

- Changes the model cannot express or that cannot be read back are not diffed: enum value lists
  (enums are plain `TEXT`), a check's expression when its name is unchanged, a generated column's
  expression, collation, `AUTOINCREMENT`, and foreign key constraint names.
- A chain whose SQL `node:sqlite` cannot replay (an extension D1 has and the local SQLite lacks)
  cannot be diffed; the error names the file.
- Loading a model runs its module code; a model that imports `cloudflare:workers` fails to load.

## Alternatives Considered

- **Introspect a live D1 database.** Needs credentials and a deployed database, and differs per
  environment; the chain is the source every environment is built from.
- **Keep a snapshot of the schema beside the chain (Drizzle's approach).** A second source of
  truth that drifts from hand-written migrations; replaying the chain needs none.
- **Always rebuild.** Simpler, but a rebuild of a referenced table deletes child rows on D1, so
  the cheapest statement is also the safest one.

## References

- [ADR-143](./ADR-143-sdxc-make-generators.md) — `sdxc make` generators and migration chains
- SQLite: `ALTER TABLE` limits and the twelve-step table rebuild
- Cloudflare D1: foreign keys and `PRAGMA defer_foreign_keys`
