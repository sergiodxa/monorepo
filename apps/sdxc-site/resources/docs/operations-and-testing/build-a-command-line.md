---
title: Build a command line
description: Declare commands as a contract, answer them with typed handlers, ask for what a flag left out, show progress, share services through middleware, and test every command without a terminal.
section:
    title: Operations & testing
    order: 9
order: 8
lastUpdated: 2026-10-25
outcomes:
    - "How to declare commands as a contract and answer them with typed handlers"
    - "How to ask for what a flag left out, show progress and share services through middleware"
    - "How to test every command without a terminal"
---

A command line has the same parts as a router: a table of what it answers, a handler per
entry, middleware that publishes what handlers share, and a way to call it from a test. This
guide builds a small tool for a static site, `site`, that creates posts and publishes them, and
shows each of those parts.

[`@sdxc/cli`](/api/cli) parses arguments and flags, generates the help, asks on a terminal for
what the command line left out, draws progress for long work, and maps exit codes. Handlers
answer a `Result` from [`@sdxc/result`](/api/result), and arguments are checked by any Standard
Schema; the examples use `remix/data-schema`. It runs on Node and Bun.

```bash
npm add @sdxc/cli @sdxc/result remix
```

## Declare the commands

The contract lists every command, its arguments and its flags, and nothing else. Help, usage
errors and each handler's types all come from it:

```typescript {% title="src/commands.ts" %}
import { argument, command, commands, flag, prompt } from "@sdxc/cli";
import * as s from "remix/data-schema";

export const COMMANDS = commands({
	posts: commands({
		description: "Write and publish posts",
		create: command({
			description: "Start a post from a title",
			arguments: {
				title: argument(s.string(), {
					prompt: prompt.text({
						message: "Title?",
						placeholder: "Hello world",
					}),
				}),
			},
			flags: {
				draft: flag.boolean("draft", {
					description: "Keep it out of the published site",
					prompt: prompt.confirm({ message: "Save it as a draft?" }),
				}),
			},
			examples: ['posts create "Hello world" --draft'],
		}),
		publish: command({
			description: "Upload every post that changed",
			tasks: true,
			flags: {
				dryRun: flag.boolean("dry-run", { description: "Upload nothing" }),
			},
		}),
	}),
});
```

Groups nest, so the words typed to reach a command are the path to it:
`site posts create` is `COMMANDS.posts.create`. A flag's key is the name the handler reads and
its first argument the name typed, so `--dry-run` arrives as `ctx.flags.dryRun`.

## Answer them

`createCLI` builds the program from the contract, and `map` binds a handler to a command.
`ctx.arguments` and `ctx.flags` are typed from the declaration, so `title` is a `string` and
`draft` a `boolean`:

```typescript {% title="src/cli.ts" %}
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { createCLI, failure, success } from "@sdxc/cli";
import { isFailure, wrap } from "@sdxc/result";

import { COMMANDS } from "./commands.js";

export const cli = createCLI({ name: "site", version: "1.0.0", commands: COMMANDS });

cli.map(COMMANDS.posts.create, async (ctx) => {
	let slug = ctx.arguments.title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
	let path = join(ctx.cwd, "posts", `${slug}.md`);
	let front = `---\ntitle: ${ctx.arguments.title}\ndraft: ${ctx.flags.draft}\n---\n`;

	let written = await wrap(async () => {
		await mkdir(join(ctx.cwd, "posts"), { recursive: true });
		await writeFile(path, front, { flag: "wx" });
	});
	if (isFailure(written)) {
		return failure(
			new Error(`Could not write ${path}`, { cause: written.error }),
		);
	}

	ctx.stdout(`${path}\n`);
	return success();
});
```

The entry point only runs it, so a test can import the program without starting it:

```typescript {% title="src/main.ts" %}
import { cli } from "./cli.js";

process.exitCode = await cli.run(process.argv.slice(2));
```

`--help` and `--version` come with the program, and a mistyped command is answered with the
closest one. What a handler answers decides the exit code:

| A handler answers      | The run exits                   |
| ---------------------- | ------------------------------- |
| `success()`            | 0                               |
| `failure(error)`       | 1, printing the error's message |
| `usage(message)`       | 2, printing the command's help  |
| `cancelled()`          | 130                             |
| `exit(code, message?)` | `code`                          |

A handler writes through `ctx.stdout` and `ctx.stderr`, and reads its directory and
environment from `ctx.cwd` and `ctx.env` rather than from the process, which is what lets a
test run it anywhere.

## Ask for what the command line left out

The prompts in the contract belong to the argument or flag they fill, so every question can
also be answered on the command line:

```bash
site posts create                       # asks for the title, then whether it is a draft
site posts create "Hello world" --draft # asks nothing
```

A value on the command line is never asked for. A missing one is asked when stdin and stderr
are terminals; otherwise its `default` applies, and one with neither is a usage error naming the
flag. A run in CI or under an agent therefore never waits on a question.

## Show progress

`ctx.task` runs work under a spinner on a terminal and prints one line per task without one.
It answers a `Result`: what the callback returned, or what it threw. The task's last line is a
check mark or a cross with its final label, so a handler that returns a failed task's result
prints nothing more:

```typescript {% title="src/cli.ts" %}
import { listPosts, upload } from "./posts.js";

cli.map(COMMANDS.posts.publish, async (ctx) => {
	let posts = await ctx.task("Reading posts", async (task) => {
		let found = await listPosts(join(ctx.cwd, "posts"));
		task.update(`Found ${found.length} posts`);
		return found;
	});
	if (isFailure(posts)) return posts;
	if (ctx.flags.dryRun) return success();

	return ctx.task("Uploading", async (task) => {
		task.total(posts.data.length);
		for (let post of posts.data) {
			await upload(post, { signal: task.signal });
			task.advance();
		}
	});
});
```

`task.total` turns the spinner into a bar with a count, and `task.advance` moves it. Ctrl+C
aborts `task.signal`, so pass it to whatever the task waits on. `listPosts` and `upload` are
your own.

## Share services through middleware

Middleware runs before every handler, and publishes what commands share under a context key,
the way a router's middleware publishes `ctx.db`. `ctx.set` with a `property` also installs the
value under that name, and `CommandMiddleware` carries its type to every handler:

```typescript {% title="src/middleware/config.ts" %}
import type { CommandMiddleware } from "@sdxc/cli";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { failure } from "@sdxc/cli";
import { isFailure, wrap } from "@sdxc/result";
import { createContextKey } from "remix/router";

export interface SiteConfig {
	bucket: string;
}

export const Config = createContextKey<SiteConfig>();

export function config(): CommandMiddleware<{
	key: typeof Config;
	value: SiteConfig;
	property: "config";
}> {
	return async (ctx, next) => {
		let text = await wrap(() => readFile(join(ctx.cwd, "site.json"), "utf8"));
		if (isFailure(text)) return failure(new Error("Run this inside a site"));
		ctx.set(Config, JSON.parse(text.data), { property: "config" });
		await next();
	};
}
```

```typescript {% title="src/cli.ts" %}
export const cli = createCLI({
	name: "site",
	version: "1.0.0",
	commands: COMMANDS,
	middleware: [config()],
});
```

Every handler now reads `ctx.config.bucket`. A middleware that returns a failure ends the run
there, and code after `await next()` runs once the handler settles, which is where a connection
closes.

## Test a command

`invoke` from `@sdxc/cli/test` runs a command without a terminal and answers its exit code and
what it printed. `answers` answers the prompts by the flag or argument they fill, and `cwd` and
`env` are the whole world the run sees:

```typescript {% title="src/commands/posts/create.test.ts" %}
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { invoke } from "@sdxc/cli/test";
import { expect, test } from "vitest";

import { cli } from "../../cli.js";

test("asks for the title and writes the post", async () => {
	let cwd = await mkdtemp(join(tmpdir(), "site-"));
	let run = await invoke(cli, ["posts", "create"], {
		cwd,
		answers: { title: "Hello world", draft: true },
	});

	expect(run.code).toBe(0);
	let post = await readFile(join(cwd, "posts", "hello-world.md"), "utf8");
	expect(post).toContain("draft: true");
});

test("needs a title without a terminal", async () => {
	let run = await invoke(cli, ["posts", "create"], { interactive: false });

	expect(run.code).toBe(2);
});
```

A prompt the test left unanswered fails the run and names itself, so nothing waits on a
question.

## Where to go next

- [Your app's command line](/docs/operations-and-testing/your-apps-command-line) — commands
  inside your Remix app, with its database, models, jobs and mailer.
- [Read configuration files](/docs/operations-and-testing/configuration-files) — a config file
  with comments and errors that point at the line.
- [`@sdxc/cli`](/api/cli) — every flag option, prompt kind and context member.
