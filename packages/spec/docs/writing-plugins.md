# Writing plugins for `@sdxc/spec`

Every capability the runtime has — `fs`, `cli`, `http`, `browser`, `db` — is a
plugin: one namespace exposing typed tools behind a single interface. Nothing
about the built-ins is privileged, so your own plugin is a first-class citizen.
This guide shows the three ways to build one, how a project loads it, and the
trust model that governs launching it.

- [The `Plugin` interface](#the-plugin-interface)
- [1. In-process plugins (for embedders)](#1-in-process-plugins-for-embedders)
- [2. External plugins over stdio (language-agnostic)](#2-external-plugins-over-stdio-language-agnostic)
- [3. Loading a plugin into a project](#3-loading-a-plugin-into-a-project)
- [Third-party plugins](#third-party-plugins)
- [The `--allow-plugins` trust model](#the---allow-plugins-trust-model)
- [Permissions inside a tool](#permissions-inside-a-tool)

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

| Direction     | Message                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------- |
| host → plugin | `{"id":1,"method":"describe"}`                                                           |
| plugin → host | `{"id":1,"result":[…ToolDescriptor…]}`                                                   |
| host → plugin | `{"id":2,"method":"call","tool":"hello","args":[…ToolArg…],"workspaceRoot":"/abs/path"}` |
| plugin → host | `{"id":2,"result":…Value…}` or `{"id":2,"error":{"code":"tool-error","message":"…"}}`    |

Request ids strictly increase and the plugin replies in the order it received
requests. The child inherits no environment beyond `PATH`. Arguments are
`ToolArg` values (`{"kind":"value","value":…}` or `{"kind":"word","word":…}`),
and a result is any JSON-shaped [`Value`](../src/values.ts).

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
`db`, `env`, `url`, `jwt`); built-ins are always available and need no config
entry.

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
use. Declare a tool's `requires` (`"run"`, `"net"`, `"env"`, `"host-fs"`) and
the runtime refuses the call when that family is denied — before your `call()`
runs. For scoped checks, ask the runtime through the context:

```ts
async call(tool, args, context) {
	let allowed = context.permissions.checkNet("api.example.com", 443);
	if (isFailure(allowed)) return allowed; // becomes a permission denial
	// … reach the network …
}
```

For an in-process plugin these checks are exact. For an **external** plugin, one
honesty note from [ADR-011](../../../docs/adr/spec/ADR-011-project-and-third-party-plugins.md):
the wire carries the workspace root, and the coarse `requires` gate still runs
host-side before any call crosses it, but the caller's _scoped_ grants are not
yet transmitted over the wire — an external plugin does its own filesystem and
network work, and fine-grained per-resource enforcement over the transport is an
open question tracked in the design suite. Keep genuinely privileged, precisely
scoped capabilities as built-ins for now.
