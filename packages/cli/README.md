# @sdxc/cli

Build command-line tools with generated help, prompts bound to flags, tasks and a test harness.

## Installation

```sh
npm add @sdxc/cli
```

Handlers answer a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which installs alongside. Arguments and flags are checked by any [Standard Schema](https://standardschema.dev); the examples use `remix/data-schema` from [`remix`](https://www.npmjs.com/package/remix), whose context keys also type what middleware publishes. It runs on Node and Bun.

## Usage

### A command with an argument and a flag

```typescript
import { argument, command, commands, createCLI, flag, success } from "@sdxc/cli";
import * as s from "remix/data-schema";

let contract = commands({
	greet: command({
		description: "Say hello",
		arguments: { name: argument(s.string()) },
		flags: { shout: flag.boolean("shout", { description: "Use capitals" }) },
	}),
});

let cli = createCLI({ name: "hello", version: "1.0.0", commands: contract });

cli.map(contract.greet, (ctx) => {
	let greeting = `Hello, ${ctx.arguments.name}!`;
	ctx.stdout(`${ctx.flags.shout ? greeting.toUpperCase() : greeting}\n`);
	return success();
});

process.exitCode = await cli.run(process.argv.slice(2));
```

```sh
hello greet Ada --shout   # HELLO, ADA!
hello greet --help        # usage, arguments and flags, generated from contract
hello gret Ada            # Unknown command "gret" for hello; did you mean "greet"?
```

A success exits 0, a failure prints its message and exits 1, `usage("…")` prints the command's help and exits 2, and a cancelled prompt or task exits 130.

### Ask for what the command line left out

A prompt is declared on the flag or argument it fills, so every question can also be answered on the command line.

```typescript
import { argument, command, flag, prompt } from "@sdxc/cli";
import * as s from "remix/data-schema";

let create = command({
	arguments: {
		directory: argument(s.string(), {
			prompt: prompt.text({ message: "Where?", placeholder: "my-app" }),
		}),
	},
	flags: {
		template: flag.string("template", {
			default: "basic",
			prompt: prompt.select({
				message: "Which template?",
				options: ["basic", "full"],
				ask: "always",
			}),
		}),
		git: flag.boolean("git", { prompt: prompt.confirm({ message: "Initialize git?" }) }),
	},
});
```

A value on the command line is never asked for. A missing one is asked when stdin and stderr are terminals; otherwise its `default` applies, and an input with neither is a usage error naming the flag, so a run in CI never waits on a question.

### Show progress while work runs

```typescript
import { isFailure } from "@sdxc/result";

cli.map(contract.sync, async (ctx) => {
	let posts = await ctx.task("Fetching posts", async (task) => {
		let response = await fetch(FEED_URL, { signal: task.signal });
		let list: Post[] = await response.json();
		task.update(`Fetched ${list.length} posts`);
		return list;
	});
	if (isFailure(posts)) return posts; // the task already printed ✗

	return ctx.task("Saving posts", async (task) => {
		task.total(posts.data.length);
		await Promise.all(
			posts.data.map(async (post) => {
				await save(post);
				task.advance();
			}),
		);
	});
});
```

A task answers a `Result`: what the callback returned, or the error it threw. Its final line is ✓ or ✗ with the last label, and the count when it had a total. Ctrl+C aborts `task.signal`.

### Test a command

```typescript
import { invoke } from "@sdxc/cli/test";

let run = await invoke(cli, ["greet", "Ada"]);
run.code; // 0
run.stdout; // "Hello, Ada!\n"
```

## API

### Declaring commands

#### `commands(members)`

A group of commands; groups nest, so `app users find` is `contract.users.find`.

#### `command({ description, arguments, flags, examples })`

One command. Its `arguments` and `flags` type the handler's `ctx.arguments` and `ctx.flags`.

#### `argument(schema, options?)`

A positional value checked by `schema`, with `optional`, `default` or a `prompt`.

#### `argument.variadic(schema, { min?, max? })`

Every remaining value, as an array.

#### `argument.rest()`

Every token after the command's name, unparsed, to hand to another program.

```typescript
command({ arguments: { args: argument.rest() } }); // prog run users --help → ["users", "--help"]
```

#### `flag.boolean(name, options?)`

`--name`, and `--no-name` to turn it off.

#### `flag.string(name, options?)` and `flag.number(name, options?)`

`--name value` or `--name=value`, with `default`, `required`, `short`, `schema` or a `prompt`. Chain `.multiple()` to repeat it, `.list()` for `--env=HOME,PATH`, or `.optionalValue()` to allow a bare `--name`.

#### `prompt.text`, `password`, `number`, `confirm`, `select`, `multiselect`, `search`

What to ask when a flag or argument is missing on a terminal: `prompt.select({ message: "Which?", options: ["a", "b"] })`.

### Running commands

#### `createCLI({ name, version?, commands, middleware? })`

The program. `--help` and `--version` come for free, and `--help --json` prints the same facts as data.

#### `cli.map(command, handler)`

Binds a handler, a `createCommand(...)` or a `lazy(...)` import to a command.

#### `cli.run(argv, io?)`

Runs the command and answers its exit code; `io` replaces the process's `cwd`, `env`, streams or `exec`.

#### `cli.describe(path?)`

The contract as data: every visible command under `path` with its arguments, flags and examples, as `--help --json` prints it.

#### `cli.check(argv)`

Checks a command line without running it: the command, every flag and every value against its schema. A value a prompt would ask for passes. Answers the command's path, or a `UsageError` listing every problem.

```typescript
let checked = await cli.check(["greet", "Ada", "--shuot"]);
if (isFailure(checked)) console.error(checked.error.message); // Unknown flag --shuot …
```

#### `createCommand(command, handler)`

A handler typed from its command, for a module of its own; pass `{ middleware, handler }` for middleware this command alone runs.

#### `lazy(() => import("./command.js"))`

A handler loaded only when its command runs.

### The handler's context

| Member                                                                  | What it is                                                      |
| ----------------------------------------------------------------------- | --------------------------------------------------------------- |
| `ctx.arguments`, `ctx.flags`                                            | The parsed input                                                |
| `ctx.argv`, `ctx.path`                                                  | The raw arguments, and the command's name (`["users", "find"]`) |
| `ctx.cwd`, `ctx.env`, `ctx.signal`                                      | The run's directory, environment, and the signal Ctrl+C aborts  |
| `ctx.stdout(text)`, `ctx.stderr(text)`                                  | Write output                                                    |
| `ctx.stdin`                                                             | `isTTY`, and `text()` for piped input                           |
| `ctx.style`                                                             | Colours, off without a terminal or with `NO_COLOR`              |
| `ctx.prompt.text(…)` and the other kinds                                | Ask from a handler; `default` answers without a terminal        |
| `ctx.task(label?, fn)`                                                  | Run `fn` under a spinner, answering a `Result`                  |
| `ctx.exec(command, options?)`                                           | Run a program without a shell                                   |
| `ctx.get(key)`, `ctx.set(key, value, { property })`, `ctx.require(key)` | Values middleware publishes                                     |
| `ctx.setExecEnv(variables)`                                             | Variables every `ctx.exec` child starts with                    |

### Results

| A handler answers      | The run exits                   |
| ---------------------- | ------------------------------- |
| `success()`            | 0                               |
| `failure(error)`       | 1, printing the error's message |
| `usage(message)`       | 2, printing the command's help  |
| `cancelled()`          | 130                             |
| `exit(code, message?)` | `code`                          |

`UsageError`, `CancelledError`, `ExitError` and `ExecError` are the errors behind them, `EXIT_CODES` holds the codes, and `exitCodeOf(error)` maps an error to its code.

### Testing

#### `invoke(cli, argv, options?)` from `@sdxc/cli/test`

Runs a command without a terminal and answers `{ code, stdout, stderr, exec }`. `options.answers` answers prompts by flag or argument name, `options.exec` replies to commands by their text (`{ "git init": { code: 0 } }`), and `options.stdin` is piped input.

### Other exports

- `spawnExec`: the default `exec`, over `node:child_process`.
- `createStyle(enabled)`: the colours `ctx.style` uses, for output outside a handler.
- Types: `CommandMiddleware<Effect>` (a middleware publishing `Effect`'s `property`), `Task`, `RunIO`, `Exec`, `ExecOptions`, `ExecOutput`, `HandlerContext`, `ChainContext` (the context a helper shared by several commands takes), `ArgumentsOf`, `FlagsOf`.

## Patterns

### Pattern: Publish a database to every command

Middleware runs before each handler and publishes what commands share, typed through a context key.

```typescript
import { DatabaseSync } from "node:sqlite";

import type { CommandMiddleware } from "@sdxc/cli";

import { argument, command, commands, createCLI, failure, success } from "@sdxc/cli";
import * as s from "remix/data-schema";
import { createContextKey } from "remix/router";

let Database = createContextKey<DatabaseSync>();

function database(
	path: string,
): CommandMiddleware<{ key: typeof Database; value: DatabaseSync; property: "db" }> {
	return async (ctx, next) => {
		let db = new DatabaseSync(path);
		ctx.set(Database, db, { property: "db" });
		try {
			await next();
		} finally {
			db.close();
		}
	};
}

let contract = commands({
	users: commands({ find: command({ arguments: { email: argument(s.string()) } }) }),
});

let cli = createCLI({ name: "app", commands: contract, middleware: [database("app.db")] });

cli.map(contract.users.find, (ctx) => {
	let user = ctx.db.prepare("SELECT id, email FROM users WHERE email = ?").get(ctx.arguments.email);
	if (user === undefined) return failure(new Error(`No user with email ${ctx.arguments.email}`));
	ctx.stdout(`${user.id}\t${user.email}\n`);
	return success();
});

process.exitCode = await cli.run(process.argv.slice(2));
```

### Pattern: One module per command

A larger program declares its commands in one module and keeps each handler in its own, loaded only when it runs.

```typescript
// commands.ts
import { command, commands, flag } from "@sdxc/cli";

export let contract = commands({
	deploy: command({ description: "Build and upload", flags: { dryRun: flag.boolean("dry-run") } }),
	logs: command({ description: "Stream the latest logs" }),
});
```

```typescript
// commands/deploy.ts
import { createCommand, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { contract } from "../commands.js";

export default createCommand(contract.deploy, async (ctx) => {
	let built = await ctx.task("Building", () =>
		ctx.exec(["npm", "run", "build"], { stdio: "stderr" }),
	);
	if (isFailure(built)) return built;
	if (ctx.flags.dryRun) return success();
	return ctx.task("Uploading", () => upload({ signal: ctx.signal }));
});
```

```typescript
// main.ts
import { createCLI, lazy } from "@sdxc/cli";

import { contract } from "./commands.js";

let cli = createCLI({ name: "ship", version: "1.0.0", commands: contract });
cli.map(
	contract.deploy,
	lazy(() => import("./commands/deploy.js")),
);
cli.map(
	contract.logs,
	lazy(() => import("./commands/logs.js")),
);

process.exitCode = await cli.run(process.argv.slice(2));
```

### Pattern: Test prompts and child processes together

```typescript
import { invoke } from "@sdxc/cli/test";
import { expect, test } from "vitest";

test("creates a project with git", async () => {
	let run = await invoke(cli, ["create"], {
		answers: { directory: "my-app", template: "basic", git: true },
		exec: { "git init": { code: 0 } },
	});

	expect(run.code).toBe(0);
	expect(run.exec.map((call) => call.command.join(" "))).toEqual(["git init"]);
});

test("needs a directory without a terminal", async () => {
	let run = await invoke(cli, ["create"], { interactive: false });

	expect(run.code).toBe(2);
});
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/cli": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
