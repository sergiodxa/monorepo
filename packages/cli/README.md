# @sdxc/cli

Build command-line tools with generated help, prompts bound to flags, tasks and a test harness.

## Installation

```sh
npm add @sdxc/cli
```

Handlers answer a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which installs alongside this package. Arguments and flags are checked by any [Standard Schema](https://standardschema.dev); the examples use [`remix/data-schema`](https://www.npmjs.com/package/remix). It runs on Node and Bun.

## Usage

### Declare the commands, then map handlers onto them

The contract says what each command takes; handlers live in their own modules and load only when their command runs.

```typescript
import { argument, command, commands, flag, prompt } from "@sdxc/cli";
import * as s from "remix/data-schema";

export let contract = commands({
	ui: commands({
		description: "Copy components into the project",
		add: command({
			description: "Copy components and point imports at the copies",
			arguments: {
				components: argument.variadic(s.string(), {
					min: 1,
					prompt: prompt.search({ message: "Add which?", options: COMPONENTS, multiple: true }),
				}),
			},
			flags: {
				withDeps: flag.boolean("with-deps", { description: "Copy what they reach too" }),
				allowNet: flag.string("allow-net").optionalValue().list(),
			},
		}),
	}),
});
```

```typescript
import { createCLI, lazy } from "@sdxc/cli";

let cli = createCLI({ name: "acme", version: "2026.10.15", commands: contract });
cli.map(
	contract.ui.add,
	lazy(() => import("./commands/ui/add.js")),
);

process.exitCode = await cli.run(process.argv.slice(2));
```

```typescript
import { createCommand, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

export default createCommand(contract.ui.add, async (ctx) => {
	ctx.arguments.components; // [string, ...string[]]
	let copied = await ctx.task("Copying components", async (task) => {
		task.total(ctx.arguments.components.length);
		for (let name of ctx.arguments.components) {
			await copy(name, { signal: task.signal });
			task.advance();
		}
	});
	if (isFailure(copied)) return copied; // the task already printed ✗
	return success();
});
```

`--help` works at every level, every usage error prints the command's help, and a mistyped command or flag suggests the closest name. A success exits 0, a failure prints its message and exits 1, `usage("…")` exits 2 and a cancelled prompt or task exits 130.

A prompt bound to a flag or argument asks only when the command line left it out and stdin and stderr are terminals; otherwise its `default` applies, and an input with neither is a usage error, so a run in CI never waits on a question.

### Test a command

```typescript
import { invoke } from "@sdxc/cli/test";

let run = await invoke(cli, ["ui", "add"], {
	answers: { components: ["button"] },
	exec: { "npm install": { code: 0 } },
});
run.code; // 0
run.stderr; // "✓ Add which? button\n…"
```

`tty: { columns }` with `keys: ["down", "space", "enter"]` draws prompts on a virtual terminal instead, answering the screen after each key in `run.screens`.

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
