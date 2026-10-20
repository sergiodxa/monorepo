---
title: Your app's command line
description: Give your app commands for work that belongs to no request, and publish its log, database, models, jobs, translations and mailer to them through the same middleware its routes use.
section:
    title: Operations & testing
    order: 9
order: 9
lastUpdated: 2026-10-19
outcomes:
    - "How to add commands for work that belongs to no request"
    - "How to publish the log, database, models, jobs and mailer to commands through middleware"
    - "How to run app code outside the server and test a command"
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
	@sdxc/logger @sdxc/mail @sdxc/trace-context remix
```

## Where it lives

An app created with `sdxc create` already has one, in four places:

| File                      | What it holds                                              |
| ------------------------- | ---------------------------------------------------------- |
| `app/commands/index.ts`   | The contract: every command, its arguments and flags       |
| `app/commands/<name>.ts`  | One handler per command, the file's default export         |
| `app/initializers/cli.ts` | The command line: its middleware, and each handler mapped  |
| `bootstrap/cli.ts`        | The entry point, which runs the command the arguments name |

It starts with the commands local work needs: `about`, `console` (a REPL with `db` and `models`
loaded from `bootstrap/console.ts`), `db console`, `db migrate`, `db fresh`, `db prepare` and
`db seed`, `emails preview`, `deploy` and `typegen`.
[Run your app's commands](/docs/sdxc/run-app-commands) covers what each one does.

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
the declaration's arguments and flags; the template's own commands stay beside `users`:

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
	let user = await ctx.models.user.findByEmail(ctx.arguments.email);
	if (user === null) return failure(new Error(`No user ${ctx.arguments.email}`));

	await ctx.models.user.grant(user, ctx.flags.role);
	ctx.stdout(`${user.email} is now ${ctx.flags.role}\n`);
	return success();
});
```

`findByEmail` and `grant` are methods on your `user` model. On a terminal, a missing `--role`
is asked for with the list of roles; in a script, `sdxc run users grant ada@example.com --role
admin` asks nothing. [Build a command line](/docs/operations-and-testing/build-a-command-line)
covers arguments, flags, prompts and progress in full.

## Publish the app's services

The command line's middleware publishes what commands read, in the order a router's does: the
log first, then the services. The template builds it once, at module scope:

```typescript {% title="app/initializers/cli.ts" %}
import { createCLI, lazy } from "@sdxc/cli";
import { models } from "@sdxc/data-model/cli";
import { Database, database } from "@sdxc/database-middleware/cli";
import i18n from "@sdxc/i18n/middleware/cli";
import { createLogger } from "@sdxc/logger";
import { log } from "@sdxc/logger/middleware/cli";
import mailer from "@sdxc/mail/middleware/cli";
import { PrintTransport } from "@sdxc/mail/print";
import { trace } from "@sdxc/trace-context/middleware/cli";

import commandset from "~/app/commands";
import {
	FALLBACK_LANGUAGE,
	RESOURCES,
	SUPPORTED_LANGUAGES,
} from "~/app/initializers/i18n";
import { openLocalDatabase } from "~/app/initializers/local-database";
import { logger } from "~/app/initializers/logger";
import { mail } from "~/app/initializers/mail";
import registry from "~/app/models";
import { MAIL_FROM } from "~/config/constants";

import manifest from "../../package.json" with { type: "json" };

const COMMAND_LOGGER = createLogger({
	...logger.options,
	sink: (record) => process.stderr.write(`${JSON.stringify(record)}\n`),
});

export const cli = createCLI({
	name: manifest.name,
	commands: commandset,
	middleware: [
		log(COMMAND_LOGGER),
		trace(),
		database(openLocalDatabase),
		models(registry, (ctx) => ({ db: ctx.require(Database) })),
		mailer({
			transport: (ctx) =>
				new PrintTransport({ write: (text) => ctx.stderr(text) }),
			from: MAIL_FROM,
			mail,
		}),
		i18n({
			resources: RESOURCES,
			supportedLanguages: SUPPORTED_LANGUAGES,
			fallbackLanguage: FALLBACK_LANGUAGE,
		}),
	],
});

cli.map(
	commandset.users.grant,
	lazy(() => import("~/app/commands/users/grant")),
);

declare module "@sdxc/cli" {
	interface CLITypes {
		cli: typeof cli;
	}
}
```

The `CLITypes` augmentation at the end types every handler's `ctx` with what this chain
publishes, so `ctx.models` type checks in `users/grant.ts` with nothing to add. `sdxc make
command` adds each mapping after the last `cli.map`, and a test runs the same `cli` against a
temporary project, as [Test a command](#test-a-command) shows. Each entry is explained
in the sections that follow.

### The log

`log(logger)` from `@sdxc/logger/middleware/cli` opens a `command` log for each run and writes it
once the handler settles, carrying `command.path` (`users grant`), `command.duration_ms`, and
`command.exit_code` when the run fails; `trace()` gives the run a trace id. Handlers log through `ctx.log`, and code they call
reaches the same log through `currentLog()`, exactly as in a route or a job. The logger above
is the app's own with its records sent to stderr as JSON lines, so stdout carries only what a
command prints and can be piped.

### The database, and a SQL prompt

`database()` from `@sdxc/database-middleware/cli` publishes `ctx.db` under the same `Database`
key the router entry uses, so a model method that reads `ctx.db` works unchanged. A function is
called once per run that reaches a handler, so `--help` opens nothing.

Where the database comes from is the app's decision, as it is for the server. A Node or Bun app
opens the connection its server opens. A Cloudflare app opens the SQLite file its local dev
server keeps for the D1 database, through Remix's SQLite adapter: the template's
`openLocalDatabase()` in `app/initializers/local-database.ts` finds the file `bun dev` writes
under `.cloudflare/state/` for the `DB` binding, so a command and the dev server read the same
rows.

The same entry ships a SQL prompt: the template mounts `DB_COMMAND` as `db console` in its
contract and maps `dbHandler` onto it, from `app/commands/db/console.ts`.

```bash
sdxc run db console                                   # a sql> prompt until .exit or Ctrl+C
sdxc run db console --execute "SELECT count(*) FROM users"
sdxc run db console < scripts/fix-slugs.sql
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
route does. The template leaves it out; add it after `models()`, over a memory queue and a
dispatcher built on that queue, such as the `createDispatcher` factory from
[Background jobs and cron](/docs/data-and-background-work/jobs-and-cron):

```typescript {% title="app/initializers/cli.ts" %}
import { jobEnqueuer } from "@sdxc/jobs/cli";
import * as memory from "@sdxc/jobs/memory";

import { createDispatcher } from "~/app/initializers/dispatcher";

const QUEUE = memory.queue();

export const cli = createCLI({
	name: manifest.name,
	commands: commandset,
	middleware: [
		log(COMMAND_LOGGER),
		trace(),
		database(openLocalDatabase),
		models(registry, (ctx) => ({ db: ctx.require(Database) })),
		jobEnqueuer(QUEUE, {
			dispatcher: createDispatcher({ queue: QUEUE, openDb: openLocalDatabase }),
		}),
		mailer({
			transport: (ctx) =>
				new PrintTransport({ write: (text) => ctx.stderr(text) }),
			from: MAIL_FROM,
			mail,
		}),
	],
});
```

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
`unconfirmed` is a method on your `postings` model. Given a memory queue and a dispatcher built
over it, the jobs run in the command's own
process once the handler returns, through the dispatcher's middleware, timeout and retries, and
the jobs those jobs enqueue run too. Each job's record lands under the command's log, so its
output and failures show in the terminal you ran it from, against the same local database. A
run you cancel with Ctrl+C runs none of them. Passed the production queue instead, with no
dispatcher, `jobEnqueuer(queue)` writes to it and the deployed consumer does the work.

### Translations

`i18n()` from `@sdxc/i18n/middleware/cli` takes the resources and languages the router entry
does, and publishes two things. `ctx.translate(language)` binds copy to the person a command
writes to, so a message reads in its recipient's language. `ctx.intl` and `ctx.locale` carry
the command's own output in the language of whoever runs it, read from `LC_ALL`,
`LC_MESSAGES` or `LANG`, so `LANG=es_AR.UTF-8` reports in Spanish:

```typescript {% title="app/commands/users/grant.ts" %}
ctx.stdout(`${ctx.intl.t("cli.roleGranted", { email: user.email })}\n`);
```

### Mail that never leaves your laptop

`mailer()` from `@sdxc/mail/middleware/cli` publishes the app's mailer as `ctx.email`, given the
sender identity and the email registry a route uses, so a command sends any declared email by
its declaration. The transport is the one decision that changes with where the command runs, so
it may be a function of the run. `PrintTransport` from `@sdxc/mail/print` writes each message to
the function it is given, here the command's stderr, and reports it sent, so a local run shows
every message in full and emails no one:

```typescript {% title="app/commands/postings/resend.ts" %}
import { createCommand, failure, success } from "@sdxc/cli";

import commandset from "~/app/commands";
import emails from "~/app/emails";
import { SITE_URL } from "~/config/constants";

export default createCommand(commandset.postings.resend, async (ctx) => {
	let posting = await ctx.models.postings.find(ctx.arguments.id);
	if (posting === null) return failure(new Error(`No posting ${ctx.arguments.id}`));

	ctx.email.later(emails.postings.published, {
		to: posting.contact_email,
		locale: ctx.flags.locale,
		props: {
			title: posting.title,
			company: posting.company,
			url: new URL(`/postings/${posting.id}`, SITE_URL).href,
		},
	});
	return success();
});
```

`resend` takes the posting's `id` as its argument and the same `--locale` flag, and
`emails.postings.published` is the email declared in
[Send email](/docs/data-and-background-work/send-email), translated into that locale when it
renders. A message deferred with `later()` sends once the handler returns; each send is noted on
the command's log, and one that fails fails the run, so you see that a message never left.
`new PrintTransport({ write, mime: true })` prints the raw MIME message instead of the summary.
To see a template without sending it, `sdxc run emails preview postings.published` prints the
email rendered from its template's `preview()` props.

### Production data

A command that may touch production declares a `--remote` flag, and the app's middleware reads
it to pick the connection, the queue and the transport: a transport function receives the run's
context, and so can a middleware of your own that wraps `database()`. Confirm before writing
through `ctx.prompt.confirm`, naming what the run targets, with `--yes` for scripts.

## Run app code outside the server

Every module the command line imports runs on Node or Bun. The template keeps the modules that
read Worker bindings out of that graph: the mail transport and the queue live in
`app/initializers/mail-transport.ts`, which only the router and the job dispatcher import, and
the registry in `app/initializers/mail.ts` reads none. A module you add to the command line
that imports `cloudflare:workers`, such as a dispatcher whose queue reads `env.QUEUE`, needs that
module answered there as well, the way the test setup answers it for the tests. The command line
hands its own database, queue and transport to the middleware above, so every read and write it
makes goes to the local file.

## Test a command

`invoke()` from `@sdxc/cli/test` runs a command through the same middleware. The template's
`useTemporaryProject()` from `app/test/local-database.ts` points the command line at a
temporary project holding the migrations you give it, so `db migrate` builds its database and
the test reads the file back:

```typescript {% title="app/commands/users/grant.test.ts" %}
import { invoke } from "@sdxc/cli/test";
import { openDatabase } from "@sdxc/cloudflare-mocks/sqlite";
import { expect, test } from "vitest";

import { useTemporaryProject } from "~/app/test/local-database";

let project = useTemporaryProject({
	"0001_CreateUsers.sql":
		"CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, role TEXT, created_at INTEGER, updated_at INTEGER);",
});

let { cli } = await import("~/app/initializers/cli");

test("grants the role it is given", async () => {
	await invoke(cli, ["db", "migrate"]);
	let database = openDatabase(project.databaseFile);
	database.exec(
		"INSERT INTO users VALUES ('u1', 'ada@example.com', 'member', 0, 0)",
	);

	let run = await invoke(cli, [
		"users",
		"grant",
		"ada@example.com",
		"--role",
		"admin",
	]);

	expect(run.code).toBe(0);
	expect(database.query("SELECT role FROM users WHERE id = 'u1'").get()).toEqual({
		role: "admin",
	});
	database.close();
});
```

The command line is imported after `useTemporaryProject()`, because that call replaces the
local database module before anything loads it. `answers: { role: "admin" }` in `invoke`'s
options answers the prompt instead of the flag, and `interactive: false` checks what a script
without the flag gets. A job the command enqueued has run by the time `invoke` answers, and a
message it sent is in the run's `stderr`.

## Where to go next

- [Build a command line](/docs/operations-and-testing/build-a-command-line) — contracts,
  prompts, tasks and middleware in full.
- [Make a command](/docs/sdxc/make-command) — `sdxc make command` declares and maps a
  command.
- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — the dispatcher
  the command line runs jobs through.
- [Send email](/docs/data-and-background-work/send-email) — the email registry and the
  mailer a command resends through.
- [Logs, traces and timings](/docs/operations-and-testing/observability) — reading the record
  each command run writes.
