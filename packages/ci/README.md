# @sdxc/ci

CI as a TypeScript script that runs the same on a laptop and a CI host, and signs a green commit off on GitHub.

## Installation

```sh
npm add -D @sdxc/ci
```

Install it to type your script with `defineCI`. The command line also runs without installing,
through `npx @sdxc/ci`.

## Usage

### Write a script

```typescript
import { defineCI } from "@sdxc/ci";

export default defineCI(async (ci) => {
	await ci.step("Types", "tsc --noEmit", { halt: true });

	await ci.parallel("Checks", [
		() => ci.step("Lint", "npm run lint"),
		() => ci.step("Test", "npm test", { cache: true }),
	]);

	if (ci.status === "passing") await ci.signoff("All systems go.");
	else ci.failure("CI failed. Do not push.", "Fix the steps above and run it again.");
});
```

`await` orders steps, `ci.parallel` runs them at once, and ordinary control flow does the rest.
A failed step does not stop the run unless it is a `halt` step; every later step then resolves
to `skipped`.

### Run it

```sh
npx @sdxc/ci run ci.ts
```

Each step prints one line as it finishes, a failed step's output under it, and a summary at the
end. The run exits 0 when every step passed and 1 otherwise. A green run on a clean tree signs
the commit off with an `sdxc/ci` GitHub commit status.

### Fan out over workspaces

```typescript
await ci.matrix("Workspaces", await ci.workspaces(), async (ws) => {
	await ci.step(`Build ${ws.name}`, "npm run build", { cwd: ws.path, halt: true });
	await ci.step(`Test ${ws.name}`, "npm test", { cwd: ws.path, cache: true });
});
```

Each item is an entry addressed as `Workspaces/<name>`, with its own status; a `halt` inside it
stops only that entry.

## API

### `defineCI(script)`

Types a script; the default export of the file `run` loads. A plain function works too.

### `ci.step(name, run, options?)`

Runs a shell command line, an argv without a shell, or a function, and resolves to
`{ status, cached, duration, output }`. A function step gets `step.run(command)`,
`step.log(...)` and `step.signal`; its outcome is the `Result` it returns, or a failure when a
command inside it failed. Options: `halt`, `cache`, `cwd`, `env`, `timeout` (milliseconds).

### `ci.parallel(name, functions, options?)` and `ci.matrix(name, items, fn, options?)`

Run functions, or one call per item, concurrently as a named group. Options: `failFast`
(default `false`) and `concurrency` (default `os.availableParallelism()`); a matrix also takes
`key` to name its entries. Only steps take a concurrency slot, so nesting never deadlocks.

### `ci.workspaces()`

The workspaces of the root `package.json`, each with `name`, `path`, `absolute`, `manifest`,
`dependencies`, `dependents`, `files()`, `has(glob)` and `inputs`: the cache input globs for its
own files, every workspace it depends on and the root files, which a step extends with
`cache: { inputs: [...ws.inputs, "fixtures/**"] }`.

### `ci.files(glob)`, `ci.root`, `ci.cores`

`files` lists the tracked files matching a glob, relative to the project root, so a script finds
what to act on without reading the disk. `root` is the project root every step runs in, and
`cores` the machine's available parallelism, for sizing `concurrency`.

### `ci.status`, `ci.runner`, `ci.scope`

`status` is `pending`, `passing`, `failing` or `halted` and never returns to `passing`.
`runner` is `remote` when the `CI` variable is set, else `local`. `scope` lists the workspaces
`--scope` names, or is `null`.

### `ci.success`, `ci.failure`, `ci.signoff`

Closing messages. `failure` fails a run whose steps passed. `success` and `signoff` on a run
that is not passing are script errors. `signoff` posts the status only on a local run that ran
every step, started and ended on a clean tree, and kept the same HEAD.

### `cache`

`cache: true`, or `{ inputs, env, outputs }`, reuses an earlier pass while the key is
unchanged: the command, the contents of the input globs, the listed variables, the platform and
the Node and Bun versions. Inside a matrix entry over `ci.workspaces()` the default inputs are
the workspace, the workspaces it depends on and the files at the root.

## Command line

```sh
npx @sdxc/ci run <script> [--only <pattern>] [--skip <pattern>] [--scope <workspace>] [--push] [--json]
npx @sdxc/ci list <script> [--matrix <name>] [--json]
npx @sdxc/ci signoff [<sha>]
npx @sdxc/ci verify <sha> [--wait 60s] [--repo owner/name]
```

`--only` and `--skip` match step names, group names and entry addresses, with `*` spanning
`/`. `verify` exits 0 when someone with write access signed the commit off, 1 when nobody did,
and 2 when GitHub cannot be reached. The token comes from `GITHUB_TOKEN` (or `--token-env`),
then `gh auth token`.

## Patterns

### Pattern: Test, push and sign off in one command

```sh
npx @sdxc/ci run ci.ts --push
```

When every step passes, `--push` pushes exactly the tested commit to its upstream branch, then
posts the `sdxc/ci` status. A rejected push, because someone pushed first, exits 1: pull, then
run it again on the new commit.

### Pattern: Skip the hosted run for a signed-off commit

```yaml
jobs:
  gate:
    runs-on: ubuntu-latest
    outputs:
      signed: ${{ steps.verify.outputs.signed }}
    steps:
      - id: verify
        env:
          GITHUB_TOKEN: ${{ github.token }}
          SHA: ${{ github.event.pull_request.head.sha || github.sha }}
        run: |
          if npx @sdxc/ci verify "$SHA" --repo "$GITHUB_REPOSITORY" --wait 60s; then
            echo "signed=true" >> "$GITHUB_OUTPUT"
          fi
  ci:
    needs: gate
    if: needs.gate.outputs.signed != 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx @sdxc/ci run ci.ts
```

The gate needs no checkout: `--repo` names the repository. A skipped job counts as passing for
a required check, and a commit nobody with write access signed off runs in full.

### Pattern: One CI job per workspace

```yaml
jobs:
  entries:
    runs-on: ubuntu-latest
    outputs:
      keys: ${{ steps.list.outputs.keys }}
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - id: list
        run: echo "keys=$(npx @sdxc/ci list ci.ts --runner remote --matrix Workspaces --json)" >> "$GITHUB_OUTPUT"
  test:
    needs: entries
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        key: ${{ fromJSON(needs.entries.outputs.keys) }}
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx @sdxc/ci run ci.ts --only "Workspaces/${{ matrix.key }}"
```

`list` reads the same `ci.workspaces()` call the script makes, so a new workspace gets its own
job without editing the workflow.

### Pattern: Run one package and everything that depends on it

```sh
npx @sdxc/ci run ci.ts --scope packages/ui
```

Only the matrix entries for `packages/ui` and every workspace depending on it, directly or
through others, run. The script reads the same list from `ci.scope` to narrow its own steps:

```typescript
import { defineCI } from "@sdxc/ci";

export default defineCI(async (ci) => {
	let all = await ci.workspaces();
	let scoped = ci.scope === null ? all : all.filter((ws) => ci.scope?.includes(ws.path));
	let paths = scoped.flatMap((ws) => [
		ws.path,
		...all.filter((other) => ws.dependents.includes(other.name)).map((other) => other.path),
	]);
	await ci.step("Lint", ["eslint", ...new Set(paths)]);
	await ci.matrix("Workspaces", all, (ws) =>
		ci.step(`Test ${ws.name}`, "npm test", { cwd: ws.path }),
	);
});
```

A scoped run never signs off; run the whole script before you push.

### Pattern: Test only the workspaces that have tests

```typescript
import { defineCI } from "@sdxc/ci";

export default defineCI(async (ci) => {
	let tested = (await ci.workspaces()).filter((ws) => ws.has("**/*.test.{ts,tsx}"));
	await ci.matrix("Tests", tested, async (ws) => {
		await ci.step(`Test ${ws.name}`, "npm test", { cwd: ws.path, cache: true });
	});
});
```

`has()` matches the workspace's tracked files, so a workspace without a test file gets no entry,
and adding its first test adds one. With `cache: true`, a workspace is tested again only when it
or a workspace it depends on changed.

### Pattern: Each workspace with its own linter

```typescript
import { defineCI } from "@sdxc/ci";

export default defineCI(async (ci) => {
	let linted = (await ci.workspaces()).filter((ws) => {
		let scripts = ws.manifest.scripts as Record<string, string> | undefined;
		return scripts?.lint !== undefined;
	});
	await ci.matrix("Lint", linted, (ws) =>
		ci.step(`Lint ${ws.name}`, "npm run lint", { cwd: ws.path }),
	);
});
```

Each workspace declares its linter as its own `lint` script (ESLint in one, Stylelint in
another, a Markdown linter in the docs), and the script runs whichever one each declares.

### Pattern: Apps in other languages

```typescript
import { defineCI } from "@sdxc/ci";

const APPS = [
	{ name: "api", path: "services/api", lint: "go vet ./...", test: "go test ./..." },
	{ name: "worker", path: "services/worker", lint: "ruff check .", test: "pytest" },
	{
		name: "engine",
		path: "crates/engine",
		lint: "cargo clippy -- -D warnings",
		test: "cargo test",
	},
];

export default defineCI(async (ci) => {
	await ci.matrix("Apps", APPS, async (app) => {
		await ci.step(`Lint ${app.name}`, app.lint, { cwd: app.path, halt: true });
		await ci.step(`Test ${app.name}`, app.test, {
			cwd: app.path,
			cache: { inputs: [`${app.path}/**`] },
		});
	});
});
```

Steps are commands, so a Go service, a Python worker and a Rust crate run beside each other the
same way a JavaScript workspace does. Only the script itself is TypeScript, run by Node.

### Pattern: Time-box a step

```typescript
await ci.step("End-to-end", "npm run e2e", { timeout: 10 * 60_000 });
```

A step still running after `timeout` milliseconds is stopped and fails with "Timed out after
600000ms", so a hung browser or server never holds a run open.

### Pattern: Fail on a check of your own

```typescript
import { readFile } from "node:fs/promises";

import { defineCI } from "@sdxc/ci";
import { failure, success } from "@sdxc/result";

export default defineCI(async (ci) => {
	await ci.step("Build", "npm run build", { halt: true });
	await ci.step("Bundle size", async (step) => {
		let bundle = await readFile("dist/index.js");
		step.log(`dist/index.js is ${bundle.byteLength} bytes`);
		if (bundle.byteLength > 50_000) return failure(new Error("The bundle is over 50 kB"));
		return success(undefined);
	});
});
```

A function step's outcome is the [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result)
it returns, and its message lands in the step's output. Call `ci.failure` instead when the check
reads the whole run rather than one step.

### Pattern: Steps that run in one place only

```typescript
import { defineCI } from "@sdxc/ci";

export default defineCI(async (ci) => {
	if (ci.runner === "remote") {
		for (let example of await ci.files("apps/*/.env.example")) {
			await ci.step(`Secrets for ${example}`, [
				"cp",
				example,
				example.replace(/example$/, "local"),
			]);
		}
	}
	await ci.step("Test", "npm test");
});
```

On the CI host `ci.runner` is `"remote"`, so the copies never overwrite a laptop's real
`.env.local` files.
`--runner remote` reproduces a CI run locally.

### Pattern: Cache a step that writes files

```typescript
await ci.step("Build", "npm run build", {
	cache: { inputs: ["src/**", "package.json"], env: ["NODE_ENV"], outputs: ["dist"] },
});
```

The build is skipped while `src/`, `package.json` and `NODE_ENV` are unchanged and `dist/`
still holds what the build left. Delete or edit `dist/` and the next run builds again.

### Pattern: Sign off a commit you pushed later

```sh
npx @sdxc/ci run ci.ts
git push
npx @sdxc/ci signoff
```

Every green, complete run on a clean tree keeps a record of the commit it tested. `signoff`
posts the status from that record once GitHub has the commit, and refuses a commit no green run
recorded.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"devDependencies": {
		"@sdxc/ci": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
