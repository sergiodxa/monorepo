# @sdxc/spec

Executable specification runner for `.spec` files: describe behavior as setup, action and
expectation, and `spec` runs each test against your real app in an isolated workspace, under
permissions you grant explicitly.

A suite is a directory of `.spec` files (conventionally `spec/`) written in a deliberately tiny
language with no `if`, no loops and no operators. Every test runs in its own fresh temporary
directory, and every privileged act needs an explicit `--allow-*` grant.

## Installation

```sh
npm add -D @sdxc/spec
```

The `spec` command runs on [Bun](https://bun.sh), so keep `bun` on your `PATH`. The `browser`
capability also needs the [`agent-browser`](https://www.npmjs.com/package/agent-browser) CLI
installed globally; every other capability is self-contained. Programmatic results are
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) values.

## Usage

### Write a spec

Create `spec/greeting.spec`. A `test` has up to three phases, always in this order: `given`
(arrange), `when` (act) and `then` (assert). `use` lets a file call a namespace's tools by their
bare names.

```
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

test "the generated config is on disk" {
	given {
		write "package.json" { name: "demo", type: "module" }
	}
	then {
		expect file "package.json" contains "\"type\": \"module\""
	}
}
```

### Run it and grant what it needs

`write` stays inside the test's workspace and needs no grant; spawning `node` is privileged, so
grant exactly that executable:

```sh
npx spec run spec --allow-run=node
```

```
seed spec (replay with --seed=spec)
run mtw62dtrkgga (replay with --run-id=mtw62dtrkgga)

✓ the script prints its greeting
✓ the generated config is on disk

2 passed, 0 failed (21ms)
```

The header names the two flags that replay this exact run. Drop the grant and the test fails
before `node` launches; tests denied for the same grant collapse into one block naming the flag:

```
✗ Permission denied: run (1 test)

  The spec attempted to reach:
  > cli.run

  Re-run with an appropriate permission, for example:
  > spec run --allow-run

  Affected tests:
  - the script prints its greeting (spec/greeting.spec:9)
```

Start with no flags and let the denials tell you the suite's real footprint.

### Share steps with commands

A `command` is a reusable step: it takes parameters, performs effects and produces what it
`return`s. Every command resolves by name from any file, so shared ones usually live under
`spec/commands/`.

```
# spec/commands/catalog.spec
use fs

command book {
	return { title: "Dune", author: "Herbert", year: 1965 }
}

command seed_file(path) {
	write path "seeded"
}
```

```
# spec/catalog.spec
test "commands compose by name" {
	given {
		seed_file "out.txt"
	}
	when {
		let record = book
	}
	then {
		expect record.title "Dune"
		expect file "out.txt" contains "seeded"
	}
}
```

A command with no parameters is called by its bare name, and runs again on every call.

### Point the suite at your app

`spec/config.jsonc` names the addresses a suite reaches, each read from an environment variable
with an optional fallback, so one suite runs against a laptop, staging and CI unchanged:

```jsonc
{
	"bases": {
		"web": { "env": "WEB_BASE_URL", "default": "http://localhost:3000" },
	},
}
```

```
use http

test "the health check answers" {
	when {
		let response = get "/health"
	}
	then {
		expect response.status 200
	}
}
```

```sh
npx spec run spec --allow-net=localhost:3000
```

A `/path` target resolves against the base, and `--allow-net` keys on the resolved host.

### Run a suite from code

`runSuite` is the CLI without the process: it loads a directory, registers the built-in
capabilities and returns every outcome as data.

```typescript
import { isFailure } from "@sdxc/result";
import { createRunId, parseGrants, reportRunHeader, reportSuite, runSuite } from "@sdxc/spec";

let parsed = parseGrants(["--allow-net=localhost:3000"]);
if (isFailure(parsed)) throw parsed.error;

let runId = createRunId();
let sink = { write: (text: string) => process.stdout.write(text) };
reportRunHeader({ seed: "spec", runId, bases: [] }, sink);

let run = await runSuite({ root: "spec", grants: parsed.data.grants, runId, concurrency: 4 });
if (isFailure(run)) throw run.error;

reportSuite(run.data, new Map(), sink);
process.exitCode = run.data.failed > 0 ? 1 : 0;
```

## API

### The `.spec` language

#### Tests, phases and `skip`

`test "title" { given { … } when { … } then { … } }` — each phase is optional and they share one
scope. Statements end at the newline, and `#` comments to the end of the line (inside a string it
is text). `skip "reason" test "title" { … }` never runs the body and counts the test apart,
printing the reason.

#### `expect`

```
expect content "remember the milk"   # two values: deep structural equality
expect ready                         # one value: it must be true
expect file "notes.txt" exists       # an observable tool asserts directly
expect rows contains { id: 2 }       # substring of a string, member of an array
expect not page contains "beta"      # not inverts any form
```

A negative assertion also holds when the page never rendered, so pair it with a positive one. A
denied observable fails under `not` too, so a missing grant never reads as absence.

#### `let`, references and calls

`let name = <step>` binds a value; `name.field` reads into it and `name.0` indexes an array from 0.
A dotted path whose head is a binding is a reference; one whose head is a tool or command taking no
arguments is a call, so `let current = browser.url` and `let record = book` both run something.
A bare word in argument position is a symbol when the tool declares that word and the binding of
that name otherwise; a spelling that is both is an `ambiguous-name` error. Values are strings,
numbers, booleans, `null`, arrays (`[ "a", "b" ]`) and objects (`{ key: value }`).

#### `eventually within <duration>`

Retries the assertions in its block until they hold or the window (`2s`, `30s`) ends. It accepts
only assertions, and stands in `then`, a command body, `setup` or `teardown`.

#### `command name(params) { … }`

A suite-global, reusable step: parameters bind as values, `return` produces its result, and every
definition is registered before any test runs. A duplicate name across files is a load error.

#### `setup { … }` and `teardown { … }`

At most one of each per suite, in any file. `setup` runs once before every test, under the same
grants, and its failure stops the run with exit code `2`. `teardown` runs once after every test,
failures included. Both start from an empty scope, and `return` in either is an error.

#### `use <namespace>`

Imports a namespace's tool names into one file; a fully qualified name (`fs.write`) works
anywhere. A command body resolves bare names against its own file's `use` lines, and a bare name
two namespaces share is an error naming both.

### Capabilities

| Namespace | Tools                                                                                                    | Grant                      |
| --------- | -------------------------------------------------------------------------------------------------------- | -------------------------- |
| `fs`      | `write`, `read`, `mkdir`, `copy`, `remove`, `exists`, `file`, `directory`                                | none                       |
| `cli`     | `run`, `start`, `output`, `stop`                                                                         | `--allow-run`              |
| `http`    | `get`, `post`, `put`, `patch`, `delete`                                                                  | `--allow-net`              |
| `html`    | `title`, `meta`, `rel`, `text`, `element`, `heading`, `link`, `button`, `checkbox`, `cell`, `definition` | none                       |
| `browser` | actions, observables and `fetch.<verb>` (below)                                                          | `--allow-net`              |
| `db`      | `query`, `run_file`                                                                                      | `--allow-db`               |
| `env`     | `get`                                                                                                    | `--allow-env`              |
| `url`     | `query`, `fragment`, `path`, `host`                                                                      | none                       |
| `jwt`     | `decode`, `verify`                                                                                       | `--allow-net` for `verify` |
| `sample`  | one record per module, plus `int`, `float`, `words`, `pick`, `email`, `uuid`                             | none                       |
| `str`     | `format`                                                                                                 | none                       |
| `spec`    | `run_id`, `attempt`, `nonce`                                                                             | none                       |

#### `fs`

Paths resolve inside the test's workspace; leaving it needs `--allow-host-fs`. `write` stores a
string verbatim and any other value as JSON. `file <path> exists|contains <text>` and
`directory <path> exists` are the observables.

#### `cli`

`run <program> <args…> [in <dir>]` waits and returns `{ stdout, stderr, exit_code }`. `start`
takes the same arguments and returns a process handle at once; `output <process>` observes
everything it printed so far (so `eventually` waits on it) and `stop <process>` returns
`{ exit_code, output }`. Started programs belong to the run and stop when it ends, process group
included. The child sees only `PATH`, `HOME`, `TMPDIR` and the variables granted with
`--allow-env`; `in <dir>` resolves against where `spec run` was invoked and needs
`--allow-host-fs`.

#### `http`

`<verb> <target> [body] [options…]` returns `{ status, ok, headers, text, json }`; an error status
is a normal value. A bare body travels as `text/plain` for a string and JSON otherwise. Options
come in any order: `headers { … }`, `json <value>`, `form { … }`, `text "<string>"`,
`bearer <token>`, `basic <user> <pass>`. A request takes one body, one `headers` block and one
auth option, and an explicit `authorization` header wins over `bearer`/`basic`.

#### Bases

`http`, `browser` and `browser.fetch` resolve a `/path` target against a base from
`spec/config.jsonc`; `on "name"` picks one when several exist. A target with a scheme ignores the
bases. A base whose variable is unset and has no `default` stops the run naming the variable.

#### Addressing elements (`html` and `browser`)

`html` tools take an HTML string first (usually `response.text`); `browser` tools read the live
page. Both address elements by ARIA role and accessible name, under the same rules:

- `element <role> "<name>"`, with `heading`, `link`, `button` and `checkbox` as shorthands.
  `heading "Billing" level 2` pins the outline level.
- Names match exactly; `containing` opts into a substring. `text "<string>"` is the reverse: a
  substring over the visible text, with `exactly` for equality.
- Several matches is an error listing them; `first`, `nth <n>` and `last` (from 1) choose.
- `field "<name>"` addresses by `name` attribute (a password input has no role), and
  `value "<v>"` narrows a group sharing a name.
- Predicates: `count <n>`, `value <v>`, `attribute <name> <v>`, `enabled`, `disabled`,
  `in_viewport` (browser only), and `exists` for deliberate absence.
- `cell row <r> column <c>` (1-based, `including header` to count it) and
  `definition "<term>"` read tables and description lists.
- A trailing string compares the element's text; with no expected value or predicate the lookup
  asserts presence and returns the text, so it can be bound.

`html.title`, `html.meta <name|property>` and `html.rel <rel>` read the document's own metadata.
A miss lists the near matches, and `browser` matches only rendered elements.

#### `browser`

Actions: `open`, `navigate`, `reload`, `click`, `fill … with`, `type … with`, `select … with`,
`check`, `uncheck`, `press`, `click_selector`, `scroll to <y|element>`, `viewport`, `ua`,
`set_cookie <name> <value> [for <url>]` and `fetch.<verb>` (the `http` grammar, inside the
session's cookies). Observables: the addressing tools, `cookie`, `response_status [of document|data]`,
`response_header <name> [of …]`, `url`, `path`, `query <name>`, `fragment <name>` and `title`;
called bare, they return a value. Each test gets its own session. `viewport` takes a width and
height or a name:

| Name  | Size       |
| ----- | ---------- |
| `xs`  | 390 × 844  |
| `sm`  | 640 × 1138 |
| `md`  | 768 × 1024 |
| `lg`  | 1024 × 768 |
| `xl`  | 1280 × 800 |
| `2xl` | 1536 × 998 |

A header reads as an array of every value it carried; `Set-Cookie` is read with `cookie`.

#### `db`

`query "<sql>" [params <value|array>] [on "<name>"] [one]` runs on Bun's SQL client and returns
`{ rows, affected_rows, count }`; `params` binds `$1`, `$2`, … and `one` returns the single row,
failing on any other count. `run_file "<path>" [on "<name>"]` sends a SQL file unparsed, multiple
statements included, and also needs `--allow-host-fs`. Connections come from the `databases` key.

#### `env`, `url`, `jwt`

`env.get "NAME" [fallback]` reads one granted variable, failing when unset without a fallback.
`url.query|fragment <url> <name>`, `url.path <url>` and `url.host <url>` parse a URL.
`jwt.decode <token>` returns `{ header, payload }` unverified; `jwt.verify <token> <jwks_url>`
checks an ES256 signature against the issuer's JWKS plus expiry, and returns the payload.

#### `sample`

Each module returns a record whose fields agree with each other, drawn from the run's seed and the
test's file and title, so data reproduces whatever the concurrency:

| Tool              | Fields                                                                                                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sample.person`   | `first_name`, `last_name`, `full_name`, `prefix`, `suffix`, `sex`, `gender`, `zodiac_sign`, `job_title`, `bio`, `email`, `username`, `phone`                            |
| `sample.internet` | `email`, `username`, `url`, `domain_name`, `password`, `ip`, `ipv4`, `ipv6`, `mac`, `port`, `protocol`, `http_method`, `http_status_code`, `jwt`, `user_agent`, `emoji` |
| `sample.location` | `country`, `city`, `country_code`, `state`, `county`, `street`, `street_address`, `zip_code`, `postal_address`, `latitude`, `longitude`, `time_zone`                    |
| `sample.company`  | `name`, `catch_phrase`, `buzz_phrase` and their parts                                                                                                                   |
| `sample.lorem`    | `word`, `words`, `sentence`, `paragraph`, `lines`, `slug`, `text`                                                                                                       |
| `sample.date`     | `past`, `future`, `recent`, `soon`, `anytime`, `birthdate`, `month`, `weekday`, `time_zone` (ISO timestamps)                                                            |
| `sample.string`   | `uuid`, `ulid`, `nanoid`, `alpha`, `alphanumeric`, `numeric`, `hexadecimal`, `binary`, `octal`, `symbol`                                                                |
| `sample.number`   | `int`, `float`, `hex`, `binary`, `octal`, `roman_numeral`, `big_int`                                                                                                    |
| `sample.color`    | `human`, `hex`, `rgb`, `hsl`, `space`, `css_function`                                                                                                                   |
| `sample.datatype` | `boolean`                                                                                                                                                               |
| `sample.git`      | `branch`, `commit_sha`, `short_sha`, `commit_message`, `commit_date`, `commit_entry`                                                                                    |
| `sample.hacker`   | `abbreviation`, `adjective`, `noun`, `verb`, `ingverb`, `phrase`                                                                                                        |
| `sample.phone`    | `number`, `national`, `international`, `imei`                                                                                                                           |
| `sample.system`   | `file_name`, `file_ext`, `file_type`, `mime_type`, `directory_path`, `file_path`, `network_interface`, `semver`, `cron`                                                 |

`sample.int <min> <max>`, `sample.float <min> <max>`, `sample.words <count>`, `sample.pick <list>`,
`sample.email` and `sample.uuid` return single values. Every draw advances the stream, so `sample`
stays out of `eventually`.

#### `str`

`format "<template>" <values…>` fills `${0}` holes by position or `${name}` holes from one object.
Values stringify as JSON without quotes, a bare `$` is literal and `{{` writes a literal `${`. A
hole without a value, an unused value, mixed hole styles, or a `null`/object/array value is an
error.

#### `spec`

`spec.run_id` names the run, `spec.attempt` counts the test's attempts from 1, and `spec.nonce`
is `<run_id>-<attempt>`: compose it into any value that must be unique across runs and retries.

### CLI

```
spec run [directory] [flags]     Run every .spec file under directory (default ./spec)

  --allow-run[=name,…]           Spawn processes, by executable basename
  --allow-net[=host[:port],…]    Reach the network, by host and optional port
  --allow-env[=VAR,…]            Read environment variables, by name
  --allow-host-fs[=dir,…]        Touch files outside the workspace, by path prefix
  --allow-db[=name,…]            Query databases, by connection name
  --allow-plugins[=ns,…]         Launch plugins spec/config.jsonc declares
  --allow-config                 Apply the permissions spec/config.jsonc declares
  --concurrency=N (--jobs=N)     Run up to N tests at once (default 1)
  --retries=N                    Retry a failing test N more times (default 0)
  --seed=VALUE | --seed=random   Seed generated data (default: fixed)
  --run-id=VALUE                 Replay the run id a header printed
  --artifacts=DIR                Write failure screenshots and documents under DIR
```

A bare `--allow-*` grants the whole family, a scoped one only what it lists, and repeated flags
union. Exit codes: `0` everything passed, `1` a test failed, `2` a usage or load error. Results
print in source order at any concurrency; a test that passes only on a retry is counted `flaky`
with the failed attempt's diagnostics.

### `spec/config.jsonc`

JSONC with four optional keys:

- `bases`: `{ "<name>": { "env": "VAR", "default": "<url>" } }`, applied on every run.
- `databases`: `{ "<name>": { "env": "VAR" } }`, applied on every run.
- `plugins`: `{ "<ns>": { "command": ["bun", "./plugin.ts"] } }`; an argument starting with `.`
  resolves against the config's directory. Launching one needs `--allow-plugins`.
- `permissions.allow`: family names (`"run"`, `"net"`, `"env"`, `"host-fs"`, `"db"`,
  `"plugins"`) or `[family, ...scopes]` tuples, inert until `--allow-config`, then unioned with
  the flags.

### Running suites

#### `runSuite(options: RunOptions): Promise<Result<SuiteResult, SpecError>>`

Loads every `.spec` file under `options.root` and runs it with the built-in plugins. Options:
`grants` (required), `plugins` (added to the built-ins), `builtins` (the namespaces to register;
one left out does not exist), `concurrency`, `seed`, `runId`, `retries`, `bases`, `connections`
and `artifacts`. Test failures are outcomes in the result; only a load, `setup` or workspace
failure is a `Failure`.

#### `runTests(options: RunTestsOptions): Promise<Result<SuiteResult, SpecError>>`

The runtime under `runSuite`, with everything injected: `suite`, the complete `plugins` list,
`grants` and `createWorkspace`, plus the same optional fields and `root` (the directory a test's
seed measures its file against).

#### `loadSuite(root: string): Promise<Result<LoadedSuite, SpecError>>`

Reads and parses every `.spec` file under `root`, sorted by path, and registers its commands and
hooks.

#### `loadSources(sources: readonly SpecSource[]): Result<LoadedSuite, SpecError>`

Parses `{ path, text }` pairs from anywhere; `path` only labels diagnostics.

#### `parseGrants(args: string[]): Result<{ grants: Grants; remaining: string[] }, SpecError>`

Reads the `--allow-run|net|env|host-fs|db` flags from an argument list and passes the rest
through in `remaining`.

#### `createPermissionSet(grants: Grants): PermissionSet`

The checks every tool asks (`checkRun`, `checkNet`, `checkEnv`, `checkHostFs`, `checkDb`), each
failing with a `PermissionDeniedError` that names the flag to add.

#### `createBaseSet(bases: readonly Base[]): BaseSet` / `createConnectionSet(connections: readonly Connection[]): ConnectionSet`

The named bases and database connections a run resolves `on "name"` against.

#### `createArtifactStore(directory: string): ArtifactStore`

Where failing tools write screenshots, accessibility trees and documents.

#### `createRunId(): string`

A fresh, URL-safe run id for `runId` and the run header.

#### `createWorkspace(permissions: PermissionSet)` / `createNoFilesystemWorkspace()`

Workspace factories for `runTests`: a fresh temporary directory per test, or a workspace that
refuses every path.

#### `reportRunHeader(header: RunHeader, sink: Sink): void`

Writes the seed, the run id and each base, as the CLI prints them.

#### `reportSuite(suite: SuiteResult, sources: Map<string, SourceFile>, sink: Sink): void`

Writes a line per test, grouped denials and the summary; `sources` turns spans into line numbers.

#### `reportFatal(error: SpecError, sink: Sink): void`

Writes a load-time failure with its location and remedy.

### Plugins

#### `createBuiltinPlugins(only?: readonly BuiltinNamespace[]): Plugin[]` and `BUILTIN_NAMESPACES`

Every built-in plugin, or the named subset.

#### Plugin factories

`createFsPlugin`, `createCliPlugin`, `createHttpPlugin`, `createBrowserPlugin`, `createHtmlPlugin`,
`createDbPlugin`, `createEnvPlugin`, `createUrlPlugin`, `createJwtPlugin`, `createSamplePlugin`,
`createStrPlugin` and `createSpecPlugin` each build one namespace and take no arguments, except:

#### `createHttpPlugin(options?: HttpPluginOptions): Plugin`

`maxResponseBytes` caps each response body, refusing it with a `ResponseTooLargeError` as soon as
the declared length or the streamed bytes pass the cap. Omitted, bodies are read whole.

#### `connectStdioPlugin(command: string[], namespace: string): Promise<Result<Plugin, SpecError>>`

Spawns an external plugin and talks NDJSON over its stdio; `dispose()` kills it.

#### `servePlugin(plugin: Plugin): Promise<undefined>`

The plugin side of that protocol: serves `plugin` on stdin/stdout until stdin closes.

#### `createToolContext(overrides?: Partial<ToolContext>): ToolContext`

A complete tool context with nothing granted, for calling a plugin directly in its tests.

#### Addressing helpers

`parseQuery`, `parseFill`, `parseAssertion`, `describeQuery`, `formatCandidates`,
`ambiguousMatch`, `noMatch`, and the parameter lists `QUERY_PARAMS`, `ASSERTION_PARAMS` and
`FILL_PARAMS` give a plugin the same element-addressing grammar and diagnostics `html` and
`browser` use.

### Language internals

`lex(source)`, `parse(source)` (a `SourceFile` into a `SpecFileNode`), `positionAt(source,
offset)`, `KEYWORDS`, `createRegistry(plugins, suite)`, `executeTest(test, context)`,
`executeHook(hook, context)`, `valueEquals(left, right)` (the equality `expect` uses) and
`formatValue(value)` expose each stage for tools built on the language.

### Errors

Every failure is a `SpecError` with a stable `code` (`DiagnosticCode`), optional `file`, `span`,
`remedy`, `hint` and `artifacts`. Subclasses: `ParseError`, `LoadError`, `ResolutionError`
(`candidates`), `ExpectationError` (`expected`, `observed`), `PermissionDeniedError`
(`permission`, `resource`), `ToolError`, `ResponseTooLargeError` (`limit`, `declared`) and
`WorkspaceEscapeError` (`attemptedPath`).

### `@sdxc/spec/workers`

The language core for a runtime with no process or filesystem: `loadSources`, `runTests`,
`createNoFilesystemWorkspace`, `parseGrants`, the base and connection sets, the errors, and the
`http`, `html`, `url`, `jwt`, `sample`, `str` and `spec` plugin factories.

### Types

- `Plugin`: `namespace`, `describe(): ToolDescriptor[]`, `call(tool, args, context)` and an
  optional `dispose()`.
- `ToolDescriptor`, `ToolParam`: a tool's name, summary, `kind` (`"action"` or `"observable"`;
  only observables run in `eventually` or head an `expect`), `requires` and parameters.
- `ToolContext`: `workspace`, `permissions`, `random` (a seeded stream from
  [`@sdxc/random`](https://www.npmjs.com/package/@sdxc/random)), `now`, `run`, `bases`,
  `connections` and `artifacts`.
- `ToolArg`, `Value`, `ValueObject`: a call's arguments (`{ kind: "value" }` or
  `{ kind: "word" }`) and the values a spec handles.
- `SuiteResult`, `TestResult`, `TestStatus`: per-test outcomes and the `passed`, `failed`,
  `skipped` and `flaky` counts, with `runId` and `wallMs`.
- `Grants`, `Grant`, `PermissionKind`, `PermissionSet`; `Base`, `BaseSet`, `Connection`,
  `ConnectionSet`; `ArtifactStore`; `Workspace`, `WorkspaceFactory`; `RunOptions`,
  `RunTestsOptions`, `RunIdentity`, `RunHeader`, `Sink`; `LoadedSuite`, `SpecSource`,
  `SourceFile`, `Position`, `Span`, `Token`, `TokenKind`, `Registry`, `ResolvedCallable`,
  `ExecutionContext`, the AST node types, and the addressing types (`ElementQuery`,
  `ParsedQuery`, `Assertion`, `Candidate`, …).

## Pattern: Test an HTTP API and its pages without a browser

`http` reaches the app, `html` asserts on the markup it served, and `env` supplies a token
without the spec containing it.

```jsonc
// spec/config.jsonc
{
	"bases": {
		"web": { "env": "WEB_BASE_URL", "default": "http://localhost:3000" },
	},
}
```

```
use http
use html
use env

test "creating a post returns it" {
	when {
		let token = env.get "API_TOKEN"
		let response = post "/api/posts" json { title: "Hello" } bearer token
	}
	then {
		expect response.status 201
		expect response.json.title "Hello"
	}
}

test "the posts page describes itself" {
	when {
		let page = get "/posts"
	}
	then {
		expect page.status 200
		expect title page.text "All posts"
		expect meta page.text "og:image" containing "/og/posts.png"
		expect rel page.text "canonical" "https://example.com/posts"
		expect heading page.text "Posts" level 1
		expect cell page.text row 1 column 2 "Hello"
		expect link page.text "Profile" count 2
	}
}

test "the token endpoint rejects a bad code" {
	when {
		let response = post "/oauth/token" form { grant_type: "authorization_code", code: "bogus" } basic "client" "secret"
	}
	then {
		expect response.status 400
	}
}
```

```sh
API_TOKEN=… npx spec run spec --allow-net=localhost:3000 --allow-env=API_TOKEN
```

## Pattern: Drive a sign-in flow in a browser

A `browser` session per test, addressed the way a person reads the page, waiting on navigation
with `eventually`.

```
use browser
use env

test "signing in lands on the dashboard" {
	when {
		open "/login"
		fill textbox "Email" with "user@example.com"
		fill field "password" with "correct horse"
		click button "Sign in"
	}
	then {
		eventually within 5s {
			expect path "/dashboard"
		}
		expect heading "Dashboard"
		expect cookie "session" exists
		expect response_status 200
	}
}

test "a signed-in session skips the form" {
	given {
		let session = env.get "SESSION_COOKIE"
		set_cookie "session" session for "http://localhost:3000/"
		viewport "xs"
	}
	when {
		open "/dashboard"
		select combobox "Plan" with "Annual"
		let step = query "step"
	}
	then {
		expect step "billing"
		expect element button "Upgrade" enabled
	}
}
```

```sh
npx spec run spec --allow-net=localhost:3000 --allow-env=SESSION_COOKIE --artifacts=./artifacts
```

A failed lookup lists the near matches and, under `--artifacts`, writes a screenshot and an
accessibility-tree dump.

## Pattern: Seed a database with unique, reproducible data

`setup` loads the schema once, `sample` draws reproducible input, `spec.nonce` makes the one
unique value, and `teardown` removes what the run wrote.

```jsonc
// spec/config.jsonc
{
	"bases": { "web": { "env": "WEB_BASE_URL", "default": "http://localhost:3000" } },
	"databases": { "web": { "env": "DATABASE_URL" } },
}
```

```
use db
use http
use sample
use str

setup {
	run_file "db/schema.sql"
}

teardown {
	let pattern = format "%-${0}-%" spec.run_id
	query "delete from accounts where slug like $1" params pattern
}

command signed_up_account {
	let who = sample.person
	let slug = format "${name}-${nonce}" { name: who.username, nonce: spec.nonce }
	let created = post "/signup" json { email: who.email, name: who.full_name, slug: slug }
	expect created.status 201
	return query "select * from accounts where slug = $1" params slug one
}

test "a new account starts on the free plan" {
	when {
		let account = signed_up_account
	}
	then {
		expect account.plan "free"
	}
}
```

```sh
npx spec run spec --allow-net=localhost:3000 --allow-db=web --allow-host-fs=./db
```

Data stays the same on every run; `--seed=random` shakes the suite for hidden dependence on
particular values and prints the seed to replay. The nonce moves with each attempt, so
`--retries` never collides with the rows a failed attempt wrote.

## Pattern: Boot the app under test

`cli.start` in `setup` launches a server once for the whole run, and `eventually` waits for it to
come up. The run stops it at the end.

```
use cli
use http

setup {
	let server = start "bun" "run" "dev" in "."
	eventually within 30s {
		expect output server contains "localhost:3000"
	}
}

test "the home page answers" {
	when {
		let response = get "http://localhost:3000/"
	}
	then {
		expect response.status 200
	}
}
```

```sh
npx spec run spec --allow-run=bun --allow-host-fs=. --allow-net=localhost:3000
```

A failing `output … contains` on a program that already exited says so, which diagnoses a crash
on boot.

## Pattern: Declare permissions with the suite

The suite carries its grants in `spec/config.jsonc`; they stay inert until an operator who read
the file passes `--allow-config`, so a cloned project fails closed with the normal denials.

```jsonc
// spec/config.jsonc
{
	"permissions": {
		"allow": ["run", ["net", "localhost:3000"], ["db", "web"]],
	},
}
```

```sh
npx spec run spec --allow-config
npx spec run spec --allow-config --allow-env=CI --concurrency=4 --retries=1
```

Flags only add to the declared set, and a denial the config would cover points at
`--allow-config`.

## Pattern: Write a plugin

A plugin is one namespace of typed tools. Serve it over stdio from any script, declare it in the
config, and grant its launch.

```typescript
// spec/greeter.ts
import type { Plugin } from "@sdxc/spec";

import { failure, success } from "@sdxc/result";
import { servePlugin, ToolError } from "@sdxc/spec";

let greeter: Plugin = {
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

await servePlugin(greeter);
```

```jsonc
// spec/config.jsonc
{
	"plugins": {
		"greet": { "command": ["bun", "./greeter.ts"] },
	},
}
```

```
use greet

test "the greet plugin greets by name" {
	when {
		let message = hello "world"
	}
	then {
		expect message "Hello, world!"
	}
}
```

```sh
npx spec run spec --allow-plugins=greet
```

A served plugin receives the whole `ToolContext` on every call, so it resolves bases, checks
permissions and reads `context.run.nonce` like a built-in; a `PermissionDeniedError` it returns
keeps its remedy. Pass the same object to `runSuite({ plugins: [greeter] })` to run it in-process,
and test it directly with `greeter.call("hello", args, createToolContext())`.

## Pattern: Run specs inside a Worker

`@sdxc/spec/workers` runs specs held as strings, with only the capabilities that need no process
or filesystem, and caps response bodies for an untrusted suite.

```typescript
import { isFailure } from "@sdxc/result";
import {
	createBaseSet,
	createHtmlPlugin,
	createHttpPlugin,
	createNoFilesystemWorkspace,
	createSpecPlugin,
	loadSources,
	parseGrants,
	runTests,
} from "@sdxc/spec/workers";

export default {
	async fetch(request: Request) {
		let source = await request.text();
		let suite = loadSources([{ path: "submitted.spec", text: source }]);
		if (isFailure(suite)) return Response.json({ error: suite.error.message }, { status: 400 });

		let parsed = parseGrants(["--allow-net=example.com"]);
		if (isFailure(parsed)) return Response.json({ error: parsed.error.message }, { status: 500 });

		let run = await runTests({
			suite: suite.data,
			plugins: [
				createHttpPlugin({ maxResponseBytes: 1_048_576 }),
				createHtmlPlugin(),
				createSpecPlugin(),
			],
			grants: parsed.data.grants,
			createWorkspace: createNoFilesystemWorkspace,
			bases: createBaseSet([{ name: "site", url: "https://example.com" }]),
		});
		if (isFailure(run)) return Response.json({ error: run.error.message }, { status: 422 });

		return Response.json({
			passed: run.data.passed,
			failed: run.data.failed,
			failures: run.data.results
				.filter((result) => result.status === "failed")
				.map((result) => ({ title: result.title, code: result.error?.code })),
		});
	},
};
```

A namespace left out of `plugins` does not exist to the spec, so `fs.write` here fails as an
unknown name.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/spec": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
