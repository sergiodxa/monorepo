---
title: Glossary
description: The words the sdxc guides and messages use in a sense of their own, from ability to stub, each with a link to where it is covered.
section:
    title: The sdxc command
    order: 2
order: 12
lastUpdated: 2026-10-25
outcomes:
    - "What the words ability, grant and policy mean in sdxc"
    - "What the template terms initializer, kind, stub and seed refer to"
    - "Where each term is covered in the guides"
---

The terms below have a meaning of their own in `sdxc` and the app template. Words Cloudflare or
Remix define, such as binding, Worker, controller and middleware, keep their meaning from
[Cloudflare's](https://developers.cloudflare.com/workers/) and [Remix's](https://remix.run)
documentation.

## Ability

A named thing a visitor may do with a resource, such as `bookmark.create`. The catalog of
abilities is `app/policies/abilities.ts`, and a [grant](#grant) in the [policy](#policy) says who
holds each one. [Make a policy](/docs/sdxc/make-policy)

## App command line

The command line every app from the [template](#template) ships in `bootstrap/cli.ts`, for work
that belongs to no request, such as `db migrate`. You run it with `sdxc run`.
[Run your app's commands](/docs/sdxc/run-app-commands)

## App layout

The folder each kind of code goes in: `app/http/controllers/` for controllers, `app/models/` for
models, and so on. `sdxc make` writes to it and `sdxc doctor` checks it.
[How it fits together](/docs/getting-started/how-it-fits-together#where-each-kind-of-code-goes)

## Chain

Two things share the word. A **middleware chain** is the list of middleware a router or a
controller runs, in order: the router's global chain, and the `page` and `api` chains a
controller declares. A **migration chain** is a folder of numbered migrations that one database
applies in order, named in `make.migrations`. [Make a migration](/docs/sdxc/make-migration#chains)

## Contract

A module that declares what exists without implementing it. A **route contract** in `routes/`
declares every URL and method; `app/jobs/index.ts`, `app/commands/index.ts`,
`app/mcp/tools/index.ts` and `app/emails/index.ts` are the contracts for jobs, commands, MCP
tools and emails. Handlers and templates are typed by the contract entry they implement.

## Copy

An `@sdxc/ui` component written into your project by `sdxc ui add`, to edit. A copy is
**untouched** while its files hash as the [lock file](#lock-file) recorded, and **edited** once
one differs. `sdxc ui update` replaces untouched copies.
[Copy UI components](/docs/sdxc/copy-ui-components)

## Declared and mapped

What a controller, job, model, MCP tool, command or email needs before the app reaches it: an
entry in its [contract](#contract), the declaration, and a line in its
[initializer](#initializer) that connects the entry to its handler, the mapping. `sdxc make` adds both.
[Generate files](/docs/sdxc/generate-files#declared-and-mapped)

## Factory

A function in `database/factories/` that creates a model's rows for tests through the model
itself, with values that repeat from run to run. [Make a factory](/docs/sdxc/make-factory)

## Field

A column given to `sdxc make model` or `sdxc scaffold` as `name`, `name:type` or `name?`, with
`:index` or `:unique` after it to index the column. A bare name is typed by its spelling: `*_at`
is a timestamp, `*_url` a URL, `body` text.
[Scaffold a resource](/docs/sdxc/scaffold-a-resource#fields)

## Grant

A rule in `app/policies/policy.ts` that gives [abilities](#ability) to everyone or to a role,
optionally under a condition. [Authorization](/docs/identity-and-security/authorization)

## Initializer

A module in `app/initializers/` that builds the one instance of something the app shares: the
router, the database, the job dispatcher, the mailer, the command line.
[Make an initializer](/docs/sdxc/make-initializer)

## Kind

What `sdxc make` writes: `controller`, `job`, `model` and the rest, each with its own folder,
[stub](#stub) and test. [Generate files](/docs/sdxc/generate-files#kinds)

## Lazy route

A route mapped through `lazy(() => import(…))`, so a request imports only the controller it
reaches. Every route the template and `sdxc make` map is one, and `sdxc doctor` checks it.

## Lock file

`.config/sdxc.lock.jsonl`, where the CLI records what it did that a later command needs, such
as each [copy](#copy) and the hashes of its files. You commit it.
[Configuration](/docs/sdxc/configuration#lock)

## Pin

An exact `@sdxc` version in `package.json`, such as `"2026.10.17"`, rather than a range. Every
package in a project is pinned to its newest version on or before one [release](#release).
[Install and pin](/docs/getting-started/install-and-pin)

## Policy

`app/policies/policy.ts`: every [grant](#grant) the app makes, bound to each request as
`ctx.access`, which a handler checks with `ctx.access.can(…)`.
[Authorization](/docs/identity-and-security/authorization)

## Project check

A check `sdxc doctor` runs: a built-in one such as `pins` or `migrations`, or one of yours in
`.config/sdxc/checks/`. [Check a project](/docs/sdxc/check-a-project)

## Project root

The nearest folder, from where you run a command, that holds a `package.json`. Every `sdxc`
command runs there, so it works from any folder inside the project.

## Release

One day's publish of the `@sdxc` packages that changed and the packages that depend on them, each
versioned by its date, such as `2026.10.17`. A project's
release is the newest date among its [pins](#pin). [Versioning](/docs/releases/versioning)

## Seed

`database/seed.ts`: the rows a new local database starts with, as named steps declared with
`defineSeed`, which `sdxc run db seed` runs in order.
[Run your app's commands](/docs/sdxc/run-app-commands#seed-and-reset-the-local-database)

## Stub

The template a [kind](#kind) is written from, such as `controller.stub`, with `{{placeholder}}`s
for its names. A stub in `.config/sdxc/stubs/` replaces the built-in one of the same name.
[Generate files](/docs/sdxc/generate-files#make-the-generated-files-your-own)

## Template

The project `sdxc create` writes: the built-in `app`, or any GitHub repository you name.
[Start a project](/docs/sdxc/start-a-project)

## Upgrade prompt

The text `sdxc upgrade` prints for an AI agent: what changed between two releases for the code
your project has, with each breaking change's migration steps. [Upgrade](/docs/sdxc/upgrade)

## Where to go next

- [Start a project](/docs/sdxc/start-a-project) — the template and the layout these terms
  describe.
- [Generate files](/docs/sdxc/generate-files) — kinds, stubs and declared-and-mapped edits in
  practice.
- [Errors and FAQ](/docs/sdxc/errors-and-faq) — the fix when a term shows up in a message.
