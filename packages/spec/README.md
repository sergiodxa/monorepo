# @sdxc/spec

An executable specification runner. You describe behavior in `.spec` files —
setup, action, expectation — and `spec` runs each one against your real app, in
an isolated workspace, under permissions you grant explicitly.

A suite is a directory of `.spec` files (conventionally `spec/`), each written
in a deliberately tiny language — no `if`, no loops, no operators. Every test
runs in its own fresh temporary directory, and every privileged act needs an
explicit `--allow-*` grant.

## Installation

```bash
npm add -D @sdxc/spec
```

The `spec` command runs on [Bun](https://bun.sh), so keep `bun` on your `PATH`.
Then invoke the CLI through your package runner:

```bash
npx spec run spec
```

`bunx @sdxc/spec run spec` runs it without installing first. The `browser`
capability additionally needs the `agent-browser` CLI installed globally; every
other capability is self-contained.

## Usage

### Write a suite

Create `spec/greeting.spec`:

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

### Run it

`write` creates files in the test's workspace and `run` starts processes there.
Spawning `node` is a privileged act, so grant exactly that one executable:

```bash
npx spec run spec --allow-run=node
```

```
✓ the script prints its greeting
✓ the generated config is on disk

2 passed, 0 failed (21ms)
```

`spec run` takes a directory (default `./spec`) and scans it recursively for
`.spec` files.

### Read a denial

Drop the grant and the process-spawning test fails before `node` is ever
launched. Tests denied for the same missing grant collapse into one block naming
the flag that would unblock them:

```
✗ Permission denied: run (1 test)

  The spec attempted to reach:
  > cli.run

  Re-run with an appropriate permission, for example:
  > spec run --allow-run

  Affected tests:
  - the script prints its greeting (spec/greeting.spec:9)
```

Start with no flags and let the denials tell you the suite's true footprint.

## The language

### Tests and phases

A `test` has up to three phase blocks, always in this order: `given` (arrange),
`when` (act), `then` (assert). Each is optional. Lines end statements, and `#`
starts a comment to end of line (a `#` inside a string is just text).

```
test "a write is read back verbatim" {
	given {
		write "notes.txt" "remember the milk"   # arrange
	}
	when {
		let content = read "notes.txt"           # act, capture a value
	}
	then {
		expect content "remember the milk"       # assert
	}
}
```

### `expect`

`expect` has three forms:

```
expect content "remember the milk"   # two values: deep structural equality
expect true                          # one value: it must be true
expect file "notes.txt" exists       # observable: assert straight from a capability
```

The observable form reads the world through a capability (`file … exists`,
`file … contains`, `directory … exists`, `browser.heading …`) and passes when
that observation holds.

### `let` and references

`let` binds the result of a step, and a dotted reference reaches into a returned
object:

```
when {
	let result = run "node" "build.js"
}
then {
	expect result.exit_code 0
	expect result.stdout "built\n"
}
```

A bare word in tool-argument position is a symbol, not a variable:
`write "f" content` hands the tool the literal word `content`. To pass a bound
value to a tool, use a dotted reference (`result.stdout`), boxing it in an object
if needed (`let x = { path: p }`, then `write x.path …`).

On the right of `let` or `return`, a dotted path whose head names a binding is a
reference. When the head names a tool that takes no arguments instead, the path
is a zero-argument tool call, so `let current = browser.url` binds that tool's
observed value, permission-gated like any other call.

### `eventually`

Wrap an observable assertion in `eventually` to retry it until it holds or the
window ends — for anything that becomes true a moment later, such as a server
coming up or an async write landing. A plain assertion checks exactly once.

```
then {
	eventually within 2s {
		expect file "ready.txt" exists
	}
}
```

Only assertions may be retried; an action inside `eventually` is an error.

### `command` and `fixture`

A command is a reusable step; a fixture is reusable data (its value is whatever
it `return`s). Define them in the same file, or share them suite-wide by putting
them under `spec/commands/` and `spec/fixtures/`. Either way they resolve by
name from anywhere — no import, no path — because every definition is registered
before any test runs.

```
# spec/fixtures/book.spec
fixture book {
	return { title: "Dune", author: "Herbert", year: 1965 }
}

# spec/commands/seed.spec
use fs

command seed_file(path) {
	let target = { path: path }
	write target.path "seeded"
}

# spec/tour.spec
test "commands and fixtures compose by name" {
	given {
		seed_file "out.txt"          # run a command for its effect
	}
	when {
		let record = fixture book    # run a fixture for its value
	}
	then {
		expect record.title "Dune"
		expect file "out.txt" contains "seeded"
	}
}
```

### `use` and namespaces

Capabilities live in namespaces (`fs`, `cli`, `http`, …). Use a fully qualified
name anywhere (`fs.write`, `cli.run`), or `use` a namespace at the top of a file
to call its tools by their bare names (`write`, `run`). `use` applies per file;
suite commands and fixtures need no `use` at all. An ambiguous bare name is an
error naming both candidates.

## Capabilities

`fs`, `url`, and `sample` need no grant; the rest are privileged and denied
until you grant them.

### `fs` — the workspace filesystem

Every path resolves inside the test's workspace. Tools: `write`, `read`,
`mkdir`, `copy`, `remove`, and the observables `exists`, `file`, `directory`.
Strings are written verbatim; objects and arrays are written as JSON.

```
use fs

test "mkdir, copy, and remove move files around the workspace" {
	given {
		mkdir "src"
		write "src/index.ts" "export const answer = 42"
	}
	when {
		copy "src/index.ts" "dist/index.ts"
		remove "src/index.ts"
	}
	then {
		expect directory "src" exists
		expect file "dist/index.ts" contains "answer = 42"
	}
}
```

### `cli` — run processes · `--allow-run`

`run` spawns a program in the workspace and returns
`{ stdout, stderr, exit_code }`. The grant is scoped by executable basename. The
child gets a minimal environment (`PATH`, `HOME`, `TMPDIR`, plus only the
variables granted with `--allow-env`), so your host environment stays out of it.

```
use cli

test "run captures stdout and the exit code" {
	when {
		let result = run "echo" "hello"
	}
	then {
		expect result.exit_code 0
		expect result.stdout "hello\n"
	}
}
```

```bash
npx spec run spec --allow-run=echo
```

### `http` — call an HTTP API · `--allow-net`

`get`, `post`, `put`, `patch`, and `delete`, each needing `--allow-net` for the
URL's host (and port, if you scope one). URLs must be absolute. An optional bare
body travels as `text/plain` when it is a string and as JSON otherwise. Each
returns `{ status, ok, headers, text, json }`; an HTTP error status is a normal
value, and only a network-level failure is an error.

```
use http

test "creating a post returns 201" {
	when {
		let response = http.post "http://localhost:3000/api/posts" { title: "Hello" }
	}
	then {
		expect response.status 201
	}
}
```

```bash
npx spec run spec --allow-net=localhost:3000
```

After the URL, a request takes word-tagged options in any order:

- `headers { Name: "value", … }` — request headers. Numbers and booleans
  stringify, header names are case-insensitive, and an explicit `content-type`
  here overrides the body's.
- `form { field: "value", … }` — a body sent as
  `application/x-www-form-urlencoded`.
- `json <value>` — a body sent as `application/json`.
- `text "<string>"` — a body sent as `text/plain`.
- `bearer <token>` — sets `Authorization: Bearer <token>`.
- `basic <user> <pass>` — sets `Authorization: Basic base64(user:pass)`. It is
  the one option that takes two values.

The options combine, so an authenticated form post is one call:

```
when {
	let response = http.post "http://localhost:3000/oauth/token" form {
		grant_type: "authorization_code"
		code: "bogus"
	} basic "the-client-id" "the-secret"
}
```

A request carries at most one body (the bare body, or one of `json`, `form`,
`text`), at most one `headers` block, and at most one auth option. A second
body, a body on a `GET`, both `bearer` and `basic`, or an unknown tag is an
error, and an explicit `headers.authorization` wins over `bearer` and `basic`.

### `browser` — drive a real browser · `--allow-net`

Drive a browser through its accessibility tree: address elements by role (a bare
word) and accessible name (a string). Actions are `open`, `navigate`, `cookie`,
`ua`, `click`, `fill … with …`, `check`, `press`, and `click_selector`;
observables are `heading`, `link`, `button`, `text`, `checkbox`, `url`, and
`title`. Each needs `--allow-net` for the target host. The capability is backed
by the globally installed `agent-browser` CLI, loaded lazily, so the grant and
the binary matter only to a suite that reaches for `browser.*`.

```
use browser

test "the sign-in form authenticates" {
	when {
		browser.open "http://localhost:3000/login"
		browser.fill textbox "Email" with "user@example.com"
		browser.fill textbox "Password" with "correct horse"
		browser.click button "Sign in"
	}
	then {
		expect browser.heading "Welcome back"
		expect browser.title "My App"
		expect browser.url "http://localhost:3000/home"
	}
}
```

`browser.heading` also takes a level, for when the rung of the document outline
is part of the behavior: `expect browser.heading "Billing" level 2` matches an
`<h2>` and equally a `role="heading"` with `aria-level="2"`. A heading of that
name at another level fails with the levels it did find.

`browser.url` and `browser.title` read as values too: `let current = browser.url`
binds the session's current URL, so a spec can pull the authorization `code` out
of the page the browser landed on.

```
when {
	browser.click button "Authorize"
	let landing = browser.url             # capture the redirect URL
	let where = { url: landing }
	let code = url.query where.url "code" # read ?code=… out of it
}
```

`browser.cookie "session" value for "http://localhost:3000/app"` seeds the
session's cookie jar, so a test about what comes after sign-in can arrive
already signed in. The `for` clause names the URL the cookie belongs to, which is what
lets it be set before the first navigation; drop the clause to set it on the
page already open.

`browser.ua "spec-runner/1.0"` sets the `User-Agent` the session sends, so the
app can recognize its own spec run. Set it before `open`; it applies to requests
made after it, and changes the request header only, so `navigator.userAgent`
inside the page still reports the real browser.

### `db` — query a database · `--allow-env=DATABASE_URL`

`db.query` runs raw SQL on Bun's SQL client and returns
`{ rows, affected_rows, count }`. It reads the connection string from the
`DATABASE_URL` environment variable, so granting that one variable is the whole
authorization and the environment alone chooses the target. The connection opens
lazily on the first query and closes at the end of the run.

```
use db

test "an INSERT reports exactly one affected row" {
	when {
		let result = db.query "INSERT INTO ledger (entry) VALUES ('opening balance')"
	}
	then {
		expect result.affected_rows 1
		expect result.count 0
	}
}
```

```bash
DATABASE_URL=postgres://localhost/test npx spec run spec --allow-env=DATABASE_URL
```

### `env` — read a granted variable · `--allow-env`

`env.get NAME` reads one environment variable, and only one the caller granted
by name — so a spec names a secret without containing one, and the same spec
runs against local, staging, and CI. An unset variable is an error unless you
give `env.get` a fallback as its optional second argument.

```
use env
use browser

test "the dashboard renders for a signed-in session" {
	given {
		let token = env.get "SESSION_COOKIE"
		let jar = { session: token }
		browser.cookie "session" jar.session for "http://localhost:3000/app"
	}
	when {
		browser.open "http://localhost:3000/app"
	}
	then {
		expect browser.heading "Dashboard"
	}
}
```

```bash
SESSION_COOKIE=… npx spec run spec --allow-env=SESSION_COOKIE --allow-net=localhost:3000
```

### `url` — parse a URL · no grant

Pure URL parsing, so a spec reads a value straight out of a URL it already
holds.

- `url.query <url> <name>` — the value of a query-string parameter.
- `url.fragment <url> <name>` — the value of a parameter after the `#`.
- `url.path <url>` — the URL's pathname.
- `url.host <url>` — its host and port.

A missing parameter, a non-string argument, or an unparseable URL is an error.

```
when {
	let code = url.query "http://localhost:3000/callback?code=abc123&state=s" "code"
}
then {
	expect code "abc123"
}
```

### `sample` — generate a suite's input · no grant

Names, addresses, identifiers, and numbers drawn per test, instead of literals
typed into the suite. Every value reproduces: the same test draws the same data
on every run, so a failure on generated input is replayable. Each module is one
tool returning a record of everything it generates, so bind it and read fields
by path:

```
use sample
use http

test "a visitor signs up from somewhere" {
	given {
		let who = sample.person
		let where = sample.location
	}
	when {
		let created = http.post "http://localhost:3000/signup" json {
			email: who.email
			name: who.full_name
			city: where.city
			country: where.country
		}
	}
	then {
		expect created.status 201
	}
}
```

| Tool              | The record holds                                                                                                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sample.person`   | `first_name`, `last_name`, `full_name`, `prefix`, `suffix`, `sex`, `gender`, `zodiac_sign`, `job_title`, `bio`, `email`, `username`, `phone`                            |
| `sample.internet` | `email`, `username`, `url`, `domain_name`, `password`, `ip`, `ipv4`, `ipv6`, `mac`, `port`, `protocol`, `http_method`, `http_status_code`, `jwt`, `user_agent`, `emoji` |
| `sample.location` | `country`, `city`, `country_code`, `state`, `county`, `street`, `street_address`, `zip_code`, `postal_address`, `latitude`, `longitude`, `time_zone`                    |
| `sample.company`  | `name`, `catch_phrase`, `buzz_phrase`, and their parts                                                                                                                  |
| `sample.lorem`    | `word`, `words`, `sentence`, `paragraph`, `lines`, `slug`, `text`                                                                                                       |
| `sample.date`     | `past`, `future`, `recent`, `soon`, `anytime`, `birthdate`, `month`, `weekday`, `time_zone` — dates as ISO timestamps                                                   |
| `sample.string`   | `uuid`, `ulid`, `nanoid`, `alpha`, `alphanumeric`, `numeric`, `hexadecimal`, `binary`, `octal`, `symbol`                                                                |
| `sample.number`   | `int`, `float`, `hex`, `binary`, `octal`, `roman_numeral`, `big_int`                                                                                                    |
| `sample.color`    | `human`, `hex`, `rgb`, `hsl`, `space`, `css_function`                                                                                                                   |
| `sample.datatype` | `boolean`                                                                                                                                                               |
| `sample.git`      | `branch`, `commit_sha`, `short_sha`, `commit_message`, `commit_date`, `commit_entry`                                                                                    |
| `sample.hacker`   | `abbreviation`, `adjective`, `noun`, `verb`, `ingverb`, `phrase`                                                                                                        |
| `sample.phone`    | `number`, `national`, `international`, `imei`                                                                                                                           |
| `sample.system`   | `file_name`, `file_ext`, `file_type`, `mime_type`, `directory_path`, `file_path`, `network_interface`, `semver`, `cron`                                                 |

A record's fields agree with each other: a location's postal address names its
own city and country. The generators that take an argument keep a tool of their
own, alongside two shortcuts:

- `sample.int <min> <max>` — an integer, both bounds included.
- `sample.float <min> <max>` — a number between the bounds, two decimals.
- `sample.words <count>` — that many words of placeholder prose.
- `sample.pick <list>` — one element of a list another tool returned.
- `sample.email`, `sample.uuid` — the two single values worth their own name.

Every tool is an action rather than an observation: a draw advances the stream,
so `sample` may not head an `eventually`.

A test's data follows its identity — the run's seed, the test's file inside the
suite, and its title — and nothing else, so two runs generate the same data
whatever the concurrency and wherever the suite is checked out. Adding or
removing a neighboring test leaves it in place. `--seed=random` prints the seed
it drew (`seed 1007223771 (replay with --seed=1007223771)`), so a suite can be
shaken for hidden dependence on particular values and any failure stays
reproducible.

```bash
npx spec run spec --seed=checkout      # a different suite-wide seed
npx spec run spec --seed=random        # draw one, printed so it can be replayed
```

### `jwt` — read and verify tokens · `--allow-net` (verify only)

- `jwt.decode <token>` — split a token into `{ header, payload }` with no
  signature check; permissionless, for asserting on claims
  (`decoded.payload.sub`, `decoded.header.alg`, …).
- `jwt.verify <token> <jwks_url>` — fetch the issuer's JWKS, select the key the
  token names by `kid`, verify its ES256 signature and expiry, and return the
  verified payload, so a spec proves a token is genuinely issuer-signed. It
  reads the JWKS over the network, so it needs `--allow-net` for that host; a
  bad signature, an unknown key, an expired token, or a non-ES256 algorithm is
  an error.

```
when {
	let claims = jwt.verify tokens.id_token "http://localhost:3000/.well-known/jwks.json"
}
then {
	expect claims.iss "https://id.example.com"
	expect claims.aud "the-client-id"
}
```

## Permissions

| Flag                          | Grants                                                 |
| ----------------------------- | ------------------------------------------------------ |
| `--allow-run[=name,…]`        | Spawn processes (scoped by executable basename)        |
| `--allow-net[=host[:port],…]` | Reach the network (scoped by host, optionally port)    |
| `--allow-env[=VAR,…]`         | Read environment variables (scoped by name)            |
| `--allow-host-fs[=dir,…]`     | Touch files outside the workspace (path-prefix scoped) |
| `--allow-plugins[=ns,…]`      | Launch project-declared plugins                        |
| `--allow-config`              | Apply the permissions the suite's config declares      |

A bare flag grants the whole family (`--allow-net`); a scoped flag grants only
what it lists (`--allow-run=node,git`); repeated scoped flags union.

```bash
# Pure filesystem suite — the workspace is always writable, so no flags at all:
npx spec run spec

# One known tool, one local server, and two named env vars:
npx spec run spec --allow-run=node --allow-net=localhost:3000 --allow-env=CI,NODE_ENV

# Read shared fixture data from outside the workspace (path prefix):
npx spec run spec --allow-host-fs=/opt/fixtures
```

## `spec/config.jsonc`

Rather than reciting the same `--allow-*` line every run, a suite can carry its
own configuration in `spec/config.jsonc` (JSONC: comments and trailing commas
allowed). It has two optional keys, `permissions` and `plugins`.

```jsonc
// spec/config.jsonc
{
	"permissions": {
		// A bare string is a whole-family grant (like a bare --allow-<family>);
		// a [family, ...scopes] tuple is a scoped grant (like --allow-<family>=…).
		"allow": ["run", "plugins", ["env", "DATABASE_URL"]],
	},
}
```

The families match the flags: `"run"`, `"net"`, `"env"`, `"host-fs"`, and
`"plugins"`. A malformed or unknown entry is a load error naming it.

### Pattern: declare, then opt in

The declaration stays inert until an operator opts in, so until then the suite
fails closed with the normal denials. One flag opts in:

```bash
npx spec run spec --allow-config
```

The effective grants are then the config's declared set unioned with any
explicit `--allow-*` flags you also pass — flags only ever add. Because the file
takes effect only once someone who read it adds `--allow-config`, a cloned or
untrusted project stays inert until an operator says otherwise. When a denial
would be covered by the config, the denial adds one line pointing at
`--allow-config`.

### Loading project plugins

The `plugins` key maps a namespace to the command that launches its plugin, so
specs name `greet.hello` and never a path:

```jsonc
// spec/config.jsonc
{
	"plugins": {
		// A command argument starting with "." resolves against this file's
		// directory, so the suite runs the same from any working directory.
		"greet": { "command": ["bun", "./greeter.ts"] },
	},
}
```

```
use greet

test "the greet plugin greets by name" {
	when {
		let message = greet.hello "world"
	}
	then {
		expect message "Hello, world!"
	}
}
```

Declaring a plugin is a separate act from running it: launching one executes
code the project ships, so `spec run` starts a declared plugin only with
`--allow-plugins` (all) or `--allow-plugins=greet` (named), and a suite that
imports an unauthorized namespace is refused before any test runs. The built-in
namespaces stay available throughout.

```bash
npx spec run spec --allow-plugins=greet
```

## Custom and third-party plugins

Every capability is itself a plugin — one namespace exposing typed tools behind
a single interface — so your own is a first-class citizen. Write one in-process
for an embedder, as an external executable speaking a small NDJSON-over-stdio
protocol in any language, or install someone else's and declare it. The full
authoring guide — the `Plugin` interface, all three shapes, project loading, and
the trust model — ships with the package as `docs/writing-plugins.md`, next to a
runnable showcase under `examples/plugin-loading/`.

## CLI

```
spec run [directory] [--allow-*]     Run the suite (directory defaults to ./spec)

  --concurrency=N (alias --jobs=N)   Run up to N tests at once (default 1, sequential)
  --seed=VALUE                       Seed the data sample generates (default: fixed)
  --seed=random                      Draw a seed and print it, to replay with --seed=<it>
```

Exit codes are the contract to script against: `0` everything passed, `1` a test
failed, `2` a usage or load error (a bad flag, an unreadable suite, a parse
error).

At `--concurrency=N` the runner executes up to `N` tests at once and still
reports them in source order, so output, counts, and exit code stay identical
and only wall-time changes. It isolates each test's workspace rather than the
app under test, so a suite sharing one mutable backend belongs at
`--concurrency=1`.

## Programmatic API

Every fallible export returns a
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) `Result`, so parse
errors, permission denials, and tool failures are values you branch on.

### `runSuite(options)`

Loads a suite from disk and runs it, registering all nine built-in namespaces.
Options: `root` (the directory to scan), `grants` (from `parseGrants`), and the
optional `plugins`, `builtins`, `concurrency`, and `seed`.

```ts
import { isFailure } from "@sdxc/result";
import { parseGrants, runSuite } from "@sdxc/spec";

let grants = parseGrants(["--allow-net=localhost:3000"]);
if (isFailure(grants)) throw grants.error;

let run = await runSuite({ root: "spec", grants: grants.data, concurrency: 4 });
```

Passing `builtins` registers only the namespaces you name — `builtins: ["http",
"url", "jwt"]`. That is not a permission decision: a denied capability still
exists and its denial names the flag that would allow it, while a namespace left
out does not exist at all, so a spec calling `fs.write` fails with an unknown
name.

### `runTests(options)`

The runtime underneath `runSuite`, which assumes no filesystem and no process:
the `suite`, the `plugins`, the `grants`, and the `createWorkspace` factory all
arrive as arguments. Pair it with `loadSources`, which parses `{ path, text }`
pairs from wherever the specs live, and `createNoFilesystemWorkspace`.

```ts
import { isFailure } from "@sdxc/result";
import { createHttpPlugin, createNoFilesystemWorkspace, loadSources, runTests } from "@sdxc/spec";

let loaded = loadSources([{ path: "flow.spec", text: source }]);
if (isFailure(loaded)) return loaded;

let outcome = await runTests({
	suite: loaded.data,
	plugins: [createHttpPlugin()],
	grants: grants.data,
	createWorkspace: createNoFilesystemWorkspace,
});
```

### Entry points

`@sdxc/spec` also exports `lex`, `parse`, `loadSuite`, `createRegistry`,
`executeTest`, `reportSuite`, `reportFatal`, `createBuiltinPlugins`, every
plugin factory (`createFsPlugin`, `createCliPlugin`, `createHttpPlugin`,
`createBrowserPlugin`, `createDbPlugin`, `createEnvPlugin`, `createUrlPlugin`,
`createJwtPlugin`), the `SpecError` family, and `connectStdioPlugin` /
`servePlugin` for plugins that speak the NDJSON-over-stdio protocol.

`@sdxc/spec/workers` carries the same language core for a V8-isolate runtime,
with the four capabilities that reach for neither a process nor a filesystem:
`http`, `url`, `jwt`, and `sample`.

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
