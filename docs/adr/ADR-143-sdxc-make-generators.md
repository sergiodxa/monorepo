# ADR-143: `sdxc make` Generators

## Status

**Proposed** - 2026-10-14

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

| Kind          | File                                         |
| ------------- | -------------------------------------------- |
| `controller`  | `app/http/controllers/<name>.tsx`            |
| `middleware`  | `app/http/middleware/<name>.ts`              |
| `validator`   | `app/http/validators/<name>.ts`              |
| `job`         | `app/jobs/<name>.ts`                         |
| `model`       | `app/models/<name>.ts`                       |
| `migration`   | `<chain folder>/<NNNN>_<PascalCaseName>.sql` |
| `factory`     | `database/factories/<name>.ts`               |
| `service`     | `app/services/<name>.ts`                     |
| `policy`      | `app/policies/<name>.ts`                     |
| `initializer` | `app/initializers/<name>.ts`                 |
| `email`       | `app/emails/<name>.tsx`                      |
| `mcp`         | `app/mcp/tools/<name>.ts`                    |

Every kind is one word. A slash in the name argument means a folder inside the kind's folder
(`make job trials/expire` writes `app/jobs/trials/expire.ts`), which keeps the feature grouping
ADR-129 recommends, so a kind never contains one.

- **MCP.** `make mcp <name>` writes a tool, the handler most MCP servers have; `--resource`
  writes a resource to `app/mcp/resources/<name>.ts` instead.
- **Migrations by chain.** `make migration <name> [--chain <chain>]` writes into the folder
  `make.migrations` names for the chain, taking the next number after the highest in that folder.
  An unknown chain is an error listing the configured ones.
- **Tests beside the file.** With `make.tests` on, every kind except `migration` and `factory`
  also writes `<name>.test.ts` (`.test.tsx` beside a `.tsx` file) from that kind's test stub.
  `--test` and `--no-test` override the setting for one run.
- The generator refuses to overwrite an existing file, the test included.

### Stubs

The built-in stubs follow the repo's own rules: module JSDoc header, `@sdxc/result` for failures,
the invocation's log, `lazy()`-mapped routes.

- **One naming rule.** A kind's stub is `<kind>.stub`; a flag that changes what the generated
  file looks like selects a variant, `<kind>.<variant>.stub` (`mcp.resource.stub` for
  `--resource`, `job.cron.stub` for `--cron`, `controller.form.stub` for `--method form`); a test
  stub is `<kind>.test.stub` or `<kind>.<variant>.test.stub`.
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
| `controller`     | `sponsors: get("/sponsors")` in `routes/web.ts`                              | `router.map(routes.sponsors, lazy(() => import("~/app/http/controllers/sponsors")))`        |
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
  the chosen contract; the job dispatcher and the MCP handler are the initializers that import
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

- Registering the other kinds `make` writes, such as a model in an app's model registry or
  middleware in a router's chain.

## References

- [ADR-129: One Folder Layout for Every App](./ADR-129-app-folder-layout.md)
- [ADR-136: `sdxc` Umbrella Package and CLI](./ADR-136-sdxc-umbrella-package-and-cli.md)
- [ADR-137: `@sdxc/codemod` Package](./ADR-137-codemod-package.md)
- [ADR-142: `sdxc create` Templates](./ADR-142-sdxc-create-templates.md)

## Current Progress

- [x] Stubs, project stubs, migration chains
- [x] Declaration and mapping for `job`, `controller` and `mcp`
