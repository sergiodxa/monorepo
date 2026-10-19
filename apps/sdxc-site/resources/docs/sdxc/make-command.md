---
title: Make a command
description: Write a command for your app's own command line with sdxc make command, declared in app/commands/index.ts, mapped through lazy() and run with sdxc run.
section:
    title: The sdxc command
    order: 2
order: 2.13
lastUpdated: 2026-10-19
outcomes:
    - "How the name you pass becomes the words you type after `sdxc run`"
    - "What `make command` writes and where it maps the handler"
    - "How to fill in a command's flags and test it"
---

An app command is work you run by hand or from a script, outside any request: seeding, a
backfill, granting a role. `sdxc make command` writes the handler in `app/commands/`, declares it
in `app/commands/index.ts` and maps it on the app's command line, so it runs right away with
[`sdxc run`](/docs/sdxc/run-app-commands):

```bash
sdxc make command users/grant
sdxc run users grant
```

```text
Wrote app/commands/users/grant.ts
Wrote app/commands/users/grant.test.ts
Edited app/commands/index.ts
Edited app/initializers/cli.ts
```

## Flags

| Flag                  | Default      | What it does                                      |
| --------------------- | ------------ | ------------------------------------------------- |
| `--test`, `--no-test` | `make.tests` | write the test beside it, or skip it              |
| `--dry-run`           |              | print the files and the diffs, and change nothing |

## Names are the words you type

Each segment of the name is a word of the command, kept as you spell it in kebab-case:
`users/grant` runs as `sdxc run users grant`, and `users/send-digest` as
`sdxc run users send-digest`. Each folder is a `commands({ … })` group, created when missing and
joined when it exists; a folder whose name is already a command stops the run, since a command
holds no others.

## What it writes

The handler prints its title and succeeds, for you to replace with the work:

```typescript {% title="app/commands/users/grant.ts" %}
import { createCommand, success } from "@sdxc/cli";

import commandset from "~/app/commands";

export default createCommand(commandset.users.grant, (ctx) => {
	// TODO: do the work, then report what changed
	ctx.stdout("Grant\n");
	return success();
});
```

## What it edits

The command is declared with a description, and mapped through `lazy()` on the command line the
initializer creates with `createCLI`, so a run imports only the command it reaches:

```text
--- a/app/commands/index.ts
+++ b/app/commands/index.ts
 	typegen: command({
 		description: "Write the Worker's env types from cloudflare.config.ts",
 	}),
+	users: commands({
+		grant: command({ description: "Grant" }),
+	}),
 });
--- a/app/initializers/cli.ts
+++ b/app/initializers/cli.ts
+cli.map(commandset.users.grant, lazy(() => import("~/app/commands/users/grant")));
```

A word that is no identifier is reached by its quoted key, `commandset.users["send-digest"]`.

## The test

The test runs the command through the app's command line, so its middleware runs as it does for
`sdxc run`:

```typescript {% title="app/commands/users/grant.test.ts" %}
import { invoke } from "@sdxc/cli/test";
import { describe, expect, test } from "vitest";

import { cli } from "~/app/initializers/cli";

describe("users grant", () => {
	test("runs and exits 0", async () => {
		let run = await invoke(cli, ["users", "grant"]);

		expect(run.code).toBe(0);
	});

	test.todo("does the Grant work");
});
```

```bash
bun run test app/commands/users/grant.test.ts
```

## Fill it in

1. Declare the arguments and flags in `app/commands/index.ts`, beside the description, such as
   an `email` argument and a `--role` flag; the handler's `ctx.arguments` and `ctx.flags` take
   their types.
2. Do the work through what the command line publishes: `ctx.db` and `ctx.models` over the local
   database, the mailer, the log.
3. Print what changed with `ctx.stdout`, and return a failure for an exit code other than 0.

[Your app's command line](/docs/operations-and-testing/your-apps-command-line) covers arguments,
flags, prompts and the services a command reads, and [`@sdxc/cli`](/api/cli) the whole API.

## Where to go next

- [Run your app's commands](/docs/sdxc/run-app-commands) — run it from any folder in the project.
- [Make a service](/docs/sdxc/make-service) — the rule a command shares with a controller or a
  job.
- [Generate files](/docs/sdxc/generate-files) — the flags, configuration and stubs every kind
  shares.
