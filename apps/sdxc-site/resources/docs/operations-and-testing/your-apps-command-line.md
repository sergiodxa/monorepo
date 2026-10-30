---
title: Your app's command line
description: Give your app commands for work that belongs to no request, and publish its log, database, models, translations and mailer to them through the same middleware its routes use.
section:
    title: Operations & testing
    order: 9
order: 9
lastUpdated: 2026-10-25
outcomes:
    - "How to add commands for work that belongs to no request"
    - "How to publish the log, database, models and mailer to commands through middleware"
    - "How to run app code outside the server and test a command"
---

Some work belongs to your app but to no request: seeding a database, backfilling a column,
granting someone a role, resending an email that bounced. A command line inside the app does
that work with the app's own models, jobs and templates, so a backfill runs the same code a
route would.

This guide builds that command line for a job board. A command reaches the app's services the
way a controller does, through middleware: [`@sdxc/cli`](/api/cli) runs the commands, and
[`@sdxc/logger`](/api/logger), [`@sdxc/database-middleware`](/api/database-middleware),
[`@sdxc/data-model`](/api/data-model), [`@sdxc/i18n`](/api/i18n) and [`@sdxc/mail`](/api/mail)
each ship a `cli` entry that publishes their service to a command under the same name and key
their router entry uses.

```bash
npm add @sdxc/cli @sdxc/data-model @sdxc/database-middleware @sdxc/i18n @sdxc/logger \
	@sdxc/mail @sdxc/trace-context remix
npm add -D @sdxc/cloudflare-mocks
```

> [!NOTE]
> This guide builds the command line and its commands. To run the commands an app already has,
> such as `db migrate`, see [Run your app's commands](/docs/sdxc/run-app-commands).

## Find where it lives

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

It runs on Node or Bun, outside the server, and the server entry never imports it, so no
command ships in the server build.

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
`findByEmail`and`grant`are methods on your`user`model. On a terminal, a missing`--role`is asked for with the list of roles; in a script,`sdxc run users grant ada@example.com --role
admin` asks nothing.

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
publishes, so `ctx.models` type checks in `users/grant.ts` with nothing to add. Each entry
publishes what its router entry does:

- `log(logger)` opens a `command` log for each run, carrying `command.path` and
  `command.duration_ms`, and `trace()` gives the run a trace id. Handlers log through `ctx.log`.
  The logger writes its records to stderr, so stdout carries only what a command prints and can
  be piped.
- `database()` publishes `ctx.db` under the same `Database` key the router uses, so a model
  method works unchanged. The template's `openLocalDatabase()` opens the SQLite file `bun dev`
  keeps for the `DB` binding, so a command and the dev server read the same rows.
- `models()` publishes `ctx.models`, built on the first model access.
- `mailer()` publishes `ctx.email`. `PrintTransport` writes each message to the command's stderr
  and reports it sent, so a local run shows every message in full and emails no one.
- `i18n()` publishes `ctx.translate(language)` for copy written to someone else, and `ctx.intl`
  for the command's own output in the language `LANG` names.

The same database entry ships a SQL prompt, mounted as `db console` in the template:

```bash
sdxc run db console --execute "SELECT count(*) FROM users"
```

> [!WARNING]
> A command that may touch production declares a `--remote` flag that your middleware reads to
> pick the connection, queue and transport. Confirm before writing through `ctx.prompt.confirm`,
> naming what the run targets, with `--yes` for scripts.

## Run app code outside the server

Every module the command line imports runs on Node or Bun. The template keeps the modules that
read Worker bindings out of that graph: the mail transport and the queue live in
`app/initializers/mail-transport.ts`, which only the router and the job dispatcher import. A
module you add to the command line that imports `cloudflare:workers` needs that module answered
there as well, the way the test setup answers it for the tests.

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
options answers the prompt instead of the flag.

## Where to go next

- [Build a command line](/docs/operations-and-testing/build-a-command-line) — contracts,
  prompts, tasks and middleware in full.
- [Make a command](/docs/sdxc/make-command) — `sdxc make command` declares and maps a
  command.
- [Logs, traces and timings](/docs/operations-and-testing/observability) — reading the record
  each command run writes.
