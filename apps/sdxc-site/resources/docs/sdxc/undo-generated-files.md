---
title: Undo a make
description: Remove a file sdxc make wrote, its test, the mapping that loads it and the declaration it names, with sdxc destroy, after one look at the plan.
section:
    title: The sdxc command
    order: 2
order: 2.5
lastUpdated: 2026-10-25
outcomes:
    - "How to remove a controller, job, tool, command, email or model and everything make wired for it"
    - "What sdxc destroy leaves for you, and why"
    - "How to run it from a script or an agent"
---

`sdxc destroy <kind> <name>` takes out what `sdxc make <kind> <name>` put in: the file, its test,
its pairing `.spec`, the mapping in its initializer and the declaration that mapping names. A `make` followed by a
`destroy` gives you back every declaration and initializer it edited, as it was.

```bash
sdxc destroy controller about
```

```text
Removes:
  app/http/controllers/about.tsx
  app/http/controllers/about.test.tsx
  spec/about.spec
Edits:
  routes/web.ts
  app/http/controllers/sitemap.ts
  app/initializers/router.tsx
Remove 3 files and edit 3? › No
```

## What it removes

| Kind           | Files                                                   | Edits                                                                            |
| -------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `controller`   | the controller, its test and spec                       | the route in its contract, its sitemap decision, its `router.map(…)`             |
| `job`          | the job and its test                                    | its declaration in `app/jobs/index.ts`, its `dispatcher.map(…)`, its trigger     |
| `mcp`          | the tool, its test and spec, or `--resource` a resource | its declaration, its `mcp.tools.map(…)` or `mcp.resources.map(…)`                |
| `command`      | the command, its test and spec                          | its declaration in `app/commands/index.ts`, its `cli.map(…)`                     |
| `email`        | the template and its test                               | its declaration in `app/emails/index.ts`, its `mail.map(…)` in the mail registry |
| `model`        | the model, its test and its factory                     | its entry in `app/models/index.ts`                                               |
| any other kind | the file and its test                                   | none                                                                             |

`destroy` finds the mapping by the import that loads the file, and reads the declaration from
the mapping itself, `jobs.trials.expire` in `dispatcher.map(jobs.trials.expire, …)`. A group the
removal leaves empty, such as `trials: {}`, goes too, and so does an import whose last use was
the mapping or the declaration. Every other import stays.

A scheduled job's trigger leaves `cloudflare.config.ts` with it once no other job runs on the
same schedule, so the Worker stops waking for a job it no longer has. A cron in `wrangler.jsonc`
is listed for you to remove.

The kinds are `controller`, `middleware`, `validator`, `job`, `model`, `factory`, `service`,
`initializer`, `email`, `mcp` and `command`. A file that does not exist stops the
command before it edits anything:

```text
app/jobs/digset.ts does not exist; sdxc destroy removes what sdxc make wrote
```

## What it leaves for you

Code you wrote that uses the file is yours to change, so `destroy` lists every line that still
names the file or its declaration, after everything else it prints:

```text
Still referenced, to remove by hand:
  app/jobs/charge-all.ts:1: import { charge } from "~/app/services/billing/charge";
```

> [!NOTE]
> A model's migrations stay. A database may already have applied them, and removing a migration
> that ran leaves that database out of step with the chain. Write a migration that drops the
> table instead, with [`sdxc make migration`](/docs/sdxc/make-migration).

The packages `make` added to `package.json` stay too, since other code may import them.

## Flags

| Flag         | What it does                                                     |
| ------------ | ---------------------------------------------------------------- |
| `-y, --yes`  | remove without asking; required without a terminal               |
| `--dry-run`  | print the plan and the diff of every edit, and change nothing    |
| `--resource` | with `mcp`, a resource in `app/mcp/resources/` instead of a tool |

Nothing changes without a yes: on a terminal the command asks once, after the plan, and `No` is
the default. A script or an agent passes `--yes`; without a terminal and without it, the command
is a usage error. Once it writes, the `format` command from your configuration runs over the
edited files.

```bash
sdxc destroy job digest --dry-run
sdxc destroy model post --yes
```

## Where to go next

- [Generate files](/docs/sdxc/generate-files) — what `sdxc make` writes and edits for each kind.
- [List routes](/docs/sdxc/list-routes) — check that a removed controller left no route behind.
