---
title: Inspect a project
description: Read what an app holds without opening its files, with sdxc models, schedule, middleware, initializers, notes and stats, each as a table or as JSON for an agent.
section:
    title: The sdxc command
    order: 2
order: 7.5
lastUpdated: 2026-10-19
outcomes:
    - "How to see each model's table and whether its migrations match it"
    - "How to check that every scheduled job has a trigger that fires it"
    - "How to read the middleware a request runs, and where each instance comes from"
---

Six read-only commands answer the questions you would otherwise open files for. Each runs from
any folder in the project, changes nothing, and takes `--json` for a script or an agent.

| Command             | Answers                                                       |
| ------------------- | ------------------------------------------------------------- |
| `sdxc models`       | which tables the models declare, and whether migrations match |
| `sdxc schedule`     | which jobs run on a schedule, when next, and what fires them  |
| `sdxc middleware`   | which middleware a request runs, in order                     |
| `sdxc initializers` | where the app's one instance of each thing is built           |
| `sdxc notes`        | which `TODO` and `FIXME` comments are left                    |
| `sdxc stats`        | how much code each kind holds, and the code to test ratio     |

[`sdxc routes`](/docs/sdxc/list-routes) answers the seventh: which route reaches which controller.

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
`--from-model`.
A model you changed after its migration ran reads `behind`, and the full view names the command
that writes the SQL to catch up.

## Scheduled jobs

A job made with `--cron` runs only when a Worker trigger delivers its exact expression, which
`sdxc make job` adds to `cloudflare.config.ts` beside the job. `sdxc schedule` pairs every scheduled job in `app/jobs/index.ts` with the trigger that fires it,
from `cloudflare.config.ts` or `wrangler.jsonc`:

```bash
sdxc schedule
```

```text
Job            Schedule   Next run              Trigger
reports.daily  0 8 * * *  2026-10-20 08:00 UTC  none; add triggers.scheduled({ schedule: "0 8 * * *" })
```

<warning>
A job whose trigger reads `none` never runs in production. That is a job declared by hand, or
one whose Worker is configured in `wrangler.jsonc`: add the trigger the row names, then deploy.
</warning>

A trigger no job declares is listed below the table, as
`cloudflare.config.ts fires "0 5 * * 1", which no job declares`. Expressions are compared as
parsed, so `0 9 * * MON-FRI` matches `0 9 * * 1-5`, and next runs are in UTC, the zone Workers
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

A middleware that sits inside a chain counts the routes of that chain, so a count of 0 is one no
route reaches.

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

A factory is an imported `create*`, `open*`, `define*` or `connect*` the module calls; the app's
own modules and Node's built-ins are left out.

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

`--tag` reads other tags instead, as `sdxc notes --tag TODO,REVIEW`. The notes come from comments
alone, after `//`, `/*`, `*`, `{/*`, `--` or `<!--`, in the folders the app layout names.

## Lines of code

`sdxc stats` counts files, lines, and code lines without blanks and comments, for each kind of
code the app layout names, with tests apart wherever they sit:

```bash
sdxc stats
```

```text
Kind                 Files  Lines  Code
-------------------  -----  -----  ----
Controllers              9    225   122
Middleware               4    165    87
Jobs                     2     36    11
Models                   2     52    22
…
Tests                   24    855   514
-------------------  -----  -----  ----
Total                   90   2991  1669

Code: 1155  Tests: 514  Code to test ratio: 1:0.4
```

## Where to go next

- [List routes](/docs/sdxc/list-routes) — every route with its controller and middleware.
- [Check a project](/docs/sdxc/check-a-project) — the checks that fail a build, beside these
  listings that inform one.
