---
title: Generate files
description: Write a controller, job, model, migration or any other kind of file where the app layout puts it, declared, mapped and tested, with sdxc make.
section:
    title: The sdxc command
    order: 2
order: 2
lastUpdated: 2026-10-25
outcomes:
    - "Which file each `sdxc make` kind writes, and what it edits to wire the file in"
    - 'What to do when `make` prints "Declare and map it by hand"'
    - "How to replace the built-in stubs with your own"
---

`sdxc make <kind> <name>` writes one file of that kind where the app layout puts it, with a test
beside it, and makes every edit the file needs to run: a route declared and mapped, a job
registered with the dispatcher, a model added to the registry, a middleware added to a chain. A
new handler answers as soon as the command finishes.

```bash
sdxc make controller sponsors
sdxc make job reports/daily
sdxc make model post title body published_at author_id
```

This page covers what every kind shares. Each kind has its own guide with its flags, the file it
writes and how to fill it in.

## Kinds

| Kind                                         | File                                      | Test | Also edits                                                                                       |
| -------------------------------------------- | ----------------------------------------- | ---- | ------------------------------------------------------------------------------------------------ |
| [`controller`](/docs/sdxc/make-controller)   | `app/http/controllers/<name>.tsx`         | yes  | the route contract, the router, the sitemap                                                      |
| [`middleware`](/docs/sdxc/make-middleware)   | `app/http/middleware/<name>.ts`           | yes  | a chain, with `--mount`                                                                          |
| [`validator`](/docs/sdxc/make-validator)     | `app/http/validators/<name>.ts`           | yes  |                                                                                                  |
| [`job`](/docs/sdxc/make-job)                 | `app/jobs/<name>.ts`                      | yes  | `app/jobs/index.ts`, the dispatcher; with `--cron`, the Worker trigger in `cloudflare.config.ts` |
| [`model`](/docs/sdxc/make-model)             | `app/models/<name>.ts`                    | yes  | `app/models/index.ts`; writes its migration and factory                                          |
| [`migration`](/docs/sdxc/make-migration)     | `database/migrations/<number>_<Name>.sql` | no   |                                                                                                  |
| [`factory`](/docs/sdxc/make-factory)         | `database/factories/<name>.ts`            | no   |                                                                                                  |
| [`service`](/docs/sdxc/make-service)         | `app/services/<name>.ts`                  | yes  |                                                                                                  |
| [`policy`](/docs/sdxc/make-policy)           | `app/policies/<name>.test.ts`             | yes  | `app/policies/abilities.ts`, `app/policies/policy.ts`                                            |
| [`initializer`](/docs/sdxc/make-initializer) | `app/initializers/<name>.ts`              | yes  |                                                                                                  |
| [`email`](/docs/sdxc/make-email)             | `app/emails/<name>.tsx`                   | yes  | `app/emails/index.ts`, the mail registry                                                         |
| [`mcp`](/docs/sdxc/make-mcp)                 | `app/mcp/tools/<name>.ts`                 | yes  | `app/mcp/tools/index.ts`, the MCP handler                                                        |
| [`command`](/docs/sdxc/make-command)         | `app/commands/<name>.ts`                  | yes  | `app/commands/index.ts`, the command line                                                        |

Three more kinds write to the Worker's configuration rather than a layer folder, so they take no
test:

| Kind                                                 | Writes                                                                                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`secret <NAME>`](/docs/sdxc/make-secret)            | `NAME: bindings.secret()` in `cloudflare.config.ts`, and `NAME=` in `.env.example`                                                                |
| [`binding <helper> <NAME>`](/docs/sdxc/make-binding) | a `bindings.kv()`, `d1()`, `r2()`, `queue()`, `rateLimit()`, `sendEmail()`, `durableObject()` or `secret()` entry in `cloudflare.config.ts`       |
| [`do <name>`](/docs/sdxc/make-do)                    | a Durable Object class in `app/services/`, or `app/models/` with `--role model`, re-exported from `bootstrap/worker.ts` with its binding declared |

`sdxc make` alone asks for the kind and the name on a terminal, and `sdxc make <kind> --help`
prints the flags of one kind.

## Names

A slash in the name is a folder inside the kind's folder, so a feature stays together across
layers: `sdxc make job trials/expire` writes `app/jobs/trials/expire.ts`, and
`sdxc make service trials/extend` writes `app/services/trials/extend.ts`.

Every segment is written in kebab-case on disk, so `Trials/ExpireOld` and `trials/expire-old`
write the same file. Declarations use the last segment's other spellings, such as the key
`expireOld`.

## Flags every kind takes

- `--dry-run` prints each file it would write in full and each edit as a diff, and changes
  nothing.
- `--no-test` skips the test for one run, and `--test` writes it when `make.tests` is `false`.
  Migrations and factories never get one.
- `--no-spec` skips the pairing `.spec` a controller, an MCP tool or a command gets under
  `spec/`, and `--spec` writes it when `make.specs` is `false`. A spec checks the running app
  from the outside; [Write executable specs](/docs/operations-and-testing/executable-specs)
  covers running one.
- `--force` writes the file, its test and its spec from the stub again when they exist. Every
  kind but `migration` takes it.

> [!NOTE]
> A run plans every file and every edit before it writes any, and leaves every existing file as
> it is: a name that is taken, test included, stops the command and leaves the project as it was.

Pass `--force` when you want the stub's version back, such as after editing a stub of your own.
The file, its test and its spec are replaced, and the declaration and mapping they already have
are kept, so nothing is declared twice:

```bash
sdxc make controller home --force
```

```text
Replaced app/http/controllers/home.tsx
Replaced app/http/controllers/home.test.tsx
Replaced spec/home.spec
Kept the declaration, mapping and mount home already has; --force replaces files only
```

On an existing model, `--force` rewrites the model, its test and its factory, and writes no
second migration; add columns with [`sdxc make migration`](/docs/sdxc/make-migration).

When the run finishes it prints `Wrote` and `Edited` for each path, then runs the `format`
command from your configuration once over all of them. Anything that still needs you, such as an
edit to make by hand, prints last.

## Add a test later

A file made with `--no-test`, or written by hand in a kind's folder, gets the test `make` would
have written with `sdxc make test`:

```bash
sdxc make test app/services/billing/charge.ts
```

```text
Wrote app/services/billing/charge.test.ts
```

The kind comes from the folder the file sits in, so the test is rendered from that kind's test
stub, yours included. An existing test stops the command unless `--force` replaces it.

## Declared and mapped

A controller, a job, a model, an MCP tool or resource, a command and an email each need an
entry in a declaration module and a mapping before the app reaches them, and `make` adds both:

| Kind         | Declaration                                                            | Mapping                                |
| ------------ | ---------------------------------------------------------------------- | -------------------------------------- |
| `controller` | `sponsors: get("/sponsors")` in `routes/web.ts`                        | `router.map(…, lazy(() => import(…)))` |
| `job`        | `daily: job({ input: s.object({}) })` in `app/jobs/index.ts`           | `dispatcher.map(…, () => import(…))`   |
| `model`      | `post: () => import("./post")` in `app/models/index.ts`                | read as `ctx.models.post`              |
| `mcp`        | `searchPosts: tool("search_posts", { … })` in `app/mcp/tools/index.ts` | `mcp.tools.map(…, lazy(…))`            |
| `command`    | `grant: command({ … })` in `app/commands/index.ts`                     | `cli.map(…, lazy(() => import(…)))`    |
| `email`      | `invite: email({ props: s.object({ … }) })` in `app/emails/index.ts`   | `mail.map(…, lazy(() => import(…)))`   |

`make` finds the initializer that serves each one by reading `app/initializers/`: the one that
imports the declaration module and calls `createRouter`, `createJobDispatcher`, `createHandler`,
`createCLI` or `createMail`. [`sdxc destroy`](/docs/sdxc/undo-generated-files) removes the
declarations and mappings again.

## When an edit cannot be placed

A project laid out differently from the template, such as one whose dispatcher lives outside
`app/initializers/`, may have no place `make` can edit. The command then writes the file and
its test, leaves every other file as it is, and prints the edits for you to make, so a
declaration never lands without its mapping:

```text
Declare and map it by hand, since no initializer in app/initializers/ creates the job dispatcher:
In app/jobs/index.ts, in jobs({ … }):
  digest: job({ input: s.object({}) }),
In the job dispatcher's initializer:
  dispatcher.map(jobs.digest, () => import("~/app/jobs/digest"));
```

## Packages the code imports

When the generated code imports an `@sdxc` package your `package.json` does not list yet, `make`
adds it at the same release as the packages you have and prints the install command to run.

## Configuration

`make` reads its settings from `.config/sdxc.jsonc`, and `sdxc init` writes the file with every
default spelled out:

```jsonc {% title=".config/sdxc.jsonc" %}
{
	"make": {
		// Route contract `sdxc make controller` adds to, a module in routes/
		"routes": "web",
		// Migration chains by name; `--chain <name>` picks one
		"migrations": { "default": "database/migrations" },
		// Write a test beside every generated file except migrations and factories
		"tests": true,
		// Write a pairing .spec under spec/ for controllers, commands, MCP tools and scaffolds
		"specs": true,
		// Stubs here replace the built-in ones; `sdxc make stubs` copies them out
		"stubs": ".config/sdxc/stubs",
	},
	// Command run on every file the CLI writes or edits, paths appended
	"format": ["bunx", "vp", "fmt", "--no-error-on-unmatched-pattern"],
}
```

[Configuration](/docs/sdxc/configuration) covers every key.

## Make the generated files your own

Each file is written from a stub, and a stub in `make.stubs` replaces the built-in one of the
same name. Copy the built-in stubs to start from:

```bash
sdxc make stubs job
```

```text
Wrote .config/sdxc/stubs/job.cron.stub
Wrote .config/sdxc/stubs/job.stub
Wrote .config/sdxc/stubs/job.test.stub
```

That writes every stub whose name starts with the kind, and with no kind it copies all of them.
A stub already in the folder is kept, so your edits survive a second run.

> [!NOTE]
> Delete the stubs you leave unchanged: every kind without a stub of yours keeps the built-in one,
> and takes its improvements when you upgrade.

A kind's stub is `<kind>.stub`, a flag that changes the file selects `<kind>.<variant>.stub`
(`job.cron.stub` for `make job --cron`), and the test is `<kind>.test.stub`. A stub is the file's
text with `{{placeholder}}`s. Every kind can use these:

| Placeholder     | For `trials/expire-old`                                                              |
| --------------- | ------------------------------------------------------------------------------------ |
| `{{name}}`      | `expire-old`                                                                         |
| `{{key}}`       | `expireOld`                                                                          |
| `{{Name}}`      | `ExpireOld`                                                                          |
| `{{snake}}`     | `expire_old`                                                                         |
| `{{title}}`     | `Expire old`                                                                         |
| `{{specifier}}` | `~/app/jobs/trials/expire-old`, the file's import path                               |
| `{{header}}`    | the `@author` and `@copyright` tags, from `package.json`'s `author` or your git user |

Some kinds add their own, such as a controller's `{{path}}`; a placeholder the kind does not
define stops the command and lists the ones it accepts, so a typo never reaches a generated file.

## Where to go next

- [Scaffold a resource](/docs/sdxc/scaffold-a-resource) — every file a resource needs, from
  one command.
- [Make a controller](/docs/sdxc/make-controller) — the kind most features start from.
- [List routes](/docs/sdxc/list-routes) — confirm what a new controller is mapped to.
