---
title: Make a model
description: Write a model with a column per field typed by its name, the migration that creates its table and a factory for its tests, with sdxc make model, registered as ctx.models.
section:
    title: The sdxc command
    order: 2
order: 2.05
lastUpdated: 2026-10-25
outcomes:
    - "How field names type a model's columns"
    - "What `make model` writes beside the model: its migration and its factory"
    - "How the model is registered and read as `ctx.models`"
---

A model owns one table: its columns, and the rules that keep a row consistent.
`sdxc make model` writes it in `app/models/` with a column per field, the migration that creates
its table and a factory for its tests, and registers it in `app/models/index.ts`, so every
request, job and command reads it as `ctx.models.<name>`:

```bash
sdxc make model post title body published_at author_id
```

```text
Wrote app/models/post.ts
Wrote app/models/post.test.ts
Wrote database/migrations/0001_CreatePosts.sql
Wrote database/factories/post.ts
Edited app/models/index.ts
Added @sdxc/uuid@2026.10.13 to package.json; run bun install
database/factories/post.ts leaves author_id out, since only a test knows which row it points at; pass it when creating one
```

Apply the migration and the table is ready:

```bash
sdxc run db migrate
```

Reach for it for every table the app stores. A whole resource, with its pages, validator and
policy around the model, is one [`sdxc scaffold`](/docs/sdxc/scaffold-a-resource).

## Flags

| Argument or flag       | Default      | What it does                                                      |
| ---------------------- | ------------ | ----------------------------------------------------------------- |
| `[field[:type][?]...]` |              | a column per field, after the name                                |
| `--chain <chain>`      | `default`    | the chain in `make.migrations` the migration goes in              |
| `--skip <file,...>`    |              | leave out `migration`, `factory`, or both; repeat it or list them |
| `--test`, `--no-test`  | `make.tests` | write the model's test, or skip it                                |
| `--dry-run`            |              | print the files and the diffs, and change nothing                 |
| `--force`              |              | write an existing model, its test and its factory again           |

```bash
sdxc make model post title --skip migration,factory
```

A model, migration or factory that already exists stops the run with the project as it was.
`--force` writes an existing model, its test and its factory again from the fields you give and
writes no second migration, since the database already has the table; it prints the
`sdxc make migration` to run for the columns you added.

## Fields

A field is `name`, `name:type` or `name?`, with an optional `:index` or `:unique`. A bare name
takes its type from its name, an explicit type always wins, and a trailing `?` on any part
makes the column nullable:

```bash
sdxc make model post title 'subtitle?' views:integer
```

Quote a field with `?` in zsh, which reads a bare `?` as a pattern.

| A bare name                                                                                                                         | Type         | Column                                  |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------------------------------------- |
| ends in `_id`: `author_id`                                                                                                          | `references` | `c.text().references(…)`                |
| ends in `_at`: `published_at`                                                                                                       | `timestamp`  | `c.integer()`, milliseconds since epoch |
| ends in `_on` or `_date`, or `birthday`, `birthdate`                                                                                | `date`       | `c.text()`, `YYYY-MM-DD`                |
| starts with `is_`, `has_`, `can_`, `should_`, `was_`, `allow_`, or names a state such as `published`, `archived`, `active`, `draft` | `boolean`    | `c.boolean()`                           |
| ends in `_count` or `_cents`, or names a count such as `age`, `position`, `rank`, `score`, `year`                                   | `integer`    | `c.integer()`                           |
| ends in `email`                                                                                                                     | `email`      | `c.text()`                              |
| ends in `url`, or is `homepage`, `website`                                                                                          | `url`        | `c.text()`                              |
| ends in long text such as `body`, `description`, `content`, `summary`, `notes`, `bio`                                               | `text`       | `c.text()`                              |
| anything else                                                                                                                       | `string`     | `c.text()`                              |

The rules apply in that order, so `published_at` is a timestamp and `published` a box. A
reference such as `author_id` points at the table `app/models/author.ts` declares, or at the
plural, `authors`, when the project has no such model.

`:unique` or `:index` after the name or the type indexes the column: a unique column is declared
on the model, `slug: c.text().unique()`, and a plain index lives in the migration alone.

```bash
sdxc make model post title slug:unique rank:index 'code?:index'
```

`id`, `created_at` and `updated_at` are refused, since every table already has them, and so is a
column holding a password as typed; name it `password_hash` instead.

## The model

```typescript {% title="app/models/post.ts" %}
import type { TableRow } from "remix/data-table";

import { column as c, table } from "remix/data-table";
import { createModel } from "@sdxc/data-model";
import { generateUUID } from "@sdxc/uuid/v7";

/** The `posts` table, as its migration creates it. */
export const postTable = table({
	name: "posts",
	columns: {
		id: c.text().primaryKey(),
		title: c.text(),
		body: c.text(),
		published_at: c.integer(),
		author_id: c.text().references("authors", "posts_author_id_fkey"),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
	/** `create` and `update` stamp `created_at` and `updated_at` with the database's clock. */
	timestamps: true,
});

/** One Post row as it reads back from the database. */
export type PostRow = TableRow<typeof postTable>;

export const Post = createModel(postTable, { generateId: generateUUID });

export default Post;
```

The model is named in the singular and its table in the plural snake_case: `post` declares
`posts`, `blog-post` declares `blog_posts`, `category` declares `categories`. Each row gets a
UUIDv7 id and the two timestamps.

## The migration

The migration is `create-<table>`, written from the same fields as
[`sdxc make migration create-posts …`](/docs/sdxc/make-migration#create-alter-or-drop-from-fields)
writes it, next in the chain.

## The factory

The factory gives each field a sample value, so a test sets only the fields it is about:

```typescript {% title="database/factories/post.ts" %}
import { defineFactory } from "@sdxc/data-model/testing";

import { Post } from "~/app/models/post";

/** A complete Post row; a test overrides only the fields it is about. */
export const PostFactory = defineFactory(Post, {
	title: ({ sequence }) => `Title ${sequence}`,
	body: ({ sequence }) => `Body ${sequence}`,
	published_at: Date.UTC(2026, 0, 1),
});
```

A required reference is left out, with the note shown above, since only the test knows which row
it points at: pass it when creating one.

## What it edits

The model is registered under its key, imported the first time a handler reads it:

```text
--- a/app/models/index.ts
+++ b/app/models/index.ts
-export default createModels({});
+export default createModels({
+	post: () => import("./post"),
+});
```

The key is the file's last segment in camelCase: `blog-post` is `ctx.models.blogPost`.

## The test

```typescript {% title="app/models/post.test.ts" %}
import { describe, expect, test } from "vitest";

import { Post } from "~/app/models/post";

describe("Post", () => {
	test("is defined over its table", () => {
		expect(Post).toBeDefined();
	});

	test.todo("keeps a Post row consistent");
});
```

```bash
bun run test app/models/post.test.ts
```

Turn the `test.todo` into a test of each rule the model adds, against an in-memory database and
rows from the factory.

## Fill it in

1. Apply the migration with `sdxc run db migrate`.
2. Add the rules about one row as methods on the model: scopes, callbacks, finders such as
   `findBySlug`.
3. Read and write it from a handler through `ctx.models.post`:

```typescript
let post = await ctx.models.post.create({
	title,
	body,
	published_at: Date.now(),
	author_id,
});
```

A column you add to the model later reaches the table through
[`sdxc make migration <name> --from-model post`](/docs/sdxc/make-migration#write-the-sql-from-a-model).
[Data models](/docs/data-and-background-work/data-models) covers scopes, callbacks and
transactions.

## Where to go next

- [Make a migration](/docs/sdxc/make-migration) — the SQL that creates and changes the table.
- [Make a factory](/docs/sdxc/make-factory) — rows for the model's tests.
- [Generate files](/docs/sdxc/generate-files) — the flags, configuration and stubs every kind
  shares.
