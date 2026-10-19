---
title: Undo a make
description: Remove a file sdxc make wrote, its test, the mapping that loads it and the declaration it names, with sdxc destroy, after one look at the plan.
section:
    title: The sdxc command
    order: 2
order: 2.5
lastUpdated: 2026-10-19
outcomes:
    - "How to remove a controller, job, tool, command or model and everything make wired for it"
    - "What sdxc destroy leaves for you, and why"
    - "How to run it from a script or an agent"
---

`sdxc destroy <kind> <name>` takes out what `sdxc make <kind> <name>` put in: the file, its test,
the mapping in its initializer and the declaration that mapping names. A `make` followed by a
`destroy` gives you back every declaration and initializer it edited, as it was.

```bash
sdxc destroy controller about
```

```text
Removes:
  app/http/controllers/about.tsx
  app/http/controllers/about.test.tsx
Edits:
  routes/web.ts
  app/http/controllers/sitemap.ts
  app/initializers/router.tsx
Remove 2 files and edit 3? › No
```

## What it removes

| Kind           | Files                                | Edits                                                                        |
| -------------- | ------------------------------------ | ---------------------------------------------------------------------------- |
| `controller`   | the controller and its test          | the route in its contract, its sitemap decision, its `router.map(…)`         |
| `job`          | the job and its test                 | its declaration in `app/jobs/index.ts`, its `dispatcher.map(…)`, its trigger |
| `mcp`          | the tool, or `--resource` a resource | its declaration, its `mcp.tools.map(…)`                                      |
| `command`      | the command and its test             | its declaration in `app/commands/index.ts`, its `cli.map(…)`                 |
| `model`        | the model, its test and its factory  | its entry in `app/models/index.ts`                                           |
| any other kind | the file and its test                | none                                                                         |

`destroy` finds the mapping by the import that loads the file, and reads the declaration from
the mapping itself, `jobs.trials.expire` in `dispatcher.map(jobs.trials.expire, …)`. A group the
removal leaves empty, such as `trials: {}`, goes too, and so does an import whose last use was
the mapping or the declaration. Every other import stays.

A scheduled job's trigger leaves `cloudflare.config.ts` with it, unless another job runs on the
same schedule. A trigger in `wrangler.jsonc` is listed for you to remove.

Every make kind but `migration` and `policy` is accepted. A file that does not exist stops the
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

<note>
A model's migrations stay. A database may already have applied them, and removing a migration
that ran leaves that database out of step with the chain. Write a migration that drops the
table instead, with [`sdxc make migration`](/docs/sdxc/make-migration).
</note>

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
