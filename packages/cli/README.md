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

### `commands(definition: GroupDefinition): Group`

A group of commands keyed by name, with an optional `description` and `hidden`; groups nest, so `app users find` is `contract.users.find`. A group may declare its own `arguments`, `flags` and `tasks`, read by a handler mapped onto the group when no member is named: `app make` with a `kind` argument whose prompt asks which member to run. A flag written before a member's name moves to that member.

### `command(definition: CommandDefinition): Command`

One command: `description`, `arguments`, `flags`, `examples` for its help, `hidden`, and `tasks: true` when its handler runs `ctx.task`, which lists `--no-progress` in its help. Its arguments and flags type the handler's `ctx.arguments` and `ctx.flags`.

### `argument(schema: StandardSchemaV1, options?: SingleArgumentOptions): Argument`

A positional argument parsed through `schema`; `options` take `optional`, `default`, `prompt`, `description` and `valueName`. Arguments are read in declaration order.

### `argument.variadic(schema: StandardSchemaV1, options?: VariadicArgumentOptions): Argument`

The remaining positionals as an array, with `min`, `max` and `default`; `min: 1` types the value as a non-empty tuple.

### `argument.rest(options?: RestArgumentOptions): Argument<string[]>`

Every token after the command's name exactly as typed, flags and `--help` included, for a command that runs another program with them. It is the command's only argument and the command declares no flags; `options` take `description` and `valueName`.

```typescript
let run = command({ arguments: { args: argument.rest() } });
// prog run users find --limit 5  →  ctx.arguments.args: ["users", "find", "--limit", "5"]
```

### `flag.boolean(name: string, options?: BooleanFlagOptions): Flag<boolean>`

`--name` and the generated `--no-name`; passing both is a usage error. With `default: undefined` the flag is `boolean | undefined`, unset when neither is passed, so a configuration or a later question decides; the help shows `--[no-]name`.

### `flag.string(name: string, options?: ValueFlagOptions): ValueFlag<string>` and `flag.number(name, options?)`

A flag with a value, as `--name value` or `--name=value`, checked by `options.schema` when given. `options` also take `default`, `required`, `prompt`, `short` (`-n`), `aliases`, `valueName`, `description` and `hidden`. Every flag kind takes `heading`, the help section it is listed under: `{ heading: "Permissions" }`.

- `.multiple()`: the flag may repeat, and its value is an array.
- `.list()`: a comma list, `--env=HOME,PATH`.
- `.optionalValue()`: the flag may stand alone, `--allow-net` or `--allow-net=api.example.com`; alone it is `true`.

A flag belongs to the command that declares it: passing it to another command is a usage error naming the commands that take it, and the value written after it is read as its value. A value that fails is reported under the name typed (`--jobs`, not `--concurrency`), and an empty `--name=` is the same usage error as a missing value.

### `prompt.text | password | number | confirm | select | multiselect | search(options)`

A prompt declaration for a flag's or an argument's `prompt`. Every kind takes `message` and `ask` (`"missing"`, the default, or `"always"` to show it even when a `default` exists); list kinds take `options` as values or `{ value, label, hint, disabled }`. `password` takes `mask`, `number` takes `min`, `max` and `step`, `confirm` takes `active` and `inactive` (the words for yes and no), `multiselect` and `search` take `min` and `max`, and `search` takes `multiple`. A failed schema check keeps the prompt open with the issue under it.

### `createCLI(options: CLIOptions): CLI`

A program from `name`, `version`, `description`, `commands` and `middleware`, the chain that runs before every handler. `--help`, `--no-progress` and, with a `version`, `--version` are reserved.

#### `cli.map(target: Command | Group, binding)`

Binds a handler, a `createCommand(...)` action or a `lazy(...)` import to a declared command. A mapped group runs when no member is named; an unmapped one prints its help.

#### `cli.run(argv: readonly string[], io?: RunIO): Promise<number>`

Runs the command `argv` names and answers its exit code. `io` replaces any of `cwd`, `env`, `stdin`, `stdout`, `stderr`, `exec` and `signal`, which default to the process's own.

### `createCommand(target, handler | { middleware, handler }): CommandAction`

A handler typed from its command, for a module of its own; `middleware` runs before this command alone.

### `lazy(load: () => Promise<{ default: CommandAction }>): Lazy`

A handler loaded when its command runs, so `--help` and other commands import nothing of it.

### `CommandContext`

What a handler receives.

- `arguments`, `flags`: the parsed input.
- `argv`: the arguments the run was given, before parsing, for logging a run or starting it again.
- `path`: the command's name as typed, `["users", "find"]`.
- `cwd`, `env`, `signal`: the run's directory, environment, and the signal Ctrl+C aborts.
- `stdout(text)`, `stderr(text)`: write output; a running task redraws around them.
- `style`: colours for stdout, and `style.stderr` for stderr, off without a terminal or with `NO_COLOR`.
- `prompt.text | password | number | confirm | select | multiselect | search(options)`: ask from a handler. Each takes a `default` used without a terminal, `initial` when a terminal should start elsewhere (`default: false, initial: true` answers no in CI and yes on Enter), plus `name` for scripted answers and `schema`. A list prompt's value type comes from its `options`.
- `task(label?, fn)`: runs `fn` under a spinner and answers a `Result`; `fn` receives a `Task`.
- `exec(command, options?)`: runs a program with no shell. `options.stdio` is `"inherit"`, `"ignore"`, `"collect"` or `"stderr"` (its stdout to the CLI's stderr), and `"inherit"` and `"stderr"` pause any spinner. Answers the exit code and collected output, or an `ExecError`.
- `stdin`: `isTTY`, and `text()`, which reads everything piped in (`cat query.sql | app db`).
- `setExecEnv(variables)`: adds variables every child `exec` starts with, under each call's own `options.env`, for a middleware that hands children what it knows.
- `get(key)`, `has(key)`, `set(key, value, { property }?)`: read and publish values under context keys; `property` installs the value as `ctx.<property>`.
- `require(key)`: `get` for a value an earlier middleware must have published; a missing one fails the run naming the command.

### `success(data?)`, `failure(error)`, `usage(message)`, `cancelled()`, `exit(code, message?)`

What a handler or middleware answers: `failure` exits 1 with the error's message, `usage` exits 2 with the command's help, `cancelled` exits 130, and `exit` exits with `code`, printing `message` when given. `exitCodeOf(error)` answers the code a failure exits with.

### `UsageError`, `CancelledError`, `ExitError`, `ExecError`, `EXIT_CODES`

The errors behind those results, and the codes `{ success: 0, failure: 1, usage: 2, cancelled: 130 }`. An `ExecError` carries the `command`, its `code` and its output.

### `spawnExec`

The default `Exec`, spawning with `node:child_process`; replace it through `RunIO.exec`.

### `createStyle(enabled: boolean): Style`

The colour functions `ctx.style` uses, for output written outside a handler.

### `invoke(cli, argv, options?): Promise<Invocation>` from `./test`

Runs `argv` and answers `{ code, stdout, stderr, exec, screens }`.

- `options.cwd`, `options.env`: the run's directory and environment.
- `options.answers`: prompt answers keyed by the flag or argument they fill, or an array answered in order; a prompt with no answer fails the run naming it.
- `options.exec`: replies keyed by command (`{ "git init": { code: 0 } }`), recorded in `exec`; an unlisted command fails naming itself. Or an `Exec` function.
- `options.interactive: false`: applies the no-terminal rules instead of the answers.
- `options.stdin`: text piped into the run, read by `ctx.stdin.text()`; it makes `interactive` default to `false`.
- `options.tty` and `options.keys`: draw prompts on a virtual terminal (`{ columns: 80 }`) and press `keys` (`"down"`, `"space"`, `"enter"`, …), collecting each screen in `screens`.

Without a terminal, task lines carry no durations, so output compares exactly.

### Types

#### `CommandMiddleware<Effect>`

`(ctx, next) => void | CommandResult`. `next()` resolves to what the rest of the chain answered, so a middleware can log the outcome. A middleware that answers a failure ends the run; `Effect` (`{ key, value, property }`) names what it publishes, so the handler's `ctx` gains that property, typed. A middleware publishing several values declares a union of effects, one per property.

A middleware's own `ctx` is `AnyCommandContext`, without the properties earlier middleware installed, since one middleware can run in many chains. It reads them with `ctx.require(Key)`; a package whose middleware is always installed may instead augment `CommandContext` with its property.

#### `Task`

A task's `signal`, `update(label)`, `total(count)` and `advance(by = 1)`.

#### `RunIO`, `Exec`, `ExecOptions`, `ExecOutput`, `Stdio`

What `cli.run` and `ctx.exec` take and answer.

#### `HandlerContext<Target, Chain>`, `ArgumentsOf<Target>`, `FlagsOf<Target>`

The context, arguments and flags a command's handler receives, for typing helpers.

#### `ChainContext<Chain>`

The context of any command behind `Chain`, whatever it parsed, for a helper several commands share:

```typescript
const MIDDLEWARE = [database("app.db")] as const;
function findUser(ctx: ChainContext<typeof MIDDLEWARE>, email: string) {
	return ctx.db.prepare("SELECT id FROM users WHERE email = ?").get(email);
}
```

## Patterns

### Pattern: Publish a database to every command

Middleware runs before each handler and publishes what commands share, typed through a context key.

```typescript
import { argument, command, commands, createCLI, failure, success } from "@sdxc/cli";
import type { CommandMiddleware } from "@sdxc/cli";
import { DatabaseSync } from "node:sqlite";
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
