# Proposal: what `@sdxc/spec` needs to run a real browser E2E suite

## Context

This proposal is derived from one concrete target: migrating the Daffy monorepo's
Playwright integration suite to `@sdxc/spec`. That suite is 17 files, 75 tests,
~2,900 lines including helpers. It drives a full local stack — Remix frontend,
Rails API, Kotlin backend, two PostgreSQL databases — through a real browser.

Every requirement below is backed by call sites in that suite, with counts. The
counts are the point: they say which additions unlock many tests and which unlock
one. Nothing here is speculative API design for its own sake.

Baseline reference: `@sdxc/spec` 2026.9.5 (README as published).

## Design constraints (do not violate)

These are settled and are not up for renegotiation while implementing:

1. **No control flow.** No `if`, no loops, no operators, no arithmetic. Repetition
   is expressed by defining a `command` and calling it N times. Branching is not
   expressed at all — a spec that seems to need it is either testing two behaviors
   (split it) or fighting non-determinism in the app (fix the app).
2. **The language stays tiny.** Prefer a new capability tool over new syntax.
   Where a feature can be a word-tagged option on an existing observable, it
   should be.
3. **Fail closed.** Every new privileged act needs an explicit grant, and its
   denial names the flag that would allow it.
4. **Deterministic.** Generated data stays reproducible from the run seed plus the
   test's identity. See §1.4, which is where this collides with reality.
5. **Declarative reads.** Address the world by role and accessible name, not by
   CSS. Where the suite currently uses CSS, the answer is a new _semantic_
   addressing form, not a CSS escape hatch.

---

# Part 1 — Prerequisites

Nothing ports without these four. They are language-level and should be settled
before any capability work starts.

## 1.1 String composition

**Why.** There is currently no way to build `"/" + user.slug + "/invite"`. The
suite has 26 interpolation sites, and nearly every test navigates to a URL that
contains a generated slug, email, or campaign id. Without this, generated data
cannot reach a URL, a heading assertion, or a SQL parameter — so `sample` is
unusable for anything but literal comparison.

**Proposed syntax.** Interpolation inside string literals, holding a dotted
reference and nothing else:

```
test "a private profile redirects to the invite page" {
	given {
		let user = create_testing_account
	}
	when {
		browser.open "/{user.slug}"
	}
	then {
		expect browser.path "/{user.slug}/invite"
	}
}
```

**Rules.**

- Only a dotted reference goes inside `{…}`. No calls, no arithmetic, no
  formatting directives — that keeps the language declarative.
- `{{` is a literal `{`. An unclosed brace, or a reference that does not resolve,
  is an error naming the reference and the literal it appeared in.
- Interpolation works anywhere a string literal works: tool arguments, `expect`
  values, and object literal values.
- Non-string values stringify the way JSON would (a number as its digits, no
  quotes), except that interpolating an object or array is an error.

**Acceptance.** `browser.open "/{user.slug}/invite"`, `expect browser.heading
"Donate to \"{campaign.title}\", led by {user.name}"`, and `db.query "web" "…"
params "{user.email}"` all resolve.

## 1.2 `contains`, `matches`, and `not`

**Why.** `expect` is deep structural equality; `contains` exists only as a `file`
observable. The suite has 26 substring text assertions, 15 partial-URL
assertions, and 8 negative assertions. Four tests are _about_ an absence (the
session cookie after logout, the API-key limit warning after revoking) and cannot
be written at all today.

**Proposed syntax.** Three predicate words, usable in both the two-value and the
observable forms of `expect`:

```
then {
	expect response.text contains "og:title"          # substring
	expect browser.url contains "/donate"
	expect browser.heading matches "sent you|believes you are generous"
	expect not browser.text "You have reached your limit of 5 API keys."
	expect not browser.cookie "session" exists
}
```

**Rules.**

- `contains` is substring for strings, membership for arrays, and an error for
  anything else.
- `matches` takes a JS `RegExp` source with no flags, plus an optional
  `ignoring case` tag. Lower priority than `contains`: only two sites genuinely
  need alternation, and both could be split into two tests instead. Implement
  `contains` first and see whether `matches` is still wanted.
- `not` immediately follows `expect` and inverts whichever form follows it.
- `eventually { expect not … }` retries until the thing is _absent_. That is the
  semantics the logout and revoke tests want, so allow it and document it. A
  "stays absent for the whole window" assertion is a different feature; do not
  build it now, nothing needs it.

## 1.3 A command may return a value

**Why.** 14 of 17 files call one helper that both _acts_ and _yields data_:
`createTestingAccount` navigates to a mock sign-in endpoint and returns the
email, name, slug and fund name it generated, all of which later assertions and
DB queries depend on. Today `command` performs effects and `fixture` returns
data, and neither does both.

**Proposed change.** Allow `return` in a `command`, so one definition covers
"do this, and hand me back what it produced":

```
# spec/commands/account.spec
use browser
use sample

command create_testing_account {
	let who = sample.person
	let slug = "{who.username}-{spec.run_id}"
	browser.open "/mocks/signin?email={who.email}&name={who.full_name}&slug={slug}&onboarding_status=complete"
	return { email: who.email, name: who.full_name, slug: slug, fund_name: "{who.full_name}'s Fund" }
}
```

**Also clarify, because the no-control-flow story depends on it:**

- A command body may contain assertions as well as actions.
- A command may be called from any phase. The `given`/`when`/`then` split stays a
  convention about intent, not a restriction on what a command contains.

That combination is what makes "call a command five times" a real substitute for a
loop. The suite's two loops become:

```
test "warns when reaching the limit of API keys" {
	given {
		create_testing_account
		browser.open "/settings/developers"
	}
	when {
		create_api_key                  # x5, one line each
		create_api_key
		create_api_key
		create_api_key
		create_api_key
	}
	then {
		expect browser.text "You have reached your limit of 5 API keys."
	}
}
```

The original loop asserted a countdown (`toHaveCount(5 - i)`) on each pass. With
no arithmetic, pass the expected remainder in as an argument —
`revoke_key_leaving 4` — which reads better than the loop did.

## 1.4 A per-run nonce: `spec.run_id`

**Why.** This is the one place where the determinism guarantee actively breaks the
target suite, and it is not obvious.

`sample` draws the same values on every run, by design. This suite runs
repeatedly against a **persistent** database with unique constraints on user
email and profile slug. Deterministic data means the second run collides on the
first insert. Playwright's faker draws fresh values each run, which is why it
works today; `--seed=random` would fix collisions but throw away replayability,
which is the feature's whole point.

**Proposed addition.** A permissionless value naming the run — a ULID, drawn once
per `spec run` and printed alongside the seed:

```
let slug = "{who.username}-{spec.run_id}"
```

**Rules.**

- Same value for every test in a run, different between runs.
- Printed in the run header next to the seed, so a row left in the database can be
  traced back to the run that made it.
- Overridable with `--run-id=…`, so CI can stamp a build number and a debugging
  session can reproduce a specific run's rows.

This keeps generated _data_ deterministic while letting a spec construct the one
thing that must not be: an identifier unique across runs.

---

# Part 2 — The cheapest third of the suite: an `html` namespace

`meta.spec.ts` is 24 of the 75 tests — a third of the suite — and it is the
easiest thing in it. Every test is: GET a page, assert on `<title>` and the
`<meta>` tags. It already runs with JavaScript disabled for speed, so it needs no
browser at all.

**Proposed addition.** An `html` namespace, permissionless (pure parsing, like
`url`), operating on a string of HTML so it composes with `http.get`:

- `html.title <html>` — the document title.
- `html.meta <html> <name>` — the `content` of a `<meta>` whose `name` **or**
  `property` matches, so `"description"` and `"og:title"` both work.
- `html.link <html> <rel>` — the `href` of a `<link rel="…">`, for canonical URLs.

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
		expect html.meta page.text "og:title" "Invest your money for more charitable impact"
		expect html.meta page.text "og:image" contains "/build/_assets/og-image-"
		expect html.meta page.text "twitter:card" "summary_large_image"
	}
}
```

Note that `page.text` is a _reference_, not a nested call, so this needs no new
syntax beyond §1.2's `contains`.

**Dependencies.** §1.2 (`contains`, for the image-path and URL assertions), §1.1
(two of the 24 build a slug-bearing URL), §3.1 (relative URLs), and for the two
tests that seed a gift and a campaign first, Part 5.

**Deliverable.** With Part 1 plus this, 24 tests port with zero browser work. That
is the milestone that proves the format on a real suite; do it first.

---

# Part 3 — Browser: navigation and session

## 3.1 A base URL and relative paths

**Why.** All 81 navigations in the suite are relative (`page.goto("/charities")`),
against a `baseURL` that differs between the dev environment (`:4000`) and the
integration environment (`:4010`). `browser.open` requires an absolute URL, so
today every spec would hard-code a host.

**Proposed syntax.** A suite-level base in `spec/config.jsonc`, with environment
substitution, plus relative URLs accepted by `browser.open`, `browser.navigate`
and the `http` verbs:

```jsonc
{
	"baseUrl": { "env": "FRONTEND_BASE_URL", "default": "http://localhost:4000" },
	"permissions": { "allow": [["env", "FRONTEND_BASE_URL"]] },
}
```

`--allow-net` still keys on the _resolved_ host, and the denial message names the
resolved host rather than the relative path, so a grant can be copy-pasted.

A second base is needed: the suite also drives a separate work-frontend origin
(`WORK_FRONTEND_BASE_URL`) in `dfw-dashboard.spec.ts`. Either allow a map of named
bases (`browser.open "work:/dashboard"`) or leave that one file on absolute URLs
built by interpolation. The second is fine; do not over-build.

## 3.2 `browser.reload`

Six sites. `settings-developers` reloads to prove an API key survives, and
`dfw-dashboard` reloads to prove a form saved. No options needed.

## 3.3 Cookie reads

**Why.** `browser.cookie` is set-only. Three tests read cookies:

- `fund_id` — read after sign-in, then used as the key for a DB write. This is
  load-bearing for the whole donation and tipping group.
- `session` — must be absent after logout.
- `daffy-partners-inviteCode` — must be present after a partner redirect.

**Proposed syntax.** Keep the setter, add the reader — as a value on the right of
`let`, and as an observable:

```
when {
	let fund = browser.cookie "fund_id"
}
then {
	expect not browser.cookie "session" exists
	expect browser.cookie "daffy-partners-inviteCode" exists
}
```

## 3.4 Response headers

**Why.** `rolling-session-cookie.spec.ts` (4 tests) is entirely about response
headers during navigation: the session cookie must be re-issued with
`Max-Age=3600` on document _and_ data requests, and must not be set for
anonymous requests. There is currently no way to observe a response the browser
received.

**Proposed syntax.** An observable over the session's most recent response:

```
when {
	browser.click link "Contributions"
}
then {
	expect browser.response_header "set-cookie" contains "session="
	expect browser.response_header "set-cookie" contains "Max-Age=3600"
	expect browser.response_status 200
}
```

**Rules.** "Most recent" means the last document or data response the session
received, which is well-defined after a click that triggers navigation. Header
names are case-insensitive. A repeated header (several `set-cookie` lines) joins
with `, ` — document that, since it affects `contains`.

## 3.5 Requests inside the browser's session

**Why.** The suite seeds a campaign by POSTing to a mock endpoint _with the
browser's session cookies_ (`page.request.post("/mocks/campaign", …)`). The `http`
namespace has its own cookie-less client, so it cannot do this.

**Proposed syntax.** `browser.request`, returning the same shape as `http`:

```
when {
	let created = browser.post "/mocks/campaign" json { campaign: { title: "…" }, nonProfits: [ "1111111" ] }
}
then {
	expect created.status 200
}
```

Reuse the `http` option grammar verbatim (`json`, `form`, `headers`, `bearer`,
`basic`). Grant is `--allow-net` for the resolved host, same as `browser.open`.

## 3.6 Viewport and scroll

**Why.** `hamburger-menu.spec.ts` exists _because of_ mobile layout: it sets a
390×844 viewport, scrolls down 1500px, opens the menu, and asserts the menu item
is in the viewport. Three viewport sites, two scroll sites.

**Proposed syntax.**

```
given {
	browser.viewport 390 844        # or: browser.viewport mobile
}
when {
	browser.open "/"
	browser.scroll to 1500          # or: browser.scroll to button "menu"
}
```

Presets (`mobile`, `tablet`, `desktop`) are worth having since that is how the two
tests read.

---

# Part 4 — Browser: addressing and observing elements

This is the bulk of the work: 51 tests depend on it. The suite's Playwright usage
breaks down as 128 role lookups, 96 visibility assertions, 62 text assertions, 47
CSS locators, 23 label lookups.

## 4.1 Matching rules, stated explicitly

Before adding observables, settle and document two rules. Both have many call
sites and the wrong default is expensive to change later.

- **Role lookups match the accessible name exactly**, whitespace-normalized. The
  suite passes `{ exact: true }` at 30+ sites and its absence is usually an
  oversight. Add a `containing` tag for the deliberate substring case:
  `browser.click link "Profile"` is exact, `browser.click link containing
"Profile"` is not.
- **`browser.text` is a substring assertion** over the page's visible text —
  "this text appears" — because that is what its 62 call sites mean. Add an
  `exactly` tag for the handful that need equality.

## 4.2 Ambiguity: `first` and `nth`

12 sites use `.first()` because several elements match (a nav link repeated in
header and footer, a "Donate" button per card). Playwright throws on ambiguity by
default; that strictness is arguably right but would fail 12 specs immediately.

**Recommendation.** Match the **first element in tree order**, documented, and add
`nth <n>` for the rest:

```
browser.click link "Profile"
browser.click button "Donate" nth 2
```

If you prefer strictness, the alternative is: ambiguity is an error whose message
lists every match with its position, and `first` / `nth n` are how a spec opts
in. That is defensible and better for catching real bugs — but it is a decision to
make deliberately, not a default to stumble into.

## 4.3 Element addressing by field name

**Why.** ~30 CSS-selector sites exist for one reason: addressing a form control by
its `name` attribute, because the visible label is not unique or not associated
(`input[name="tip"]`, `input[name=slug]`, `input[name=maxMatchingAmount]`). A CSS
escape hatch would solve it and would also gut the "address by role and name"
philosophy.

**Proposed syntax.** A `field` addressing form that resolves by the `name`
attribute, usable with every action and observable that takes an element:

```
when {
	browser.fill field "tip" with "50"
}
then {
	expect browser.field "maxMatchingAmount" value "1000"
}
```

This is narrow (one attribute, form controls only), declarative, and removes the
single largest reason to reach for CSS. The remaining CSS sites are covered by 4.6
and 4.7.

**Note for the implementer.** The tipping tests drive a _range_ input 14 times. A
fill must dispatch whatever events the framework listens for (`input` **and**
`change`) or React will not update and every tipping assertion will fail on a
stale total. This is the most likely silent failure in the whole migration —
verify it against the real app early.

## 4.4 Fill replaces; add `check` / `uncheck`

Eight sites do `.clear()` then `.fill()`. Define `fill … with` as _replace the
control's value_, not append. Add `browser.check` / `browser.uncheck`, addressing
`checkbox` and `switch` roles — the onboarding flow checks a membership agreement,
and the donation flow toggles a "share my information" switch.

Addressing by _label_ needs no new feature: a control's label is its accessible
name, so the 23 `getByLabel` sites are already `browser.fill textbox "Name" with
…`. Document that equivalence, it is not obvious.

## 4.5 Missing observables

Each of these is a word-tagged predicate on an element observable. Ordered by call
sites:

| Predicate              | Sites      | Example                                               |
| ---------------------- | ---------- | ----------------------------------------------------- |
| `count <n>`            | 4 + helper | `expect browser.button "Revoke" count 5`              |
| `value <v>`            | 7          | `expect browser.field "name" value "Another name"`    |
| `attribute <name> <v>` | 6          | `expect browser.link "Home" attribute "href" "/home"` |
| `enabled` / `disabled` | 2          | `expect browser.button "Create API Key" enabled`      |
| `in_viewport`          | 2          | `expect browser.menuitem "About Us" in_viewport`      |

`count 0` also covers several negative assertions, and `count` is what the suite's
`saveAndLoadForm` helper needs: it detects a Remix revalidation by watching a
locator go from 1 to 0 to 1, which becomes two `eventually` blocks.

On `in_viewport`: only 2 real uses. Nine more appear in `onboarding.spec.ts` but
are un-awaited floating promises that assert nothing today, so they do not need
porting — and are worth reporting back to the suite's owners as a live bug.

## 4.6 More roles

The suite addresses elements that current observables do not cover: `menuitem`,
`switch`, `textarea`, and images by alt text (6 sites — the donation flow's
confirmation is an `<img alt="Thank you">`). Images are already a role with an
accessible name, so `expect browser.image "Thank you" exists` fits the existing
grammar.

## 4.7 Two structural reads

Five CSS sites read table cells by position, and the tipping tests read a total
from a `<dd>` that follows a `<dt>`. Both map onto real ARIA roles, so both can be
declarative rather than CSS:

```
then {
	expect browser.cell row 1 column 2 "john@example.com"
	expect browser.definition "Total" contains "$100"
}
```

`browser.definition "<term>"` reads the `definition` paired with a `term` — which
is exactly what the tipping suite's xpath (`following-sibling::dd[1]`) is faking,
and it is the single most-repeated read in the largest test file.

---

# Part 5 — `db`: two databases, parameters, and seed scripts

## 5.1 Named connections

**Why.** `db.query` takes its DSN from `DATABASE_URL` — one database per run. This
suite touches **two inside a single test**: it reads a fund id from the Rails
database, then writes balances into the Kotlin backend's database. Four files and
46 tests depend on it. Nothing about this suite ports without it.

**Proposed syntax.** Named connections declared in config, each DSN from its own
environment variable, so the grant stays "one named variable" and the environment
still chooses the target:

```jsonc
{
	"databases": {
		"web": { "env": "WEB_DATABASE_URL" },
		"backend": { "env": "BACKEND_DATABASE_URL" },
	},
	"permissions": { "allow": [["env", "WEB_DATABASE_URL", "BACKEND_DATABASE_URL"]] },
}
```

```
use db

command give_fund_balance(email, amount) {
	let fund = db.query "web" "select funds.id from funds join memberships on funds.id = memberships.fund_id join users on users.id = memberships.user_id where memberships.default = true and users.email = $1" params email
	db.query "backend" "delete from balances where fund_id = $1" params fund.rows.0.id
	db.query "backend" "insert into balances (organization_id, fund_id, pending_deposit_balance, portfolio_balance, net_transaction_balance) values (1, $1, $2, $2, $2)" params [ fund.rows.0.id, amount ]
}
```

Keep a single unnamed `db.query "…"` working against `DATABASE_URL` when exactly
one connection is configured, so existing suites do not break.

**Open question for the implementer:** indexing into `rows` by position
(`fund.rows.0.id`) — confirm whether dotted references already accept a numeric
segment. If not, that is a small addition, and it is required: every DB read in
this suite reads row 0.

## 5.2 Query parameters

**Why.** Interpolating values straight into SQL would work once §1.1 lands, and it
is a footgun even in a test suite. Every DB call in the suite is parameterized.

**Proposed syntax.** A `params` tag taking one value or an array literal, mapped
to `$1`, `$2`, … in order. Confirm array literals are writable in argument
position; if not, that is a prerequisite.

## 5.3 Running a seed script from a host path

**Why.** Suite setup loads four `.sql` files from `database-seed/` — outside the
workspace, each containing many statements (production portfolio bootstrap,
Coinbase currencies). Bun's SQL client may not accept multi-statement strings, so
this likely needs its own tool rather than `db.query`.

**Proposed syntax.**

```
setup {
	db.run_file "backend" "../database-seed/backend/V1_production_portfolios_bootstrap.sql"
}
```

Doubly gated: `--allow-env` for the DSN and `--allow-host-fs` for the path prefix.
The denial should name both when both are missing.

---

# Part 6 — The runner

## 6.1 Suite-level `setup`

**Why.** The suite seeds portfolios, currencies, non-profits and causes **once**,
as a Playwright setup project. `command` and `fixture` are per-test, so they would
re-seed 75 times.

**Proposed syntax.** One `setup { }` block per suite — as a top-level block or a
`spec/setup.spec` convention:

```
setup {
	db.run_file "backend" "../database-seed/backend/V1_production_portfolios_bootstrap.sql"
	db.query "web" "insert into non_profits (ein, name, city, state, country) values ('1111111', 'test non profit 1', 'New York', 'NY', 'US') on conflict do nothing"
}
```

**Rules.** Runs once before any test, in its own workspace, under the same grants.
Runs exactly once regardless of `--concurrency`. A failure is fatal and reports
like a load error (exit 2), because every test would fail confusingly otherwise.

## 6.2 URL observables, so `eventually` can wait on navigation

**Why.** 15 sites wait for a URL to satisfy a predicate — most often "the wizard
advanced to the `share` step" (`?step=share`). Composing this today needs
`let landing = browser.url` then `url.query`, and `let` is an action, so it cannot
sit inside `eventually` — which is exactly where waiting belongs.

**Proposed syntax.** Dedicated observables on the session, needing no new syntax:

```
then {
	eventually within 10s {
		expect browser.path "/donate"
		expect browser.query "step" "share"
	}
}
```

Add `browser.path`, `browser.query <name>`, `browser.fragment <name>` alongside the
existing `browser.url` and `browser.title`.

**Rejected alternative.** Allowing nested calls in argument position
(`expect url.query browser.url "step" "share"`) requires parenthesized calls to
resolve the parse, adds syntax, and buys nothing these observables do not.

## 6.3 `skip`

Six tests are skipped, including all of one file (a known-broken Playwright bug, a
flow pending a rewrite). Propose a `skip` prefix, reported in the counts:

```
skip test "shows the CapsLock warning" {
	…
}
```

`2 passed, 0 failed, 1 skipped (21ms)`.

## 6.4 `--retries=N`

CI runs with `retries: 2` today. E2E against a live multi-service stack will need
it. Retried tests should redraw nothing — same seed, same run id, same data — so a
retry is a genuine repeat rather than a different test.

## 6.5 Failure diagnostics

**This is the largest non-feature risk in the migration.** Playwright's trace
viewer and UI mode are why a 75-test browser suite is maintainable. Replacing them
with "assertion failed" would make the ported suite harder to own than the one it
replaced, regardless of how good the language is.

Minimum bar for a browser assertion failure:

- The session's current URL.
- The accessible name and role of every element that _nearly_ matched — same role
  wrong name, same name wrong role. Most e2e failures are a renamed button, and
  this one line usually is the whole diagnosis.
- A screenshot and an accessibility-tree dump written to a run directory
  (`--artifacts=<dir>`), with the paths printed in the failure.

## 6.6 Concurrency, honestly

The suite runs 2 workers on CI today. Per the README, a suite sharing one mutable
backend belongs at `--concurrency=1`. This suite shares one Rails instance, one
Kotlin backend, and two databases, and its tests write overlapping rows.

Measure the sequential wall-clock before committing to the migration. If it is
materially worse, the honest fix is per-test data isolation in the _app's_ mock
endpoints, not concurrency in the runner.

---

# Milestones

**M1 — Prerequisites.** §1.1 interpolation, §1.2 `contains`/`not`, §1.3 commands
that return, §1.4 `spec.run_id`. Unlocks nothing on its own; everything depends on
it.

**M2 — The meta suite.** Part 2 (`html` namespace) + §3.1 (base URL). Ports 24 of
75 tests with no browser work. This is the milestone that validates the format
against a real suite — do it before committing to the rest.

**M3 — Data setup.** Part 5 (named connections, params, seed scripts) + §6.1
(`setup`). Unblocks the 46 tests that need database state, though they still need
M4 to actually run.

**M4 — Browser.** Parts 3 and 4, plus §6.2. The long tail, and most of the effort.

**M5 — Replacing Playwright in CI.** §6.3–§6.6. Until this lands, run both suites
green side by side rather than deleting anything.

# Decisions the implementer should make explicitly

1. **Ambiguity:** first-match-wins (12 specs port unchanged) versus error-with-
   candidates (`first`/`nth n` to opt in; better bug-catching, 12 specs to touch).
   §4.2.
2. **`matches`:** implement regex at all, or force the two sites that want
   alternation to split into two tests? §1.2.
3. **Second origin:** named bases in config, or absolute URLs built by
   interpolation for the one file that needs them? §3.1.
4. **Determinism versus a persistent database:** `spec.run_id` is proposed here,
   but the alternative is requiring a freshly seeded database per run. The nonce
   is cheaper and does not weaken replay; confirm that is the direction. §1.4.

# What the constraints cost, for the record

Two tests in the target suite currently branch:

- A sign-in helper dismisses a welcome modal _if it appeared_. The fix is app-side:
  teach the mock sign-in endpoint a `welcome=false` parameter so the modal never
  renders under test.
- An onboarding test races two headings and branches on whichever resolves first.
  That is papering over non-determinism in a mock; make the mock deterministic and
  it becomes one straight-line test.

Both are small changes to the application's test endpoints, not to the language.
The no-control-flow constraint costs this suite two mock-endpoint edits and
nothing else — worth stating plainly, because "the language has no `if`" reads
like a much larger tax than it turns out to be.
