# Flow Monitors

## Purpose

A flow monitor answers the question no single-request monitor can be asked: can somebody still sign in, carry the token they were handed, and call the endpoint it authorizes. Its entire configuration is a **spec** — source text in a small executable-spec language — and one check is one run of that spec.

## What Users Configure

- Name
- Spec source
- Check interval, picked from a fixed list
- Enabled or disabled state

There is no host field, no URL field, no region, and no header or body column. Every URL the flow requests is written in the spec, which is also what makes each of them checkable against what the team is allowed to reach.

## How It Works

1. The user writes a spec: one or more `test` blocks, each with `given` / `when` / `then` phases in that order.
2. On save, the source is parsed and every host it names is resolved against the team's verified domains. A source that will not parse, that names no host at all, or that names a host no verified domain covers is refused at the form, with the reason.
3. Each scheduled check runs every test in the source, under one time cap and one request cap.
4. The monitor is `up` when every test passes and `down` when any test fails. The first failure is the incident detail: which test, which line, what was expected against what was observed.
5. The run's HTTP requests are metered, one ping each, and the run is written as one result row.

## What a Spec Can Say

A statement does one of five things: `let` binds a step's result to a name, `expect` asserts, `eventually` retries assertions, a bare tool call performs a step, and `return` inside a `fixture` produces data. A `command` is a reusable step and a `fixture` is reusable data; both resolve by name from anywhere in the source.

Exactly four namespaces are registered: `http`, `url`, `jwt` and `sample`. Files, shells, databases and environment variables are **refused, not merely absent** — a spec reaching for a file is answered with the language's own permission error naming the path it tried, so a habit earns a readable sentence instead of a crash. There is no browser.

`expect` compares two values for equality, asserts that one value is true, or reads an observable. There is no contains, no regex, no comparison and no range. The language has no branching, no arithmetic and no string building. `sample` covers the value a flow needs fresh each run, one tool per kind returning a record — a person, a place, an identifier, a date, a file — which is what a sign-up flow drives; a flow that signs in reads its credential from a fixed account written into the source.

`eventually within Ns` retries the assertions inside it until they hold or the window closes, defaulting to a `5s` window polled every `100ms`. It retries assertions only, so it **cannot retry an `http.*` call** — those are actions, and a retried mutation is not a retried check. That is the whole retry vocabulary.

## What a Flow May Reach

- A run reaches only hosts covered by one of the team's **verified** domains. Verification is a DNS TXT record at `_ping-verification.<hostname>` whose value is `ping_<team domain id>`, re-checked every 10 minutes.
- Coverage extends across subdomains by exactly one label boundary. `example.com` covers `app.example.com` and `api.staging.example.com`; `notexample.com` and `example.com.evil.test` are refused.
- The allowance names the exact hosts the spec wrote, not the domain that covers them. A flow written for `app.example.com` cannot reach `internal.example.com` even when the team owns both, so a monitor's blast radius equals what it was written to do.
- The allowance is resolved fresh on every run and never stored on the monitor, so un-verifying a domain stops its flows at the very next check rather than whenever somebody remembers to re-save them.
- Refusal happens **before the run starts** and refuses the whole flow, never part of it. A flow is a sequence, so a partly authorized one is a monitor to fix, not a check to attempt.
- A team with no verified domains cannot create a flow monitor. The gate is stricter than an HTTP monitor's, which watches any URL, and the asymmetry is deliberate: an HTTP monitor sends one request a stranger could send anyway, while a flow drives a sequence. Without the gate the feature is a way to automate somebody else's site.

## Status Model

- `up`: every test passed
- `down`: a test failed — an assertion about the customer's own system is broken
- `error`: the app could not find out
- No result yet: nothing has run

`error` covers a source that will not parse, a host outside the run's reach, a run cut off at the request cap, and a misconfiguration the language reports for itself: a denied permission, an unknown name, an ambiguous name.

## Result Handling Rules

- `error` is never an outage. It renders neutral, and pass rate is computed over the runs that actually ran, excluding it. A mistyped spec or an unverified host is a monitor to fix, not an incident to page about.
- One failure is kept per run: the first failing test's title, the 1-based line of the source it failed on, and the formatted detail. The run also stores counters — tests total, passed and failed, and requests made — plus its wall-clock duration.
- Several tests in one source group related assertions about one flow. They are not a way to get several monitors for one price: the run is what is capped and what is billed.
- A run refused before it starts made no requests and therefore bills nothing, and it still writes a visible result row — a refusal is visible without being charged for.
- One analytics data point per run, not per request: the series is how long the flow takes. A run that never started reports zero duration, which is how the rest of the dataset spells "no measurement".
- No per-step timings and no screenshots are stored, both deliberately. Per-step detail would multiply retention volume by the step count to add detail nobody reads twice, and a screenshot of a page that has just been logged into is a redaction problem and a separate feature.

## Scheduling Rules

- The interval is one of seven values: `900`, `1800`, `3600`, `10800`, `21600`, `43200`, `86400` seconds. The default is `3600`.
- A value off the list is refused by the form and by the data layer alike — a caller who asks for `60` is told no, not quietly given `900`. The list is fixed rather than a free integer because each step down roughly doubles what the monitor costs to run, and a free integer lets somebody type `600` and discover the consequence on an invoice.
- A flow needing detection faster than a quarter-hour wants an HTTP monitor on the endpoint the flow depends on, which is sold at a much finer resolution for a fraction of the cost.
- A sweep is enqueued every minute alongside the other monitor types even though the floor is fifteen minutes, so the trigger list stays flat as monitor types grow. The claim matches nothing in most minutes, which is cheaper than a trigger per type.
- Claiming is one atomic update that advances each claimed monitor's next due time by whole intervals as it returns the row, so concurrent deliveries cannot double-claim a monitor.
- A newly created or re-enabled monitor is due immediately, so its first status lands on the next tick instead of after one silent interval. Disabling clears the due time.
- A sweep runs at most `10` checks concurrently.

## Visible Outputs

- Monitor list, with each monitor's last status and last check time
- Detail page: status, interval, last checked, and — derived from the run history — pass rate excluding `error` runs, average duration, and total runs
- The last failure, naming the failing test and its line, with the expected-against-observed detail quoted verbatim
- The spec source rendered as a numbered listing, with the line the last failure names marked
- Recent runs: time, status, tests passed of total, requests made, duration
- Create, edit and delete forms; the form states which domains a spec written there may reach, and says so distinctly when the team has verified none
- Run now, inline from the detail page: the same code path the sweep runs, gated on an active subscription and metered identically, so a manual run and a scheduled one can never double-bill

## Defaults and Limits

- Default interval `3600` seconds, floor `900`, ceiling `86400`.
- A run gets `30` seconds of wall clock and `20` HTTP requests, the requests counted across every test in the source.
- A source may be `20,000` characters.
- Flow monitors are enabled by default.
- A run bills one ping per HTTP request it made, into the same allowance every other check spends from. The meter is keyed by the result row plus the request's ordinal: the row makes a redelivered sweep free, and the ordinal stops one run's several requests deduplicating into one.
- Run history is retained `90` days, against `7` for HTTP check results — a flow at the 15-minute floor writes at most a few thousand rows a month.

## Important Behavior Notes

- The two run caps do not report the same way. Passing the request cap reports `error`, on the reading that a spec asking for more than twenty requests is a monitor to fix. Running past the time cap refuses the next request and that refusal fails the test, so it reports `down`. That asymmetry is a wart worth removing: the same class of event — the run hitting a bound the product set — should not read as an outage in one case and as a configuration problem in the other.
- The time cap is not a hard abort. It refuses new requests once the deadline has passed rather than stopping the run in flight, so a single slow request, or assertion windows that make no requests, can carry a run past `30` seconds. The bound is on what a run may spend, not on when it must return.
- Only HTTP requests are counted against the request cap. `url`, `jwt` and `sample` calls are free, which is right while HTTP is the only cost, and is narrower than a cap on tool calls in general.
- **A spec's text is stored and rendered in plain text.** A flow that signs in carries its fixture account's password in that text, and the detail page renders the source back as a numbered listing. Anyone who can view the monitor can read the credential. This is the weakest part of the feature: the credential wants a secret store, and the language deliberately has no interpolation to substitute one in.
- A flow alerts on `down` and on recovery, through the same alerts, maintenance windows and cooldowns every other monitor type uses, and the alert quotes the failing test, its line and its detail. `error` never alerts — an outage of ours must not page a customer about their own system.
- Flow monitors are not yet on status pages, are not in the public REST API, and are not in the daily roll-up that feeds long-range stats. All three are gaps rather than decisions.
- A flow whose steps are requests is not a substitute for watching a browser. Nothing renders a page, so a failure only a rendered page would show is invisible here.

## Reimplementation Guidance

Preserve these product rules:

- The configuration is **source text, not fields**. There is no host column to read a flow's target from, and every URL it uses must be written in the spec, because that is what makes the target checkable before the run.
- The language is the sandbox. Its austerity is the security argument, not a limitation to work around: keep the registered inventory to what the flow genuinely needs, and refuse the rest with the language's own permission error rather than leaving it merely unimplemented.
- `down` is the customer's system failing; `error` is this app failing to find out. Keep the two apart everywhere they surface — the badge, the pass rate, the alert.
- The reach gate is per-host, derived from verified domains, resolved on every run, and applied before the run starts to the flow as a whole.
- A run is the unit: capped as a run, billed for the requests it actually made, recorded as one row and one data point.
- The interval is a closed list, and a value off it is refused rather than clamped.
- A failure is worth a line number only beside the line, so keep the source listing and the failure marker together.
