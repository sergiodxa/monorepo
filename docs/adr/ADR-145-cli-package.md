# ADR-145: `@sdxc/cli` Package

## Status

**Proposed** - 2026-10-14

## Background

The repo ships two command lines: `spec` (`@sdxc/spec`, ADR suite in `docs/adr/spec/`) and
`sdxc` (ADR-136), whose `create`, `init`, `make`, `ui` and `upgrade` commands (ADR-141–144)
landed together. Each command parses its own arguments, prints its own usage, finds the project
and its configuration, and wraps `child_process.spawn` its own way. This ADR proposes one package
that owns that plumbing, with `sdxc` rebuilt on it first. The requirements below come from the
commands as built, not from a survey of other CLI libraries.

## Context

### What the `sdxc` commands do today

| Command   | Arguments and flags                                                                                                                            | Beyond parsing                                                                                   |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `init`    | none; `--dry-run`                                                                                                                              | project root; writes one file or prints it                                                       |
| `create`  | `<directory>`; `--template <spec>`, `--git` / `--no-git`                                                                                       | a yes/no question on a terminal, `null` without one; spawns `git`; reads `npm_config_user_agent` |
| `make`    | `<kind> <name>` or `stubs [kind...]`; `--test` / `--no-test`, `--cron`, `--method`, `--path`, `--routes`, `--resource`, `--chain`, `--dry-run` | project root and config; per-kind flags; diffs for `--dry-run`; runs the configured `format`     |
| `ui`      | `list`, `add <c...>`, `diff <c>`, `update <c...>`, `remove <c...>`; `--with-deps`, `--force`, `--dry-run`                                      | project root and config; per-subcommand flags; diffs for `--dry-run`; runs `format`              |
| `upgrade` | `[version]`; `--no-install`, `--output <file>`, `--prompt`, `--from <v>`, `--remix-from <v>`                                                   | project root and config; detects the package manager; spawns the install and the new `sdxc`      |

### What is repeated

- **Dispatch.** `run.ts` hands `create`, `make`, `ui` and `upgrade` their raw `argv` before its
  own `parseArgs`, because a single `parseArgs` call rejects every flag it was not told about.
  Each command then calls `parseArgs` again with its own option table.
- **Usage text.** Five hand-written `*_USAGE` strings restate the option tables, and nothing keeps
  the two in step. Each command has its own `usage(io, message)` helper that prints one and
  answers exit code 2.
- **Scoped flags.** `ui` keeps a `FLAGS` table of which subcommand takes which flag, and `make`
  keeps one of which kind takes which flag; both re-check what `parseArgs` already accepted.
  `create` (`--git` / `--no-git`) and `make` (`--test` / `--no-test`) each hand-check that a
  boolean and its negation were not both passed.
- **Project context.** `make`, `ui`, `upgrade` and `init` each call `findProjectRoot(io.cwd)` and
  then `loadConfig(root)`, and print the same failure the same way.
- **Processes.** Four `spawn` wrappers: `format.ts` (inherits stdio), `create/git.ts` (ignores
  it), `upgrade`'s `Exec` (routes stdout to stderr so a piped prompt stays clean) and `testing.ts`
  (collects output). Two package-manager detectors: `create/package-manager.ts` reads the user
  agent, `upgrade/project.ts` reads `packageManager` and lock files.
- **Test seams.** Every command takes a `CommandIO` (`cwd`, `stdout`, `stderr`) plus its own
  options bag: `confirm` for `create`, `exec` for `upgrade`, `packageRoot` for `create`, `ui` and
  `upgrade`. Each test file builds its own `invoke()` that collects both streams.
- **`--dry-run`.** `init`, `make` and `ui` each branch on it; `make` and `ui` print
  `unifiedDiff` output and skip `format`.

### What `spec` adds

`packages/spec/src/cli.ts` (473 lines) uses the same exit codes (0 done, 1 failed, 2 usage) but
its own `Sink` in place of `CommandIO` and a hand-written flag peeler, because it needs flags
`node:util`'s `parseArgs` cannot express: an optional value (`--allow-net` alone grants
everything, `--allow-net=api.example.com` scopes it) and comma lists (`--allow-env=HOME,PATH`).

## Decision

Add `packages/cli`, published as `@sdxc/cli`: command lines declared as a contract and mapped to
handlers, the same split as `remix` route contracts, `@sdxc/jobs` and `@sdxc/mcp`. Rebuild `sdxc`
on it, then `spec`.

### 1. Commands are a contract

```typescript
import * as s from "remix/data-schema";
import { argument, command, commands, flag } from "@sdxc/cli";

export let sdxc = commands({
	init: command({
		description: "Write .config/sdxc.jsonc with every default spelled out",
		flags: { dryRun: flag.boolean("dry-run", { description: "Print it and write nothing" }) },
	}),
	ui: commands({
		description: "Copy @sdxc/ui components into the project",
		add: command({
			description: "Copy components and point imports at the copies",
			arguments: { components: argument.variadic(s.string(), { min: 1 }) },
			flags: {
				withDeps: flag.boolean("with-deps", { description: "Copy what they reach too" }),
				dryRun: flag.boolean("dry-run"),
			},
		}),
	}),
});
```

- `commands({...})` nests: a group's keys are its subcommands, and `sdxc ui add` is
  `sdxc.ui.add`. A group without a mapped handler of its own prints its help.
- A flag belongs to the command that declares it. `--force` on `ui add` is a usage error naming
  the commands that take it; this replaces `ui`'s and `make`'s `FLAGS` tables. `make` becomes a
  group, `make job`, `make controller`, `make stubs`, so each kind declares its own flags.
- Arguments and flag values parse through any Standard Schema, with `remix/data-schema` the
  documented one; the handler's `ctx.arguments` and `ctx.flags` are its
  output types. Every failed argument or flag is reported in one usage error.
- Flag kinds: `flag.boolean` (with `--no-<name>` generated, and passing both is a usage error),
  `flag.string` and `flag.number` (`--name value` and `--name=value`), `.multiple()` for a
  repeated flag, `.list()` for a comma list, and `.optionalValue()` for `spec`'s
  `--allow-net[=hosts]`. `-h`/`--help` and `--` are reserved; a short alias is declared per flag.

### 2. Help is generated

`--help` at any level, and every usage error, prints help rendered from the contract: the usage
line, the subcommands with their descriptions, the arguments, then the flags with their value
names and defaults. Unknown commands suggest the closest declared name. The five `*_USAGE`
strings are deleted.

### 3. A runtime that maps handlers

```typescript
import { createCLI, lazy } from "@sdxc/cli";

let cli = createCLI({ name: "sdxc", version, commands: sdxc, middleware: [project()] });
cli.map(
	sdxc.init,
	lazy(() => import("./commands/init.js")),
);
cli.map(
	sdxc.ui.add,
	lazy(() => import("./commands/ui/add.js")),
);

process.exitCode = await cli.run(process.argv.slice(2));
```

```typescript
import { createCommand, failure, success } from "@sdxc/cli";

export default createCommand(sdxc.ui.add, async (ctx) => {
	ctx.flags.withDeps; // boolean
	ctx.arguments.components; // [string, ...string[]]
	ctx.stdout(`Copied ${ctx.arguments.components.length} components\n`);
	return success();
});
```

- A handler answers a `Result` (`@sdxc/result`): success exits 0, a failure prints its message to
  stderr and exits 1, and a usage failure (`usage("...")`) prints the command's help and exits 2.
  The codes match what both CLIs use today.
- Handlers are loaded through `lazy()`, so `sdxc ui list` imports neither `make` nor `@sdxc/codemod`
  paths it does not run, and `--help` imports no handler.
- Middleware runs before the handler and publishes onto the context, as `remix` middleware does:
  `sdxc` writes one `project()` middleware that finds the root, loads the config and fails the
  run with its message, and handlers read `ctx.root` and `ctx.config`. A command that runs outside
  a project (`create`) is mapped without it.

### 4. The context carries the process

`ctx` holds `cwd`, `env`, `stdout(text)`, `stderr(text)`, `confirm(question)` (answering `null`
when stdin is not a terminal) and `exec(command, options)`: a `spawn` with no shell, whose
`stdio` option takes `"inherit"`, `"ignore"`, `"collect"` or `"stderr"` (child stdout to the
CLI's stderr), answering a `Result` with the exit code and collected output. `cli.run(argv)`
defaults all of them to the process's own; `cli.run(argv, io)` replaces any of them.

### 5. A test harness ships with it

`@sdxc/cli/test` exports `invoke(cli, argv, options)`, answering `{ code, stdout, stderr }`, with
`options` taking `cwd`, `env`, scripted `confirm` answers, and an `exec` that records each command
and answers from a table. It replaces each test file's `invoke()`, `create`'s `confirm` option and
`upgrade`'s `exec` option. Values only the app knows (`sdxc`'s `packageRoot`) reach handlers
through middleware, so a test installs its own the way an app test installs `ctx.db`.

### What stays in `sdxc`

The package owns parsing, help, dispatch, exit codes, the process context and the harness.
`--dry-run`, diffs, running `format`, package-manager detection and project lookup are `sdxc`
behavior: `sdxc` keeps one `packageManager()` module and one `project()` middleware in place of
the duplicates above, and `@sdxc/cli` stays free of anything about JavaScript projects.

## Consequences

### Positive

- **Help cannot drift.** Usage text, flag validation and handler types come from one declaration.
- **Flags scope to commands.** `ui`'s and `make`'s flag tables and the `--x`/`--no-x` checks go
  away, and `make <kind>` gets per-kind help.
- **One way to test a command.** `invoke()` covers stdin, environment and child processes for
  every command, `spec` included.
- **Lazy commands.** Startup imports only the handler that runs.
- **New commands are cheap.** A command is a contract entry, a handler file and one `map` call,
  the shape `sdxc make` already writes for controllers, jobs and MCP tools.

### Negative

- **A migration with no feature in it.** Every `sdxc` command and its tests move, and `spec`'s
  `--allow-*` parsing moves onto `.optionalValue()` and `.list()`.
- **Another package to publish and document**, and `sdxc` gains a dependency.
- **Parsing rules become ours.** Combined short flags (`-xvf`) and abbreviations are left out
  until a command needs them.

### Neutral

- Output stays plain text; nothing in either CLI uses colour or a spinner today.
- `scripts/release/main.ts` and `scripts/upgrade-dependencies.ts` can move later; they are not
  published.

## Alternatives Considered

### 1. Keep `node:util`'s `parseArgs` and share helpers inside `sdxc`

A private `usage()` and option tables per command would trim the repetition in `sdxc`.

**Rejected because**: `parseArgs` has no subcommands, no per-command flags and no optional flag
values, so the dispatch special-casing and `spec`'s peeler stay, and `spec` cannot share a
module that lives inside `sdxc`.

### 2. An existing library (`commander`, `cac`, `citty`, `yargs`)

**Rejected because**: none parses through Standard Schema into typed handlers, none loads
handlers lazily from a contract, and none answers a `Result`; each would sit behind an adapter
as large as the package, and the process context and test harness would still be ours.

### 3. Handlers in the contract

`command({ ..., handler })` in one place is shorter.

**Rejected because**: the contract would import every handler, so `--help` and every command
would load all of them, and a test could not substitute one. Contract and `map` stay separate as
routes, jobs and MCP tools are.

## Implementation Plan

### Phase 1: Package

1. Contract (`commands`, `command`, `argument`, `flag`), parsing and usage errors, with tests for
   every flag kind, `--`, `--no-<name>` and scoped flags.
2. Generated help, closest-name suggestions.
3. `createCLI`, `map`, `lazy`, middleware, `createCommand`, exit codes.
4. Process context (`confirm`, `exec`) and `@sdxc/cli/test`.
5. README, `LICENSE.md`, root README row, docs-site group; bootstrap on npm with its trusted
   publisher; regenerate the `sdxc` export map.

### Phase 2: `sdxc` on `@sdxc/cli`

1. The `sdxc` contract, `project()` middleware and one `packageManager()` module.
2. `init`, `create`, `upgrade`, then `ui`, then `make` as a group, each with its tests on
   `invoke()`; delete `run.ts`'s special cases and the `*_USAGE` strings.
3. `sdxc make` stubs for a new CLI command, so `sdxc` writes its own commands.

### Phase 3: `spec` on `@sdxc/cli`

1. `spec run` with `--allow-*` on `.optionalValue().list()`; delete `peelValueFlag`.

## References

- [ADR-136: `sdxc` Umbrella Package and CLI](./ADR-136-sdxc-umbrella-package-and-cli.md)
- [ADR-141: `sdxc ui` Component Vendoring](./ADR-141-sdxc-ui-component-vendoring.md)
- [ADR-142: `sdxc create` Templates](./ADR-142-sdxc-create-templates.md)
- [ADR-143: `sdxc make` Generators](./ADR-143-sdxc-make-generators.md)
- [ADR-144: `sdxc upgrade`](./ADR-144-sdxc-upgrade.md)
- [Standard Schema](https://standardschema.dev)
- [`node:util` `parseArgs`](https://nodejs.org/api/util.html#utilparseargsconfig)

## Current Progress

- [ ] Phase 1: Package
- [ ] Phase 2: `sdxc` on `@sdxc/cli`
- [ ] Phase 3: `spec` on `@sdxc/cli`
