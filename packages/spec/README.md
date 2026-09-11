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
seed spec (replay with --seed=spec)
run mtw62dtrkgga (replay with --run-id=mtw62dtrkgga)

✓ the script prints its greeting
✓ the generated config is on disk

2 passed, 0 failed (21ms)
```

The header comes before the first result, so a failure is already anchored to
the inputs that produced it: both flags re-run this exact run, and a suite with
configured bases prints each resolved address underneath them.

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

`skip` prefixes `test` and takes an optional reason, which the summary prints.
The body never executes, and the test is counted apart from the passes and the
failures:

```
skip "the staging database is down" test "the nightly report reconciles" {
	then {
		expect report.balance 0
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

`contains` and `not` join either form. `contains` is a substring over a string
and membership over an array, comparing members with the same structural
equality the two-value form uses. `not` is valid as `expect`'s first argument
and inverts whichever form follows it.

```
then {
	expect page contains "og:title"
	expect rows contains { id: 2, title: "Emma" }
	expect not page contains "twitter:card"
	expect not browser.cookie "session" exists
}
```

A negative assertion holds when the thing is absent and equally when the page
never rendered, so anchor it with a positive expectation in the same block. An
observable denied a permission still fails the statement under `not`, so a
missing grant is never read as the thing being absent.

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

A bare word in tool-argument position resolves against the tool's own
declaration. It is a symbol when the tool declares a word of that spelling, or
when the required parameter at that position is a word — which is what makes
`expect file "notes.txt" exists` read `exists` as `fs.file`'s assertion word.
Otherwise it reads the binding of that name, so `browser.open profile` hands the
tool the URL `profile` holds. A spelling that is both a declared word and a live
binding is an `ambiguous-name` error: rename the binding, or pass it as a dotted
reference.

A dotted path whose head names a binding is a reference. When the head names
something callable instead — a tool that takes no arguments, or a command that
takes no parameters — the path is that call, so `let current = browser.url`
binds the tool's observed value and `let user = create_testing_account` binds
what the command produced. Both are permission-gated exactly like a written
call.

A bound head is always a reference and an unbound one is always a call, so the
two readings never overlap and the rule holds in every expression position — a
right-hand side, an object entry, an array item, an argument. A tool's value
therefore reaches the place it belongs with no binding in between:

```
when {
	let slug = format "${name}-${nonce}" { name: who.username, nonce: spec.nonce }
}
```

Arrays are values like any other, writable as a literal, and a path segment
spelled as digits indexes one **0-based**:

```
given {
	let titles = [ "Dune", "Emma" ]
}
then {
	expect titles.0 "Dune"
	expect titles contains "Emma"
}
```

The addressing vocabulary's ordinals count from 1 instead (`nth 2`,
`row 1 column 2`), and the two sit side by side in a real spec.

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
`eventually` stands in a `then` block, in a command body, and in a `setup` or
`teardown` hook — everywhere a body may wait for an effect to land. A command
that waits for the effect it just caused is what lets a sequence of calls stand
in for the loop the language does not have.

### `command`

A command is a reusable step: it takes parameters, performs effects, and
produces whatever it `return`s. Define one beside the test that uses it, or
share it suite-wide by putting it under `spec/commands/`. Either way it resolves
by name from anywhere — no import, no path — because every definition is
registered before any test runs.

```
# spec/commands/catalog.spec
use fs

command book {
	return { title: "Dune", author: "Herbert", year: 1965 }
}

command seed_file(path) {
	write path "seeded"
}

# spec/tour.spec
test "commands compose by name" {
	given {
		seed_file "out.txt"     # run a command for its effect
	}
	when {
		let record = book       # one with no parameters is called by its bare name
	}
	then {
		expect record.title "Dune"
		expect file "out.txt" contains "seeded"
	}
}
```

A command runs on every call — no memoization, no lifecycle — so a value wanted
once is bound once. Reusable data is a command that only returns, which is the
whole of it: one definition form covers arrangement, effects, and data alike.

### `setup` and `teardown`

A suite may declare one `setup` and one `teardown`, in whichever file suits
them; a second of either kind is a load error naming both files. `setup` runs
once before any test whatever the concurrency, in its own workspace and under
the same grants, and its failure is fatal — the run reports a load error, exits
`2`, and no test executes. `teardown` runs once after every test, failures
included, which is where a suite removes the rows it left behind.

```
use db
use spec

setup {
	db.run_file "db/schema.sql" on "web"
}

teardown {
	db.query "delete from accounts where run_id = $1" params spec.run_id on "web"
}
```

A hook body is an ordinary block with a fresh, empty scope; `return` inside one
is a usage error.

### `use` and namespaces

Capabilities live in twelve namespaces: `fs`, `cli`, `http`, `browser`, `html`,
`db`, `url`, `jwt`, `env`, `sample`, `str`, and `spec`. Use a fully qualified
name anywhere (`fs.write`, `cli.run`), or `use` a namespace at the top of a file
to call its tools by their bare names (`write`, `run`). `use` applies per file,
and a command or hook body resolves bare names against the imports of the file
that declared it rather than the caller's. An ambiguous bare name is an error
naming both candidates.

## Capabilities

`fs`, `html`, `url`, `sample`, `str`, and `spec` need no grant; the rest are
privileged and denied until you grant them.

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
URL's host (and port, if you scope one). A target is an absolute URL, or a
`/path` resolved against a configured base. An optional bare body travels as
`text/plain` when it is a string and as JSON otherwise. Each returns
`{ status, ok, headers, text, json }`; an HTTP error status is a normal value,
and only a network-level failure is an error.

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

### Named bases — where a relative target points

`http`, `browser`, and `browser.fetch` address a running app by path, and
`spec/config.jsonc` decides what those paths hang off. Each base reads an
environment variable, falling back to a default, so one suite runs against a
laptop, staging, and CI unchanged:

```jsonc
// spec/config.jsonc
{
	"bases": {
		"web": { "env": "FRONTEND_BASE_URL", "default": "http://localhost:4000" },
		"work": { "env": "WORK_FRONTEND_BASE_URL", "default": "http://localhost:4020" },
	},
}
```

```
browser.open "/charities"
browser.open "/dashboard" on "work"
http.get "/portfolios"
```

Naming no base works when exactly one is configured; `on "name"` chooses
otherwise, and naming none among several is an error listing what the config
declares. A relative target starts with `/` — anything else is an error
suggesting the slash, which keeps a statement from depending on the statement
before it — and a target carrying a scheme, or `//host/path`, is absolute and
ignores the base entirely.

Substituting the environment into the config needs no grant: it is the runner's
own settings, written by whoever runs the CLI, and could have held the literal
URL. `env.get` inside a spec is a different act and keeps its grant. A base that
resolves to nothing stops the run before any test, naming the variable to set.

`--allow-net` keys on the **resolved** host, so a denial is copy-pasteable
whatever the spec wrote:

```
✗ Permission denied: net (1 test)

  The spec attempted to reach:
  > localhost:4020

  Re-run with an appropriate permission, for example:
  > spec run --allow-net=localhost:4020
```

The run header prints each resolved base, so a run says out loud which app it
actually reached.

### `html` — read a served page's markup · no grant

`html` addresses a string of HTML — typically the `text` of an `http` response —
so a page's content, structure, and metadata are assertable with no browser, no
sockets, and no grant. Every tool takes the source as its first argument.
`title`, `meta`, and `rel` read what the document says about itself; `text`,
`element`, `cell`, and `definition` read what a person would see.

```
use http
use html

test "the portfolios page describes itself" {
	when {
		let page = http.get "/portfolios"
	}
	then {
		expect page.status 200
		expect html.title page.text "Invest your money for more charitable impact"
		expect html.meta page.text "description" "Give more, and give it sooner"
		expect html.rel page.text "canonical" "https://example.com/portfolios"
		expect html.meta page.text "og:image" containing "/build/_assets/og-image-"
	}
}
```

`meta` matches a tag's `name` or its `property` and `rel` matches one token of a
`<link>`'s `rel`, which is why the tag is an argument rather than a field of a
parsed object: `og:image` could never be a segment of a dotted path. A requested
tag the document does not carry is an error naming the ones it does — `Present:
description` — and `exists` is how a spec says the absence is the point.

`html` and `browser` address elements under identical rules, so a document is
addressed one way and the namespace choice is only about whether a live browser
is needed. Both reach every role through `element`, and both carry `heading`,
`link`, `button`, and `checkbox` as shorthands for the roles a suite reaches for
most, so an assertion moved from one namespace to the other keeps its meaning —
which is why a `<link rel>` is read by `html.rel`, leaving the name `link` to the
role it means on either side. `html` answers nothing that depends on layout: no
viewport, no scrolling, no `in_viewport`.

#### The addressing vocabulary

Elements are addressed the way a person perceives them: by ARIA role (a bare
word) and accessible name (a string). A control's label is its accessible name,
so addressing by label needs no feature of its own.

```
then {
	expect html.element page.text heading "Portfolios"
	expect html.element page.text textbox "Tip" value "20"
	expect html.element page.text button "Save" enabled
	expect html.element page.text button "Save" attribute "type" "submit"
}
```

- **Names match exactly**, on the normalized accessible name; `containing` opts
  into a substring. `text` is the mirror image — a substring assertion over the
  visible text, with `exactly` opting into equality. "Is there an element named
  X" and "does this string appear" are different questions, so they carry
  opposite defaults.
- **Ambiguity is an error** listing every match with its position, because a nav
  link repeated in the footer would otherwise assert on whichever came first
  with no signal that a choice was made. `first`, `nth <n>`, and `last` opt into
  one, counting from 1 — deliberately distinct from a 0-based array index.
- **`field "name"`** resolves anything carrying a `name` attribute — input,
  textarea, select, button — and sits where a role word sits. `value "annual"`
  narrows a group sharing one name, which is how a radio group and a
  submit-intent button are addressed — in an action as much as in an assertion,
  so `browser.fill field "cadence" value "annual" with "12"` writes into the one
  member it names.
- **Predicates** are `count <n>`, `value <v>`, `attribute <name> <v>`,
  `enabled` / `disabled`, and `in_viewport` (a browser only). `count` is the one
  set predicate and accepts any number of matches; the rest require exactly one.
  `attribute` reads the raw markup rather than the resolved property, and `value`
  compares as a string.
- **`cell row 1 column 2`** is 1-based over body rows, with `including header` to
  count them, and **`definition "Total"`** reads the `definition` paired with a
  `term`.
- **Roles are roles, not tags.** A `<textarea>` is a `textbox`, and writing
  `textarea` is an error naming the role that tag exposes; `menuitem`, `switch`,
  and `image` sit alongside the familiar ones.
- **A `browser` lookup takes visibility from the rendered page**, the one place
  the two namespaces answer differently and only because `browser` has a layout
  to consult: an element the page does not render does not match, so a closed
  `<dialog>` reads as absent. A dropdown's `<option>` elements are the
  exception, since Chrome reports them as not visible until the popup opens
  while a person reading the list sees them all.

```
then {
	expect html.cell page.text row 2 column 2 "40%"
	expect html.definition page.text "Total" "$12,400"
	expect html.element page.text link "Profile" count 2
	expect html.element page.text link "Profile" first
	expect html.element page.text field "cadence" value "annual"
}
```

An expected value closes an element lookup the way it closes `html.title` and
`html.meta`, comparing the element's text whole — `containing` opts into a part
of it and `exactly` spells the default out. With neither an expected value nor a
predicate the lookup asserts the element is there and hands its text to whatever
binds it, so `let share = html.cell page.text row 2 column 2` is one call, which
is worth binding where the same value is asserted more than once. A lookup that
matched nothing reports the near misses — the same role under another name, the
same name under another role — which is usually the whole diagnosis:

```
✗ the sign-in form offers a way in (spec/auth.spec:8)
  expectation-failed: html.element found a button named "Save" nowhere in the
  document. Present under the same lookup: "Save draft". That name is carried
  by: link
```

Under `--artifacts=<dir>` the failure also writes out the document it read and
prints the path.

### `browser` — drive a real browser · `--allow-net`

The same vocabulary, against a live page. Actions are `open`, `navigate`,
`reload`, `set_cookie`, `ua`, `viewport`, `scroll`, `click`, `fill … with …`,
`type … with …`, `check`, `uncheck`, `select … with …`, `press`,
`click_selector`, and the
`fetch.<verb>` request family; observables are `element`, `heading`, `link`,
`button`, `text`, `checkbox`, `cell`, `definition`, `cookie`, `response_header`,
`response_status`, `url`, `path`, `query`, `fragment`, and `title`. Each needs
`--allow-net` for the resolved host. The capability is backed by the globally
installed `agent-browser` CLI, loaded lazily, so the grant and the binary matter
only to a suite that reaches for `browser.*`.

```
use browser

test "the sign-in form authenticates" {
	when {
		browser.open "/login"
		browser.fill textbox "Email" with "user@example.com"
		browser.fill textbox "Password" with "correct horse"
		browser.click button "Sign in"
	}
	then {
		expect browser.heading "Welcome back"
		expect browser.title "My App"
		expect browser.path "/home"
	}
}
```

A session is keyed to the test's workspace, so cookies, viewport, and history
are per-test by construction, and a retry's fresh workspace gets a fresh
session.

`fill` replaces a control's value and `type` appends keystrokes; both dispatch
the `input` and `change` events the platform would, so a controlled component
never reads a stale value. `check` and `uncheck` are the two halves of a box or a
switch.

`browser.select combobox "Plan" with "Annual"` chooses in a dropdown, taking the
same `with` every write takes and naming the option the way the list shows it; an
option the list does not hold fails naming the ones it does. Every write
addresses its control with the vocabulary an assertion uses, narrowing included,
so `browser.fill field "cadence" value "annual" with "12"` reaches one member of
a group sharing a name. A clause that questions the element rather than narrowing
it — `enabled`, `count` — is refused in a write, which asserts nothing.

`browser.heading` also takes a level, for when the rung of the document outline
is part of the behavior: `expect browser.heading "Billing" level 2` matches an
`<h2>` and equally a `role="heading"` with `aria-level="2"`. A heading of that
name at another level fails with the levels it did find.

#### Where the session is

`browser.url`, `browser.path`, `browser.query <name>`, `browser.fragment <name>`,
and `browser.title` each assert when handed an expected value and read as a
value when called bare, so `eventually` can wait on a navigation without binding
anything first. An absent query or fragment parameter is an error, with `exists`
for deliberate absence.

```
then {
	eventually within 5s {
		expect browser.path "/donate/share"
	}
	expect browser.query "step" "share"
}
```

Reading a part rather than the whole is what keeps the assertion tight:
`browser.query "step" "share"` is exact, where a substring over the URL would
also pass on `?next=/donate/share`. Bound as a value, the current URL is what a
spec pulls an authorization code out of:

```
when {
	browser.click button "Authorize"
	let code = browser.query "code"
}
```

`browser.reload` returns once the document has finished loading again.

#### Cookies, headers, and requests inside the session

**`browser.cookie` reads a cookie and `browser.set_cookie` writes one.** A
descriptor is an action or an observable and never both, so the reading name is
the short one and the writing name says what it does. Seeding the jar is how a
test about what comes after sign-in arrives already signed in:

```
given {
	let token = env.get "SESSION_COOKIE"
	browser.set_cookie "session" token for "http://localhost:3000/app"
}
then {
	expect browser.cookie "session" token
	expect not browser.cookie "remember_me" exists
}
```

The `for` clause names the URL the cookie belongs to, which is what lets it be
written before the first navigation; drop the clause to set it on the page
already open. Reads include `HttpOnly` cookies, so a sign-out assertion needs no
other shape.

`browser.response_status` and `browser.response_header` read the session's own
responses. A framework navigation issues both a document and a data response and
the assertions are about each separately, so `of document` and `of data` select
the last response of that kind; naming neither reads the document.

```
then {
	expect browser.response_status 200
	expect browser.response_status of data 201
	expect browser.response_header "x-page" containing "dashboard"
}
```

A header resolves to an **array** of every value it carried, and an assertion
holds when one of them answers it. Two limits are worth knowing before writing
one: `Set-Cookie` is readable through neither kind, because Chrome withholds it
from the network log — read it with `browser.cookie` instead — and repeated
headers stay separate only on a document response, since a data response arrives
through the fetch layer already comma-folded.

`browser.fetch.<verb>` mirrors `http`'s five verbs and its option grammar
verbatim, issuing the request inside the session so its cookies apply. After
`use browser` the bare form is `fetch.post`. A `fetch` never becomes the most
recent response the header observables read, so seeding data cannot clobber an
assertion:

```
when {
	fetch.post "/api/portfolios" json { name: "Balanced" }
}
```

#### Viewport and scrolling

`browser.viewport` takes two numbers or a name, applying immediately to an open
page. A name sets size alone — no user agent, no scale factor, no touch
emulation — taking Tailwind's widths with the height of the device that lives
there:

| Name  | Size       | Device                   |
| ----- | ---------- | ------------------------ |
| `xs`  | 390 × 844  | iPhone 14                |
| `sm`  | 640 × 1138 | phone aspect ratio       |
| `md`  | 768 × 1024 | iPad, portrait           |
| `lg`  | 1024 × 768 | iPad, landscape          |
| `xl`  | 1280 × 800 | MacBook Air 13″          |
| `2xl` | 1536 × 998 | MacBook Pro aspect ratio |

```
when {
	browser.viewport "md"
	browser.viewport 1280 800
	browser.scroll to 900
	browser.scroll to button "Menu"
}
then {
	expect browser.element button "Menu" in_viewport
}
```

`browser.scroll to <n>` is an absolute Y offset in CSS pixels, and
`browser.scroll to <element>` brings one into view.

`browser.ua "spec-runner/1.0"` sets the `User-Agent` the session sends, so the
app can recognize its own spec run. Set it before `open`; it applies to requests
made after it, and changes the request header only, so `navigator.userAgent`
inside the page still reports the real browser.

A failed lookup reports the session's current URL and the same near-match list
`html` gives, and under `--artifacts=<dir>` it also writes a screenshot and an
accessibility-tree dump, printing both paths.

### `db` — query a database · `--allow-db`

`db.query` runs raw SQL on Bun's SQL client and returns
`{ rows, affected_rows, count }`. Connections are named in `spec/config.jsonc`
the way bases are, so a spec never mentions a host, a port, or a password:

```jsonc
// spec/config.jsonc
{
	"databases": {
		"web": { "env": "WEB_DATABASE_URL" },
		"backend": { "env": "BACKEND_DATABASE_URL" },
	},
}
```

`on "name"` selects one, keeping the SQL in first position; naming none works
when exactly one is configured. `params` binds a value to `$1`, or an array to
`$1`, `$2`, … in order, so a title carrying a quote stays a title and never
becomes syntax. `one` returns the single row and refuses any other count, which
turns the assumption behind a lookup by unique key into a checked one.

```
use db

command give_fund_balance(email, amount) {
	let fund = db.query "select id from funds where owner_email = $1" params email on "web" one
	db.query "delete from balances where fund_id = $1" params fund.id on "backend"
	db.query "insert into balances (fund_id, amount) values ($1, $2)" params [ fund.id, amount ] on "backend"
}

test "an INSERT reports exactly one affected row" {
	when {
		let result = db.query "insert into ledger (entry) values ('opening balance')" on "web"
	}
	then {
		expect result.affected_rows 1
		expect result.count 0
	}
}
```

A statement ends at its newline, so a long call stays on one line however wide
it grows.

`db.run_file "db/seed.sql" on "web"` sends a file's bytes unparsed over the
simple query protocol, which accepts multiple statements natively. Nothing
splits on `;` — dollar-quoted bodies, semicolons inside strings, and comments all
defeat a splitter, whose failure mode is a half-applied seed — so `run_file`
binds no parameters. Its path resolves against the directory `spec run` was
invoked from, and reaching it needs the host filesystem on top of the database:

```bash
npx spec run spec --allow-db --allow-host-fs=./db
```

The grant is scoped by connection name, and a query denied under a grant scoped
elsewhere names the exact flag it wanted (`--allow-db=backend`). A call missing
both of `run_file`'s grants reports one denial naming both flags. The connection
opens lazily on the first query and closes at the end of the run.

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
		browser.set_cookie "session" token for "http://localhost:3000/app"
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
removing a neighboring test leaves it in place. The run header prints the seed
whatever it is (`seed 1007223771 (replay with --seed=1007223771)`), so a suite
can be shaken with `--seed=random` for hidden dependence on particular values
and any failure stays reproducible.

Data that must be unique across runs rather than merely varied is composed from
`spec.nonce`, which leaves every draw here untouched.

```bash
npx spec run spec --seed=checkout      # a different suite-wide seed
npx spec run spec --seed=random        # draw one, printed so it can be replayed
```

### `str` — compose a string · no grant

The language has no `+` and no interpolation inside a literal, so a generated
value reaches a URL, a heading, or a SQL parameter through `str.format`.
Holes are `${…}`, positional by index or named by key, and one argument fills
every hole naming its index:

```
when {
	let profile = format "/${0}" who.username
	let invite = format "/${slug}/invite" { slug: user.slug }
	let query = format "?page=${0}&all=${1}" 12 true
}
then {
	expect query "?page=12&all=true"
}
```

Values stringify the way JSON would, without the quotes. A bare `$` is literal,
so prices and shell-looking text need no escape; where the output itself wants
the two characters a hole opens with, write `{{`:

```
when {
	let price = format "costs $5"
	let literal = format "write {{name} for a hole"
}
then {
	expect price "costs $5"
	expect literal "write ${name} for a hole"
}
```

Most of `format`'s design is what it refuses. A template and its arguments are
written in two places and drift apart as a suite is edited, so every mismatch is
an error naming both the template and the offender: a hole with no value, an
argument or key no hole uses, and mixing positional holes with named ones.
`null`, objects, and arrays are refused the same way, naming the hole — which is
the case the strictness exists for, since a nullable column stringified to
`"null"` composes a URL that looks real and is not.

`format` is an action rather than an observation, so it may not head an `expect`
nor run inside an `eventually`. Bind its result and assert on the binding.

### `spec` — what this run is called · no grant

Generated data is deterministic on purpose, which collides with a persistent
database the moment a suite inserts under a unique constraint. `spec` is the
seam: it reports the run's identity, and a suite composes that into the one
value that must not reproduce, leaving every `sample` draw untouched.

| Tool           | Reads                                                      |
| -------------- | ---------------------------------------------------------- |
| `spec.run_id`  | This run's identifier, shared by every test in it          |
| `spec.attempt` | Which attempt of this test is running, counting from 1     |
| `spec.nonce`   | `<run_id>-<attempt>`, the value composed into new identity |

```
use spec
use str
use sample

test "a visitor signs up under an identifier no other run holds" {
	given {
		let who = sample.person
	}
	when {
		let slug = format "${name}-${nonce}" { name: who.username, nonce: spec.nonce }
		let created = http.post "/signup" json { email: who.email, slug: slug }
	}
	then {
		expect created.status 201
	}
}
```

Read bare, each tool observes its value; handed one, it asserts equality
(`expect spec.attempt 1`) like every other reading observable. Reading advances
nothing, so a spec composes the nonce into as many identifiers as it needs and
they all share the suffix.

The nonce varies with the **attempt**, not just the run, which is what makes
`--retries` sound: a retry that reused the run's identifier would re-insert the
same email and fail on a duplicate key for a reason unrelated to the original
failure. Two tests on the same attempt share a nonce, which is safe because
their `sample` streams are keyed on test identity — and it is what makes the
rows a run left behind greppable, and deletable from a `teardown`, by a single
identifier.

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
| `--allow-db[=name,…]`         | Query databases (scoped by connection name)            |
| `--allow-plugins[=ns,…]`      | Launch project-declared plugins                        |
| `--allow-config`              | Apply the permissions the suite's config declares      |

A bare flag grants the whole family (`--allow-net`); a scoped flag grants only
what it lists (`--allow-run=node,git`); repeated scoped flags union.

```bash
# Pure filesystem suite — the workspace is always writable, so no flags at all:
npx spec run spec

# One known tool, one local server, and two named env vars:
npx spec run spec --allow-run=node --allow-net=localhost:3000 --allow-env=CI,NODE_ENV

# Read shared seed data from outside the workspace (path prefix):
npx spec run spec --allow-host-fs=/opt/seeds

# One of two configured databases:
npx spec run spec --allow-db=web
```

## `spec/config.jsonc`

Rather than reciting the same `--allow-*` line every run, a suite can carry its
own configuration in `spec/config.jsonc` (JSONC: comments and trailing commas
allowed). It has four optional keys: `permissions`, `plugins`, `bases`, and
`databases`.

```jsonc
// spec/config.jsonc
{
	"permissions": {
		// A bare string is a whole-family grant (like a bare --allow-<family>);
		// a [family, ...scopes] tuple is a scoped grant (like --allow-<family>=…).
		"allow": ["run", "plugins", ["db", "web"]],
	},
	// Where a relative target points, and which database a query runs against.
	// Each reads an environment variable, with an optional literal fallback.
	"bases": {
		"web": { "env": "FRONTEND_BASE_URL", "default": "http://localhost:4000" },
	},
	"databases": {
		"web": { "env": "WEB_DATABASE_URL" },
	},
}
```

The families match the flags: `"run"`, `"net"`, `"env"`, `"host-fs"`, `"db"`,
and `"plugins"`. A malformed or unknown entry is a load error naming it.

`bases` and `databases` are addresses rather than grants, so they apply on every
run without `--allow-config` — the file is the runner's own settings, written by
whoever runs the CLI, and could have held the literal URL. Reaching what they
name is still gated: `--allow-net` for a base's resolved host, `--allow-db` for a
connection's name. A base or connection whose variable is unset and which
declares no fallback stops the run before any test, naming the variable.

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
protocol in any language, or install someone else's and declare it.

An external one is no lesser for being a process: every call carries the whole
context over the wire — `workspaceRoot`, `now`, `run`, `bases`, `connections`,
`grants`, and `artifactsDirectory` — so a served plugin resolves a base, selects
a connection, and stamps the run's nonce exactly as a built-in does. A
`permission-denied` it raises keeps its `permission`, `resource`, and `remedy`
across the wire, so its denial prints the flag that would grant it.

The full authoring guide — the `Plugin` interface, all three shapes, the wire
protocol in detail, project loading, and the trust model — ships with the
package as `docs/writing-plugins.md`, next to a runnable showcase under
`examples/plugin-loading/`.

## CLI

```
spec run [directory] [--allow-*]     Run the suite (directory defaults to ./spec)

  --concurrency=N (alias --jobs=N)   Run up to N tests at once (default 1, sequential)
  --retries=N                        Retry a failing test N more times (default 0)
  --seed=VALUE                       Seed the data sample generates (default: fixed)
  --seed=random                      Draw a seed and print it, to replay with --seed=<it>
  --run-id=VALUE                     Name this run, replaying the one printed in the header
  --artifacts=DIR                    Write failure screenshots and dumps under DIR
```

Exit codes are the contract to script against: `0` everything passed, `1` a test
failed, `2` a usage or load error (a bad flag, an unreadable suite, a parse
error).

Every run opens with a header naming the two things a replay needs, plus each
base it resolved. A database connection is left out of it, because a DSN carries
credentials:

```
seed spec (replay with --seed=spec)
run mtw62dtrkgga (replay with --run-id=mtw62dtrkgga)
base "web" → http://localhost:4000
```

At `--concurrency=N` the runner executes up to `N` tests at once and still
reports them in source order, so output, counts, and exit code stay identical
and only wall-time changes. It isolates each test's workspace rather than the
app under test, so a suite whose tests write the same rows belongs at
`--concurrency=1` — while a suite that keys its writes to `spec.nonce` has
already isolated them.

`--retries=N` gives a failing test that many further attempts. A retry redraws
no data — same seed, same `sample` draws — while `spec.nonce` moves, so inserts
stay clean; `setup` does not re-run, and the attempt gets a fresh workspace. A
test that passed only on a retry lands in its own **flaky** count with the failed
attempt's diagnostics kept, so retries absorb infrastructure noise without hiding
a test decaying toward permanent failure. The summary carries the extra counts
only when they are non-zero:

```
○ the nightly report reconciles (skipped: the staging database is down)
✓ settles on the second attempt (flaky: passed on attempt 2)
  attempt 1: expectation-failed: spec.attempt is not 2
✓ a plain one

1 passed, 0 failed, 1 skipped, 1 flaky (1ms)
```

`--artifacts=DIR` turns a failure's evidence into files: a browser failure leaves
a screenshot and an accessibility-tree dump, an `html` failure leaves the
document it read, and the reporter prints each path under a `Wrote:` heading.

```
✗ a lookup that matched nothing (spec/portfolios.spec:8)
  expectation-failed: html.element found a button named "Save" nowhere …

  Wrote:
  > /work/artifacts/html-element-mtw62io8y5ij-1.html
```

## Programmatic API

Every fallible export returns a
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) `Result`, so parse
errors, permission denials, and tool failures are values you branch on.

### `runSuite(options)`

Loads a suite from disk and runs it, registering all twelve built-in namespaces.
Options: `root` (the directory to scan), `grants` (from `parseGrants`), and the
optional `plugins`, `builtins`, `concurrency`, `seed`, `runId`, `retries`,
`bases`, `connections`, and `artifacts` — the last three built with
`createBaseSet`, `createConnectionSet`, and `createArtifactStore`.

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

`@sdxc/spec` also exports `lex`, `parse`, `loadSuite`, `loadSources`,
`createRegistry`, `executeTest`, `executeHook`, `createToolContext`,
`createRunId`, `reportSuite`, `reportRunHeader`, `reportFatal`,
`createBuiltinPlugins`, every plugin factory (`createFsPlugin`,
`createCliPlugin`, `createHttpPlugin`, `createBrowserPlugin`,
`createHtmlPlugin`, `createDbPlugin`, `createEnvPlugin`, `createUrlPlugin`,
`createJwtPlugin`, `createSamplePlugin`, `createStrPlugin`, `createSpecPlugin`),
the `SpecError` family, and `connectStdioPlugin` / `servePlugin` for plugins
that speak the NDJSON-over-stdio protocol. A plugin's own test builds its
`ToolContext` with `createToolContext`, which fills every field with an inert
default.

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
