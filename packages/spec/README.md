# @pkg/spec

Write down how your app should behave, then run it. `spec` is an **executable
specification runner**: you describe behavior in `.spec` files — setup, action,
expectation — and it runs each one against your real app, in an isolated
workspace, under permissions you grant explicitly. The specs don't care _how_
the app is built (a CLI, an HTTP server, a database, a web page); they only
describe what it should do, so they stay true as the implementation changes.

## Overview

A suite is a directory of `.spec` files (conventionally `spec/`). Each file is
written in a deliberately tiny language — no `if`, no loops, no operators — so a
spec reads as a linear, diffable list of steps. A `test` declares its setup in
`given`, its action in `when`, and its checks in `then`. The `spec` CLI loads
the suite, runs every test in its **own fresh temporary directory**, and prints
one line per test plus a summary.

Two rules shape everything:

- **Deny by default.** A test that spawns a process, reaches the network, reads
  an environment variable, or touches files outside its workspace needs an
  explicit `--allow-*` grant. Every denial tells you the exact flag that would
  allow it.
- **Isolated per test.** Each test gets its own workspace, created before it
  runs and removed after. Tests never see each other's files, so order never
  matters.

Exit codes are the contract to script against: **0** everything passed, **1** a
test failed, **2** a usage or load error (a bad flag, an unreadable suite, a
parse error).

## Quickstart

### Get the CLI

Inside this repo you can run the CLI straight from source — the dev entry point:

```sh
bun packages/spec/src/cli.ts run spec
```

For everyday use, compile a single self-contained executable that starts fast
and runs anywhere (no repo, no `node_modules` beside it):

```sh
cd packages/spec
bun run build          # → packages/spec/bin/spec
./bin/spec run spec
```

Put `bin/spec` on your `PATH` and it's just `spec`. The rest of this guide
writes `spec`; use whichever launcher you have.

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
		expect file "package.json" exists
		expect file "package.json" contains "\"type\": \"module\""
	}
}
```

### Run it

`write` creates files in the test's workspace and `run` starts processes there.
Spawning `bun` is a privileged act, so grant exactly that one executable:

```sh
spec run spec --allow-run=bun
```

```
✓ the script prints its greeting
✓ the generated config is on disk

2 passed, 0 failed (21ms)
```

Drop the grant and the process-spawning test fails **before** `bun` is ever
launched. Every test denied for the same missing grant collapses into one block
that names the flag to add and lists the tests it affected:

```
✓ the generated config is on disk

✗ Permission denied: run (1 test)

  The spec attempted to reach:
  > cli.run

  Re-run with an appropriate permission, for example:
  > spec run --allow-run

  Affected tests:
  - the script prints its greeting (spec/greeting.spec:9)

1 passed, 1 failed (1ms)
```

`spec run` takes a **directory** (default `./spec`); it scans it recursively for
`.spec` files.

## The language by example

### Tests and phases

A `test` has up to three phase blocks, always in this order: `given` (arrange),
`when` (act), `then` (assert). Each is optional, but you can't reorder them.
Lines end statements — there are no semicolons. `#` starts a comment to
end of line (a `#` inside a string is just text).

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

`let` binds the result of a step. Reach into a returned object with a dotted
reference:

```
when {
	let result = run "bun" "build.js"
}
then {
	expect result.exit_code 0
	expect result.stdout "built\n"
}
```

One thing to know: a **bare word** in tool-argument position is a symbol, not a
variable. `write "f" content` hands the tool the literal word `content`. To pass
a bound value to a tool, use a dotted reference (`result.stdout`), boxing it in
an object if needed (`let x = { path: p }` then `write x.path …`).

A bare path on the right of `let`/`return` is a reference when its head names a
binding, but when the head is not a binding and the path resolves to a tool that
needs no arguments, it is a **zero-argument tool call** — so `let current =
browser.url` binds that tool's observed value. This works for any argument-less
tool, and the call is permission-gated like any other.

### `eventually`

Wrap an observable assertion in `eventually` to retry it until it holds or the
window ends — for anything that becomes true a moment later (a server coming up,
an async write landing). A plain assertion checks exactly once.

```
then {
	eventually within 2s {
		expect file "ready.txt" exists
	}
}
```

Only assertions may be retried — an action (a mutation) inside `eventually` is
an error, since a retried mutation is not a retried check.

### `command` and `fixture`

A **command** is a reusable step; a **fixture** is reusable data (its value is
whatever it `return`s). Define them in the same file, or share them suite-wide
by putting them under `spec/commands/` and `spec/fixtures/`. Either way they
resolve **by name** from anywhere — no import, no path — because every
definition is registered before any test runs.

```
# spec/fixtures/book.spec
fixture book {
	return { title: "Dune", author: "Herbert", year: 1965 }
}
```

```
# spec/commands/seed.spec
use fs

command seed_file(path) {
	let target = { path: path }
	write target.path "seeded"
}
```

```
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
to call its tools by their bare names (`write`, `run`). `use` is **per file**;
suite commands and fixtures need no `use` at all. If a bare name could mean two
things, that's an error naming both candidates — the runtime never guesses.

```
use fs      # now `write`, `read`, `file`, … are available unqualified
use cli     # now `run` is too
```

## Capabilities

Capabilities are the built-in namespaces. `fs` needs no grant (it's confined to
the workspace); the rest are privileged and denied until you grant them.

### `fs` — the workspace filesystem

Every path is resolved inside the test's workspace, so `fs` needs no permission.
Tools: `write`, `read`, `mkdir`, `copy`, `remove`, and the observables `exists`,
`file`, `directory`. Strings are written verbatim; objects/arrays are written as
JSON.

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

`run` spawns a program in the workspace and returns `{ stdout, stderr,
exit_code }`. It needs `--allow-run`, scoped by executable basename. The child
gets a minimal environment (`PATH`/`HOME`/`TMPDIR` plus only the vars you granted
with `--allow-env`), so your host environment never leaks in.

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

```sh
spec run spec --allow-run=echo
```

### `http` — call an HTTP API · `--allow-net`

`get`, `post`, `put`, `patch`, `delete`, each needing `--allow-net` for the
URL's host (and port, if you scope one). URLs must be **absolute**. An optional
bare body travels as `text/plain` when it's a string, JSON otherwise. Each returns
`{ status, ok, headers, text, json }`; an HTTP error status is a normal value —
only a network-level failure is an error.

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

```sh
spec run spec --allow-net=localhost:3000
```

#### Request options: headers, bodies, and credentials

After the URL, a request takes optional **word-tagged options**, in any order:

- `headers { Name: "value", … }` — request headers (an `Authorization`, an
  `Accept`, a cookie). Numbers and booleans stringify; header names are
  case-insensitive, and an explicit `content-type` here overrides the body's.
- `form { field: "value", … }` — a body sent as
  `application/x-www-form-urlencoded` (the shape OAuth token endpoints and
  classic form posts expect).
- `json <value>` — a body sent as `application/json`; the explicit form of a
  bare non-string body.
- `text "<string>"` — a body sent as `text/plain`; the explicit form of a bare
  string body.
- `bearer <token>` — sets `Authorization: Bearer <token>`, so a resource-server
  call passes the access token, not a hand-built header.
- `basic <user> <pass>` — sets `Authorization: Basic base64(user:pass)`, the
  `client_secret_basic` shape OAuth introspection and revocation expect. It is
  the one option that takes two values.

They combine, so an authenticated form post is one call:

```
use http

test "the token endpoint rejects a bad code" {
	when {
		let response = http.post "http://localhost:3000/oauth/token" form {
			grant_type: "authorization_code"
			code: "bogus"
		} headers { authorization: "Basic dXNlcjpwYXNz" }
	}
	then {
		expect response.status 400
		expect response.json.error "invalid_grant"
	}
}

test "a bogus bearer token is rejected" {
	when {
		let who = http.get "http://localhost:3000/userinfo" bearer "bogus"
	}
	then {
		expect who.status 401
	}
}
```

A request carries **at most one body** (the bare body, or one of
`json`/`form`/`text`), **at most one** `headers` block, and **at most one** auth
option (`bearer` or `basic`); a second body, a body on a `GET`, both `bearer` and
`basic`, or an unknown tag is an error. An explicit `headers.authorization`
overrides `bearer`/`basic`. The two original forms — `http.get url` and
`http.<verb> url <body>` — are unchanged, so existing specs keep working exactly
as before.

### `browser` — drive a real browser · `--allow-net`

Drive a browser through its **accessibility tree**, not DOM internals: address
elements by role (a bare word) and accessible name (a string). Actions include
`open`, `navigate`, `cookie`, `ua`, `click`, `fill … with …`, `check`, `press`;
observables include `heading`, `link`, `button`, `text`, `checkbox`, `url`,
`title`. Reaching the page is the privileged act, so each tool needs
`--allow-net` for the target host. It's backed by a globally installed `agent-browser` CLI, loaded lazily —
a suite that never touches `browser.*` needs neither the grant nor the binary.

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

```sh
spec run spec --allow-net=localhost:3000
```

`browser.heading` also takes a level, for when the rung of the document outline
is part of the behavior: `level 3` matches an `<h3>` and equally a
`role="heading"` with `aria-level="3"`, because both reach the accessibility
tree the same way. A heading of that name at another level fails with the levels
it did find.

```
then {
	expect browser.heading "Billing" level 2
}
```

Like `browser.url`, `browser.title` reads as a value too — `let name =
browser.title` with no argument binds the current title instead of asserting one.

`browser.cookie` seeds the session's cookie jar, so a test that isn't about
signing in can arrive already signed in. The `for` clause names the URL the
cookie belongs to, which is what lets it be set _before_ the first navigation;
drop the clause to set it on the page already open. Pair it with
[`env.get`](#env--read-a-granted-variable----allow-env) — the token belongs in
the environment, not in the document.

```
given {
	let token = env.get "SESSION_COOKIE"
	let jar = { session: token }
	browser.cookie "session" jar.session for "http://localhost:3000/app"
}
```

`browser.ua` sets the `User-Agent` the session sends, so the app can recognize
its own spec run — skip a rate limiter, tag analytics, take a test-only branch.
Set it before `open`; it applies to requests made after it. It changes the
request header only: `navigator.userAgent` inside the page still reports the
real browser.

```
given {
	browser.ua "spec-runner/1.0"
}
```

`browser.url` also reads as a value: `let current = browser.url` binds the
session's current URL, so a spec can pull the authorization `code` out of the
page the browser landed on. (A bare binding reaches a tool through a dotted
reference, so box it first — see [`let` and references](#let-and-references).)

```
when {
	browser.click button "Authorize"
	let landing = browser.url            # capture the redirect URL
	let where = { url: landing }
	let code = url.query where.url "code" # read ?code=… out of it
}
```

### `db` — query a database · `--allow-env=DATABASE_URL`

`db.query` runs raw SQL on Bun's SQL client and returns `{ rows, affected_rows,
count }`. It reads the connection string from the `DATABASE_URL` environment
variable, so granting that one variable is the whole authorization — a spec can
never redirect the connection elsewhere. The connection opens lazily on the
first query and closes at the end of the run.

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

```sh
DATABASE_URL=postgres://localhost/test spec run spec --allow-env=DATABASE_URL
```

### `env` — read a granted variable · `--allow-env`

`env.get NAME` reads one environment variable, and only one the caller granted
by name. It is how a spec names a secret without containing one: the document
says _which_ variable holds the session token, the environment says what it is,
and the same spec runs against local, staging, and CI. An unset variable is an
error unless you give `env.get` a fallback — its optional second argument — which
covers an absent value, never an absent grant.

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
		# Without the cookie, this would have redirected to /login.
		expect browser.url "http://localhost:3000/app"
	}
}
```

```sh
SESSION_COOKIE=… spec run spec --allow-env=SESSION_COOKIE --allow-net=localhost:3000
```

### `url` — parse a URL · no grant

Pure, permissionless URL parsing — no network, no filesystem — so a spec can pull
a value out of a URL it already holds instead of doing string surgery the language
deliberately omits. Its typical job is reading the authorization `code` out of the
redirect URL an OAuth authorize step lands on.

- `url.query <url> <name>` — the value of a query-string parameter.
- `url.fragment <url> <name>` — the value of a parameter after the `#` (the
  implicit/hybrid OAuth response shape).
- `url.path <url>` — the URL's pathname; `url.host <url>` — its host and port.

A missing parameter, a non-string argument, or an unparseable URL is an error —
`query`/`fragment` never bind a silent null.

```
use url

test "the authorization code is read from the redirect URL" {
	when {
		let code = url.query "http://localhost:3000/callback?code=abc123&state=s" "code"
	}
	then {
		expect code "abc123"
	}
}
```

### `jwt` — read and verify tokens · `--allow-net` (verify only)

Read and verify JSON Web Tokens, the heart of specifying an OIDC server.

- `jwt.decode <token>` — split a token into `{ header, payload }` with **no**
  signature check; permissionless, for asserting on claims (`decoded.payload.sub`,
  `decoded.header.alg`, …).
- `jwt.verify <token> <jwks_url>` — fetch the issuer's JWKS, select the key the
  token names by `kid`, verify its **ES256** signature and expiry, and return the
  verified payload — so a spec proves an id_token is genuinely issuer-signed, not
  just well-formed. It reaches the network to read the JWKS, so it needs
  `--allow-net` for that host; a bad signature, an unknown key, an expired token,
  or a non-ES256 algorithm is an error.

```
use jwt

test "the id_token is genuinely signed and names the right subject" {
	given {
		let tokens = fixture issued_tokens
	}
	when {
		let claims = jwt.verify tokens.id_token "http://localhost:3000/.well-known/jwks.json"
	}
	then {
		expect claims.iss "https://id.example.com"
		expect claims.aud "the-client-id"
	}
}
```

```sh
spec run spec --allow-net=localhost:3000
```

## Permissions

Nothing privileged runs without a grant, and any attempt beyond your grants
fails with the exact flag it needs — so start with no flags and let the denials
tell you the suite's true footprint.

| Flag                          | Grants                                                        |
| ----------------------------- | ------------------------------------------------------------- |
| `--allow-run[=name,…]`        | Spawn processes (scoped by executable basename)               |
| `--allow-net[=host[:port],…]` | Reach the network (scoped by host, optionally port)           |
| `--allow-env[=VAR,…]`         | Read environment variables (scoped by name)                   |
| `--allow-host-fs[=dir,…]`     | Touch files outside the workspace (path-prefix scoped)        |
| `--allow-plugins[=ns,…]`      | Launch project-declared plugins (see below)                   |
| `--allow-config`              | Apply the permissions the suite's config declares (see below) |

A bare flag grants the whole family (`--allow-net`); a scoped flag grants only
what it lists (`--allow-run=bun,git`); repeated scoped flags union. Some recipes:

```sh
# Pure filesystem suite — the workspace is always writable, so no flags at all:
spec run spec

# One known tool, one local server, and two named env vars:
spec run spec --allow-run=bun --allow-net=localhost:3000 --allow-env=CI,NODE_ENV

# Read shared fixture data from outside the workspace (path prefix):
spec run spec --allow-host-fs=/opt/fixtures
```

When several tests fail for the same missing grant, they collapse into one
grouped block — the `(N tests)` count and `Affected tests:` list make it obvious
what a single flag would unblock:

```
✗ Permission denied: run (3 tests)

  The spec attempted to reach:
  > cli.run

  Re-run with an appropriate permission, for example:
  > spec run --allow-run

  Affected tests:
  - first needs run (spec/denials.spec:3)
  - second needs run (spec/denials.spec:9)
  - third needs run (spec/denials.spec:15)
```

## The `spec/config.jsonc` file

Rather than reciting the same `--allow-*` line every run, a suite can carry its
own configuration in `spec/config.jsonc` (JSONC: comments and trailing commas
allowed). It has two keys, both optional: `permissions` and `plugins`.

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

The families match the flags: `"run"` ≡ `--allow-run`, `["env","DATABASE_URL"]`
≡ `--allow-env=DATABASE_URL`, `["net","localhost:3000"]` ≡
`--allow-net=localhost:3000`, and `"plugins"` (or `["plugins","greet"]`) ≡
`--allow-plugins`. A malformed or unknown entry is a load error naming it — a
broken declaration is never silently ignored.

Crucially, the declaration is **declare + opt-in**, never ambient authority.
With no opt-in the file grants **nothing**: the suite still fails closed with
the normal denials. The operator opts in with one flag:

```sh
spec run spec --allow-config
```

Then the effective grants are the config's declared set **unioned** with any
explicit `--allow-*` flags you also pass — flags only ever add. Because nothing
in the file takes effect until someone who read it adds `--allow-config`, a
cloned or untrusted repo can't self-grant. As a convenience, when a denial
_would_ be covered by the config, the denial adds one line pointing at
`--allow-config`.

### Loading project plugins

The `plugins` key maps a namespace to the command that launches its plugin, so
specs name `greet.hello` and never a path:

```jsonc
// spec/config.jsonc
{
	"plugins": {
		// A relative "." path resolves against this file's directory.
		"greet": { "command": ["bun", "./greeter.ts"] },
	},
}
```

Declaring a plugin is **not** permission to run it — launching one executes code
the project ships, so it's deny-by-default too. `spec run` starts a declared
plugin only with `--allow-plugins` (all) or `--allow-plugins=greet` (named); a
suite that imports an unauthorized plugin is refused before any test runs. The
built-in namespaces (`fs`, `cli`, `http`, `browser`, `db`, `env`, `url`, `jwt`)
are
never affected.

## Custom and third-party plugins

Every capability is just a plugin — one namespace exposing typed tools behind a
single interface — so your own is a first-class citizen. You can build one
in-process (for embedders), as an external executable speaking a small
NDJSON-over-stdio protocol (any language), or install a third party's. The full
authoring guide — the `Plugin` interface, all three shapes, project loading, and
the trust model — is [docs/writing-plugins.md](./docs/writing-plugins.md), with
a runnable showcase under `examples/plugin-loading/`.

## Performance

The runner itself is cheap — roughly a millisecond per test on top of whatever
the app under test costs — so wall-time is dominated by your app, not the
harness. Two levers keep it that way. Use the **compiled binary** (`bun run
build` → `./bin/spec`) instead of `bun src/cli.ts` to skip the per-launch
transpile cost, which matters most for suites that shell out to `spec` many
times. And for suites whose tests spend their time waiting — a browser, an HTTP
round-trip, a slow process — run them with **`--concurrency=N`** (alias
`--jobs=N`) to overlap that waiting:

```sh
spec run spec --concurrency=8
```

Concurrency defaults to `1` (strictly sequential — today's behavior). At `N` the
runner executes up to `N` tests at once but still reports results in **source
order**, so the output, counts, and exit code are byte-for-byte identical
regardless of how the schedule shook out; only the wall-time changes. The runner
isolates each test's **workspace**, not the app under test — so a suite that
shares one mutable backend (the same database rows, one stateful server) may
still need `--concurrency=1`.

## Beyond the CLI

The CLI is the product surface, and its exit codes (0 pass, 1 test failure, 2
usage/load error) are what you script against. For embedding the runner in
another program, the package also exports a programmatic `runSuite` and the
supporting types from `@pkg/spec`; every fallible export returns a
[`@pkg/result`](/packages/result) `Result`, so parse errors, permission denials,
and tool failures are values you branch on, never thrown exceptions.

### Choosing which capabilities exist

`runSuite` registers all eight built-in namespaces. Pass `builtins` to register
only some:

```ts
import { runSuite } from "@pkg/spec";

let run = await runSuite({ root: "spec", grants, builtins: ["http", "url", "jwt"] });
```

This is **not** a permission decision, and the difference matters. A denied
capability still exists — the denial names the flag that would allow it. A
namespace left out of `builtins` does not exist: a spec calling `fs.write` fails
with an unknown name, because there is no flag that would ever lift it. Use
grants to say "not now", and `builtins` to say "not here".

`createBuiltinPlugins(only?)` builds the same list on its own, for callers that
assemble a plugin set by hand.

### Running without a filesystem or a process

`runSuite` assumes a Bun or Node process: it reads the suite off a disk, gives
each test a temp directory, and can spawn `cli`, `browser` and `db`. Underneath
it is `runTests`, which assumes nothing — the suite, the plugin set, the grants,
and the workspace factory all arrive as arguments:

```ts
import { isFailure } from "@pkg/result";
import {
	createHttpPlugin,
	createJwtPlugin,
	createNoFilesystemWorkspace,
	createUrlPlugin,
	loadSources,
	parseGrants,
	runTests,
} from "@pkg/spec/workers";

let loaded = loadSources([{ path: "flow.spec", text: source }]);
if (isFailure(loaded)) return loaded;

let grants = parseGrants(["--allow-net=app.example.com"]);
if (isFailure(grants)) return grants;

let outcome = await runTests({
	suite: loaded.data,
	plugins: [createHttpPlugin(), createUrlPlugin(), createJwtPlugin()],
	grants: grants.data,
	createWorkspace: createNoFilesystemWorkspace,
});
```

`loadSources` is the half of loading that has no filesystem in it: hand it
`{ path, text }` pairs from wherever the specs live — a database row, an HTTP
body, a bundled string — and it parses and registers them exactly as
`loadSuite` does after its directory walk. `createNoFilesystemWorkspace` refuses
every path, which a run without `fs` and `cli` never asks it to resolve.

The `@pkg/spec/workers` entry point exists because of what a module may
**import**, not what a run may do: `db` imports Bun's SQL client, and `cli`,
`browser` and the stdio plugin transport reach for the `Bun` global, so a module
importing them cannot load in a V8-isolate runtime however carefully the run is
permissioned. That entry point exports the language core plus the three
capabilities that are already pure — `http`, `url`, `jwt` — and a test in the
package walks its import graph to keep it that way. It still needs Node
compatibility enabled for `node:path` and `node:fs`, which the permission set
reaches only through a host-filesystem grant.

There is no browser capability there, deliberately. Driving a browser without a
local binary means calling a remote service over HTTP, and which service that is
belongs to the host, not to this package: implement the same tool surface as a
[plugin](./docs/writing-plugins.md) and pass it to `runTests` beside the others.

## Related packages

- [`@pkg/result`](/packages/result) — the `Result` type every fallible export
  returns; errors are values, never throws.
- [`@pkg/duration`](/packages/duration) — parses and validates the duration
  literals (`10s`, `500ms`) the language accepts.
