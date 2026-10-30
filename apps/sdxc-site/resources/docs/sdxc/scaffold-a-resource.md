---
title: Scaffold a resource
description: Write the model, migration, pages, validator, abilities and tests a resource needs to be listed, read, created, changed and deleted, with one sdxc scaffold command.
section:
    title: The sdxc command
    order: 2
order: 3
lastUpdated: 2026-10-25
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
| `app/test/database.ts`                         | the in-memory database the tests use, when an older app lacks it |
| `spec/posts.spec`                              | the pairing spec, one case per way in the scaffold wrote         |

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

When the generated code imports an `@sdxc` package `package.json` lacks, the scaffold adds it at
your release and prints the install command to run.

## Fields

Fields are typed as [`sdxc make model`](/docs/sdxc/make-model#fields) types them: a bare name
by its name, `name:type` explicitly, `name?` nullable, with an optional `:index` or `:unique`.
Each type gets its form field: a checkbox for a boolean, a date field for a date, a text area for
`body` or `description`. Quote a `?` field in zsh, which reads `?` as a pattern:

```bash
sdxc scaffold event name starts_at 'ends_at?' contact_email website
```

A nullable field is nullable everywhere: the column, the form field, the MCP tool's input and
the command's flag. A scaffold needs at least one required field, since a form must have one
field to fill.

The scaffold writes no pages for a reference yet, so `references` and a bare `*_id` are refused:
write it as `author_id:string`, or add it afterwards with `sdxc make model`, which writes a
foreign key from the same field.

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

## A JSON resource

`--api` writes the resource as JSON endpoints in the `api` contract instead of pages, with the
OpenAPI operations that type them:

```bash
sdxc scaffold post title body published --api
```

It writes `index`, `show`, `create`, `update` and `destroy` in
`app/http/controllers/api/posts/`, served under `/api/posts`, and one OpenAPI operation per
endpoint in `routes/api.ts`, so `/api/openapi.json` describes every endpoint. A refused body
answers with the `validationError` problem, and a missing or hidden row with `notFound`. The
model, migration, factory and policy are written as they are for pages.

> [!NOTE]
> The template's API binds every caller as a guest, who may only read, so the create, update and
> delete endpoints answer `403` until the API authenticates its callers in
> `app/http/middleware/api.ts`. Their tests check that, and leave the signed-in case as a
> `test.todo` to fill in once it does.

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

So a guest reads every post and a signed-in member writes them; until the app signs people in,
the new and edit pages answer 403. Narrow the grants in `app/policies/policy.ts`. App commands
check nothing, since whoever runs them already holds the database.

## Tests

The generated tests pass as written: they apply your migrations to the in-memory database and
drive the pages through the router, the tools through `/mcp` and the commands through the app's
command line. Each write is tested as a member, signed in with `signIn()` from
`app/test/session.ts`, and refused to a guest. `--no-test` skips them for one run.

`spec/posts.spec` checks the running app from the outside, starting with the index page loading
in a browser; `--no-spec` leaves it out.

## Taken names and dry runs

Everything is planned before anything is written, so a refusal anywhere leaves the project as it
was. A file that already exists stops the command, since a scaffold writes new files only.

When the project already has some of the pieces, `--skip` leaves them out. Pages for a model
[`sdxc make model`](/docs/sdxc/make-model) wrote are the common case:

```bash
sdxc make model post title body
sdxc scaffold post title body --skip model,migration,factory
```

| Piece       | What `--skip` leaves out                                        |
| ----------- | --------------------------------------------------------------- |
| `model`     | the model, its test and its entry in `app/models/index.ts`      |
| `migration` | the migration that creates the table                            |
| `factory`   | the factory                                                     |
| `validator` | the validator and its test                                      |
| `policy`    | the abilities, their grants and the policy test                 |
| `pages`     | the five controllers, their tests, the form and the locale copy |

A skipped piece the rest of the scaffold reads must already exist, so the files it writes type
check; otherwise the command stops before writing anything.

`--dry-run` prints every file in full and every edit as a diff, and writes nothing.

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
