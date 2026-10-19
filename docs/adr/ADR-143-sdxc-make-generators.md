# ADR-143: `sdxc make` Generators

## Status

**Accepted** - 2026-10-15

## Background

ADR-129 gives every kind of code in an app one folder. Adding a job, a controller or an MCP tool
also means declaring it and mapping it in an initializer, and a handler that is written but never
mapped ships silently. This ADR records `sdxc make`, which writes a file of a given kind from a
stub, at the location ADR-129 gives it, and for the kinds that need it, declares and maps it.

## Context

ADR-129 places controllers, middleware and validators under `app/http/`, jobs under `app/jobs/`
with the job map in `app/jobs/index.ts`, models under `app/models/`, migrations as
`database/migrations/NNNN_PascalCaseName.sql`, and MCP handlers under `app/mcp/tools/` and
`app/mcp/resources/`. `test/app-layout.test.ts` holds the converted apps to it. One app keeps a
second migration chain for its tenant Durable Object's own schema.

## Decision

### Configuration keys

| Key               | Default                                | Meaning                                                                                     |
| ----------------- | -------------------------------------- | ------------------------------------------------------------------------------------------- |
| `make.routes`     | `web`                                  | Route contract `make controller` adds to, a module in `routes/`                             |
| `make.migrations` | `{ "default": "database/migrations" }` | Migration chains by name; `make migration --chain <name>` picks one, `default` when omitted |
| `make.tests`      | `true`                                 | Whether `make` writes a test beside every generated file except migrations and factories    |
| `make.stubs`      | `.config/sdxc/stubs`                   | Folder whose stubs replace the built-in ones, kind by kind                                  |

**`make.tests` defaults to on** because the templates carry Vitest and a generated handler with a
test beside it is the layout ADR-129 expects.

### `sdxc make <kind> <name>`

| Kind          | File                                           |
| ------------- | ---------------------------------------------- |
| `controller`  | `app/http/controllers/<name>.tsx`              |
| `middleware`  | `app/http/middleware/<name>.ts`                |
| `validator`   | `app/http/validators/<name>.ts`                |
| `job`         | `app/jobs/<name>.ts`                           |
| `model`       | `app/models/<name>.ts`                         |
| `migration`   | `<chain folder>/<number><separator><name>.sql` |
| `factory`     | `database/factories/<name>.ts`                 |
| `service`     | `app/services/<name>.ts`                       |
| `policy`      | `app/policies/<name>.test.ts` (see below)      |
| `initializer` | `app/initializers/<name>.ts`                   |
| `email`       | `app/emails/<name>.tsx`                        |
| `mcp`         | `app/mcp/tools/<name>.ts`                      |

Every kind is one word. A slash in the name argument means a folder inside the kind's folder
(`make job trials/expire` writes `app/jobs/trials/expire.ts`), which keeps the feature grouping
ADR-129 recommends, so a kind never contains one.

- **Policies.** `make policy <resource>` declares the resource's `create`, `read`, `update` and
  `delete` abilities in `app/policies/abilities.ts` and grants them in `app/policies/policy.ts`,
  reads to `everyone` and writes to `member`, writing only the test that decides them
  ([ADR-164](./ADR-164-generated-authorization-uses-authz.md)).
- **MCP.** `make mcp <name>` writes a tool, the handler most MCP servers have; `--resource`
  writes a resource to `app/mcp/resources/<name>.ts` instead.
- **Migrations by chain.** `make migration <name> [--chain <chain>]` writes into the folder
  `make.migrations` names for the chain, spelled like the files already there: a zero-padded
  sequence keeps its width, a 14-digit UTC timestamp (`YYYYMMDDHHmmss`) takes the current time,
  and the separator and case (kebab, snake, Pascal or camel) follow the newest file, so the new
  file sorts last under both wrangler's numeric order and a plain lexical one. An empty chain
  starts at `0001_PascalCaseName.sql`. An unknown chain is an error listing the configured ones.
- **Tests beside the file.** With `make.tests` on, every kind except `migration` and `factory`
  also writes `<name>.test.ts` (`.test.tsx` beside a `.tsx` file) from that kind's test stub.
  `--test` and `--no-test` override the setting for one run.
- The generator refuses to overwrite an existing file, the test included.
- **Model fields.** `make model <name> [field ...]` takes the field list `sdxc scaffold` takes,
  with the same conventions (ADR-163), and writes each field's column into the model stub's
  `{{columns}}` placeholder, between `id` and the timestamps; with no field the placeholder
  renders a reminder to add the columns. The table is the plural of the name (`{{table}}`:
  `make model post` declares `posts`), as `sdxc scaffold` names it and as a reference to a model
  the project lacks assumes. A reference becomes a foreign key named `<table>_<column>_fkey`,
  pointing at the table the referenced model in `app/models/` declares. A project stub that
  lacks `{{columns}}` refuses a field list, so no field is dropped silently.
- **A model comes with its migration and factory.** `make model` also writes
  `create-<table>` into the default chain (or `--chain`), its `CREATE TABLE` rendered from the
  same fields as the model's columns, and `database/factories/<name>.ts` with a value per field
  in the factory stub's `{{attributes}}` (the sample values `sdxc scaffold`'s factory uses; a
  nullable reference is `null`, and a required reference is left out with a note, since only a
  test knows which row it points at). Without fields the migration holds `id` and the
  timestamps and the factory is empty. `--skip migration`, `--skip factory` or
  `--skip migration,factory` leaves either out. All files are planned before any is written,
  so a taken path, or a table the chain already creates, stops the run with nothing written.
- **Migration fields.** `make migration <name> [field ...]` reads the name the way Rails does,
  in any spelling `parseName` accepts (`create_posts`, `AddSlugToPosts`):
  - `create-<table>` writes the `CREATE TABLE` a model with those fields declares: a text `id`
    key, the fields, `created_at` and `updated_at`, foreign keys and unique indexes, through the
    renderer `--from-model` and `sdxc scaffold` use.
  - `add-<words>-to-<table>` writes one `ALTER TABLE … ADD COLUMN` per field. SQLite fills the
    rows a table already holds with the column's default and refuses `NOT NULL` without one, so
    a boolean is added `NOT NULL DEFAULT 0` and any other field must be marked `?`; a required
    column is added by declaring it in the model and running `--from-model`, which rebuilds the
    table. A reference is nullable for the same reason, and because D1 enforces foreign keys.
  - `remove-<words>-from-<table>` writes one `ALTER TABLE … DROP COLUMN` per field, whose type
    and `?` are ignored.

  The table is the words after `create`, or after the last `to` or `from`. Fields with any other
  name, or with `--from-model`, are a usage error; without fields the stub is written as before.
  The statements are applied to the replayed chain before the file is written, so a table that
  already exists, a missing table or column, or a column SQLite cannot drop fails with SQLite's
  own message; a chain that does not replay is left unchecked.

### Stubs

The built-in stubs follow the repo's own rules: module JSDoc header, `@sdxc/result` for failures,
the invocation's log, `lazy()`-mapped routes.

- **One naming rule.** A kind's stub is `<kind>.stub`; a flag that changes what the generated
  file looks like selects a variant, `<kind>.<variant>.stub` (`mcp.resource.stub` for
  `--resource`, `job.cron.stub` for `--cron`, `controller.form.stub` for `--method form`); a test
  stub is `<kind>.test.stub` or `<kind>.<variant>.test.stub`. A controller with no variant takes
  its contract's stub when one exists (`controller.api.stub` for `--routes api`, a JSON endpoint),
  and `controller.stub`, a page, otherwise.
- **Project stubs win.** For each stub name, `make` uses the file in `make.stubs` when it exists
  and the built-in one otherwise, so a project overrides only the stubs it cares about.
- **`sdxc make stubs [kind...]`** copies the built-in stubs for the given kinds, or all of them,
  into `make.stubs` to start from; it never overwrites a stub already there.
- **Placeholders.** A stub is the file's text with `{{name}}` placeholders: the file's base name,
  its camelCase key, its PascalCase name, its import specifier and, for a tool, its snake_case
  tool name. The set is documented per kind; a placeholder outside it is an error naming the stub,
  so a typo never reaches a generated file.
- **Declarations are not stubs.** The entry `make` adds to `app/jobs/index.ts`, a route contract
  or an MCP declaration module is fixed per kind and driven by the command's options, since its
  shape is what the mapping depends on.

### Declaring and mapping what the handler serves

A job, a controller, an MCP tool and an MCP resource each need a declaration and a mapping in the
initializer before the app reaches them. `make` writes both through `@sdxc/codemod` (ADR-137), so
the new handler answers as soon as the command finishes:

| Kind             | Declaration                                                                  | Mapping                                                                                     |
| ---------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `job`            | `expire: job({ input: s.object({}) })` under `trials` in `app/jobs/index.ts` | `dispatcher.map(jobs.trials.expire, () => import("~/app/jobs/trials/expire"))`              |
| `controller`     | `sponsors: get("/sponsors")` in `routes/web.ts`                              | `router.map(webRoutes.sponsors, lazy(() => import("~/app/http/controllers/sponsors")))`     |
| `mcp`            | `getPost: tool("get_post", { … })` in `app/mcp/tools/index.ts`               | `mcp.tools.map(toolset.getPost, lazy(() => import("~/app/mcp/tools/get-post")))`            |
| `mcp --resource` | `article: resource("…", { … })` in `app/mcp/resources/index.ts`              | `mcp.resources.map(resourceset.article, lazy(() => import("~/app/mcp/resources/article")))` |

- **Naming.** A file name's kebab-case segments become the camelCase declaration key
  (`get-post` → `getPost`) and, for a tool, the snake_case tool name (`get_post`). A job's
  leading segments name its group; an existing group whose mapped handlers already live in that
  folder is reused (the `activitypub/` folder maps to the existing `activityPub` group), and a
  missing group is created.
- **Declaration options.** `make job` takes `--cron "<expression>"` to declare a scheduled job
  instead of one with input. `make controller` takes `--method` (`get`, `post`, `put`, `patch`,
  `delete` or `form`, default `get`), `--path` (default `/<name>`) and `--routes <contract>`
  (default `make.routes`). Leading name segments of a controller nest the route under the
  `route({ … })` group with that key, created without a path prefix when missing.
- **Which initializer.** The router initializer is the one in `app/initializers/` that imports
  the chosen contract and calls `createRouter`, since other initializers may import a contract
  too (the OpenAPI document reads `routes/api.ts`); the job dispatcher and the MCP handler are the initializers that import
  `~/app/jobs` and `~/app/mcp/tools` (or `resources`). The new mapping follows the last mapping
  of the same declarations in that file, inside a router factory when the existing calls are
  there, or directly after the instance is created when none exist yet.
- **Import specifiers** follow the form the existing mappings use (`~/app/…` in the templates),
  and a relative path when there are none.
- **Declaration and mapping land together or not at all.** Both edits are computed before
  anything is written. When either cannot be placed — no initializer imports the contract, or the
  declarations are not an object literal passed to `jobs()`, `route()`, `tools()` or
  `resources()` — the command writes the new handler file, leaves the declarations and
  initializers untouched, and prints both edits for the user to make. An app never ends up with a
  declaration that has no mapping.
- Mappings are written without guards or middleware; a route that needs `lazy()`'s second
  argument gets it by hand.

## Consequences

### Positive

- **A generated handler is live immediately.** `make job`, `controller` and `mcp` declare and map
  what they create, so a forgotten mapping cannot ship.
- **The layout is applied, not memorized.** Every kind lands in its ADR-129 folder.

### Negative

- **`make` depends on the initializer shapes ADR-129 and the templates use.** An app whose
  declarations or mappings are written differently falls back to printed instructions.
- **The CLI edits files the user wrote:** route contracts, declaration modules and initializers;
  `--dry-run` shows the diff first.
- **Stubs are code outside any app.** They need a test that generates every kind into the
  materialized `app` template (ADR-142) and type checks the result.

## Implementation Plan

Depends on `@sdxc/codemod` (ADR-137) and the `app` template (ADR-142).

1. Stubs and test stubs for every kind in the table, project stub lookup, `sdxc make stubs`,
   migration chains and numbering, and nested names.
2. Declaration and mapping for `job`, `controller` and `mcp` (tool and resource), verified by a
   test that runs each against the materialized `app` template and type checks the result.

## Alternatives Considered

### 1. Configurable paths per kind

Let a project move controllers, jobs or models out of the ADR-129 folders.

**Rejected because**: the layout is what the templates, the stubs and the declaration and mapping
edits are built around; migrations get named chains because one app already has two schemas, and
that is the only location that varies between projects that follow the layout.

### 2. Folder-style kind names (`http/controller`, `mcp/tool`)

**Rejected because**: a slash already means a folder inside the kind's folder in the name
argument, so `make http/controller cms/posts` would use it for two things in one command, and the
kind typed most often would be the longest.

## Deferred

- Registering the other kinds `make` writes, such as a model in an app's model registry.
  Middleware in a router's chain or a controller chain is mounted with `--mount`, recorded in
  [ADR-157](./ADR-157-sdxc-make-middleware-mount.md).

## References

- [ADR-129: One Folder Layout for Every App](./ADR-129-app-folder-layout.md)
- [ADR-136: `sdxc` Umbrella Package and CLI](./ADR-136-sdxc-umbrella-package-and-cli.md)
- [ADR-137: `@sdxc/codemod` Package](./ADR-137-codemod-package.md)
- [ADR-142: `sdxc create` Templates](./ADR-142-sdxc-create-templates.md)

## Current Progress

- [x] Stubs, project stubs, migration chains
- [x] Declaration and mapping for `job`, `controller` and `mcp`
- [x] Model fields; `make model` writes its migration and factory
- [x] Rails-style `make migration` names with fields
