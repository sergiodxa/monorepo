# ADR-018: What the Language Needs to Run a Real Browser E2E Suite

## Status

**Proposed** - 2026-09-10

This ADR records the language, capability and runner decisions taken so a real
browser end-to-end suite can be written in `.spec` — derived from one concrete
target, a 75-test Playwright suite across 17 files that drives a Remix frontend, a
Rails API, a Kotlin backend and two PostgreSQL databases through a real browser
(`docs/proposals/spec-requirements-for-real-e2e.md` holds the call-site counts that
set the priorities). Like [ADR-009](./ADR-009-v1-typescript-implementation.md)
through [ADR-017](./ADR-017-zero-arg-tool-calls.md) it is an implementation ADR: not
standalone, free to reference this monorepo's packages, and bound by the design suite
([ADR-001](./ADR-001-executable-specification-language.md) through
[ADR-008](./ADR-008-environments-and-compatibility.md)) rather than amending it.
Every choice here is **v1-provisional**.

It closes two prior Open Questions. [ADR-016](./ADR-016-oauth-oidc-testing-tools.md)'s
first — that a bare scalar binding reaches a tool only through a dotted reference —
is answered in §2, and [ADR-017](./ADR-017-zero-arg-tool-calls.md)'s first — that a
bare-path right-hand side admits tools but not argument-less commands — is answered
in §4.

## Context

The design suite's constraints hold throughout and were not renegotiated:
capability arrives as tools rather than grammar
([ADR-002](./ADR-002-specification-language-design.md)); there is no control flow, so
repetition is a command called N times and branching is not expressed at all; every
privileged act needs an explicit grant whose denial names the flag that would allow it
([ADR-007](./ADR-007-deny-by-default-permissions.md)); generated data reproduces from
the run seed plus the test's identity; and the world is addressed by role and
accessible name rather than by CSS.

Two of those collide with the target, and the collisions shaped the decisions more
than any individual feature request:

1. **Determinism against a persistent database.** `sample` draws the same values every
   run, and the target's database has unique constraints on user email and profile
   slug. A second run collides on its first insert. `--seed=random` fixes it by
   discarding replayability, which is the feature's whole point.
2. **String composition is missing entirely.** Generated data could not reach a URL, a
   heading assertion or a SQL parameter, so `sample` was usable only for literal
   comparison.

## Decision

### 1. String composition is a tool: the `str` namespace

A new permissionless namespace `str`, whose first tool is `format`. Holes are always
`${…}`, positional by index or named by key:

```
use str

let profile = format "/${0}" who.username
let invite = format "/${slug}/invite" { slug: user.slug }
```

- A bare `$` is literal; `{{` writes a literal `${`-style hole where one is wanted as
  text. No lexer or parser change, and `"""` keeps its documented raw semantics.
- **Strict on arguments**: a hole with no value, an argument no hole consumes, and
  mixing positional with named are each errors naming the template and the offender.
- Values stringify the way JSON would without quotes. `null`, objects and arrays are
  errors naming the hole, so a nullable column never becomes the text `null` inside a
  URL.

Interpolation inside string literals was the alternative. It reads better at a single
site and costs a lexing mode, a mandatory escape in every existing string, and a
second decision about whether `"""` stays raw — which the runtime's own suite depends
on, since it writes `.spec` source inside `"""` blocks.

### 2. A bare identifier in tool-argument position resolves against the descriptor

Previously a bare identifier handed to a tool was always a word, so a binding reached a
tool only as a dotted reference — the wrapper idiom `let where = { url: landing }`.
A tool already declares its words: a `ToolParam` with `kind: "word"` carries the
accepted spelling in its `name`. So resolution reads that declaration:

1. A **word** when the tool declares a word-kind parameter of that name, or when the
   required parameter at that position is word-kind.
2. Otherwise a **binding read**, when the name is bound in scope.
3. Otherwise the usual unknown-name error.

A name that is both a declared word and a live binding is an `ambiguous-name` error,
the rule that already governs colliding names. `expect file "note.txt" exists` is
unchanged; `browser.open profile` now works.

### 3. Predicates live in two places, deliberately

`contains` and `not` join the `expect` statement, which needs no grammar change —
`expect` already takes an open argument list and dispatches on its first argument, and
words are already valid arguments.

```
expect page.text contains "og:title"
expect not browser.cookie "session" exists
```

- `contains` is substring for strings and membership for arrays, using the same
  structural equality `expect` uses; anything else is an error naming the type.
- `not` is valid only as `expect`'s first argument, and inverts whichever form follows.
- `eventually { expect not … }` retries until the thing is absent.

Element observables keep declaring their own predicates instead
(`containing`, `exactly`, `count`, `value`), because the tool runs the query and is
the only thing that saw the near-misses — which is what makes the failure diagnostics
in §11 possible.

`matches` is not implemented. The two sites wanting alternation are two behaviors in
one test, and a regex borrowed from the host runtime would pin the notation to a
dialect that drifts.

A negative assertion passes when the thing is absent and equally when the page never
rendered. The idiom that fixes it needs no feature and is documented: anchor it with a
positive expectation in the same block.

### 4. Commands absorb fixtures

- `return` in a command body already works; the documentation catches up to it.
- A bare path now admits a **zero-parameter command**, not only an argument-less tool,
  so `let user = create_testing_account` binds what the command produced.
- **The zero-argument rule holds in every expression position**, not only on a
  `let`/`return` right-hand side as [ADR-017](./ADR-017-zero-arg-tool-calls.md) confined
  it. §5's `{ nonce: spec.nonce }` is an object entry, and the same path means the same
  thing inside an array or an argument. A bound head stays a reference, so nothing is
  guessed at: the two readings never overlap. This widens ADR-017's scope rather than
  answering one of its Open Questions, and is what makes §5's identity values usable
  where a spec actually composes them.
- `eventually` is valid in any command body, not only in a `then` block. A helper can
  wait for its own effect to land, which is what makes five sequential calls a
  substitute for a loop rather than a race.
- **`fixture` is removed.** A command takes parameters, performs effects and returns a
  value, which left `fixture` with no distinguishing property. The word stays reserved
  so the old syntax fails with a message naming the replacement rather than an
  unexpected-identifier error. There is no per-test memoization: a command runs on
  every call, and a value wanted once is bound once.

### 5. The `spec` namespace: three values, one of which must not be deterministic

```
use spec

let slug = format "${name}-${nonce}" { name: who.username, nonce: spec.nonce }
```

| Value          | Scope                            | Purpose                                    |
| -------------- | -------------------------------- | ------------------------------------------ |
| `spec.run_id`  | one per run, shared by all tests | tracing rows to a run; `--run-id=` replays |
| `spec.attempt` | 1, 2, 3 … per test attempt       | reporting                                  |
| `spec.nonce`   | per run **per attempt**          | what specs compose into generated identity |

`spec.nonce` is `<run_id>-<attempt>`. Generated data stays deterministic — the seed and
every `sample` draw are unchanged between runs — while the one thing that must not be
reproducible, an identifier unique across runs, is constructed explicitly and visibly
by the spec.

Varying with the attempt rather than the run is what makes `--retries` sound: a retry
that reused the run's identifier would re-insert the same email and fail on a duplicate
key, for a reason unrelated to the original failure.

Two tests on the same attempt share a nonce, which is safe because their `sample`
streams are keyed on test identity. Leftover rows stay greppable, and §11's `teardown`
is where a suite removes them.

The run header prints the seed and the run id as copy-pasteable replay flags.

### 6. The `html` namespace

A permissionless namespace over a string of HTML, a thin plugin over the `@sdxc/html`
package ([ADR-055](../ADR-055-html-package.md)), which owns parsing and the query
semantics.

```
use http
use html

test "the portfolios page describes itself" {
	when { let page = http.get "/portfolios" }
	then {
		expect page.status 200
		expect html.title page.text "Invest your money for more charitable impact"
		expect html.meta page.text "og:image" containing "/build/_assets/og-image-"
	}
}
```

`html` carries **every observable `browser` carries**, minus the layout-dependent
ones, under the identical matching rules of §9 — so a document is addressed one way
and the namespace choice is only about whether a live browser is needed. A requested
tag that is absent is an error naming the tags that were present, with `exists` for
deliberate absence.

That parity settles one naming question the head readers raise: `html.link` is the role
shorthand its `browser` counterpart is, and `html.rel` reads the `href` of a
`<link rel="…">`, beside `html.title` and `html.meta`. One spelling means one thing in
both namespaces, so an assertion moved between them cannot quietly change subject.

A structured `html.parse` returning an object was the alternative. Meta names in
practice are `og:title` and `twitter:card`, and a colon cannot appear in a dotted
path, so the exact tags under test would be unaddressable.

### 7. Named bases and relative targets

```jsonc
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

- Unnamed resolution works when exactly one base is configured; `on "name"` selects
  otherwise. The same rule and the same word govern `db` in §10.
- **Config-level environment substitution needs no grant.** The config is the runner's
  own settings, written by whoever runs the CLI, and could have held the literal URL.
  `env.get` inside a spec is a different act and keeps its grant.
- A relative target starts with `/`; anything else is an error suggesting the slash,
  which removes "relative to the current page" — a meaning that would make a statement
  depend on the statement before it.
- A target carrying a scheme, or `//host/path`, is absolute and ignores the base.
- `--allow-net` keys on the resolved host and its denial names that host, so a grant is
  copy-pasteable. The run header prints each resolved base.

### 8. Browser navigation and session

- **`browser.reload`**, which returns once the document has finished loading.
- **`browser.cookie` reads, `browser.set_cookie` writes.** A descriptor is an action or
  an observable and never both, so the setter's name could not gain a reading form.
  Splitting this way restores the namespace's convention — actions are verbs, observables
  are nouns — and gives the short name to the common case.
- **`browser.response_header` and `browser.response_status`**, over the session's
  responses. `of document` and `of data` select the last response of that kind, because
  a framework navigation issues both and the assertions are about each separately.
  Repeated headers resolve to an **array**, never comma-folded: `Set-Cookie` carries
  commas inside `Expires`, so folding makes it unparseable. The observable's
  `containing` matches when some value contains the string.
- **`browser.fetch.*`** mirrors `http`'s verbs and its option grammar verbatim, issuing
  requests inside the session so cookies apply. After `use browser` the bare form is
  `fetch.post`. A `fetch` request does **not** become the "most recent response" the
  header observables read, so seeding data cannot clobber an assertion.
- **`browser.viewport`** takes two numbers or a name, applying immediately to an open
  page. Names take Tailwind's widths with the height of the device that lives there:

  | Name  | Size       | Device                   |
  | ----- | ---------- | ------------------------ |
  | `xs`  | 390 × 844  | iPhone 14                |
  | `sm`  | 640 × 1138 | phone aspect ratio       |
  | `md`  | 768 × 1024 | iPad, portrait           |
  | `lg`  | 1024 × 768 | iPad, landscape          |
  | `xl`  | 1280 × 800 | MacBook Air 13″          |
  | `2xl` | 1536 × 998 | MacBook Pro aspect ratio |

  A name sets size alone — no user agent, scale factor or touch emulation.

- **`browser.scroll to <n>`** is an absolute Y offset in CSS pixels;
  `browser.scroll to button "menu"` brings an element into view.

Sessions are keyed to the test's workspace, so cookies, viewport and history are
per-test by construction, and a retry's fresh workspace gets a fresh session.

### 9. One addressing vocabulary, shared by `html` and `browser`

**Matching.** Role lookups match the accessible name **exactly**, on the normalized
name; `containing` opts into substring. `text` is a **substring** assertion over
visible text; `exactly` opts into equality. The asymmetry is deliberate: "is there an
element named X" and "does this string appear" are different questions.

**Ambiguity is an error** listing every match with its position; `first`, `nth n` and
`last` opt into one. Ordinals are 1-based, distinct from 0-based array indexing.
First-match-wins was the alternative: it makes a duplicated element — a nav link in
header and footer, a button per card — assert on the wrong node with no signal, which
is the failure class declarative addressing exists to prevent. Its migration cost is
also near zero, because a strict runner's opt-ins are already written at those sites.

**Addressing by field name.** `field "tip"` resolves any element carrying a `name`
attribute — input, textarea, select, button — and sits where a role word sits, so it
needs no new production. `value "annual"` narrows a group sharing one name, which is
how radio groups and submit-intent buttons are addressed. This removes the single
largest reason to reach for CSS.

**Filling and typing.** `fill … with` replaces the control's value; `type … with`
appends keystrokes. `fill` dispatches the `input` and `change` events the platform
would, or a controlled component reads a stale value — the most likely silent failure
in any port, and a conformance test against a real range input is part of the browser
milestone's definition of done.

A control's label is its accessible name, so addressing by label needs no feature:
`browser.fill textbox "Name" with …` is the label lookup. `browser.uncheck` joins the
existing `check`.

**Predicates.** `count <n>`, `value <v>`, `attribute <name> <v>`,
`enabled` / `disabled`, and `in_viewport` (browser only). `count` is a set predicate
and accepts any number of matches; the rest require exactly one. `attribute` reads the
raw markup rather than the resolved property, and `value` compares as a string.

**Roles.** `menuitem`, `switch` and `image` join the existing roles. A `<textarea>` is
a `textbox`; addressing it as `textarea` would be addressing a tag name.

**Structural reads.** `browser.cell row 1 column 2` is 1-based over **body** rows, with
`including header` to count them. `browser.definition "Total"` reads the `definition`
paired with a `term`, which is a genuine role pairing rather than a translated xpath.

### 10. `db`: its own grant, named connections

```jsonc
{
	"databases": {
		"web": { "env": "WEB_DATABASE_URL" },
		"backend": { "env": "BACKEND_DATABASE_URL" },
	},
}
```

```
command give_fund_balance(email, amount) {
	let fund = db.query "select funds.id from funds … where users.email = $1" params email on "web" one
	db.query "delete from balances where fund_id = $1" params fund.id on "backend"
	db.query "insert into balances (fund_id, portfolio_balance)" params [ fund.id, amount ] on "backend"
}
```

- **A new `db` permission family.** `db` was gated entirely by
  `--allow-env=DATABASE_URL`; once DSNs move into config, that gate disappears, so the
  capability takes its own: `--allow-db`, scopable to connection names, with a denial
  naming the flag.
- **`on "name"` selects the connection**, matching §7 and keeping the SQL in first
  position. Unnamed works when exactly one connection is configured.
- **`one` returns the single row**, erroring unless exactly one came back — which turns
  the assumption every one of these queries makes into a checked one. **Numeric path
  segments** (`result.rows.0.id`, 0-based) address genuine multi-row reads and arrays
  generally; a dotted reference previously could not hold a numeric segment at all.
- **Array literals** join the expression grammar, so `params [ a, b ]` is writable.
  Arrays were already values — query rows, repeated headers — without being writable.
- **`db.run_file "…sql" on "backend"`** sends a file's bytes unparsed over the simple
  query protocol, which accepts multiple statements natively. Nothing splits on `;`:
  dollar-quoted bodies, semicolons inside strings and comments all defeat a splitter,
  and its failure mode is a half-applied seed. Gated `--allow-db` plus
  `--allow-host-fs=<prefix>`, whose flag this wires up for an already-declared
  permission family, with the denial naming both when both are missing.

Host filesystem paths resolve against the process working directory, the same way
`spec run <dir>` already resolves the suite.

### 11. The runner

- **`setup` and `teardown`**, one of each per suite, a second being a load error like a
  duplicate definition. `setup` runs once before any test regardless of
  `--concurrency`, in its own workspace under the same grants; its failure is fatal and
  reports as a load error at exit 2. `teardown` runs once after all tests, including
  after failures, which is where a suite removes rows it left behind by run id.
- **URL observables**: `browser.path`, `browser.query <name>`, `browser.fragment <name>`
  alongside `url` and `title`, so `eventually` can wait on navigation without a `let`.
  An absent query parameter is an error, with `exists` for deliberate absence. These
  make `contains` on URLs largely unnecessary: `expect browser.query "step" "share"` is
  exact, where `url contains "/donate"` also passes on `?next=/donate`.
- **`skip`** prefixes `test`, with an optional reason printed in the summary, and is
  reported in the counts.
- **`--retries=N`**. A retry redraws no data — same seed, same `sample` draws — while
  `spec.nonce` moves so inserts stay clean. `setup` does not re-run, and the attempt
  gets a fresh workspace. A test that passed only on retry is reported in its own
  **`flaky`** count with the failed attempt's diagnostics kept, so retries absorb
  infrastructure noise without hiding a test decaying toward permanent failure.
- **Failure diagnostics** are part of the browser milestone, not a follow-up: the
  session's current URL, the near-match list — same role wrong name, same name wrong
  role, which is usually the whole diagnosis — and a screenshot plus accessibility-tree
  dump under `--artifacts=<dir>` with the paths printed. The candidate-listing machinery
  is shared with §9's ambiguity error. An `html` failure dumps the parsed document.
- **Concurrency** stays measured rather than assumed. `spec.nonce` gives every attempt
  its own generated identity, so writes keyed to a generated account are already
  isolated and what remains shared is seeded reference data that tests only read.

### 12. Milestones

Sharing one addressing vocabulary between `html` and `browser` moves the semantic work
earlier, where failures are deterministic and fast.

| Milestone | Contents                                                                              |
| --------- | ------------------------------------------------------------------------------------- |
| M1        | §1 `str.format`, §2 descriptor-driven bindings, §3 predicates, §4 commands, §5 `spec` |
| M2        | [ADR-055](../ADR-055-html-package.md), §6 `html`, §7 bases, §9 the vocabulary         |
| M3        | §10 `db`, §11 `setup`/`teardown`                                                      |
| M4        | §8 browser session, §9 bound to `agent-browser`, §11 URL observables and diagnostics  |
| M5        | §11 `skip`, retries, flaky reporting, concurrency measurement                         |

M2 is where addressing and matching are designed, built and tested with no browser in
the loop, so M4 binds a settled vocabulary rather than inventing one.

## Consequences

`fixture` leaves the language, and the runtime's own suite and examples migrate:
`fixture X { … }` becomes `command X { … }`, and `let v = fixture X` becomes
`let v = X` — which is the same change as §4's zero-parameter admission.

Two decisions are breaking. The cookie setter is renamed, and a bare identifier in
tool-argument position may now read a binding where it previously became a word. The
second is guarded: a collision between a declared word and a live binding is an
`ambiguous-name` error rather than a silent reinterpretation.

The no-control-flow constraint costs the target suite two application changes and
nothing in the language: a sign-in helper that dismisses a welcome modal only when it
appeared becomes a mock endpoint parameter, and an onboarding test that races two
headings becomes deterministic in the mock. Both are smaller than "the language has
no `if`" suggests.

## Open Questions

These are v1-provisional pressure points. The first five are capability verifications
rather than design choices — several decisions above assume something of
`agent-browser` or of Bun's SQL client — and each has been checked against the real
tool, so what they answer is recorded with them.

- **`HttpOnly` cookie reads — verified.** `agent-browser cookies get` returns the real
  jar, including `httpOnly: true` entries with their values, so `browser.cookie` reads
  the session cookie and the logout assertion needs no other shape.
- **Document versus data responses — verified, with two limits.**
  `network requests --type document` and `--type xhr,fetch` separate the two kinds,
  each response carrying its status and its response headers, which is what
  `of document` and `of data` select between. Two things do not follow from that.
  `Set-Cookie` is exposed on neither kind, because Chrome withholds it from the network
  log, so a spec reads cookies through `browser.cookie` rather than through a response
  header. And §8's no-folding rule is reachable on a document response only: a data
  response arrives through the fetch layer, which has already comma-folded repeated
  headers, so the array of separate values is unavailable there.
- **Screenshots and accessibility-tree dumps — verified.**
  `agent-browser screenshot [path]` writes a PNG, and `snapshot` / `snapshot -i` dumps
  the tree with refs. Together they are what `--artifacts=<dir>` collects.
- **`fill` on a range input — the CLI's own `fill` does not satisfy §9.**
  `agent-browser fill` reports success on a range input while leaving the slider at its
  midpoint, and dispatches `input` without `change`; repeated fills with different
  values never move it. `browser.fill` therefore drives a range input itself, through the
  prototype `value` setter and explicit `input` and `change` events — the prototype setter
  being what defeats a controlled component's value tracker, so React reads the change.
  §9's conformance test against a real range input asserts the value moves, both events
  fire, and a second fill moves it again.
- **The simple query protocol — verified.** Bun 1.4.0's `sql.unsafe(text)` uses the
  simple query protocol and applies a multi-statement string whole, on PostgreSQL 16 and
  on SQLite, including a `$$…$$` dollar-quoted `plpgsql` body with internal semicolons
  and a string literal containing `;`. Binding parameters switches to the extended
  protocol, which Postgres refuses for multiple commands, so `db.run_file` never binds —
  which leaves `psql` and `--allow-run` out of the seeding story entirely.
- **`select` and `dialog` — answered against a real browser.** `dialog` needs no feature:
  roles are an open set, and a native `<dialog>` and an explicit `role="dialog"` both
  address as `dialog`. `select` was worth having and is spelled in the `fill … with`
  idiom — `browser.select combobox "Plan" with "Annual"` — with the option addressed by
  the accessible name the list shows, so the matching rule is the vocabulary's rather
  than the CLI's.

  Confirming `dialog` turned up a defect the ADR had not anticipated: a closed `<dialog>`
  is hidden by the user-agent stylesheet, which markup cannot see, so
  `expect not browser.element dialog "…" exists` wrongly reported it present. A browser
  lookup therefore takes visibility from the rendered page rather than from the markup —
  the one place `browser` and `html` answer differently, and only because `browser` has a
  layout to consult. A dropdown's `<option>` elements are the exception, since Chrome
  reports them as not visible until the popup opens while a person reading the list sees
  them all.
