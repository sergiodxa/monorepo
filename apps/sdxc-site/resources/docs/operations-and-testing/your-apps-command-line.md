---
title: Your app's command line
description: Give your app commands for work that belongs to no request, and publish its log, database, models, jobs, translations and mailer to them through the same middleware its routes use.
section:
    title: Operations & testing
    order: 9
order: 9
lastUpdated: 2026-10-15
---

<note>
This guide builds the command line and its commands. To run the commands an app already has,
such as `db migrate`, see [Run your app's commands](/docs/sdxc/run-app-commands).
</note>

Some work belongs to your app but to no request: seeding a database, backfilling a column,
granting someone a role, resending an email that bounced. A command line inside the app does
that work with the app's own models, jobs and templates, so a backfill runs the same code a
route would.

This guide builds that command line for a job board. A command reaches the app's services the
way a controller does, through middleware: [`@sdxc/cli`](/api/cli) runs the commands, and
[`@sdxc/logger`](/api/logger), [`@sdxc/database-middleware`](/api/database-middleware),
[`@sdxc/data-model`](/api/data-model), [`@sdxc/jobs`](/api/jobs), [`@sdxc/i18n`](/api/i18n) and
[`@sdxc/mail`](/api/mail) each ship a `cli` entry that publishes their service to a command
under the same name and key their router entry uses.

```bash
npm add @sdxc/cli @sdxc/data-model @sdxc/database-middleware @sdxc/i18n @sdxc/jobs \
	@sdxc/logger @sdxc/mail remix
```

## Where it lives

An app created with `sdxc create` already has one, in four places:

| File                      | What it holds                                              |
| ------------------------- | ---------------------------------------------------------- |
| `app/commands/index.ts`   | The contract: every command, its arguments and flags       |
| `app/commands/<name>.ts`  | One handler per command, the file's default export         |
| `app/initializers/cli.ts` | The command line: its middleware, and each handler mapped  |
| `bootstrap/cli.ts`        | The entry point, which runs the command the arguments name |

The layout matches `app/mcp/`: declarations in one module, a handler per file beside it, and the
wiring in an initializer. `bootstrap/cli.ts` is the only file that starts anything:

```typescript {% title="bootstrap/cli.ts" %}
import { cli } from "~/app/initializers/cli";

process.exitCode = await cli.run(process.argv.slice(2));
```

It runs on Node or Bun, outside the server: `sdxc run about` runs the template's `about`
command from any folder in the project, as [Run your app's commands](/docs/sdxc/run-app-commands)
describes. The server entry never imports `bootstrap/cli.ts`, so no command ships in the server
build.

## Add a command

```bash
sdxc make command users/grant
```

`make` writes `app/commands/users/grant.ts` and a test beside it, declares `grant` inside a
`users` group in `app/commands/index.ts`, and maps the handler through `lazy()` in
`app/initializers/cli.ts`, so `sdxc run users grant` answers as soon as it finishes. Fill in
the declaration's arguments and flags:

```typescript {% title="app/commands/index.ts" %}
import { argument, command, commands, flag, prompt } from "@sdxc/cli";
import * as s from "remix/data-schema";

const ROLES = ["member", "admin"] as const;

export default commands({
	users: commands({
		grant: command({
			description: "Grant a role to a user",
			arguments: { email: argument(s.string()) },
			flags: {
				role: flag.string("role", {
					schema: s.enum_(ROLES),
					prompt: prompt.select({ message: "Which role?", options: ROLES }),
				}),
			},
		}),
	}),
});
```

The handler reads the app's models from `ctx.models`, which the middleware below publishes:

```typescript {% title="app/commands/users/grant.ts" %}
import { createCommand, failure, success } from "@sdxc/cli";

import commandset from "~/app/commands";

export default createCommand(commandset.users.grant, async (ctx) => {
	let user = await ctx.models.users.findByEmail(ctx.arguments.email);
	if (user === null) return failure(new Error(`No user ${ctx.arguments.email}`));

	await ctx.models.users.grant(user, ctx.flags.role);
	ctx.stdout(`${user.email} is now ${ctx.flags.role}\n`);
	return success();
});
```

`findByEmail` and `grant` are methods on your `users` model. On a terminal, a missing `--role`
is asked for with the list of roles; in a script, `sdxc run users grant ada@example.com --role
admin` asks nothing. [Build a command line](/docs/operations-and-testing/build-a-command-line)
covers arguments, flags, prompts and progress in full.

## Publish the app's services

The command line's middleware publishes what commands read, in the order a router's does: the
log first, then the services. Build it in a factory, so a test can hand it a database of its
own:

```typescript {% title="app/initializers/cli.ts" %}
import type { MemoryQueue } from "@sdxc/jobs/memory";
import type { Database } from "remix/data-table";

import { createCLI, lazy } from "@sdxc/cli";
import { models } from "@sdxc/data-model/cli";
import { DB_COMMAND, database, dbHandler } from "@sdxc/database-middleware/cli";
import i18n from "@sdxc/i18n/middleware/cli";
import { jobEnqueuer } from "@sdxc/jobs/cli";
import * as memory from "@sdxc/jobs/memory";
import { createLogger } from "@sdxc/logger";
import { log } from "@sdxc/logger/middleware/cli";
import mail from "@sdxc/mail/middleware/cli";
import { PrintTransport } from "@sdxc/mail/print";

import commandset from "~/app/commands";
import { createDispatcher } from "~/app/initializers/dispatcher";
import {
	FALLBACK_LANGUAGE,
	RESOURCES,
	SUPPORTED_LANGUAGES,
} from "~/app/initializers/i18n";
import { openLocalDatabase } from "~/app/initializers/local-database";
import { logger } from "~/app/initializers/logger";
import { MAIL_FROM } from "~/app/initializers/mail";
import { models as registry } from "~/app/models";

interface CLIOptions {
	openDb?: () => Database;
	queue?: MemoryQueue;
}

export function createAppCLI(options: CLIOptions = {}) {
	let openDb = options.openDb ?? openLocalDatabase;
	let queue = options.queue ?? memory.queue();
	let dispatcher = createDispatcher({ queue, openDb });

	let cli = createCLI({
		name: "app",
		commands: commandset,
		middleware: [
			log(
				createLogger({
					...logger.options,
					sink: (record) =>
						process.stderr.write(`${JSON.stringify(record)}\n`),
				}),
			),
			database(openDb),
			models(registry, (ctx) => ({ db: ctx.db })),
			jobEnqueuer(queue, { dispatcher }),
			i18n({
				resources: RESOURCES,
				supportedLanguages: SUPPORTED_LANGUAGES,
				fallbackLanguage: FALLBACK_LANGUAGE,
			}),
			mail({
				transport: (ctx) =>
					new PrintTransport({ write: (text) => ctx.stderr(text) }),
				from: MAIL_FROM,
			}),
		],
	});

	cli.map(commandset.db, dbHandler);
	cli.map(
		commandset.users.grant,
		lazy(() => import("~/app/commands/users/grant")),
	);
	return cli;
}

export const cli = createAppCLI();
```

`commandset.db` is `db: DB_COMMAND` in `app/commands/index.ts`, covered below. `sdxc make
command` keeps adding its mappings after the last `cli.map`, inside the factory. Each entry is
explained in the sections that follow.

### The log

`log(logger)` from `@sdxc/logger/middleware/cli` opens a `command` log for each run and writes it
once the handler settles, carrying `command.path` (`users grant`), `command.duration_ms`, and
`command.exit_code` when the run fails. Handlers log through `ctx.log`, and code they call
reaches the same log through `currentLog()`, exactly as in a route or a job. The logger above
is the app's own with its records sent to stderr as JSON lines, so stdout carries only what a
command prints and can be piped.

### The database, and a SQL prompt

`database()` from `@sdxc/database-middleware/cli` publishes `ctx.db` under the same `Database`
key the router entry uses, so a model method that reads `ctx.db` works unchanged. A function is
called once per run that reaches a handler, so `--help` opens nothing.

Where the database comes from is the app's decision, as it is for the server. A Node or Bun app
opens the connection its server opens. A Cloudflare app opens the SQLite file its local dev
server keeps for the D1 database, through Remix's SQLite adapter:

```typescript {% title="app/initializers/local-database.ts" %}
import { createSqliteDatabase } from "remix/data-table/sqlite";

export function openLocalDatabase() {
	return createSqliteDatabase({
		filename: process.env.LOCAL_DATABASE ?? "local.db",
	});
}
```

The same entry ships a `db` command: mount `DB_COMMAND` in your contract under any name and map
`dbHandler` onto it.

```bash
sdxc run db                                   # a sql> prompt until .exit or Ctrl+C
sdxc run db --execute "SELECT count(*) FROM users"
sdxc run db < scripts/fix-slugs.sql
```

A read prints its rows as aligned columns with a row count, and a write prints how many rows it
changed. It runs on whatever `database()` connected, so it is a SQL shell for any adapter.

### Models

`models()` from `@sdxc/data-model/cli` takes the registry and the function that builds the
model context, exactly as the router entry does, and publishes `ctx.models`. The function runs
on the first model access, after `database()` has published `ctx.db`.
[Model your tables](/docs/data-and-background-work/data-models) writes the registry.

### Jobs that run where you are watching

`jobEnqueuer()` from `@sdxc/jobs/cli` publishes `ctx.jobs`, so a command enqueues a job the way a
route does:

```typescript {% title="app/commands/postings/reconfirm.ts" %}
import { createCommand, success } from "@sdxc/cli";

import commandset from "~/app/commands";
import jobs from "~/app/jobs";

export default createCommand(commandset.postings.reconfirm, async (ctx) => {
	let postings = await ctx.models.postings.unconfirmed();
	await ctx.jobs.enqueueMany(
		jobs.sendConfirmation,
		postings.map((posting) => ({
			postingId: posting.id,
			locale: ctx.flags.locale,
		})),
	);
	ctx.stdout(`Queued ${postings.length} confirmations\n`);
	return success();
});
```

`reconfirm` is declared in `app/commands/index.ts` like `grant`, with a `--locale` flag, and
`unconfirmed` is a method on your `postings` model. Given a memory queue and the app's dispatcher built over it, the jobs run in the command's own
process once the handler returns, through the dispatcher's middleware, timeout and retries, and
the jobs those jobs enqueue run too. Each job's record lands under the command's log, so its
output and failures show in the terminal you ran it from, against the same local database. A
run you cancel with Ctrl+C runs none of them. Passed the production queue instead, with no
dispatcher, `jobEnqueuer(queue)` writes to it and the deployed consumer does the work.

`createDispatcher` is the factory from
[Background jobs and cron](/docs/data-and-background-work/jobs-and-cron), given the memory queue
and the command line's database.

### Translations

`i18n()` from `@sdxc/i18n/middleware/cli` takes the resources and languages the router entry
does, and publishes two things. `ctx.translate(language)` binds copy to the person a command
writes to, so an email goes out in its recipient's language. `ctx.intl` and `ctx.locale` carry
the command's own output in the language of whoever runs it, read from `LC_ALL`,
`LC_MESSAGES` or `LANG`, so `LANG=es_AR.UTF-8` reports in Spanish:

```typescript {% title="app/commands/users/grant.ts" %}
ctx.stdout(`${ctx.intl.t("cli.roleGranted", { email: user.email })}\n`);
```

### Mail that never leaves your laptop

`mail()` from `@sdxc/mail/middleware/cli` publishes the app's mailer as `ctx.email`, with the
sender identity and templates a route uses. The transport is the one decision that changes
with where the command runs, so it may be a function of the run. `PrintTransport` from
`@sdxc/mail/print` writes each message to the function it is given, here the command's stderr,
and reports it sent, so a local run shows every message in full and emails no one:

```typescript {% title="app/commands/postings/resend.ts" %}
import { createCommand, failure, success } from "@sdxc/cli";

import commandset from "~/app/commands";
import { PostingPublishedEmail } from "~/app/emails/posting-published";

export default createCommand(commandset.postings.resend, async (ctx) => {
	let posting = await ctx.models.postings.find(ctx.arguments.id);
	if (posting === null) return failure(new Error(`No posting ${ctx.arguments.id}`));

	let { t } = ctx.translate(ctx.flags.locale);
	let vars = { title: posting.title, company: posting.company };
	ctx.email.later(
		new PostingPublishedEmail(posting.contact_email, {
			subject: t("email.subject", vars),
			heading: t("email.heading"),
			body: t("email.body", vars),
			footer: t("email.footer"),
		}),
	);
	return success();
});
```

`resend` takes the posting's `id` as its argument and the same `--locale` flag, and
`PostingPublishedEmail` is the class from [Send email](/docs/data-and-background-work/send-email). A message queued with `later()` sends once the handler returns; each send is noted on the
command's log, and one that fails fails the run, so you see that a message never left.
`new PrintTransport({ write, mime: true })` prints the raw MIME message instead of the summary.

### Production data

A command that may touch production declares a `--remote` flag, and the app's middleware reads
it to pick the connection, the queue and the transport: a transport function receives the run's
context, and so can a middleware of your own that wraps `database()`. Confirm before writing
through `ctx.prompt.confirm`, naming what the run targets, with `--yes` for scripts.

## Run app code outside the server

Every module the command line imports runs on Node or Bun. One that imports
`cloudflare:workers`, as a Worker's queue and database initializers do, needs that module
answered there as well; a Cloudflare app provides it for its command line the way its test setup
provides it for its tests. The command line hands its own database, queue and transport to the
middleware above, so every read and write it makes goes to the local file.

## Test a command

`invoke()` from `@sdxc/cli/test` runs a command through the same middleware, against a test
database handed to the factory:

```typescript {% title="app/commands/users/grant.test.ts" %}
import { invoke } from "@sdxc/cli/test";
import { expect, test } from "vitest";

import { createAppCLI } from "~/app/initializers/cli";
import { createTestDatabase } from "~/app/test/database";
import { users } from "~/database/schema";

test("grants the role it is given", async () => {
	let db = await createTestDatabase();
	await db.create(users, { id: "u1", email: "ada@example.com", role: "member" });

	let run = await invoke(createAppCLI({ openDb: () => db }), [
		"users",
		"grant",
		"ada@example.com",
		"--role",
		"admin",
	]);

	expect(run.code).toBe(0);
	expect(await db.find(users, "u1")).toMatchObject({ role: "admin" });
});
```

`answers: { role: "admin" }` answers the prompt instead of the flag, and `interactive: false`
checks what a script without the flag gets. A job the command enqueued has run by the time
`invoke` answers, and a message it sent is in the run's `stderr`.

## Where to go next

- [Build a command line](/docs/operations-and-testing/build-a-command-line) — contracts,
  prompts, tasks and middleware in full.
- [Make a command](/docs/sdxc/make-command) — `sdxc make command` declares and maps a
  command.
- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — the dispatcher
  the command line runs jobs through.
- [Send email](/docs/data-and-background-work/send-email) — the mailer and the email classes
  a command resends.
- [Logs, traces and timings](/docs/operations-and-testing/observability) — reading the record
  each command run writes.
