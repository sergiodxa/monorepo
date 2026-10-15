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

`ctx` holds `cwd`, `env`, `stdout(text)`, `stderr(text)`, `prompt` (section 5), `spinner` and
`task` (section 6), `style` (section 6) and `exec(command, options)`: a `spawn` with no shell,
whose `stdio` option takes `"inherit"`, `"ignore"`, `"collect"` or `"stderr"` (child stdout to the
CLI's stderr), answering a `Result` with the exit code and collected output. `cli.run(argv)`
defaults all of them to the process's own; `cli.run(argv, io)` replaces any of them.

### 5. Prompts

Seven prompt kinds, each answering through the same schema as the flag or argument it fills:

| Prompt               | Answers      | Keys                                                                   |
| -------------------- | ------------ | ---------------------------------------------------------------------- |
| `prompt.text`        | `string`     | line editing, `placeholder`, `default` shown dimmed and taken on Enter |
| `prompt.password`    | `string`     | echoes `•` per character, or nothing with `mask: false`                |
| `prompt.number`      | `number`     | digits, `-`, `.`; arrows step by `step` within `min`/`max`             |
| `prompt.confirm`     | `boolean`    | `y`/`n`, arrows, Enter takes `default`                                 |
| `prompt.select`      | one value    | arrows, Home/End, type to jump; options carry a `hint` and `disabled`  |
| `prompt.multiselect` | `T[]`        | Space toggles, `a` toggles all, `min`/`max` enforced on Enter          |
| `prompt.search`      | one or `T[]` | typing filters the options, for lists too long to scroll (`ui add`)    |

A failed schema check keeps the prompt open with the issue under it, so a wrong answer is fixed in
place instead of failing the run.

**Prompts are declared on flags and arguments.** A question the user can be asked is one a script
can answer, so the contract binds each prompt to the input it fills:

```typescript
create: command({
	arguments: {
		directory: argument(s.string(), {
			prompt: prompt.text({ message: "Where should the project go?", placeholder: "my-app" }),
		}),
	},
	flags: {
		template: flag.string("template", {
			default: "app",
			prompt: prompt.select({ message: "Which template?", options: TEMPLATES }),
		}),
		git: flag.boolean("git", { prompt: prompt.confirm({ message: "Initialize git?" }) }),
	},
}),
```

- A value passed on the command line is never asked for. A missing one is asked for when stdin
  and stderr are terminals; otherwise the declared `default` applies, and an input with neither is
  a usage error naming its flag (`--template is required when stdin is not a terminal`). A run in
  CI or under an agent therefore never blocks on a question.
- `ask: "always"` asks even when a `default` exists (the `default` is preselected), for choices
  the user should see; the flag still skips it.
- `ctx.prompt.*` is also callable from a handler for questions that depend on earlier work (which
  of the files `update` found edited to overwrite). Each call takes a `default` used without a
  terminal, so the handler stays runnable non-interactively.
- Ctrl+C or Escape cancels: the prompt answers a `cancelled` failure, the terminal is restored,
  and an unhandled one exits 130 with nothing written.
- Prompts render on stderr, so `sdxc upgrade --prompt | pbcopy` stays clean, and are erased once
  answered, leaving one summary line (`✓ Which template? app`).

### 6. Progress and styling

```typescript
let spinner = ctx.spinner("Downloading sergiodxa/starter");
spinner.update("Extracting 128 files");
spinner.succeed("Downloaded sergiodxa/starter"); // or .fail(message), .stop()

let installed = await ctx.task("Installing dependencies", () =>
	ctx.exec(manager.install, { stdio: "stderr" }),
); // spinner while it runs, ✓ or ✗ line with the duration after
```

- `ctx.spinner(label)` animates on stderr. `ctx.task(label, fn)` runs a `Result`-returning
  function under a spinner and ends it with `succeed` or `fail` from the result, so a handler
  rarely drives a spinner by hand.
- `ctx.progress({ label, total })` draws a bar with a count (`advance(n)`), for work with a known
  size: files copied by `ui add`, entries read from a changelog.
- The terminal has one owner at a time. Writing through `ctx.stdout`/`ctx.stderr` while a spinner
  runs clears its line, writes, and redraws it; `ctx.exec` with `"inherit"` or `"stderr"` pauses
  the spinner and resumes it when the child exits, so child output is never interleaved with
  frames.
- Without a terminal on stderr, or with `CI`, `TERM=dumb` or `--no-progress`, nothing animates: a
  spinner prints its label once and its final line once, and a bar prints only its final count.
- `ctx.style` colours and weights text (`style.bold`, `style.dim`, `style.green`, …), off when the
  stream is not a terminal or `NO_COLOR` is set and forced on by `FORCE_COLOR`. Help output uses
  it for headings and flag names.
- Exiting for any reason, a signal included, shows the cursor again and leaves raw mode.

### 7. A test harness ships with it

`@sdxc/cli/test` exports `invoke(cli, argv, options)`, answering `{ code, stdout, stderr }`, with
`options` taking `cwd`, `env`, and an `exec` that records each command and answers from a table.
It replaces each test file's `invoke()`, `create`'s `confirm` option and `upgrade`'s `exec`
option. Values only the app knows (`sdxc`'s `packageRoot`) reach handlers through middleware, so a
test installs its own the way an app test installs `ctx.db`.

- **Answers.** `answers: { template: "app", git: false }` answers prompts by the flag or argument
  they fill, and `answers: ["a", true]` answers handler-called prompts in order. A prompt with no
  scripted answer fails the test naming it, so a new question never passes silently on its
  default.
- **Rendering.** By default `invoke` renders as a non-terminal, so `stderr` holds each spinner's
  label and final line and nothing time-dependent. `tty: { columns: 80 }` with
  `keys: ["down", "space", "enter"]` drives the real renderer through a virtual terminal and
  answers the screen after each key, for testing a prompt's own drawing.

### 8. Apps ship their own command line

An app gets a `bootstrap/cli.ts` beside `bootstrap/worker.ts`, the way a Laravel app has
`artisan`: commands that import the app itself, its models, services and initializers, for work
that belongs to the app but to no request (seeding, backfills, granting a role, replaying a
job).

```typescript
// app/commands/index.ts
export let commandset = commands({
	users: commands({
		grant: command({
			description: "Grant a role to a user",
			arguments: { email: argument(s.string()) },
			flags: { role: flag.string("role", { prompt: prompt.select({ options: ROLES }) }) },
		}),
	}),
});

// app/commands/users/grant.ts
export default createCommand(commandset.users.grant, async (ctx) => {
	let user = await ctx.db.find(users, { email: ctx.arguments.email });
	...
});

// bootstrap/cli.ts
export default createCLI({ name: "app", commands: commandset, middleware: [database()] });
```

- The layout gains one row: a command line command goes in `app/commands/`, declared in
  `app/commands/index.ts` with one handler file per command, laid out like `app/mcp/`, and
  `bootstrap/cli.ts` maps each through `lazy()`. `sdxc make command users/grant` writes the
  handler, its test, the declaration and the mapping, as it does for jobs and tools.
- **The commands run in the `sdxc` process, against the app's real data.** `sdxc run <command>`
  loads `bootstrap/cli.ts` in Node or Bun and answers `cloudflare:workers` with an `env` built
  from the app's `cloudflare.config.ts`, so app code, `@sdxc/data-table-d1` and every
  initializer run unchanged. Each D1 binding is a `D1Database` backed by a SQL client:
  - **Local (the default):** the SQLite file Miniflare persists for that binding under
    `.wrangler/state`, opened through the D1 implementation `@sdxc/cloudflare-mocks` already runs
    tests on, so a command sees and changes exactly what `bun dev` serves. SQLite's write-ahead log
    lets it run beside a dev server.
  - **`--remote`:** the D1 HTTP API (`/accounts/<account>/d1/database/<id>/query`), authenticated
    with `CLOUDFLARE_API_TOKEN`, for a backfill or a support fix against production.
  - Secrets come from `.dev.vars` locally and from the shell's environment with `--remote`; a
    secret a command reads and neither supplies is a failure naming it.
  - KV and R2 follow the same split (Miniflare's local files, the REST API remotely) once a
    command needs them. A binding with no client from outside the runtime (Durable Object storage,
    queues, service bindings) is a failure naming the binding, and a command that needs one calls
    the deployed Worker over HTTP instead.
- **A SQL shell comes with it.** `sdxc db [binding]` opens an interactive SQL prompt on the same
  client, local or `--remote`, and `sdxc db --execute "SELECT …"` prints one query's rows, so
  inspecting a database needs neither `wrangler d1 execute` nor a separate tool.
- The same middleware an app's router uses publishes its services, so a command reads `ctx.db`
  exactly as a controller does, and the app's own test setup installs a test database for
  `invoke()`.
- A command never ships in the deployed Worker: `bootstrap/worker.ts` does not import
  `bootstrap/cli.ts`, and the build's entry is the worker.
- `--remote` prints the account and database it targets and asks for confirmation before the
  command runs, with `--yes` to skip it in scripts.

### Where `sdxc` uses them

| Command   | Prompts                                                                                                                                                                                          | Progress                                                      |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `create`  | `directory` (text), `--template` (select of built-ins, `ask: "always"`), `--git` (confirm); a GitHub token (password) after a 401/404 when no `GITHUB_TOKEN` is set, used for that download only | download and extraction (task), install (task)                |
| `make`    | `<kind>` (select) and `<name>` (text) when missing, `--method` (select) for a controller                                                                                                         | none; it writes a few files                                   |
| `ui`      | `add` with no names (search, multiple), `remove` with no names (multiselect of copies), `update` asking per edited file whether to overwrite                                                     | files copied (bar), `format` (task)                           |
| `upgrade` | confirm before bumping across a breaking release, `default: true` without a terminal                                                                                                             | registry lookup (task), install (task with `"stderr"` output) |
| `init`    | none                                                                                                                                                                                             | none                                                          |

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
- **Interactive and scriptable at once.** Every prompt is a flag, so a person is guided through
  `sdxc create` and an agent or CI job runs it in one line with no question left to block on.
- **Long steps show they are alive.** Downloads and installs run under a spinner that never
  garbles the child's own output.
- **Apps get a command line.** One-off work against an app's data is a typed, tested command
  that imports the app, run locally or with `--remote`, instead of a hand-written SQL file passed
  to `wrangler d1 execute`.
- **Lazy commands.** Startup imports only the handler that runs.
- **New commands are cheap.** A command is a contract entry, a handler file and one `map` call,
  the shape `sdxc make` already writes for controllers, jobs and MCP tools.

### Negative

- **A migration with no feature in it.** Every `sdxc` command and its tests move, and `spec`'s
  `--allow-*` parsing moves onto `.optionalValue()` and `.list()`.
- **Another package to publish and document**, and `sdxc` gains a dependency.
- **Parsing rules become ours.** Combined short flags (`-xvf`) and abbreviations are left out
  until a command needs them.
- **Terminal rendering becomes ours.** Raw-mode key reading, redrawing, wide characters and
  Windows consoles are a lasting maintenance surface; the virtual-terminal harness is what keeps
  it honest.
- **A test package runs outside tests.** Local D1 reuses `@sdxc/cloudflare-mocks`' SQLite D1,
  so that implementation becomes part of what `sdxc run` depends on, and the remote client is a
  second `D1Database` the repo maintains against Cloudflare's HTTP API.
- **Only D1 at first.** App commands that touch KV, R2 or Durable Objects wait for their clients
  or go through the deployed Worker.

### Neutral

- Every prompt and every frame goes to stderr; stdout carries only a command's output.
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

### 3. A prompt library (`@clack/prompts`, `inquirer`) and a spinner library (`ora`)

**Rejected because**: each owns stdin and stderr on its own, so a spinner cannot pause for
`ctx.exec`, a prompt cannot be answered from a flag or a harness script, and cancellation arrives
as each library's own sentinel rather than a `Result`. The layer that binds prompts to flags and
shares the terminal is most of the work; the drawing under it is a few hundred lines on
`node:readline`'s keypress events, which run on Node and Bun alike.

### 4. App commands inside workerd

Start the app's Worker locally and run the command inside it, forwarding argv, output, prompts
and the exit code over a message channel.

**Rejected because**: every terminal feature would cross a process boundary, a remote run would
need Cloudflare's remote-binding proxy in place of a documented HTTP API, and a SQL client in the
`sdxc` process reaches the same local file and the same remote database with none of that.

### 5. Handlers in the contract

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
4. Process context (`exec`, `style`) and `@sdxc/cli/test` with scripted answers.
5. Prompts: the seven kinds, binding to flags and arguments, the non-terminal rules,
   cancellation, and the virtual-terminal harness with a test per kind.
6. `spinner`, `task`, `progress`, terminal ownership with `exec` and writes, and the
   non-animated fallback.
7. README, `LICENSE.md`, root README row, docs-site group; bootstrap on npm with its trusted
   publisher; regenerate the `sdxc` export map.

### Phase 2: `sdxc` on `@sdxc/cli`

1. The `sdxc` contract, `project()` middleware and one `packageManager()` module.
2. `init`, `create`, `upgrade`, then `ui`, then `make` as a group, each with its tests on
   `invoke()`; delete `run.ts`'s special cases and the `*_USAGE` strings.
3. The prompts and progress in "Where `sdxc` uses them", each covered by an `invoke()` test with
   answers and one without a terminal.

### Phase 3: `spec` on `@sdxc/cli`

1. `spec run` with `--allow-*` on `.optionalValue().list()`; delete `peelValueFlag`.

### Phase 4: App command lines

1. The `env` built from `cloudflare.config.ts`: local D1 on Miniflare's files, `--remote` D1 on
   the HTTP API, secrets from `.dev.vars` or the shell, and failures naming an unsupported
   binding; a spike first runs an app's own `Database` initializer both ways.
2. `sdxc run`, the `app/commands/` row in the app layout rules, and `bootstrap/cli.ts` and
   `app/commands/index.ts` in the `app` template.
3. `sdxc make command`, declaring and mapping like `make job`, verified against the materialized
   template.
4. `sdxc db`, with the interactive prompt and `--execute`.

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
- [ ] Phase 4: App command lines
