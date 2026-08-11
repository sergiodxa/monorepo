# ADR-027: A Flow Monitor Is an Executable Spec, Run on Browser Run

## Status

**Proposed** — 2026-08-11. Adds a sixth monitor type whose configuration is a `.spec` file
written by the customer, executed server-side against a hosted browser.

The `@pkg/spec` side of it is **in place** as of 2026-08-11: the package now runs a suite in a
V8-isolate runtime, loads specs from strings instead of a directory, and lets a host choose
which capabilities exist at all ([§9](#9-what-pkgspec-has-to-grow)). What remains before a
flow monitor can run is the Browser Run plugin, the schema, and the metering — the rate card
still has no browser resource ([§7](#7-cost)).

Nothing here is a migration of existing rows: there is no monitor type being replaced. The
five existing types (`http`, `dns`, `tcp`, `ssl`, `cron`) are untouched.

## Background

Every monitor this app offers today answers a question about one request. Did the endpoint
answer, how fast, with what status, containing what substring; do these DNS records still
resolve to these values; does this port accept a connection; does this certificate expire
soon; did this cron job check in.

None of them can answer the question customers actually lose sleep over: **can somebody
still sign in and complete the thing they came to do**. A homepage returning `200` while the
login form posts to a broken session store is a green dashboard and a dead business. The
gap is not a missing assertion — it is that a multi-step, stateful interaction cannot be
expressed as a single request.

The industry answer is synthetic monitoring: the customer writes a Playwright script and
the vendor runs it. That answer is unavailable to us at any acceptable cost, because
running a customer's arbitrary JavaScript means owning a real sandbox, and a real sandbox is
a bigger product than the one it would be a feature of.

This ADR proposes a different answer. The customer writes an **executable spec** — a file
in the deliberately tiny language `@pkg/spec` already implements — and we run it. The whole
design rests on one property of that language, established in [§1](#1-the-language-is-the-sandbox).

## Context: what is true, verified

### 1. The language is the sandbox

`@pkg/spec`'s language has no `if`, no loops, no operators, no arithmetic, no string
concatenation, no function definitions beyond named `command`/`fixture` bodies that are
themselves written in the same language, and no escape into a host language. A spec
statement can do exactly three things: call a permission-gated tool with literal arguments,
bind the result to a name, and assert.

```
test "the sign-in form authenticates" {
	when {
		browser.open "https://app.example.com/login"
		browser.fill textbox "Email" with "monitor@example.com"
		browser.click button "Sign in"
	}
	then {
		expect browser.heading "Welcome back"
	}
}
```

There is nothing in that grammar to sandbox. A spec is **data describing a sequence of tool
calls**, and the tools are ours. The trust boundary is not an isolate or a container; it is
the grant set and the tool inventory. That is a categorically smaller thing to get right
than an interpreter for a Turing-complete language, and it is the reason this feature is
tractable at all.

The corollary is the constraint the product has to live inside: a spec cannot compute. It
cannot build a URL from parts, generate a unique email, retry with backoff, or branch on
what it found. Anything a flow needs beyond a linear list of steps has to become a tool, an
`eventually` window, or a limitation we state plainly.

### 2. The pure core of `@pkg/spec` has no runtime dependencies

Every non-test module was checked for `node:*` and `Bun.*` imports:

| Module                                                                                                  | Host dependency                                | Runs on Workers                                                                                                   |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `lexer`, `parser`, `executor`, `runner`, `registry`, `values`, `source`, `ast`, `errors`, `diagnostics` | **none**                                       | as-is                                                                                                             |
| `plugins/http`, `plugins/url`, `plugins/jwt`                                                            | **none**                                       | as-is                                                                                                             |
| `loader`                                                                                                | `node:fs/promises`, `node:path`                | needs a from-strings variant — specs come from D1                                                                 |
| `workspace`                                                                                             | `node:fs`, `node:os`, `node:path`              | not needed — see [§4](#4-fs-and-cli-are-not-omitted-they-are-refused)                                             |
| `permissions`                                                                                           | `node:fs`, `node:path`                         | `realpathSync` is on the host-fs path only, unreachable when host-fs is never granted                             |
| `reporter`                                                                                              | `readFileSync`                                 | only to turn a span into `line:column`, and it already degrades to the bare path on failure; `positionAt` is pure |
| `plugins/fs`, `plugins/cli`, `plugins/db`, `transport-stdio`                                            | `node:fs/promises`, `Bun.spawn`, `bun`'s `SQL` | never loaded                                                                                                      |
| `plugins/browser`                                                                                       | `Bun.spawn` → `agent-browser`                  | **must be reimplemented** — this is the work                                                                      |

`runSuite` hard-imports `createWorkspace`, so it cannot be reused unchanged. But
`executeTest` is already exported from the public surface and takes a fully injectable
`ExecutionContext` (`registry`, `workspace`, `permissions`, `uses`, `usesFor`, `grants`,
`file`). A server-side runner is a loop over parsed tests calling `executeTest`, not a
reimplementation.

`import { SQL } from "bun"` in `plugins/db` is the one hard build failure, which is why this
needs a separate entry point rather than tree-shaking ([§9](#9-what-pkgspec-has-to-grow)).

This table records what the package looked like when the question was asked. The four rows it
calls out have since been addressed — see [§9](#9-what-pkgspec-has-to-grow) for what exists
now — and it is kept because it is the survey the decision rests on.

### 3. `agent-browser` cannot come with us

`plugins/browser` shells out to a globally installed `agent-browser` binary through
`Bun.spawn`. There is no version of that which deploys to a Worker. What survives is the
**tool surface and its addressing model**, which is the valuable part: 7 actions (`open`,
`navigate`, `click`, `fill`, `check`, `press`, `click_selector`) and 6 observables
(`heading`, `link`, `button`, `text`, `checkbox`, `url`), every one of them addressing
elements by accessibility role and accessible name rather than by DOM selector.

### 4. Browser Run exposes exactly the two shapes this needs

Cloudflare's Browser Run offers a stateless **Quick Actions** family and a stateful
**CDP/Puppeteer/Playwright** family, and Kitesurf — its Workers-native, agent-first browser
— is available on both by adding `browser=kitesurf` to the endpoint.

- `POST …/browser-run/accessibilityTree` returns roles, names, values, states and hierarchy
  for a URL, with `interestingOnly` and `root` options. This is, almost exactly, the data
  model `plugins/browser` already addresses elements through.
- Quick Actions keep **no session across calls**; the docs direct anything stateful to
  Puppeteer, Playwright or CDP. The CDP endpoint is
  `wss://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/browser-run/devtools/browser?browser=kitesurf`.

That split maps cleanly onto the tool inventory: the six observables and `open` are
stateless; the six remaining actions are not. It is the basis of the two-phase plan in
[§5](#5-two-phases-stateless-first).

### 5. Kitesurf's efficiency is not, today, a discount

Kitesurf is in beta and free behind per-account limits. It is 3.1–3.8× more CPU-efficient
and 4.7–7.0× more memory-efficient than Chromium — and **1.7–1.8× slower in wall time**.

Browser Run bills **wall-clock browser hours**. Under that meter, the same task on Kitesurf
occupies the billed resource for longer than on Chromium. Cloudflare will presumably price
Kitesurf to reflect the resources it actually saves, but no rate is published, so the only
safe assumption is the published one: **$0.09 per browser-hour past 10 included hours per
month**, plus concurrency billed as the monthly average of daily peak, 10 included then
$2.00 per additional browser. Paid-plan ceilings are 120 concurrent browsers, 1 new instance
per second, 10 Quick Action requests per second, 60s default inactivity timeout extendable
to 10 minutes with `keep_alive`.

The commercial consequence is [§7](#7-cost): price against Chromium, spend Kitesurf's
beta as margin, and be unmoved when the beta ends.

### 6. Kitesurf's gaps are mostly, but not entirely, irrelevant

No video playback, no WebGL, no pixel-perfect rendering, no bot-challenge TLS
fingerprint negotiation, no long-running authenticated sessions. The first three do not
matter to an assertion about an accessible name. The last two do: a flow behind a bot
challenge, or one that must hold a session for minutes, will fail on Kitesurf and may
succeed on Chromium. Engine is therefore a per-monitor field from the first migration, not
a global constant ([§6](#6-the-engine-is-a-monitor-field)).

### 7. A container is the wrong tool, and not the cheap one

Running the compiled `bin/spec` inside a Cloudflare Container is the no-rewrite path: the
whole capability set works, `fs`, `cli` and `db` included. That is also precisely why it is
wrong — those three are the capabilities a tenant's spec must never be granted
([§4](#4-fs-and-cli-are-not-omitted-they-are-refused)). It buys authority we have to spend
effort refusing.

Nor is it cheaper. A `standard-1` instance (½ vCPU, 4 GiB, 8 GB disk) at the published
per-10ms rates works out to roughly **$0.074/hr** — $0.036 memory + $0.036 CPU + $0.002
disk — against Browser Run's $0.09/hr, before Chromium cold starts, image maintenance, and
the container's own idle. A 20% notional saving does not pay for a second deployment
artifact.

Containers stay in reserve for a different product — a self-hosted or CI-facing runner
where `cli.run` is the point rather than the hazard.

### 8. The incumbent prices a browser run as a different class of unit

Checkly, checked because it is the closest thing to this feature sold as a product:

|                                  | Browser / Playwright checks    | API checks                        |
| -------------------------------- | ------------------------------ | --------------------------------- |
| Included, Hobby → Starter → Team | 1,000 → 3,000 → 12,000 runs/mo | 10,000 → 25,000 → 100,000 runs/mo |
| Overage, Starter                 | **$6.50 per 1,000**            | $2.60 per 10,000                  |
| Overage, Team                    | **$6.25 per 1,000**            | $2.50 per 10,000                  |
| Minimum interval                 | **60 seconds** (was 5 minutes) | 10 seconds                        |

Two things to take from it. First, a browser run is priced at **25× an API run** by a company
that has been metering both for years — independent confirmation of the arithmetic in
[§7](#7-cost), arrived at from their cost structure rather than ours. Second, they draw the
same line this ADR draws — that a browser check cannot be scheduled like a request check —
and they draw it at 60 seconds, three notches below where [§7a](#7a-the-interval-is-a-discrete-choice-from-15-minutes-to-a-day)
draws it. That divergence is deliberate and argued there, not an oversight.

They do fold browser runs into the plan allowance, which is the one place
[§7](#7-cost) declines to follow them. Their entry plan is ~10× our subscription; an
allowance is affordable inside it and is not inside ours.

## Decision

### 1. A sixth monitor type, `flow`, whose configuration is a spec source

One row per flow monitor, holding the spec text. A flow monitor's check result is the same
shape every other monitor produces — a status, a duration, an error message — so alerts,
status pages, digests, the daily roll-up and the public API need no new concepts to carry
it. Everything novel is confined to how the result is produced.

A spec source may contain several `test` blocks. The monitor is **up** when every test
passes and **down** when any test fails; the first failure is the incident detail. Multiple
tests in one monitor are a convenience for grouping related assertions about one flow, not a
way to get several monitors for one price — [§7](#7-cost) bills the run, not the test,
and [§3](#3-one-run-is-one-session-under-one-wall-clock-cap) caps the run.

### 2. Grants are derived, never written by the customer

The spec file the customer writes carries no permissions and no `config.jsonc`. The
`--allow-config` mechanism is not exposed: a suite that could declare its own authority is
exactly the thing `@pkg/spec` made opt-in so that untrusted sources could not self-grant,
and a customer-authored monitor is an untrusted source by construction.

The grant set is computed per run:

| Family                             | Grant                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------ |
| `net`                              | Scoped to the hosts of the team's **verified** domains, and nothing else |
| `run`, `host-fs`, `plugins`, `env` | Never granted, and their namespaces are not registered                   |

Scoping `net` to verified domains is the SSRF control, and it costs nothing new: domain
verification already runs on the `*/10 * * * *` trigger and already gates other features. A
spec pointed at `http://192.168.0.1/` or at a competitor's login page is refused by the
permission layer before a request leaves, and refused with the language's own denial
message, which names what it tried to reach.

The consequence to state in the UI: **a flow monitor cannot be created for a domain the team
has not verified.** That is a harder gate than an HTTP monitor's, which watches any URL. It
is the right asymmetry — an HTTP monitor sends one request a stranger could send anyway, a
flow monitor drives a browser through a login.

### 3. One run is one session, under one wall-clock cap

A run gets a single browser session and a hard **30-second** wall-clock cap, enforced by us
and independent of Browser Run's own 60s inactivity timeout. Exceeding it is a `down` result
with a timeout error, not an infrastructure error to retry.

The cap is what makes [§7](#7-cost) possible: it converts an unbounded resource
(browser-seconds) into a bounded one (a run), so a customer can be quoted a price per run
instead of being metered on seconds they cannot predict. It is also the only defence against
a spec whose `eventually within 25s` blocks stack — the cap is on the run, not on any
statement inside it.

A step cap rides along: **20 tool calls per run**, counted across every test in the file.
Both numbers live in `app/lib/pricing.ts` beside the price they bound, because they are
commercial terms before they are timeouts.

### 4. `fs` and `cli` are not omitted, they are refused

`fs` needs no grant in `@pkg/spec` because it is confined to a per-test workspace. That
reasoning does not survive the move: in a Worker there is no workspace, and a
D1- or R2-backed one would only let a spec assert on its own writes. `fs` exists so that a
spec can `write` a file and then `run` a process against it, and `cli.run` is the one
capability that can never be granted to a tenant. Without `run`, `fs` is a memo pad.

So neither namespace is registered. `Workspace.resolve()` is stubbed to fail with the
existing `PermissionDeniedError`, which means a spec that reaches for a file gets the
language's own denial rather than a crash — a customer typing `write "x" "y"` out of habit
reads a sentence explaining that files are not available here.

`db` is refused for the same reason twice over: it reads `DATABASE_URL` from the
environment, and env in a Worker is account-wide. There is no scoped form of that grant to
give.

The registered inventory is therefore **`browser`, `http`, `url`, `jwt`** — the four
namespaces that are already pure, plus the one being written.

### 5. Two phases: stateless first

**Phase A — assertions without interaction.** `browser.open` plus the six observables,
implemented over `POST …/browser-run/accessibilityTree`: one authenticated HTTP call per
statement, no WebSocket, no session, nothing to leak or clean up. This covers "the page is
reachable and it says the right thing", which is most of the value and all of the risk
reduction.

**Phase B — interaction.** `click`, `fill`, `check`, `press`, `click_selector` and
`navigate` need state to persist between statements, which Quick Actions explicitly do not
provide. Phase B talks **raw CDP over an outbound WebSocket** from the Worker — `fetch()`
with an `Upgrade` header — using a handful of commands: `Page.navigate`,
`Accessibility.getFullAXTree`, `Input.dispatchMouseEvent`, `Input.insertText`,
`Runtime.evaluate`.

`puppeteer-core` is not a candidate. Thirteen tools needing five CDP commands do not justify
a library built for a hundred, and the existing `plugins/browser` is 736 lines of
mostly-argument-validation that a CDP backend inherits unchanged.

Phase A ships alone if Phase B slips. Phase B is a strictly additive tool registration, so
a monitor written in Phase A keeps passing.

### 6. The engine is a monitor field

`engine: c.enum(["kitesurf", "chromium"])`, defaulting to `kitesurf`. Same endpoints, one
query parameter apart. It exists because of [§6](#6-kitesurfs-gaps-are-mostly-but-not-entirely-irrelevant):
when a flow fails on Kitesurf for a reason the accessibility tree cannot express, the
support answer has to be a toggle, not a deploy. Defaulting to Kitesurf is what makes its
beta a margin rather than a science project.

The column is not exposed in the create form for v1. It is settable through the API and
visible in monitor settings, so it can be flipped for a customer without shipping code.

### 7. Cost

At the published $0.09/browser-hour, one browser-second costs **0.0025 cents**. Three
per-run numbers follow, and every figure in this section is one of them multiplied by a run
count:

| Per run                        | Price       | Basis                                         |
| ------------------------------ | ----------- | --------------------------------------------- |
| **What it costs us** — 30s cap | $0.00075    | 30 × $0.09/3600, the worst case we underwrite |
| What it costs us — 15s typical | $0.000375   | what a Phase A run should actually take       |
| **What we charge**             | **$0.0025** | a quarter of a cent, $2.50 per 1,000          |
| **What Checkly charges**       | $0.0065     | $6.50 per 1,000, Starter overage rate         |

So the margin is **3.3× at the cap and 6.7× at a typical run**, and we are **2.6× cheaper
than the incumbent** either way. Over a 28-day month, across the seven intervals
[§7a](#7a-the-interval-is-a-discrete-choice-from-15-minutes-to-a-day) allows:

| Interval | Runs/month | Costs us @30s | **We charge** | Margin | Checkly |
| -------- | ---------- | ------------- | ------------- | ------ | ------- |
| 15 min   | 2,688      | $2.02         | **$6.72**     | $4.70  | $17.47  |
| 30 min   | 1,344      | $1.01         | **$3.36**     | $2.35  | $8.74   |
| 1 h      | 672        | $0.50         | **$1.68**     | $1.18  | $4.37   |
| 3 h      | 224        | $0.17         | **$0.56**     | $0.39  | $1.46   |
| 6 h      | 112        | $0.08         | **$0.28**     | $0.20  | $0.73   |
| 12 h     | 56         | $0.04         | **$0.14**     | $0.10  | $0.36   |
| 24 h     | 28         | $0.02         | **$0.07**     | $0.05  | $0.18   |

Three things that table would mislead about if left unsaid.

**The Checkly column is a marginal price, not their sticker.** It is the Starter overage
rate, so it is what a customer already past their included 3,000 browser runs pays for one
more monitor. A customer's _first_ 15-minute monitor is 2,688 runs and fits inside that
allowance, so it reads as free — their base fee already bought it. The honest claim is
therefore "each additional run costs 2.6× more there", not "we are 2.6× cheaper on day one".

**30 seconds is the cap, not the expectation.** A Phase A run is one `/accessibilityTree`
call per statement and should land in single digits of seconds; the cap only binds a spec
that stacks `eventually` windows. Real margin sits nearer the 6.7× end, and the `costs us`
column is the floor being underwritten rather than the expected bill.

**Browser-seconds are ~99% of the cost.** A run also spends a queue operation, a couple of
D1 row writes, a worker request and an Analytics Engine data point — together on the order
of $0.000002, under 1% of the browser cost. Not worth modelling per run, though the ledger
picks them up anyway through the instrumentation ADR-019 already installed.

The two intervals the table does **not** have are the point of
[§7a](#7a-the-interval-is-a-discrete-choice-from-15-minutes-to-a-day): at one minute the
same monitor costs $30.24 a month at the cap, and at five minutes $6.05 — **more than the
entire $5 subscription that today covers 100,000 pings.** A flow run is two to three orders
of magnitude more expensive than an HTTP ping, so it cannot ride the ping meter, and the
decisions follow from that arithmetic:

- **A separate meter.** Flow runs are counted and billed as flow runs. A new Polar metered
  meter, a new event name, ingested one event per run through the same path
  `app/services/ping-meter.ts` established — including the same external-id discipline, so a
  redelivered queue message is free rather than double-billed.
- **Nothing is included in the subscription. Every run is billed, from the first one.**
  `INCLUDED_FLOW_RUNS = 0`, and it is a constant rather than an absence so the pricing copy
  and the calculator can both state it. This is the one place the flow model deliberately
  breaks symmetry with pings, which get an allowance of 100,000. The reason is that the
  allowance would be paid for by the wrong people: the $5 base is a tenth of Checkly's entry
  plan and covers 100,000 pings, so folding even a small browser-run allowance into it would
  spend a visible share of that base's margin on a feature most subscribers never enable.
  Metered from run one also means the number a customer sees on the pricing page is the
  number they pay — there is no cliff where a monitor that seemed free starts costing $2
  because a sibling monitor consumed the allowance.
- **Per run, not per block. `PRICE_PER_FLOW_RUN_USD = 0.0025`** — a quarter of a cent, so
  $2.50 per 1,000 runs. This is the second place the flow model departs from the ping model,
  and it follows directly from the first. A block is only ever a rounding unit **on top of an
  allowance**: a customer past 100,000 pings is thinking in tens of thousands, and buying a
  whole 10,000-ping block for one ping over is a rounding error they never see. Strip the
  allowance away and the same mechanism becomes a **minimum charge** — the smallest monitor a
  customer can create performs 28 runs a month, so any block of 100 or more bills them for
  runs they did not perform, and the fewer runs they make the worse the ratio gets. Charging
  for the run removes the problem rather than tuning it, and it means no interval on the list
  is quietly worse value than another.

  A sub-cent unit price is ordinary in metered billing — Polar prices the meter per unit and
  charges the month's total, so nothing rounds to a cent until the invoice does. It is also
  what makes every row of the table above exact rather than rounded up, which is the property
  a per-interval price list on the pricing page needs to be quotable at all.

- **A jittered schedule**, because the one cost that is _not_ per run is concurrency: $2.00 a
  month per averaged concurrent browser above 10, computed from the monthly average of daily
  peaks. A fleet that fires on the minute boundary is therefore billed at its burst for the
  whole month, and no monitor can be blamed for it. The existing `next_due_at` scheduling
  (ADR-003) already gives us the mechanism; flow monitors offset their first due time by a
  hash of the monitor id. At 15s sessions the 10 included concurrent browsers absorb about
  **40 runs per minute** — roughly 600 monitors at the 15-minute floor, or 14,400 at hourly —
  and the paid ceiling of 120 covers 480 runs/minute. Spread, this line stays at zero; bursty,
  it is the one cost the per-run price does not cover.
- **A new rate-card resource.** `app/lib/cost-rates.ts` has no browser resource, so a flow
  monitor today would run entirely outside the cost ledger and every affected team's Polar
  Cost Insights figure would be silently short. `RATES` is documented append-only, so this is
  an append of `browserSecond: 2.5e-3` (cents, $0.09/hr ÷ 3600) plus a
  `RATE_CARD_VERSION` bump. Recording it at the end of a run, with the measured session
  duration, is one `recordCost("browserSecond", seconds)` call.

Every price above lives in `app/lib/pricing.ts` alongside the ping model, for the reason
that file's header already states: what we charge is a domain fact, and the marketing copy
quotes it rather than owning it. The pricing calculator gains a flow-monitor input.

### 7a. The interval is a discrete choice, from 15 minutes to a day

`FLOW_INTERVALS_SECONDS = [900, 1_800, 3_600, 10_800, 21_600, 43_200, 86_400]` — 15 minutes,
30 minutes, 1 hour, 3 hours, 6 hours, 12 hours, 1 day — with **1 hour** the default. A value
outside the list is refused by the validator; the column stays `interval_seconds` in seconds,
so ADR-006's scheduling is untouched and the sweep cannot tell a flow monitor from any other.

Three decisions in that, each with its own reason.

**A 15-minute floor, not 5 and not 1.** Checkly lowered its browser-check minimum from 5
minutes to 60 seconds and kept API checks at 10 seconds — so the incumbent draws exactly the
line this ADR draws, that a browser check is a different class of unit from a request check,
and it draws it three notches lower than we do. We are not matching that, for two reasons
that both point the same way. The cost is one: a 1-minute flow monitor is $30.24 a month in
browser hours at the 30s cap and $15.12 even at a typical run, which at the 3.3× markup
[§7](#7-cost) sets would be charged at $100 a month — a price nobody will pay for a check that
drives a login. The product is the other: mean time to detection is bounded below by the run
itself, and a 30-second run polled every minute spends half its life running. A flow that
must be verified faster than a quarter-hour is a flow that wants an HTTP monitor on the
endpoint the flow depends on — which we already sell, at 1-minute resolution, for a
hundredth of the price. The floor is where those two arguments stop disagreeing with the
customer.

**A 1-day ceiling.** The other monitor types have none, because a 1-minute HTTP check costs
effectively nothing and nobody needs protecting from it. Here the useful range genuinely ends:
a flow checked less often than daily is not monitoring, it is a reminder. Daily is also the
cadence the DNS monitor already defaults to for the same reason — a human-paced failure does
not need a machine-paced check.

**Discrete rather than a free integer.** Every other monitor type takes any
`interval_seconds`, and that is right when the cost per check rounds to zero. When each step
down the list roughly doubles the bill, a free integer invites a customer to type `600` and
discover the consequence on an invoice. A fixed list of seven values makes the whole price
range finite, quotable on the pricing page, and renderable as a select whose every option can
show its own monthly cost — which is the actual fix for the bait-and-switch risk in
[Consequences](#negative).

### 8. The result is the spec's own output

A `SuiteResult` carries per-test `title`, `file`, `status`, `durationMs` and a structured
`SpecError` with spans, expected and observed values, and remedies — never a pre-rendered
string. That is a strictly better incident artifact than `HTTP 500`:

```
✗ the sign-in form authenticates (login.spec:3)
  expected heading "Welcome back"
  observed heading "Something went wrong"
```

Turning a span into `line:column` needs the source text, which we hold in the monitor row —
`positionAt` is pure, so no filesystem is involved. The stored failure is the formatted
first failure plus the test title and position; the alert email quotes it verbatim.

What is **not** stored is a screenshot. It is tempting and it is a different feature: it
needs R2, a retention policy of its own (ADR-020), a redaction story for a page that by
construction has just been logged into, and it doubles the per-run cost. Out of scope,
noted in [Open Questions](#open-questions).

### 9. What `@pkg/spec` has to grow

Four changes, all additive, none of which alter CLI behaviour. **The first three are
done**; they are the difference between this app embedding `@pkg/spec` and vendoring it.

1. **The run is fully injectable — `runTests`.** ✅ `runSuite` hard-imported `createWorkspace`
   and all eight built-in plugins, so it could only ever run in a process. The lifecycle glue
   moved to `runTests`, which takes the suite, the plugin set, the grants and the workspace
   factory as arguments; `runSuite` is now the host convenience that supplies the usual
   answers. One implementation of the semantics, two sets of assumptions about the host.
2. **A `@pkg/spec/workers` entry point.** ✅ Exports the language core plus `http`, `url` and
   `jwt`, `loadSources`, `runTests` and `createNoFilesystemWorkspace`. Required, not an
   optimisation, and it is worth being precise about why: `plugins/db` does
   `import { SQL } from "bun"`, and bundling the default entry for a non-Bun target fails on
   that line — tree-shaking never runs, because resolution fails first. The new entry bundles
   clean, with `node:fs` and `node:path` as its only externals (both reached solely through
   the host-filesystem grant, so `nodejs_compat` covers them). A test walks the entry's import
   graph and fails on any `bun` specifier or `Bun` global, so the property is enforced rather
   than remembered.
3. **Loading without a filesystem — `loadSources`.** ✅ The parse-and-register pass moved to
   its own module and takes `{ path, text }` pairs, which is what a spec out of D1 already is;
   `loadSuite` is now the directory walk plus a call to it, so the duplicate-name and
   parse-error behaviour cannot drift between the two.

   Alongside it, **which capabilities exist is now a choice**: `builtins` on `runSuite`, and
   `createBuiltinPlugins(only?)` for callers assembling a set by hand. This is distinct from
   granting — a denied capability still exists and its denial names the flag that would allow
   it, whereas a namespace left unregistered fails as an unknown name. That is the correct
   shape for `fs`, `cli` and `db` here, where no grant could ever lift them.

4. **A browser plugin backed by Browser Run** — _outstanding_. Alongside the `agent-browser`
   one rather than replacing it: the CLI's local-browser story is still the right one for a
   developer running specs on their machine. Same tool descriptors, different backend. It
   lives outside `@pkg/spec` on purpose — which remote browser service drives the tools is the
   host's decision, not the language's, and the package stays free of that dependency.

Item 4 is the only one with real surface area left, and [§5](#5-two-phases-stateless-first)
is its plan.

### 10. Honest limits, stated in the docs

A spec cannot compute, so these are product limits, not bugs, and the docs page says so:

- **No generated data.** A signup flow that needs a unique email each run cannot express
  one. Flow monitors are for flows with a fixed fixture account.
- **No secrets, yet.** A login flow needs a password, and the language's answer —
  `--allow-env` — has no scoped form in a Worker. For v1 the credential is written in the
  spec text, and the spec text is encrypted at rest and never rendered in an email, a log,
  or an API response body. This is the weakest part of the design and the first thing
  [Open Questions](#open-questions) asks about.
- **No branching, no retries beyond `eventually`.** `eventually within 5s` is the whole
  retry vocabulary, and it applies to assertions only — a retried mutation is not a retried
  check.
- **No file assertions, no shelling out, no database queries.** By construction, per
  [§4](#4-fs-and-cli-are-not-omitted-they-are-refused).
- **Kitesurf's engine gaps**, per [§6](#6-kitesurfs-gaps-are-mostly-but-not-entirely-irrelevant),
  with `chromium` as the escape hatch.

## Schema and migrations

`database/migrations/20260811100000_flow_monitors.sql`.

```ts
export const flowMonitors = table({
	name: "flow_monitors",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		team_id: c.text(),
		name: c.text(),
		/**
		 * The spec source, verbatim as written. Encrypted at rest: for v1 a flow that signs in
		 * carries the fixture account's password in this column (§10), so it is never rendered
		 * back into an email, a log line, or an API response body — only into the editor, for
		 * a member who could already read it.
		 */
		source: c.text(),
		/**
		 * Which hosted browser runs it. Kitesurf by default; `chromium` is the escape hatch for
		 * the flows its engine cannot drive (§6). Not in the create form — settable through the
		 * API and monitor settings, so a customer can be unblocked without a deploy.
		 */
		engine: c.enum(["kitesurf", "chromium"]).default("kitesurf"),
		/**
		 * Seconds, as on every other monitor table, so ADR-006's scheduling is unchanged — but
		 * constrained to the seven values FLOW_INTERVALS_SECONDS lists, 15 minutes to a day,
		 * defaulting to an hour (§7a). A browser run costs two to three orders of magnitude more
		 * than a ping (§7), so unlike the other monitor types the bounds here are commercial
		 * before they are technical, and the validator refuses anything off the list rather than
		 * clamping it — a customer who asked for 60 should be told no, not silently given 900.
		 */
		interval_seconds: c.integer().default(3_600),
		/** Same column, same meaning, as on every other monitor table (ADR-006). */
		next_due_at: c.integer().nullable(),
		is_enabled: c.boolean().default(true),
		last_checked_at: c.integer().nullable(),
		last_status: c.enum(["up", "down", "error"]).nullable(),
	},
});

export const flowMonitorResults = table({
	name: "flow_monitor_results",
	columns: {
		id: c.text().primaryKey(),
		flow_monitor_id: c.text(),
		/**
		 * `down` is a failed assertion — the flow is broken. `error` is our side failing to
		 * find out: the browser session never opened, the CDP socket dropped, the run was
		 * refused. The distinction is the same one `check-http.ts` already draws, and it is
		 * what keeps a Browser Run outage from paging every customer about their own site.
		 */
		status: c.enum(["up", "down", "error"]),
		tests_total: c.integer().default(0),
		tests_passed: c.integer().default(0),
		tests_failed: c.integer().default(0),
		/** The first failing test's title, and its position in the source. */
		failed_test: c.text().nullable(),
		failed_at_line: c.integer().nullable(),
		/** The formatted first failure — expected, observed, remedy. Quoted into the alert. */
		failure_detail: c.text().nullable(),
		/** Wall-clock of the whole run. Also the quantity `browserSecond` is priced from. */
		duration_ms: c.integer().nullable(),
		error_message: c.text().nullable(),
		checked_at: c.integer(),
	},
});
```

Two amendments to existing tables:

- `alert_events.monitor_type` is `c.enum(["http", "dns", "tcp", "cron", "ssl"])` and needs
  `"flow"`. Without it a flow alert writes an event row that violates its own enum, and it
  does so at alert time — during an outage.
- `monitor_type` filters in the status-page, digest and daily-roll-up queries each gain the
  new type. Enumerated rather than inferred, so a type that is deliberately excluded from a
  surface is visibly excluded.

Retention for `flow_monitor_results` follows ADR-020's policy for every other result table;
volume is low by construction, since the interval floor is 15 minutes — a flow monitor writes
at most 2,688 result rows a month, against an HTTP monitor's 40,320.

## Implementation plan

**1. `@pkg/spec` — the Workers seam.** Inject the workspace factory into `runSuite`; add the
from-sources loader; add the `./workers` export. Spec-first, per the package's own practice:
the acceptance specs for the new entry point come before it.

**2. `@pkg/spec` — the Browser Run plugin, Phase A.** `open` plus the six observables over
`/accessibilityTree`. Same descriptors as the `agent-browser` plugin, so its argument
validation and error shapes are reused rather than re-derived.

**3. Schema and data layer.** The migration above, plus `app/data/flow-monitor.ts` following
the shape of the DNS equivalent, plus the two enum amendments.

**4. `app/services/flow-check.ts`.** Parse the source, build the registry from the four
namespaces, compute the grant set from the team's verified domains, run every test under the
wall-clock and step caps, format the first failure. This is the only new service, and it is
the one to test hardest — the permission derivation especially, because that test is the
SSRF test.

**5. `app/jobs/check-flows.ts` and the sweep.** A queue job per due monitor, on the existing
`* * * * *` trigger, claiming monitors by `next_due_at` exactly as ADR-006 established, with
the jitter from [§7](#7-cost). Retries only infrastructure faults: a failed assertion is a
stored result, not an error. The DLQ (ADR-018) applies unchanged.

**6. Metering and cost.** The new Polar meter and its event name; `recordCost("browserSecond", …)`
at the end of each run; the `RATES` append and `RATE_CARD_VERSION` bump.

**7. Pricing surfaces.** The new constants in `app/lib/pricing.ts` — including
`FLOW_INTERVALS_SECONDS`, which the interval select and the pricing page both read so the
seven options and their seven prices cannot disagree. The calculator input; the pricing,
billing-FAQ and comparison copy in the three locale files. No hardcoded English. The
"nothing is included" term is stated on the pricing page, not only in the FAQ: it is the one
place the flow model differs from the ping model a reader has just finished understanding.

**8. HTTP surfaces.** Create/edit with a spec editor and a **dry-run button** — a flow
monitor that cannot be tried before it is saved will be saved broken, and a dry run is one
metered run against the same code path. Monitor detail showing the last result's failure
detail. `/api/v1` gains the type.

**9. Alerts, status pages, digests, docs.** A flow monitor's `down` flows through the
existing `down`/`up`/`degraded` event types with no new alert concepts; the docs page states
[§10](#10-honest-limits-stated-in-the-docs) verbatim.

**Phase B**, after A is in production: the CDP backend and the six interactive tools. It
registers additional tools and changes nothing about a monitor already running.

## Consequences

### Positive

- The one question customers care about most becomes answerable, without owning a JavaScript
  sandbox. The language's austerity, which reads as a limitation in every other context, is
  the entire security argument here.
- The incident artifact is better than any other monitor type's: a failing assertion with its
  expected value, its observed value, and its line number.
- `@pkg/spec` gets dogfooded by a paying product, which is the strongest pressure available
  on its design — and the four changes it needs are ones an embedder would need anyway.
- Kitesurf's beta is spent as margin rather than as a dependency: prices are set against
  Chromium's published rate, so the beta ending is a margin event, not a repricing event.
- Nothing existing changes shape. Five monitor types, their schedules, their results and
  their alerts are untouched.

### Negative

- **A materially more expensive unit of work, with no allowance to cushion it.** A customer
  who reads "$5 for 100,000 checks" and then meets a flow monitor billed from its first run
  will feel a bait-and-switch unless the interval select shows each option's monthly cost
  before they commit. The discrete interval list is what makes that showable; shipping the
  list without the prices beside it would waste the main reason for having it.
- **Two billing models to explain on one pricing page.** Pings are an allowance plus
  indivisible blocks; flow runs are metered per run from the first one. Each is right for its
  own unit and the reasons are in [§7](#7-cost), but a reader meets them back to back, and the
  page has to make the difference land as deliberate rather than as inconsistency.
- **Credentials in a text column.** Encrypted at rest and never echoed, but a team member
  who can edit a monitor can read the fixture account's password. Every alternative is a
  secret store, which is its own ADR.
- **A dependency on a beta product**, with a fallback (`chromium`) whose cost profile is the
  one we price against and whose engine gaps are different, not absent.
- **A second browser plugin backend to maintain**, and the CLI's `agent-browser` one is the
  reference implementation for behaviour neither can drift from.
- **Concurrency is an account-wide resource billed on peaks.** A flow fleet's scheduling bug
  raises a bill for a month, not for an hour, and the signal arrives late.
- Phase A monitors can assert but not interact, so the first release cannot check a login —
  the flagship use case — until Phase B lands.

### Neutral

- Results, alerts, status pages, digests and the roll-up absorb the new type without new
  concepts, because [§1](#1-a-sixth-monitor-type-flow-whose-configuration-is-a-spec-source)
  made the result shape ordinary on purpose.
- The verified-domain gate is stricter than the HTTP monitor's and will read as
  inconsistent until the reason is stated in the UI, at which point it reads as obvious.
- Containers remain a live option for a future runner product; this ADR declines them for
  this feature, not in general.
- The 15-minute floor is three notches above the incumbent's 60 seconds, so a prospect
  comparing spec sheets will see us lose that row. The trade is deliberate: they charge
  $6.50/1,000 runs and we charge $2.50, and the row we lose is the one nobody can afford to
  use at their price either.
- A discrete interval list makes flow monitors the only type whose interval is not a free
  integer. The inconsistency is visible in the API, where every other monitor accepts any
  `interval_seconds` and this one enumerates — worth stating in the API docs rather than
  letting a client discover it from a 422.

## Open Questions

1. **Does the `BROWSER` Worker binding accept a Kitesurf option, or is the API-token CDP
   endpoint the only path from a Worker?** A binding is free and has no secret; the token
   path adds a secret and an egress hop. This changes the plugin's constructor, not its
   design, but it should be settled before step 2.
2. **Does Kitesurf's CDP expose `Accessibility.getFullAXTree`, or is the tree only reachable
   through the REST endpoint?** If CDP has it, Phases A and B share one code path and Phase A
   is a thin special case. If not, they are two backends behind one tool surface and the
   maintenance cost doubles. This is the highest-value thing to verify, and the public
   playground at `kitesurf.cloudflare.app` answers it without an account.
3. **Are the Quick Actions rate limits (10/s on paid) per account?** Phase A makes one call
   per observable statement, so a fleet doing several assertions per run meets 10/s well
   before browser hours become the binding constraint. If they are per account, Phase A needs
   its own concurrency bound (ADR-008) sized against requests, not runs.
4. **Where do secrets live?** The v1 answer is "in the source, encrypted". The candidates are
   a per-team secret store surfaced as a scoped `secret` namespace — a new plugin, a new
   grant family, and the right answer — or a per-monitor credential field the runner
   substitutes into the spec, which is a template engine bolted onto a language that
   deliberately has no interpolation. The first is a separate ADR; the second should be
   refused now so it does not arrive by accident.
5. **Screenshot on failure?** Real product value, real cost: R2, its own retention, and a
   redaction problem on a page that has just been logged into. Deferred, not declined.
6. **Should a flow monitor's tests be billable individually?** [§7](#7-cost) bills the run,
   which means a 20-assertion monitor and a 2-assertion monitor cost the same. That is right
   while the step cap binds the run; it stops being right if the cap is ever raised.
7. **What does the beta ending look like?** If Kitesurf is priced per request rather than per
   browser-hour, `browserSecond` is the wrong ledger resource for it and the rate card needs a
   second entry, not a new version. Worth watching the Browser Run changelog for.
8. **What relaxes the 15-minute floor?** It is set by cost and by the run's own duration
   ([§7a](#7a-the-interval-is-a-discrete-choice-from-15-minutes-to-a-day)), and both can move:
   a priced-per-request Kitesurf changes the first, and a Phase-A-only monitor that resolves in
   two seconds changes the second. The floor should be revisited when either lands, and a
   5-minute option added to the list rather than the list being abandoned — the reason for
   enumerating survives the floor moving.
9. **Does the ping meter want the same treatment?** Flow runs are billed per run because an
   allowance-plus-blocks model turns into a minimum charge without an allowance
   ([§7](#7-cost)). That reasoning does not apply to pings, which keep their 100,000 — but if
   a future plan ever drops the ping allowance, the block rule inherits the same defect, and
   this is the ADR that argued why.

## References

- `packages/spec/README.md` — the language, the capabilities, and the permission model
- `packages/spec/src/index.ts` — the public surface `executeTest` and `positionAt` are exported from
- `apps/uptime/app/lib/pricing.ts` — the ping model the flow model is shaped after
- `apps/uptime/app/lib/cost-rates.ts` — the append-only rate card `browserSecond` joins
- `apps/uptime/app/services/ping-meter.ts` — the metering discipline the flow meter copies
- ADR-003 — scheduling from `next_due_at`
- ADR-006 — `interval_seconds` is authoritative, not the sweep's cadence
- ADR-007 — the cost ledger and the rate card's versioning rule
- ADR-008 — bounded concurrency in sweeps
- ADR-018 — the dead-letter queue
- ADR-020 — retention for every result table
- ADR-021 — the ping meter, and the external-id discipline for metered events
- ADR-026 — the most recent new-monitor-type decision, and the shape this one follows
- [Kitesurf](https://developers.cloudflare.com/browser-run/kitesurf/) · [Kitesurf architecture](https://blog.cloudflare.com/kitesurf/)
- [Browser Run limits](https://developers.cloudflare.com/browser-run/limits/) · [pricing](https://developers.cloudflare.com/browser-run/pricing/)
- [Quick Actions](https://developers.cloudflare.com/browser-run/quick-actions/) · [CDP endpoint](https://developers.cloudflare.com/browser-run/cdp/) · [accessibilityTree endpoint](https://developers.cloudflare.com/changelog/post/2026-07-07-browser-run-accessibility-tree-endpoint/)
- [Containers pricing](https://developers.cloudflare.com/containers/pricing/)
- [Checkly pricing](https://www.checklyhq.com/pricing/) — the browser-vs-API run prices and plan allowances in [§8](#8-the-incumbent-prices-a-browser-run-as-a-different-class-of-unit)
- [Checkly high-frequency checks](https://www.checklyhq.com/blog/high-frequency-checks-are-now-live/) — browser checks from 5 minutes to 60 seconds, API checks to 10 seconds
- [Checkly on choosing a check frequency](https://www.checklyhq.com/blog/check-frequency/) — their own guidance is 1–5 minutes for critical services, i.e. guidance, not the floor
