---
name: sdxc-spec
description: "@sdxc/spec is an executable specification runner: `.spec` files written as given/when/then run against a real app in an isolated workspace, under explicit `--allow-*` grants. Use when writing or debugging a `.spec` suite, reading a permission denial, configuring `spec/config.jsonc` bases and databases, reaching for the `fs`/`cli`/`http`/`html`/`browser`/`db` capabilities, writing a plugin, or calling `runSuite` programmatically."
---

# @sdxc/spec

Behavior is described in `.spec` files — setup, action, expectation — in a deliberately tiny
language with no `if`, no loops and no operators, and `spec run` executes each one against
the real app. Every test gets its own fresh temporary directory and every privileged act
needs an explicit grant, so a suite started with no flags tells you its true footprint
through its denials. The package ships the `spec` CLI (which runs on Bun), a programmatic
API (`runSuite`, `runTests`, `parseGrants`, `loadSources`, every `create*Plugin` factory),
and a `/workers` entry carrying the same language core for a V8-isolate runtime.

Full API, options and examples: [packages/spec/README.md](packages/spec/README.md)

## When to reach for it

- Behavior needs an acceptance test that exercises the real app — its CLI, its HTTP API, its rendered HTML, its database — rather than a unit under mocks.
- A run failed with `Permission denied` and the flag that would unblock it has to be chosen.
- A suite needs a base URL or a database connection read from the environment instead of a repeated flag.
- A capability the built-ins do not cover has to be added as a plugin, in-process or as an external NDJSON-over-stdio executable.
- Specs have to run somewhere with no process and no filesystem.

## Using it

Declare the workspace dependency, then write a suite under `spec/`:

```json
{ "devDependencies": { "@sdxc/spec": "workspace:*" } }
```

```text
use fs
use cli

test "the script prints its greeting" {
	given {
		write "index.js" "console.log(\"hello from the workspace\")"
	}
	when {
		let result = run "node" "index.js"
	}
	then {
		expect result.exit_code 0
		expect result.stdout "hello from the workspace\n"
	}
}
```

```bash
npx spec run spec --allow-run=node
```

Or drive it from code:

```ts
import { isFailure } from "@sdxc/result";
import { parseGrants, runSuite } from "@sdxc/spec";

let grants = parseGrants(["--allow-net=localhost:3000"]);
if (isFailure(grants)) throw grants.error;

let run = await runSuite({ root: "spec", grants: grants.data, concurrency: 4 });
```

### Entry points

- `@sdxc/spec` — the CLI's own runtime: `runSuite`, `runTests`, `loadSuite`/`loadSources`, `lex`/`parse`, `createRegistry`, `executeTest`, the reporters, the `SpecError` family, every plugin factory, and `connectStdioPlugin`/`servePlugin` for out-of-process plugins.
- `@sdxc/spec/workers` — the same language core for a V8 isolate, with only the capabilities that need neither a process nor a filesystem.

## Suggestions

- Start with no `--allow-*` flags and let the denials name the suite's footprint, then grant exactly what they ask for (`--allow-run=node`, `--allow-net=localhost:3000`). A bare flag grants the whole family; scoped flags union.
- Put repeated grants, base URLs and database connections in `spec/config.jsonc`. `bases` and `databases` apply on every run because they are addresses rather than grants; the `permissions` block stays inert until someone passes `--allow-config`.
- Wrap an assertion in `eventually within 2s { … }` for anything that becomes true a moment later; a plain assertion checks once, and an action inside `eventually` is an error. Anchor a `not` assertion with a positive one in the same block, since a negative holds equally when the page never rendered.
- `--concurrency=N` isolates each test's workspace, not the app under test, so a suite whose tests write the same rows belongs at `--concurrency=1` unless its writes are keyed to `spec.nonce`. A test that passed only on a `--retries` attempt lands in its own flaky count with the failed attempt's diagnostics kept.
- Exit codes are the contract to script against: `0` passed, `1` a test failed, `2` a usage or load error. `--artifacts=DIR` turns a failure's evidence into files whose paths the reporter prints.
- A bare word in argument position is a declared symbol when the tool declares that spelling and a binding otherwise; a spelling that is both is an `ambiguous-name` error. Array path segments are 0-based, while the addressing vocabulary's ordinals count from 1.

## Related

- `@sdxc/result` — every fallible export returns a `Result`, so denials and parse errors are values you branch on; skill `sdxc-result`
- `@sdxc/sample` — backs the `sample` capability and the `--seed` replay; skill `sdxc-sample`
- `@sdxc/html` — backs the `html` capability's markup reading and addressing vocabulary; skill `sdxc-html`
