# Writing plugins for `@sdxc/spec`

Every capability the runtime has — `fs`, `cli`, `http`, `browser`, `html`, `db`,
`url`, `jwt`, `env`, `sample`, `str`, `spec` — is a plugin: one namespace
exposing typed tools behind a single interface. Nothing about the built-ins is
privileged, so your own plugin is a first-class citizen. This guide shows the
three ways to build one, how a project loads it, and the trust model that
governs launching it.

- [The `Plugin` interface](#the-plugin-interface)
- [Declare every word your tool accepts](#declare-every-word-your-tool-accepts)
- [What one call receives](#what-one-call-receives)
- [1. In-process plugins (for embedders)](#1-in-process-plugins-for-embedders)
- [2. External plugins over stdio (language-agnostic)](#2-external-plugins-over-stdio-language-agnostic)
- [3. Loading a plugin into a project](#3-loading-a-plugin-into-a-project)
- [Third-party plugins](#third-party-plugins)
- [The `--allow-plugins` trust model](#the---allow-plugins-trust-model)
- [Permissions inside a tool](#permissions-inside-a-tool)
- [Writing failure artifacts](#writing-failure-artifacts)

## The `Plugin` interface

A plugin is an object with a namespace, a `describe()` that lists its tools, and
a `call()` that runs one. It never throws — every outcome is a
[`@sdxc/result`](../../result) `Result`.

```ts
interface Plugin {
	namespace: string;
	describe(): ToolDescriptor[];
	call(tool: string, args: ToolArg[], context: ToolContext): Promise<Result<Value, SpecError>>;
	dispose?(): Promise<void>;
}
```

Each tool declares whether it is an `action` (it may mutate) or an `observable`
(it only reads) and, optionally, the permission family it `requires`. `kind`
matters: only observables may run inside `eventually` or head the observable
form of `expect`. `describe()` must be static — do not open a connection or read
the environment to answer it, so a suite that never calls your tools pays
nothing.

`dispose()` is optional and called once, after the whole suite, for plugins that
hold process-external state (a connection, a session, a child process). The
built-in `fs`/`cli`/`http` plugins omit it; the `db` and `browser` plugins use
it to close what they opened.

## Declare every word your tool accepts

`describe()` is not only documentation: it is what decides whether a bare
identifier in a call is a **word** for your tool or a **binding read** from the
spec's scope. This is the one thing most likely to catch you out, so get it right
before anything else.

The runtime reads a bare identifier in tool-argument position like this:

1. a word, when your descriptor declares a `kind: "word"` parameter whose `name`
   is that exact spelling;
2. otherwise a word, when the parameter you declared **at that position** is
   `kind: "word"` and `required: true`;
3. otherwise a read of the binding with that spelling;
4. otherwise an `unknown-name` error.

So a tool that accepts `exists` but declares no parameter for it fails at step 4
with `Unknown name "exists"` — even though `call()` would have handled it
perfectly. Two shapes both work:

```ts
// One required slot, when the tool's grammar is "the path, then one of these".
params: [
	{ name: "path", kind: "value", required: true, summary: "The file to inspect." },
	{ name: "assertion", kind: "word", required: true, summary: "One of `exists` or `contains`." },
	{ name: "expected", kind: "value", required: false, summary: "What `contains` looks for." },
];

// One entry per spelling, when the words are optional options in any order.
params: [
	{ name: "sql", kind: "value", required: true, summary: "The SQL text to run." },
	{ name: "params", kind: "word", required: false, summary: "Tag before the bound value(s)." },
	{ name: "on", kind: "word", required: false, summary: "Tag before the connection name." },
	{ name: "one", kind: "word", required: false, summary: "Return the single row." },
];
```

Step 2 requires `required: true` on purpose. Optional word-tagged options may be
written in any order after the required arguments, so once they begin, position
says nothing about what an argument was meant to be — and an optional word slot
would swallow `db.query "…" params title on "web"`'s `title` as a word.

A spelling that is both a word you declare and a binding live in the spec's scope
is an `ambiguous-name` error before your `call()` runs. The runtime never
guesses, and the spec's author renames the binding or passes a dotted reference.

If your tool addresses elements the way `html` and `browser` do, spread the
ready-made fragments `@sdxc/spec` exports — `QUERY_PARAMS`, `ASSERTION_PARAMS`,
`FILL_PARAMS` — rather than restating that vocabulary, so every word in it stays
declared. `parseQuery`, `parseFill` and `parseAssertion` read the arguments those
fragments describe, and `ambiguousMatch` / `noMatch` render the candidate lists a
miss reports, so a third namespace answers a lookup the way the two built-in ones
already do:

```typescript
import type { ToolDescriptor } from "@sdxc/spec";

import { parseQuery, QUERY_PARAMS } from "@sdxc/spec";
```

## What one call receives

`call()`'s third argument carries everything the runtime knows about the call:

| Field         | What it is                                                                      |
| ------------- | ------------------------------------------------------------------------------- |
| `workspace`   | The test's isolated directory; `resolve(path)` keeps a tool inside it           |
| `permissions` | The caller's grants, for scoped checks — see below                              |
| `random`      | The test's seeded stream; draw every generated value from it, never from `Math` |
| `now`         | The instant the test started, frozen for its whole run                          |
| `run`         | `{ id, attempt, nonce }` — what this run and this attempt are called            |
| `bases`       | The run's named bases, which every relative target resolves through             |
| `connections` | The run's named database connections, which `on "…"` selects among              |
| `artifacts`   | Where a failure writes evidence; absent unless the caller passed `--artifacts`  |

`run.nonce` is `<id>-<attempt>`: the one value that does not reproduce across
runs. Use it to name anything that must be unique per attempt — a row, a file, an
account — while `random` keeps everything else replayable from the seed.

## 1. In-process plugins (for embedders)

If you drive the runtime yourself through `runSuite`, the cheapest plugin is a
plain object passed in `plugins`:

```ts
import type { Plugin } from "@sdxc/spec";

import { failure, success } from "@sdxc/result";
import { runSuite, ToolError } from "@sdxc/spec";

function createMathPlugin(): Plugin {
	return {
		namespace: "math",
		describe() {
			return [
				{
					name: "double",
					summary: "Return twice the given number.",
					kind: "observable",
					params: [{ name: "n", kind: "value", required: true, summary: "The number." }],
				},
			];
		},
		async call(tool, args) {
			let first = args[0];
			if (tool !== "double" || first?.kind !== "value" || typeof first.value !== "number") {
				return failure(new ToolError("math.double expects one number, e.g. double 21"));
			}
			return success(first.value * 2);
		},
	};
}

await runSuite({ root: "spec", grants, plugins: [createMathPlugin()] });
```

Specs then `use math` and call `math.double`. In-process plugins skip the
manifest and `--allow-plugins` entirely — you supplied the code, so there is
nothing to authorize. This path is for test harnesses and tooling that embed the
runtime; the CLI cannot load an in-process plugin, because it has no code from
you to run.

### Host policy belongs in the factory

A bound the host sets rather than the spec — how much of a response to read, how
long to wait, how large a payload to accept — is an argument to the factory, not
a tool parameter. `createHttpPlugin({ maxResponseBytes })` is the built-in
example: the embedder running untrusted specs in a bounded isolate caps it, the
CLI leaves it open, and a spec cannot raise it because it was never part of the
call. Enforce such a bound while the resource is being consumed rather than
after, and report passing it as a `ToolError`: nothing was refused on authority
grounds, so a permission denial would name a flag that does not exist.

## 2. External plugins over stdio (language-agnostic)

The CLI loads plugins as **external processes**: any executable that speaks the
line protocol over stdio can be a plugin, in any language. A Bun script gets
there for free with `servePlugin`, which runs the protocol loop for you — you
implement the same `Plugin` interface and hand it over:

```ts
#!/usr/bin/env bun
import type { Plugin } from "@sdxc/spec";

import { failure, success } from "@sdxc/result";
import { servePlugin, ToolError } from "@sdxc/spec";

function createGreetPlugin(): Plugin {
	return {
		namespace: "greet",
		describe() {
			return [
				{
					name: "hello",
					summary: "Greet the given name.",
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
			return success(`Hello, ${first.value}!`);
		},
	};
}

if (import.meta.main) await servePlugin(createGreetPlugin());
```

A complete, runnable version is
[`examples/plugin-loading/greeter.ts`](../examples/plugin-loading/greeter.ts),
loaded by the manifest and spec beside it. The
[reference plugin `src/plugins/demo.ts`](../src/plugins/demo.ts) is the same
shape.

### The wire protocol

If you are not writing Bun, implement the protocol directly — it is one JSON
document per line over the child's stdin/stdout, documented in full in
[`src/transport-stdio.ts`](../src/transport-stdio.ts):

| Direction     | Message                                                                               |
| ------------- | ------------------------------------------------------------------------------------- |
| host → plugin | `{"id":1,"method":"describe"}`                                                        |
| plugin → host | `{"id":1,"result":[…ToolDescriptor…]}`                                                |
| host → plugin | `{"id":2,"method":"call","tool":"hello","args":[…ToolArg…],"context":{…}}`            |
| plugin → host | `{"id":2,"result":…Value…}` or `{"id":2,"error":{"code":"tool-error","message":"…"}}` |

Request ids strictly increase and the plugin replies in the order it received
requests. The child inherits no environment beyond `PATH`. Arguments are
`ToolArg` values (`{"kind":"value","value":…}` or `{"kind":"word","word":…}`),
and a result is any JSON-shaped [`Value`](../src/values.ts).

The `context` object carries the call's context as plain data, which the plugin
side rebuilds into a real `ToolContext`: `workspaceRoot`, `now`, `run`, the
`bases` and `connections` lists, the caller's `grants`, and `artifactsDirectory`
when the run has one. A served plugin therefore reads the same run identity,
bases and connections a built-in does.

An error message carries the failure's structured fields alongside its code, so
a denial keeps the `--allow-*` flag that would grant it: a `permission-denied`
error adds `permission`, `resource`, `remedy` and `familyGate`, and arrives on
the host as the same `PermissionDeniedError` the runtime raises itself. Reporting
a denial from a plugin therefore reads exactly like reporting one from `fs`.

## 3. Loading a plugin into a project

A project declares the plugins its suite uses in its **`config.jsonc`** — the
suite's general configuration file, in the directory you pass to `spec run`
(`config.jsonc` is tried first, then `config.json`). Plugins live under its
`plugins` key:

```jsonc
// spec/config.jsonc
{
	"plugins": {
		"greet": {
			// A command argument starting with "." is a path resolved against
			// this file's directory, so the suite runs from any working dir.
			"command": ["bun", "./greeter.ts"],
		},
	},
}
```

The `plugins` key maps a **namespace** to the **command** that launches its
plugin. This is the one place a path appears: specs name `greet.hello`, never
`./greeter.ts`, so a `.spec` file stays portable while `config.jsonc` records
where the plugin actually lives on this machine. It is environment
configuration, not specification — the same specs run against a different
machine's `config.jsonc` unchanged.

A declared namespace may not shadow a built-in (`fs`, `cli`, `http`, `browser`,
`html`, `db`, `url`, `jwt`, `env`, `sample`, `str`, `spec`); built-ins are always
available and need no config entry.

## Third-party plugins

A plugin someone else publishes is loaded the same way — there is no separate
"third-party" mechanism:

1. Install it (`bun add some-spec-plugin`, or clone it into the repo).
2. Point a `plugins` entry at the command that launches it — an installed
   binary on `PATH`, or a script path:

   ```jsonc
   {
   	"plugins": {
   		"redis": { "command": ["some-spec-plugin"] },
   		"local": { "command": ["bun", "./plugins/local.ts"] },
   	},
   }
   ```

3. `use redis` in a spec and call its tools.

Because `config.jsonc` names a launch command rather than an import, the plugin
can be written in any language and distributed however its author chooses.

## The `--allow-plugins` trust model

**Declaring a plugin is not permission to run it.** `config.jsonc` is a file in
the repository; auto-launching whatever it names would be running
project-declared code the moment you type `spec run`. So plugin launch is
**deny-by-default**, the same stance the runtime takes toward every capability
([ADR-007](../../../docs/adr/spec/ADR-007-deny-by-default-permissions.md),
[ADR-011](../../../docs/adr/spec/ADR-011-project-and-third-party-plugins.md)):

| Invocation                         | Effect                                          |
| ---------------------------------- | ----------------------------------------------- |
| `spec run dir`                     | No declared plugin launches                     |
| `spec run dir --allow-plugins`     | Every plugin `config.jsonc` declares may launch |
| `spec run dir --allow-plugins=a,b` | Only namespaces `a` and `b` may launch          |

If a suite imports a plugin (`use greet`) that `config.jsonc` declares but you
did not authorize, the run is refused before any process starts, naming the
flag:

```
✗ permission-denied: Plugin launch denied: the suite imports the plugin
  namespace greet, declared in spec/config.jsonc but not authorized to launch…
  remedy: spec run --allow-plugins=greet
```

Built-in plugins never need `--allow-plugins` — they are part of the runtime,
not project-declared code. The grant governs only whether a declared command is
launched; once launched, the plugin's _tools_ are still gated by their own
`requires` permissions, exactly like a built-in's.

## Permissions inside a tool

`--allow-plugins` decides whether your plugin's process starts. What its tools
may then do is governed separately, by the same permission engine the built-ins
use. Declare a tool's `requires` (`"run"`, `"net"`, `"env"`, `"host-fs"`, `"db"`)
and the runtime refuses the call when that family is denied — before your
`call()` runs. For scoped checks, ask the runtime through the context:

```ts
async call(tool, args, context) {
	let allowed = context.permissions.checkNet("api.example.com", 443);
	if (isFailure(allowed)) return allowed; // becomes a permission denial
	// … reach the network …
}
```

### Check the resolved address, not the one the spec wrote

A tool that takes a target resolves it through the run's bases instead of
parsing a URL itself, then checks `net` against what came back. The denial then
names the host a grant would actually have to spell, so it is copy-pasteable:

```ts
let resolved = context.bases.resolve(target, base); // base is the `on "…"` name
if (isFailure(resolved)) return resolved;
let allowed = context.permissions.checkNet(resolved.data.hostname, portOf(resolved.data));
if (isFailure(allowed)) return allowed;
```

A tool reaching a database does the same through `context.connections`, whose
resolved `name` is what `--allow-db` is scoped to:

```ts
let chosen = context.connections.resolve(name);
if (isFailure(chosen)) return chosen;
let allowed = context.permissions.checkDb(chosen.data.name);
if (isFailure(allowed)) return allowed;
```

Both sets select the same way: naming none works when exactly one is configured,
and otherwise the failure lists the configured names and the `on "…"` clause that
picks one.

### A tool needing two permission families checks the second itself

The runtime's central gate enforces the one family in `requires`. A tool that
reaches further checks the rest inside `call()`, and reports a call missing both
in a single denial naming both flags — `db.run_file` reaches a database and the
host filesystem, so it declares `requires: "db"` and calls `checkDb` and
`checkHostFs` itself, remedying with
`spec run --allow-db=<name> --allow-host-fs=<dir>`.

For an in-process plugin these checks are exact. For an **external** plugin, one
honesty note from [ADR-011](../../../docs/adr/spec/ADR-011-project-and-third-party-plugins.md):
the wire carries the workspace root, and the coarse `requires` gate still runs
host-side before any call crosses it, but the caller's _scoped_ grants are not
yet transmitted over the wire — an external plugin does its own filesystem and
network work, and fine-grained per-resource enforcement over the transport is an
open question tracked in the design suite. Keep genuinely privileged, precisely
scoped capabilities as built-ins for now.

## Writing failure artifacts

When a failure is easier to understand from a file than from a sentence — a
screenshot, an accessibility-tree dump, the document a lookup actually read —
write it through the store and hand the reporter the paths:

```ts
let path = await context.artifacts?.write(`lookup-${context.run.nonce}.html`, source);
if (path !== undefined) error.artifacts = [path];
return failure(error);
```

- `context.artifacts` is absent unless the caller passed `--artifacts=<dir>`, so
  check before writing; a run without it keeps its diagnostics as text.
- `write()` answers `undefined` when the write failed. A diagnostic is never
  worth failing a test that already failed, so treat that as "no artifact" and
  report the original error unchanged.
- Name the file after the tool and `run.nonce`, so two attempts of the same test
  leave two files rather than overwriting one.
- The reporter prints every path on `SpecError.artifacts` under a `Wrote:`
  heading, which is what makes the file findable from the run's output.

[`src/plugins/html.ts`](../src/plugins/html.ts) is the worked example: a lookup
that matched nothing leaves the parsed document in the store and points the
failure at it.
