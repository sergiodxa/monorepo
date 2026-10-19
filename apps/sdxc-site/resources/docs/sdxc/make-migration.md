---
title: Make a migration
description: Write the next numbered SQL migration of a chain with sdxc make migration, from fields that create, alter or drop, from a model, or empty for your own statements.
section:
    title: The sdxc command
    order: 2
order: 2.06
lastUpdated: 2026-10-19
outcomes:
    - "How migration names create, alter and drop tables from fields"
    - "How `--from-model` writes the SQL that brings a chain in step with a model"
    - "Which warnings to read before you apply a migration"
---

A migration is one numbered SQL file that changes the database's schema, applied in order by
`sdxc run db migrate`. `sdxc make migration` writes the next one of a chain, named like the files
already there. Fields write the SQL its name asks for, `--from-model` writes what a model's
tables need, and neither leaves it empty for statements you write:

```bash
sdxc make migration create-posts title body published_at author_id
sdxc make migration add-slug-to-posts 'slug?' featured
sdxc make migration sync-posts --from-model post
sdxc make migration add-index
```

Reach for it for every change to a table: a new table, a new column, an index, a backfill.

## Flags

| Argument or flag       | Default   | What it does                                                             |
| ---------------------- | --------- | ------------------------------------------------------------------------ |
| `[field[:type][?]...]` |           | the columns a `create-`, `add-…-to-` or `remove-…-from-` name changes    |
| `--chain <chain>`      | `default` | the chain in `make.migrations` to write into                             |
| `--from-model <model>` |           | write the SQL that brings the chain in step with `app/models/<model>.ts` |
| `--dry-run`            |           | print the file and change nothing                                        |

A migration never gets a test, and its name holds no folders. Fields and `--from-model` together
are a usage error. Every run writes a new file numbered after the last, so `make migration` is
the one kind without `--force`: to change a migration no database has applied yet, edit its
file.

[`sdxc make model`](/docs/sdxc/make-model) writes the `create-<table>` migration with the model,
so the first migration of a table usually comes from there.

## The file name

The new file sorts after every file in its chain and is spelled like them:

| The chain holds                | `sdxc make migration add-index` writes               |
| ------------------------------ | ---------------------------------------------------- |
| nothing yet                    | `0001_AddIndex.sql`                                  |
| `0004-add-feeds.sql`           | `0005-add-index.sql`                                 |
| `20261008100000_add_feeds.sql` | `20261015090807_add_index.sql`, the current UTC time |

A sequence keeps its width and counts up from the highest number; a 14-digit timestamp takes the
current time, or one past the newest file when the clock reads earlier. The separator and the
case of the name, kebab, snake, Pascal or camel, follow the newest file. An empty migration holds
one comment for you to replace with its statements:

```sql
-- AddIndex: write the statements this migration applies, in order.
```

## Chains

Chains are the folders in `make.migrations`, by name. An app with more than one database
declares one per database and picks one with `--chain`:

```jsonc {% title=".config/sdxc.jsonc" %}
{
	"make": {
		"migrations": {
			"default": "database/migrations",
			"tenant": "database/tenant",
		},
	},
}
```

```bash
sdxc make migration add-plan --chain tenant
```

A chain that is not configured stops the command and lists the ones that are.

## Create, alter or drop from fields

With fields, the name says what the migration does, as Rails reads it, and the fields say which
columns. Any spelling works: `create-posts`, `create_posts` and `CreatePosts` are the same.

| Name                            | Statements                                |
| ------------------------------- | ----------------------------------------- |
| `create-<table>`                | `CREATE TABLE` with the fields            |
| `add-<columns>-to-<table>`      | one `ALTER TABLE … ADD COLUMN` per field  |
| `remove-<columns>-from-<table>` | one `ALTER TABLE … DROP COLUMN` per field |

The words between `add-` and `-to-` only name the file; the fields decide the columns. The last
`to` or `from` starts the table's name, so `add-to-do-to-tasks` adds to `tasks`. A name that
matches none of the three is a usage error that says so.

Fields are typed as [`sdxc make model`](/docs/sdxc/make-model#fields) types them: a bare name by
its name, `name:type` explicitly, `name?` nullable.

### Create a table

```bash
sdxc make migration create-posts title body published_at author_id
```

```sql {% title="database/migrations/0001_CreatePosts.sql" %}
-- CreatePosts: creates the posts table.

CREATE TABLE "posts" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "published_at" INTEGER NOT NULL,
  "author_id" TEXT NOT NULL,
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL,
  CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "authors" ("id")
);
```

Every table gets an `id` and the two timestamps, and each reference a foreign key to the table
its model declares, or the plural of its name when the project has no such model.

### Add columns

```bash
sdxc make migration add-slug-to-posts 'slug?' featured
```

```sql {% title="database/migrations/0002_AddSlugToPosts.sql" %}
-- AddSlugToPosts: adds slug, featured to posts.

ALTER TABLE "posts" ADD COLUMN "slug" TEXT;

ALTER TABLE "posts" ADD COLUMN "featured" INTEGER NOT NULL DEFAULT 0;
```

SQLite fills an added column of every existing row with the column's default. A box is added
unticked, `NOT NULL DEFAULT 0`; every other field, a reference included, is added nullable with
`?`. A required column is refused with what to do instead:

```text
slug needs a value for the rows posts already holds; write slug? to add it nullable, or declare it in the model and run make migration --from-model, which rebuilds the table
```

A field's `:unique` or `:index` indexes the column it adds, after every `ADD COLUMN`:

```bash
sdxc make migration add-slug-to-posts 'slug?:unique' 'code?:index'
```

```sql {% title="database/migrations/0002_AddSlugToPosts.sql" %}
-- AddSlugToPosts: adds slug, code to posts.

ALTER TABLE "posts" ADD COLUMN "slug" TEXT;

ALTER TABLE "posts" ADD COLUMN "code" TEXT;

CREATE UNIQUE INDEX "posts_slug_unique" ON "posts" ("slug");

CREATE INDEX "posts_code_index" ON "posts" ("code");
```

### Drop columns

```bash
sdxc make migration remove-slug-from-posts slug
```

```sql
ALTER TABLE "posts" DROP COLUMN "slug";
```

A dropped column takes its data with it. `id`, `created_at` and `updated_at` stay, and naming
one is refused.

### Checked against the chain

The SQL is applied to the replayed chain before the file is written, so a table that already
exists, a table or column that is missing, or a column SQLite cannot drop stops the command with
SQLite's reason:

```text
The migration does not apply after database/migrations: table "posts" already exists
```

## Write the SQL from a model

`--from-model` reads the tables `app/models/<model>.ts` exports and writes only what the chain
lacks, so a model you edit reaches its table in one step. The model's name is the one
`sdxc make model` took, folders included. After adding `slug: c.text().nullable().unique()` to
the `posts` table:

```bash
sdxc make migration add-slug --from-model post
```

```sql {% title="database/migrations/0002_AddSlug.sql" %}
-- AddSlug: brings database/migrations in step with app/models/post.ts, as sdxc make migration --from-model wrote it.

ALTER TABLE "posts" ADD COLUMN "slug" TEXT;

CREATE UNIQUE INDEX "posts_slug_unique" ON "posts" ("slug");
```

It loads the model with your project's runtime, Bun or Node as `sdxc run` picks, so install the
project's dependencies first. Then it replays every file of the chain into an in-memory SQLite,
compares each table with the model, and picks the cheapest statements that keep every row:

| The model, against the chain                                                                                                  | Statement                                                          |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| a table the chain lacks                                                                                                       | `CREATE TABLE`, and a `CREATE UNIQUE INDEX` per `.unique()` column |
| a new column SQLite can add in place                                                                                          | `ALTER TABLE … ADD COLUMN`                                         |
| `.unique()` on an existing column                                                                                             | `CREATE UNIQUE INDEX`                                              |
| a column gone from the model that no index, key or foreign key uses                                                           | `ALTER TABLE … DROP COLUMN`                                        |
| a change of type, nullability, default, primary key, foreign key or named check, or a new `NOT NULL` column without a default | a rebuild                                                          |
| nothing                                                                                                                       | no file                                                            |

When the chain already matches, nothing is written:

```text
database/migrations already matches app/models/post.ts; nothing to write
```

Types compare by how SQLite stores them, so a column declared `VARCHAR(255)` matches `c.text()`.
The statements are applied to the replayed database and compared again before the file is
written, so a migration that would error, or leave a difference, fails here.

### Rebuilds

SQLite changes most column properties only by rebuilding the table: create the new table beside
the old one, copy every shared column, drop the old table, rename the new one, then recreate its
indexes and triggers. The command says why, on screen and in the file:

```sql
-- Warning: posts is rebuilt (create, copy, drop, rename) because posts.body becomes nullable

CREATE TABLE "__sdxc_new_posts" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  ...
);

INSERT INTO "__sdxc_new_posts" ("id", "title", "body", ...) SELECT "id", "title", "body", ... FROM "posts";

DROP TABLE "posts";

ALTER TABLE "__sdxc_new_posts" RENAME TO "posts";
```

A column that becomes `NOT NULL` with a default is copied through `COALESCE`, so a row holding
`NULL` takes the default. When other tables reference the rebuilt one, the rebuild runs between
`PRAGMA defer_foreign_keys = on` and `off`.

<warning>
A table another table references with `ON DELETE CASCADE`, `SET NULL`, `SET DEFAULT` or
`RESTRICT` is refused, naming the references: on D1 the rebuild's `DROP TABLE` would delete or
change those rows. Write that migration by hand.
</warning>

### Warnings

Every warning prints on screen and stays in the file as a SQL comment, for whoever reviews it.

<warning>
Read each warning before you apply the migration. A dropped column's data is gone once
production applies it, and the way back is a new migration that adds the column again, empty.
</warning>

- **Dropped columns.** A column the model no longer has is dropped with its data.
- **Renames.** A model carries no history, so a renamed column reads as one column dropped and
  another added. The command names both; copy the data in the migration before the drop.
- **Unique indexes the model lacks** are kept, since data may rely on them; drop one by hand
  when that is intended. Indexes a model cannot declare, such as multi-column ones, stay too.
- **What a rebuild cannot carry**: a foreign key spanning several columns, or an unnamed
  `CHECK`, which you add back by hand.

```text
Warning: posts.subtitle is not in the model: the migration drops it and deletes its data
Warning: posts drops subtitle and adds slug: if that is a rename, sdxc cannot tell, so the data in subtitle is deleted; copy it in the migration before the drop
```

A model that is missing, fails to load or exports no table stops the command, and so does a
chain file that errors on replay, naming it.

## Apply it

```bash
sdxc run db migrate
```

[`sdxc deploy`](/docs/sdxc/deploy) applies the same migrations to production before the new
Worker goes live. Each later change to a model's columns takes the same three steps: edit the
model, run `sdxc make migration <name> --from-model <model>`, then migrate. [Databases](/docs/data-and-background-work/databases) covers D1 and
Durable Object SQLite, the two places a chain is applied.

## Where to go next

- [Make a model](/docs/sdxc/make-model) — the tables `--from-model` reads.
- [Make a factory](/docs/sdxc/make-factory) — rows for tests, once the table exists.
- [Generate files](/docs/sdxc/generate-files) — the flags, configuration and stubs every kind
  shares.
