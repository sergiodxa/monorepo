# ADR-019: Chrome DevTools Protocol Diagnostics on `browser`

## Status

**Implemented** - 2026-10-20

## Background

Specs that drive a real browser often need more than clicks and accessibility
assertions: a Performance timeline for a slow paint, Chrome metrics for heap
growth, or a one-shot CDP command the high-level tools do not wrap yet. The
[Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
is already how the Browser Run backend talks to a remote page
([ADR-027](../uptime/ADR-027-flow-monitors-written-as-executable-specs.md)), and
`agent-browser` exposes `trace start` / `trace stop` plus a page CDP URL. What
was missing was a language-level way to collect that data without teaching
`.spec` files about WebSockets.

## Context

[ADR-005](./ADR-005-interface-capabilities.md) keeps the browser family a
**contract**: a suite must not know whether Playwright, WebDriver, or CDP sits
underneath. [ADR-004](./ADR-004-runtime-and-plugin-protocol.md) already lists
traces among the diagnostic artifacts a plugin may contribute. Raw CDP method
names in every suite would freeze the suite to Chromium and break the
`agent-browser` / Browser Run substitutability the two backends already share.

The language also has no event loop or callbacks, so CDP's event stream
(`Tracing.dataCollected`, …) cannot be subscribed to from a `.spec`. Collection
has to be start/stop shaped: begin recording, drive the page, stop and receive a
file or value.

## Decision

### 1. High-level tools on `browser`, not a `cdp` namespace

Four tools join the existing `browser` surface, on both backends:

| Tool                                   | Kind       | Role                                                                |
| -------------------------------------- | ---------- | ------------------------------------------------------------------- |
| `browser.trace.start [categories]`     | action     | Begin a Chrome Performance trace                                    |
| `browser.trace.stop [path]`            | action     | End it; write chrome://tracing JSON; return `{ path, event_count }` |
| `browser.metrics`                      | observable | `Performance.getMetrics` as a flat name→number object               |
| `browser.cdp "Domain.method" [params]` | action     | One-shot CDP escape hatch                                           |

```
use browser
use fs

test "checkout paint is captured" {
	given {
		browser.trace.start
		browser.open "/checkout" on "web"
	}
	when {
		browser.click button "Pay"
		let trace = browser.trace.stop "checkout.json"
	}
	then {
		expect trace.path "checkout.json"
		expect file "checkout.json" exists
	}
}
```

Categories default to the DevTools Performance set
(`-*`, `devtools.timeline`, `v8.execute`, `disabled-by-default-devtools.timeline`).
`trace.stop` defaults the path to `trace.json` inside the test workspace.

### 2. Backends implement the same names differently

- **`agent-browser`**: `trace start` / `trace stop <path>` for timelines;
  `get cdp-url` plus a short-lived WebSocket for `metrics` and `cdp`.
- **Browser Run**: the existing `CdpSession` gains event subscription,
  `Tracing.start` / `Tracing.end` with `transferMode: "ReportEvents"`, and
  `Performance.getMetrics`. Trace JSON is written with `writeFile` into the
  workspace the host supplied.

A suite that only uses these four names runs on either backend. Categories are
honoured on the CDP path; the CLI path keeps its own defaults when the binary
does not take a filter.

### 3. The escape hatch stays one-shot

`browser.cdp` sends one command and returns its result. It does not subscribe to
events — that is what `trace.start` / `trace.stop` are for. Params are an
optional object; the method must look like `Domain.method`. This is the same
kind of marked coupling as `browser.click_selector` ([ADR-005](./ADR-005-interface-capabilities.md)
§3): available when the high-level tools are not enough, never the default.

### 4. Permission and size

Every diagnostic tool `requires: "net"`, like the rest of `browser`. Trace files
land in the workspace (and can be copied under `--artifacts` by the caller);
the return value carries only `path` and `event_count` so a multi-megabyte
timeline never becomes a bound language value.

## Consequences

- Specs can collect Performance traces and CDP metrics without a second tool
  chain or a custom plugin.
- The Browser Run CDP client is no longer command-only: event listeners are
  first-class, which unblocks other event-shaped domains later (Network HAR,
  console) without another protocol redesign.
- Suites that lean on `browser.cdp` with Chromium-only methods will not port to
  a non-CDP backend; the high-level three tools remain the portable surface.
- Trace budgets (`event_count < N`) stay out of reach until the language grows
  comparison operators; collection and offline analysis are the v1 job.

## Alternatives Considered

- **A separate `cdp` namespace.** Rejected: it would advertise the protocol in
  every `use` line and duplicate session lifecycle already owned by `browser`.
- **Returning the full event array from `trace.stop`.** Rejected: timelines are
  too large for language values; a workspace file is the durable artifact.
- **Exposing only failure-time auto-traces under `--artifacts`.** Useful later,
  but it does not let a passing test keep a deliberate recording.

## References

- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
- [Tracing domain](https://chromedevtools.github.io/devtools-protocol/tot/Tracing/)
- [ADR-004](./ADR-004-runtime-and-plugin-protocol.md) §8 — traces as diagnostics
- [ADR-005](./ADR-005-interface-capabilities.md) — browser as a substitutable contract
- [ADR-010](./ADR-010-browser-capability-on-agent-browser.md) — `agent-browser` backend
- [ADR-027](../uptime/ADR-027-flow-monitors-written-as-executable-specs.md) — Browser Run CDP backend
