# @pkg/spec

The executable specification runtime: a small Given/When/Then language for
behavioral suites, run under deny-by-default permissions in isolated per-test
workspaces.

## Overview

Specifications written as prose drift away from the behavior they describe.
This package makes them executable: a suite is a directory of `.spec` files
written in a deliberately tiny language — no `if`, no loops, no operators —
whose tests declare setup (`given`), action (`when`), and verification
(`then`) as linear, diffable statements. The `spec` CLI loads the suite, runs
every test in its own freshly created temporary workspace, and reports
structured results with exact file-and-line attribution. The language is
defined normatively in [GRAMMAR.md](./GRAMMAR.md); the system it implements
was designed by
[ADR-001](../../docs/adr/spec/ADR-001-executable-specification-language.md)
through
[ADR-008](../../docs/adr/spec/ADR-008-environments-and-compatibility.md) and
scoped for v1 by
[ADR-009](../../docs/adr/spec/ADR-009-v1-typescript-implementation.md).

Two architectural decisions shape everything here. First, capability comes
from exactly one seam: the typed-tool `Plugin` interface. The built-in `fs`,
`cli`, and `http` capabilities, external processes speaking the
NDJSON-over-stdio transport, and in-process test fakes all implement it, and
the executor never knows which kind it is talking to. Second, permissions are
denied by default and enforced centrally: a spec that spawns a process,
touches the network, reads an environment variable, or leaves its workspace
needs an explicit `--allow-*` grant, and every denial names the exact flag
that would grant it. Plugin self-restraint is never load-bearing.

Every fallible function returns a [`Result`](/packages/result) — parse
errors, permission denials, and tool failures are values, never throws. Test
failures are outcomes, not errors: the CLI exits 0 when everything passed, 1
when a test failed, and 2 for usage or load errors.

## Usage

### Running a suite from the CLI

A suite is a directory (conventionally `spec/`) scanned recursively for
`.spec` files. Given `spec/build.spec`:

```
use fs
use cli

test "the script prints its greeting" {
	given {
		write "index.js" "console.log(\"hello from the workspace\")"
	}
	when {
		let result = run "bun" "index.js"
	}
	then {
		expect result.exit_code 0
		expect result.stdout "hello from the workspace\n"
	}
}

test "the generated config is on disk" {
	given {
		write "package.json" { name: "demo", type: "module" }
	}
	then {
		expect file "package.json" contains "\"type\": \"module\""
	}
}
```

Each test runs in its own temporary directory: `write` creates files there,
`run` starts child processes there, and the two tests never see each other's
files. Spawning `bun` needs a process grant, so run the suite with exactly
that:

```sh
spec run spec --allow-run=bun
```

The package declares `spec` as its binary; inside this repository you can
equivalently invoke `bun packages/spec/src/cli.ts run spec --allow-run=bun`.
Expected output (exit code 0):

```
✓ the script prints its greeting
✓ the generated config is on disk

2 passed, 0 failed (16ms)
```

Without the grant, that test fails before `bun` is ever spawned. Every test
denied for the same missing grant is collected into one block that names the
flag to add and lists the tests it affected (exit code 1):

```
✓ the generated config is on disk

✗ Permission denied: run (1 test)

  The spec attempted to reach:
  > cli.run

  Re-run with an appropriate permission, for example:
  > spec run --allow-run

  Affected tests:
  - the script prints its greeting (spec/build.spec:9)

1 passed, 1 failed (2ms)
```

### Running a suite programmatically

`runSuite` is the same pipeline the CLI drives: load, resolve, execute each
test in a fresh workspace, and return structured results.

```typescript
import { isFailure } from "@pkg/result";
import { parseGrants, reportFatal, reportSuite, runSuite } from "@pkg/spec";
import type { Sink, SourceFile } from "@pkg/spec";

let sink: Sink = { write: (text) => void process.stdout.write(text) };

let parsed = parseGrants(["--allow-run=bun"]);
if (isFailure(parsed)) {
	reportFatal(parsed.error, sink);
	process.exit(2);
}

let run = await runSuite({ root: "spec", grants: parsed.data.grants });
if (isFailure(run)) {
	// The suite never started: unreadable directory, a parse error, or a
	// duplicate definition.
	reportFatal(run.error, sink);
	process.exit(2);
}

for (let result of run.data.results) {
	// result.title, result.file, result.status, result.durationMs, and
	// result.error (a structured SpecError) when the test failed.
}

let sources = new Map<string, SourceFile>();
reportSuite(run.data, sources, sink);
process.exit(run.data.failed > 0 ? 1 : 0);
```

`reportSuite` renders human output through the `Sink`; the `sources` map
(file path to `SourceFile`) lets it turn error spans into `file:line`
locations, and failures degrade to the bare file path for files it does not
contain.

## API

### `runSuite(options: RunOptions): Promise<Result<SuiteResult, SpecError>>`

Load and execute a whole suite. Load failures fail the run before any test
starts; test failures do not — they are outcomes inside the returned
`SuiteResult`. Every test gets a fresh isolated workspace that is cleaned up
when the test ends.

**Parameters:**

- `options.root`: Directory scanned recursively for `.spec` files.
- `options.grants`: The caller's permission grants (see `parseGrants`).
- `options.plugins`: Optional extra plugins beyond the built-in `fs`, `cli`,
  and `http`.

**Returns:**

- A `SuiteResult` with per-test outcomes and pass/fail counts, or the
  `SpecError` that prevented the run entirely.

**Example:**

```typescript
let run = await runSuite({ root: "spec", grants });
```

### `parseGrants(args: string[]): Result<{ grants: Grants; remaining: string[] }, SpecError>`

Parse the `--allow-*` flags out of an argument list. A bare flag
(`--allow-net`) grants its whole family, `--allow-run=a,b` grants an explicit
scope list, an absent flag leaves the family denied, and repeated scoped
flags union their scopes. Non-permission arguments pass through in
`remaining` with their order preserved. Unknown `--allow-*` flags and empty
scope lists are usage errors.

**Example:**

```typescript
let parsed = parseGrants(["--allow-run=bun", "spec"]);
// parsed.data.grants.run → { mode: "scoped", scopes: ["bun"] }
// parsed.data.remaining → ["spec"]
```

### `createPermissionSet(grants: Grants): PermissionSet`

Build the runtime's single enforcement authority from a parsed grant set.
Every check denies by default, and every denial names the permission, the
attempted resource, and the exact `spec run --allow-*` flag that would grant
it. The checks: `checkRun` matches an executable's basename against the run
scopes; `checkNet` matches host (and optional port — a scope without a port
admits any port of that host); `checkEnv` matches exact variable names;
`checkHostFs` is a path-segment-aware directory-prefix test.
`grantedEnvNames()` lists the granted variables, used to build the filtered
environment of child processes.

### `createWorkspace(permissions: PermissionSet): Promise<Result<Workspace, SpecError>>`

Create one test's isolated workspace: a fresh temporary directory whose real
path is the containment boundary. `workspace.resolve(path)` is the safety
gate every path flows through: relative paths must stay inside the root even
after re-resolving symlinked ancestors (escapes fail with
`WorkspaceEscapeError`), and absolute paths require a host-fs grant.
`workspace.cleanup()` removes the directory; it is best-effort and never
fails the run.

### `loadSuite(root: string): Promise<Result<LoadedSuite, SpecError>>`

Discover every `.spec` file under a directory (recursively, in lexicographic
relative-path order), parse each one, then register commands and fixtures
suite-globally in a second pass — so name resolution never depends on file
order. The first parse failure aborts the load with its message prefixed by
the file path; two definitions sharing a name is a `duplicate-definition`
error naming both files; a missing or empty root is a load error.

### `createRegistry(plugins: Plugin[], suite: LoadedSuite): Registry`

Build the suite's name-resolution table. A dotted target (`fs.write`)
resolves inside that namespace only; a bare target resolves among suite
commands (which never need `use`) plus the tools of the namespaces the
calling file imported; more than one candidate is an `ambiguous-name` error
listing every fully qualified candidate — the runtime never guesses. The
registry also resolves `fixture NAME` references and answers `isCallable`,
which `expect` uses to pick its form.

### `executeTest(test: TestNode, context: ExecutionContext): Promise<Result<undefined, SpecError>>`

Execute one parsed test. Its phases share a single scope and run in order;
the first failing statement ends the test, and every error is stamped with
the failing statement's span and file. The executor owns scopes,
`let`/`return`, command and fixture invocation (32-deep recursion cap), and
the central permission gate that refuses calls to tools whose required
permission family is denied before the plugin ever runs. `runSuite` drives
this for you; call it directly only when embedding the executor with your own
lifecycle.

### `lex(source: SourceFile): Result<Token[], ParseError>`

Tokenize `.spec` text per GRAMMAR.md: `#` comments are discarded, dotted
identifiers with adjacent dots lex as one token, durations are validated with
[`@pkg/duration`](/packages/duration) and converted to milliseconds at lex
time, and newlines are significant. The stream always ends with an `eof`
token.

### `parse(source: SourceFile): Result<SpecFileNode, ParseError>`

Parse a `.spec` file into its AST (lexing internally). Enforces the
structural rules the grammar states in prose — strict `given`/`when`/`then`
order, `eventually` only inside `then`, call expressions only as a full
`let`/`return` right-hand side, unique object keys — and every error names
what was expected and what was found, with a span.

### `positionAt(source: SourceFile, offset: number): Position`

Translate a text offset (for example a `Span`'s `start`) into a 1-indexed
line/column position for rendering diagnostics.

### `reportSuite(suite: SuiteResult, sources: Map<string, SourceFile>, sink: Sink): void`

Render a finished suite as human output: one status line per test, an
indented detail block after each failure (permission denials render as the
denial block with the remedy flag), and a summary line with counts and total
duration.

### `reportFatal(error: SpecError, sink: Sink): void`

Render a failure that prevented any test from running — an unreadable suite
directory, a duplicate definition, a parse error — with its diagnostic code,
location when known, and remedy when the error carries one.

### `createFsPlugin(): Plugin`

The built-in `fs` capability (namespace `fs`). Every path flows through the
workspace's safe resolver first, so these tools need no permission grant.

| Tool           | Kind       | Shape                                                                                |
| -------------- | ---------- | ------------------------------------------------------------------------------------ |
| `fs.write`     | action     | `write "path" "content"` — strings verbatim, objects/arrays as JSON; creates parents |
| `fs.read`      | action     | `read "path"` — returns the file text                                                |
| `fs.mkdir`     | action     | `mkdir "path"` — creates missing parents                                             |
| `fs.remove`    | action     | `remove "path" [recursive]`                                                          |
| `fs.copy`      | action     | `copy "from" "to"`                                                                   |
| `fs.exists`    | observable | `exists "path"` — returns a boolean                                                  |
| `fs.file`      | observable | `file "path" exists` / `file "path" contains "substring"`                            |
| `fs.directory` | observable | `directory "path" exists`                                                            |

### `createCliPlugin(): Plugin`

The built-in `cli` capability (namespace `cli`). Its single tool, `cli.run`,
requires the `run` grant, checked against the executable's basename. The
child starts in the workspace root and receives a minimal environment —
`PATH`/`HOME`/`TMPDIR` plus exactly the variables granted with
`--allow-env` — so the host environment never leaks into a spec's
subprocesses. Returns `{ stdout, stderr, exit_code }`.

```
let result = run "bun" "index.js"
expect result.exit_code 0
```

### `createHttpPlugin(): Plugin`

The built-in `http` capability (namespace `http`): `get`, `post`, `put`,
`patch`, and `delete`, each requiring the `net` grant for the URL's host and
port. URLs must be absolute — v1 ships no environments mechanism to bind a
base URL against. Each tool takes an optional body (strings travel as
`text/plain`, other values as JSON) and returns
`{ status, ok, headers, text, json }`; HTTP error statuses are values, only
network-level failures are errors.

```
let response = http.post "http://localhost:3000/api/posts" { title: "Hello" }
expect response.status 201
```

### `connectStdioPlugin(command: string[], namespace: string): Promise<Result<Plugin, SpecError>>`

Spawn an external executable and connect it as a `Plugin` over the
NDJSON-over-stdio wire protocol (one JSON document per line; `describe` and
`call` requests, ordered replies). Sends the describe handshake with a 5s
timeout, caches the returned descriptors, and kills the child on any
handshake failure. The child inherits no environment beyond `PATH`.

**Parameters:**

- `command`: The argv to spawn, e.g. `["bun", "my-plugin.ts"]`.
- `namespace`: The namespace the connected plugin's tools live under.

### `servePlugin(plugin: Plugin): Promise<undefined>`

The plugin side of the same wire: read requests from stdin, dispatch each to
the given local plugin, write replies to stdout in order, and resolve when
the host closes stdin. Any Bun script becomes an external plugin by calling
this with its plugin implementation — see the Patterns section and the
reference implementation in `src/plugins/demo.ts`.

### `valueEquals(left: Value, right: Value): boolean`

Deep structural equality over runtime values — the semantics of the
two-argument `expect A B` form. Arrays compare by index, objects by key set,
primitives by `===`.

### `formatValue(value: Value): string`

Render a value for diagnostics: JSON with stable key order, indented only
when the rendering would exceed one short line.

### `KEYWORDS`

The reserved words of the language (`use`, `test`, `given`, `when`, `then`,
`command`, `fixture`, `let`, `return`, `expect`, `eventually`, `within`,
`true`, `false`), never valid as identifiers.

### Error classes

All extend `SpecError`, which carries a stable `code: DiagnosticCode` (what
reporters branch on — never message text), plus optional `file`, `span`, and
`remedy` fields.

- `ParseError` — a lexical or syntactic failure, with file and span.
- `LoadError` — a suite-level failure before any test runs
  (`load-error` or `duplicate-definition`).
- `ResolutionError` — a name that resolved to nothing (`unknown-name`) or to
  more than one candidate (`ambiguous-name`, with a `candidates` list).
- `ExpectationError` — a failed `expect`, carrying `expected` and `observed`.
- `PermissionDeniedError` — an ungranted capability use, carrying the
  `permission` family, the attempted `resource`, and the exact flag as its
  `remedy`.
- `WorkspaceEscapeError` — a path that would leave the workspace without a
  host-fs grant, carrying `attemptedPath`.
- `ToolError` — a tool that was reached and ran, but failed on its own terms.

### Types

#### `Value`, `ValueObject`, `ToolArg`

The runtime value model — deliberately JSON-shaped so values cross the plugin
wire without a serialization layer. Duration literals evaluate to
milliseconds; a `word` argument is a symbol the tool's descriptor interprets,
distinct from the string of the same spelling.

```typescript
type Value = string | number | boolean | null | Value[] | ValueObject;
type ToolArg = { kind: "value"; value: Value } | { kind: "word"; word: string };
```

#### `Plugin`, `ToolDescriptor`, `ToolParam`, `ToolContext`

The single extension seam. A plugin owns one namespace and exposes typed tool
descriptors; `descriptor.kind` separates mutations (`action`) from
observations (`observable` — the only kind allowed inside `eventually` and at
the head of an observable `expect`), and `descriptor.requires` names the
permission family the runtime gates centrally before the plugin ever runs.
`ToolContext` hands each call the test's `Workspace` and the runtime-owned
`PermissionSet`.

```typescript
interface Plugin {
	namespace: string;
	describe(): ToolDescriptor[];
	call(tool: string, args: ToolArg[], context: ToolContext): Promise<Result<Value, SpecError>>;
}
```

#### `Grants`, `Grant`, `PermissionKind`, `PermissionSet`

The permission model: one `Grant` per family (`run`, `net`, `env`,
`host-fs`), each `denied`, `all`, or `scoped` with an explicit scope list.

```typescript
type Grant = { mode: "denied" } | { mode: "all" } | { mode: "scoped"; scopes: string[] };
interface Grants {
	run: Grant;
	net: Grant;
	env: Grant;
	hostFs: Grant;
}
```

#### `RunOptions`, `SuiteResult`, `TestResult`, `TestStatus`, `Sink`

The runner's contract: `RunOptions` in (`root`, `grants`, optional
`plugins`), `SuiteResult` out (`results`, `passed`, `failed`), one
`TestResult` per test (`title`, `file`, `status`, `durationMs`, and the
structured `error` when it failed). `Sink` is the one-method output interface
(`write(text: string): void`) all human output flows through — the CLI passes
stdout, tests pass a buffer.

#### `LoadedSuite`, `Registry`, `ResolvedCallable`, `ExecutionContext`, `Workspace`

The intermediate shapes of the pipeline: `loadSuite` produces a
`LoadedSuite` (parsed files plus suite-global command/fixture maps),
`createRegistry` turns it into a `Registry` (whose lookups yield a
`ResolvedCallable`: a plugin tool or a suite command), and `executeTest`
consumes an `ExecutionContext` — registry, workspace, permissions, the
calling file's `uses`, a `usesFor(definition)` lookup (because `use` is
file-scoped, a definition's body resolves bare names against the imports of
the file that defined it), and the parsed `grants` for the coarse gate.

#### `SourceFile`, `Span`, `Position`, `Token`, `TokenKind`, `DiagnosticCode`

Source bookkeeping and diagnostics vocabulary: a `SourceFile` is a path plus
its full text; a `Span` is a half-open offset range every AST node and error
carries; `positionAt` turns offsets into 1-indexed `Position`s; `Token` and
`TokenKind` are the lexer's output vocabulary; `DiagnosticCode` is the stable
failure category reporters branch on.

#### AST node types

`parse` produces one node type per GRAMMAR.md production, all exported:

| Type                         | Production                                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| `SpecFileNode`               | one parsed file: `uses`, `definitions`, `tests`                                          |
| `UseNode`                    | `use fs`                                                                                 |
| `DefinitionNode`             | `CommandNode \| FixtureNode`                                                             |
| `CommandNode`, `FixtureNode` | `command name(params) { … }`, `fixture name { … }`                                       |
| `TestNode`                   | `test "title" { … }` with optional phase blocks                                          |
| `BlockNode`                  | `{ … }` statement sequence                                                               |
| `StatementNode`              | `LetNode \| ReturnNode \| ExpectNode \| EventuallyNode \| CallNode`                      |
| `RhsNode`                    | `ExpressionNode \| FixtureCallNode \| CallExprNode`                                      |
| `ArgumentNode`               | `ExpressionNode \| WordNode`                                                             |
| `ExpressionNode`             | `StringNode \| NumberNode \| BooleanNode \| DurationNode \| ObjectNode \| ReferenceNode` |
| `ObjectEntryNode`            | one `key: value` entry of an object literal                                              |

## Patterns

### Pattern: Writing an external plugin

Any executable that speaks the NDJSON wire protocol is a plugin; in a Bun
script, `servePlugin` handles the wire so you only implement the `Plugin`
interface. The reference implementation is `src/plugins/demo.ts`.

```typescript
#!/usr/bin/env bun
import type { Plugin } from "@pkg/spec";

import { failure, success } from "@pkg/result";
import { servePlugin, ToolError } from "@pkg/spec";

let plugin: Plugin = {
	namespace: "greet",
	describe() {
		return [
			{
				name: "hello",
				summary: "Greet a name.",
				kind: "observable",
				params: [{ name: "name", kind: "value", required: true, summary: "Who to greet." }],
			},
		];
	},
	async call(tool, args) {
		let first = args[0];
		if (tool !== "hello" || first?.kind !== "value" || typeof first.value !== "string") {
			return failure(new ToolError('greet.hello expects one string, e.g. hello "world"'));
		}
		return success(`hello, ${first.value}`);
	},
};

await servePlugin(plugin);
```

Declare tools honestly: mark mutations as `kind: "action"` and set
`requires` for anything privileged — the runtime's central gate enforces the
declaration before your code runs.

### Pattern: Connecting extra plugins to a run

Extra plugins are a programmatic feature: connect them (or construct them
in-process) and pass them through `RunOptions.plugins`. Specs then address
them like any namespace — `use greet` for bare names, or fully qualified
`greet.hello`.

```typescript
import { isFailure } from "@pkg/result";
import { connectStdioPlugin, runSuite } from "@pkg/spec";

let greet = await connectStdioPlugin(["bun", "tools/greet-plugin.ts"], "greet");
if (isFailure(greet)) {
	// The handshake failed; greet.error says why and the child is already dead.
	process.exit(2);
}

let run = await runSuite({ root: "spec", grants, plugins: [greet.data] });
```

### Pattern: Least-privilege flag recipes

Grant exactly what the suite exercises; everything else stays denied, and any
attempt beyond the grant fails with the flag it would need.

```sh
# Pure filesystem suites: the workspace is always writable, so no flags.
spec run spec

# Spawn one known tool (matched by executable basename):
spec run spec --allow-run=bun

# Talk to one local server, on one port:
spec run spec --allow-net=localhost:3000

# Read exactly the variables the spec names (children inherit only these):
spec run spec --allow-env=CI,NODE_ENV

# Read shared fixture data outside the workspace (path-prefix grant):
spec run spec --allow-host-fs=/opt/fixtures

# Combine grants; scoped flags union when repeated:
spec run spec --allow-run=bun,git --allow-net=localhost
```

This package's own behavioral suite (`spec/`) runs the spec CLI on miniature
projects with only `--allow-run=spec` — a live demonstration that a
process-spawning suite needs exactly one scoped grant.

## Related Packages

- [`@pkg/result`](/packages/result) - Result type every fallible export
  returns; errors are values, never throws
- [`@pkg/duration`](/packages/duration) - Parses and validates the duration
  literals (`10s`, `500ms`) at lex time

## Tips

1. **Reach for `spec run` before the programmatic API** - `runSuite` exists
   for embedders; the CLI is the product surface and its exit codes (0 pass,
   1 test failure, 2 usage/load error) are the contract to script against.
2. **Stay workspace-relative** - relative paths need no grants and are
   escape-checked; the first `--allow-host-fs` in a suite is a smell worth a
   second look.
3. **Grant the narrowest scope and let denials teach** - start with no flags;
   every denial prints the exact `--allow-*` flag it needs, so the final
   invocation documents the suite's true footprint.
4. **Bare identifiers in tool-argument position are words, not variables** -
   `write "f" content` hands the tool the symbol `content`; pass bound values
   to tools via dotted references like `result.stdout` (suite commands, by
   contrast, do receive the binding).
5. **Keep mutations out of `eventually`** - only `expect` and observable
   calls may appear inside; a retried mutation is not a retried assertion,
   and the runtime rejects it.
6. **`use` is per-file, definitions are suite-global** - every file declares
   its own imports (and a definition's body uses its defining file's), while
   commands and fixtures resolve everywhere without any import; qualified
   names like `fs.write` always work.
7. **Multiline strings are raw** - no escape processing and no way to contain
   `"""`, so generated files that themselves need multiline strings must be
   assembled from single-line `write` calls.
8. **Check results, don't catch** - every fallible export returns a
   `Result`; branch with `isFailure` and read the structured error
   (`code`, `span`, `remedy`) instead of parsing messages.
