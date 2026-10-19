---
title: Scaffold a resource
description: Write the model, migration, pages, validator, abilities and tests a resource needs to be listed, read, created, changed and deleted, with one sdxc scaffold command.
section:
    title: The sdxc command
    order: 2
order: 3
lastUpdated: 2026-10-19
outcomes:
    - "Every file `sdxc scaffold` writes for one resource"
    - "How the scaffold's pages, tools and commands check who may do what"
    - "How to preview a scaffold and change what it writes"
---

`sdxc scaffold <name> [field ...]` writes everything a resource needs to be listed, read,
created, changed and deleted through pages, each piece where
[`sdxc make`](/docs/sdxc/generate-files) would put it, with its test, declared and mapped:

```bash
sdxc scaffold post title body:text views:integer
```

Apply the migration and the resource is live:

```bash
sdxc run db migrate
sdxc routes -c posts
```

Then open `/posts` in `bun dev`.

## What it writes

For `sdxc scaffold post`:

| File                                           | What it is                                                       |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| `app/models/post.ts`                           | the `Post` model, a column per field, as `ctx.models.post`       |
| `database/migrations/<number>_CreatePosts.sql` | the `CREATE TABLE` for `posts`, numbered like the chain          |
| `database/factories/post.ts`                   | a factory for tests                                              |
| `app/http/validators/post.ts`                  | the form's validator                                             |
| `app/policies/post.test.ts`                    | who may read, create, update and delete a post                   |
| `resources/views/posts/form.tsx`               | the form the new and edit pages share                            |
| `app/http/controllers/posts/*.tsx`             | `index`, `new`, `show`, `edit` and `destroy`                     |
| `app/test/database.ts`                         | the in-memory database the tests use, when the project lacks one |

Every table also gets `id`, `created_at` and `updated_at`, so a field may not use those names:

```text
-- Creates the posts table the Post model reads and writes.
CREATE TABLE "posts" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "views" INTEGER NOT NULL,
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL
);
```

It edits the files that make the pages answer: the model registry in `app/models/index.ts`, the
`post` abilities in `app/policies/abilities.ts` and their grants in `app/policies/policy.ts`, the
routes in `routes/web.ts`, their mapping in the router initializer, the sitemap's decisions, and
every `resources/locales/*.json`, which take each label and title under `posts`:

```text
	posts: {
		index: get("/posts"),
		new: form("/posts/new"),
		show: get("/posts/:id"),
		edit: form("/posts/:id/edit"),
		destroy: post("/posts/:id/destroy"),
	},
```

When the generated code imports an `@sdxc` package `package.json` lacks, such as `@sdxc/uuid`
for the ids or `@sdxc/validate` for the form, the scaffold adds it at your release and prints
the install command to run.

## Fields

Each field is `name` or `name:type`, with an optional `:index` or `:unique`, and a trailing `?`
on any part makes it nullable. Quote a
`?` field in zsh, which reads `?` as a pattern:

```bash
sdxc scaffold event name starts_at 'ends_at?' contact_email website
```

A bare name takes its type from its name, by the first of these rules that matches, and an
explicit type always wins, as in `email:string`:

| A bare name like                                                                                                                 | Type         | Stored as            | Edited with                              |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------------------- | ---------------------------------------- |
| `author_id`, ending in `_id`                                                                                                     | `references` | a foreign key        | refused by `scaffold`, see below         |
| `published_at`, ending in `_at`                                                                                                  | `timestamp`  | an integer, epoch ms | a date-and-time field, read as UTC       |
| `born_on`, `due_date`, `birthday`                                                                                                | `date`       | `YYYY-MM-DD` as text | a date field                             |
| `is_public`, `has_paid`, starting `can_`, `should_`, `was_`, `allow_`; `published`, `active`, `enabled`, `archived`, `featured`… | `boolean`    | `0` or `1`           | a checkbox                               |
| `view_count`, `price_cents`; `position`, `quantity`, `age`, `rank`, `priority`, `score`, `year`…                                 | `integer`    | an integer           | a number field                           |
| `email`, `contact_email`                                                                                                         | `email`      | text                 | an email field                           |
| `website_url`, `website`, `homepage`                                                                                             | `url`        | text                 | a URL field, checked with `URL.canParse` |
| `body`, `description`, `content`, `notes`, `bio`, `summary`, `excerpt`, `message`…                                               | `text`       | text                 | a text area                              |
| anything else                                                                                                                    | `string`     | text                 | a text field                             |

The rules read the name's words, so `published_at` is a timestamp and `published` a box, and a
camelCase name such as `publishedOn` becomes the column `published_on`. An `email` field gets no
unique index by itself; `email:unique` gives it one.

`:unique` or `:index` after the name or the type indexes the column: a unique one is declared on
the model and enforced by the migration's `CREATE UNIQUE INDEX`, and a plain one lives in the
migration alone.

```bash
sdxc scaffold person name email:unique 'nickname?:index'
```

A nullable field is nullable everywhere it appears: the column is `.nullable()`, the form field
is optional and a blank answer is stored as `null`, the MCP tool's input takes `null`, and the
command's flag is optional. A required field is required in all of them.

Some fields are refused, naming the spec, before anything is written:

- `id`, `created_at` and `updated_at`, which every table already has, and a name given twice.
- A nullable `boolean`: a box is ticked or not, so drop the `?`.
- A scaffold with no field, or whose fields are all nullable: a form must have one field to
  fill.
- Any name holding `password`, unless it ends in `hash` or `digest`: a scaffolded form would
  store what the visitor typed.
- `references`, and a bare `*_id`: the scaffold writes no pages for a reference yet. Write it
  as `author_id:string`, or add it afterwards with
  [`sdxc make model`](/docs/sdxc/make-model#fields), which writes a foreign key from the same
  field.

## Names and plurals

The name is singular, such as `post` or `blog-post`, and holds no folders. The table, URLs,
folders and locale key take the plural: `post` becomes `posts` and `category` becomes
`categories`. Pass `--plural` for any other plural:

```bash
sdxc scaffold person name email --plural people
```

## MCP tools and app commands

Two flags add more ways in:

- `--mcp` writes the MCP tools `list_posts`, `get_post`, `create_post`, `update_post` and
  `delete_post` in `app/mcp/tools/posts/`, each with its input schema, declared in
  `app/mcp/tools/index.ts` and mapped in the MCP initializer.
- `--command` writes the app commands `posts list`, `posts show <id>`, `posts create` with a flag
  per field, and `posts delete <id>` in `app/commands/posts/`, so
  `sdxc run posts create --title Hello …` works.

## Who may do what

The scaffold adds `post.create`, `post.read`, `post.update` and `post.delete` to the app's
catalog, as [`sdxc make policy`](/docs/sdxc/make-policy) does, and grants the read to everyone
and the writes to members:

```ts {% title="app/policies/policy.ts" %}
everyone: [allow("post.read", { id: "post-read" })],
roles: { member: [allow(["post.create", "post.update", "post.delete"], { id: "post-write" })] },
```

Every page and tool checks the visitor's access against them:

- A post `post.read` hides is a 404 on its pages and a "no such post" error from its tools, the
  same answer a missing post gets, and the index and `list_posts` leave it out.
- A create, update or delete the policy refuses is a 403 on a page and a forbidden call from a
  tool.

So a guest reads every post and a signed-in member writes them. A visitor is a member once the
session holds them, `ctx.session.set("actor", { id })`, which your sign-in does; until the app
signs people in, the new and edit pages answer 403. Narrow the grants with conditions, such as
letting members change only their own posts, in `app/policies/policy.ts`. App commands check
nothing, since whoever runs them already holds the database.

## Tests

The generated tests pass as written: they apply your migrations to the in-memory database and
drive the pages through the router, the tools through `/mcp` and the commands through the app's
command line. Each write is tested as a member, signed in with `signIn()` from
`app/test/session.ts`, and refused to a guest; `app/policies/post.test.ts` decides every ability
for both. `--no-test` skips them for one run, and `make.tests: false` skips them
everywhere.

## Taken names and dry runs

Everything is planned in a staged copy of the project before anything is written, so the
declarations build on one another and a refusal anywhere leaves the project as it was. A file
that already exists, or a locale that already has the plural's key, stops the command:

```text
app/models/post.ts already exists; sdxc scaffold leaves it as it is
```

`--dry-run` prints every file in full and every edit as a diff, and writes nothing. An edit that
cannot be placed, such as a router laid out differently, is printed for you to make, as
`sdxc make` does. Once it writes, the `format` command from your configuration runs over every
file it wrote or edited.

## Change what it writes

The scaffold's stubs are named `scaffold.*.stub`, one per file, such as
`scaffold.controller.index.stub` and `scaffold.model.stub`. Copy them into `make.stubs` and edit
the ones you want to change:

```bash
sdxc make stubs scaffold
```

## Where to go next

- [Generate files](/docs/sdxc/generate-files) — add one more file to a scaffolded resource,
  or a migration for a changed model with `--from-model`.
- [Run your app's commands](/docs/sdxc/run-app-commands) — `sdxc run db migrate` and the
  commands `--command` adds.
- [Model your tables](/docs/data-and-background-work/data-models) — the model the scaffold
  writes.
