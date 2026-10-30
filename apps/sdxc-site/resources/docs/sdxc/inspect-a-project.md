---
title: Inspect a project
description: Read what an app holds without opening its files, with sdxc models, schedule, middleware, initializers, notes, stats and diagram, each as a table, Mermaid or JSON for an agent.
section:
    title: The sdxc command
    order: 2
order: 7.5
lastUpdated: 2026-10-25
outcomes:
    - "How to see each model's table and whether its migrations match it"
    - "How to check that every scheduled job has a trigger that fires it"
    - "How to draw the layer architecture and read the middleware a request runs"
---

Eight read-only commands answer the questions you would otherwise open files for. Each runs from
any folder in the project, changes nothing, and takes `--json` for a script or an agent.

| Command             | Answers                                                       |
| ------------------- | ------------------------------------------------------------- |
| `sdxc models`       | which tables the models declare, and whether migrations match |
| `sdxc schedule`     | which jobs run on a schedule, when next, and what fires them  |
| `sdxc middleware`   | which middleware a request runs, in order                     |
| `sdxc initializers` | where the app's one instance of each thing is built           |
| `sdxc notes`        | which `TODO` and `FIXME` comments are left                    |
| `sdxc stats`        | how much code each kind holds, and the code to test ratio     |
| `sdxc diagram`      | how the app-layout layers import each other                   |

[`sdxc routes`](/docs/sdxc/list-routes) answers the eighth: which route reaches which controller.

## Models and their migrations

`sdxc models` loads every model in `app/models/` with your project's runtime, the way the app
loads it, and compares its table with the migration chain:

```bash
sdxc models
```

```text
Model  File                Table  Columns  Migrations
post   app/models/post.ts  posts  5        in step
```

Name a model to print it in full:

```bash
sdxc models post
```

```text
post: the posts table, in app/models/post.ts

Column      Type     Null  Default  Key
id          text     no             primary
title       text     no
slug        text     no             unique
created_at  integer  no
updated_at  integer  no

Migrations: the migrations create this table
Factory: database/factories/post.ts
```

`Migrations` replays the default chain and diffs it against the table, as
[`sdxc make migration`](/docs/sdxc/make-migration#write-the-sql-from-a-model) does with
`--from-model`. A model you changed after its migration ran reads `behind`.

## Scheduled jobs

A job made with `--cron` runs only when a Worker trigger delivers its exact expression.
`sdxc make job` with `--cron` adds that trigger to `cloudflare.config.ts` beside the job, and
`sdxc schedule` pairs every scheduled job in `app/jobs/index.ts` with the trigger that fires it,
from `cloudflare.config.ts` or `wrangler.jsonc`:

```bash
sdxc make job digest --cron "0 8 * * *"
sdxc schedule
```

```text
Job            Schedule   Next run              Trigger
digest         0 8 * * *  2026-10-20 08:00 UTC  cloudflare.config.ts
reports.daily  0 9 * * 1  2026-10-26 09:00 UTC  none; add triggers.scheduled({ schedule: "0 9 * * 1" })
```

> [!WARNING]
> A job whose trigger reads `none` never runs in production. That is a job declared by hand, or
> one whose Worker is configured in `wrangler.jsonc`: add the trigger the row names, then deploy.

A trigger no job declares is listed below the table. Next runs are in UTC, the zone Workers
deliver triggers in.

## Middleware

`sdxc middleware` prints each router's global middleware in the order it runs, then every
module in `app/http/middleware/`. A chain built with `createMiddleware(…)` is expanded to its
members, and each module says how many routes run it:

```bash
sdxc middleware
```

```text
app/initializers/router.tsx, the router's global middleware:
   1. asyncContext()  remix/middleware/async-context
   2. log(logger)     @sdxc/logger/middleware
   …

app/http/middleware/page.ts, a chain 2 routes run:
  1. formData()                              remix/middleware/form-data
  2. cop()                                   remix/middleware/cop
  3. session(sessionCookie, sessionStorage)  remix/middleware/session
  …
```

A count of 0 is a middleware no route reaches.

## Initializers

`sdxc initializers` lists every module in `app/initializers/`, what it exports, and the package
factories it calls to build it:

```bash
sdxc initializers
```

```text
File                            Exports       Built with
app/initializers/cli.ts         cli           createCLI (@sdxc/cli), createLogger (@sdxc/logger)
app/initializers/database.ts    openDatabase  createD1DatabaseAdapter (@sdxc/data-table-d1)
app/initializers/dispatcher.ts  dispatcher    createJobDispatcher (@sdxc/jobs)
```

## Notes left in the code

The files `sdxc make` writes mark what is left to fill in with a `TODO`. `sdxc notes` lists them,
with every `TODO`, `FIXME`, `HACK` and `OPTIMIZE` anyone left, by file and line:

```bash
sdxc notes
```

```text
app/http/controllers/about.tsx:
  [24] TODO: render the page

app/jobs/reports/daily.ts:
  [18] TODO: do the work, through the services on `ctx`
```

`--tag` reads other tags instead, as `sdxc notes --tag TODO,REVIEW`.

## Lines of code

`sdxc stats` counts files, lines, and code lines without blanks and comments, for each kind of
code the app layout names, with tests apart wherever they sit:

```bash
sdxc stats
```

It ends with the totals and the code to test ratio, `Code to test ratio: 1:0.4`.

## Architecture diagram

`sdxc diagram` walks the same import graph the `dependencies` doctor check uses and prints a
Mermaid flowchart of the app-layout layers. Edges that break Clean Architecture's dependency
rule (inner layer importing an outer one) are dashed and labelled. `--json` prints the graph
for an agent; `--svg architecture.svg` draws it with [`@sdxc/diagram`](/api/diagram) and writes
the file under the project root:

```bash
sdxc diagram
sdxc diagram --json
sdxc diagram --svg architecture.svg
```

```text
flowchart TB
  L_http["http"]
  L_services["services"]
  L_http -->|12 imports| L_services
```

## Where to go next

- [List routes](/docs/sdxc/list-routes) — every route with its controller and middleware.
- [Check a project](/docs/sdxc/check-a-project) — the checks that fail a build, beside these
  listings that inform one.
