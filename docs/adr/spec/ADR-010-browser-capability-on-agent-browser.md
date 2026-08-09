# ADR-010: Browser Capability Backed by agent-browser

## Status

**Proposed** - 2026-08-08

This ADR implements the browser capability family that
[ADR-009](./ADR-009-v1-typescript-implementation.md) deliberately deferred. It
is an implementation ADR in the same sense as ADR-009: not standalone, free to
reference this monorepo's packages and conventions, and bound by the design
suite ([ADR-001](./ADR-001-executable-specification-language.md) through
[ADR-008](./ADR-008-environments-and-compatibility.md)) rather than amending
it. The behavioral authority for the browser family is
[ADR-005](./ADR-005-interface-capabilities.md) (accessibility-first
interaction) and [ADR-007](./ADR-007-deny-by-default-permissions.md)
(permissions). Nothing here promotes a design-suite **Open** item into a
decision; every choice forced by shipping is recorded as **v1 provisional** —
binding on this implementation, invisible to the design record, cheap to
revisit.

## Context

ADR-009 shipped `fs`, `cli`, and `http` as built-in plugins and named the
browser family "the largest omission", deliberately deferred because it forces
an automation-technology choice the design suite worked to keep out of the
core. ADR-009 also made a claim that this ADR now has to honour: adding the
browser family later is additive — "one more plugin behind the same protocol",
zero core changes.

Two things make that claim testable now. First, a suitable automation
technology exists on the host: `agent-browser`, a globally-installed CLI that
drives Chrome over CDP and — crucially — exposes an accessibility-tree snapshot
with role and accessible-name for every node, plus semantic locators. Its model
lines up with ADR-005's requirement almost exactly, which means the plugin can
be a thin mapping rather than a reimplementation of accessibility matching.
Second, the plugin protocol (`packages/spec/src/plugin.ts`) and the central
permission gate (`packages/spec/src/executor.ts`) were built in ADR-009 to
absorb exactly this: a new namespace of typed tools, each declaring a
`requires` family the runtime enforces before the plugin runs.

The design target is ADR-005 §2 (identify UI by role, accessible name, label,
and state), §3 (CSS selectors as a visible escape hatch, not the normal path),
and §5's canonical HTTP → browser test, whose `when`/`then` lines
(`browser.open`, `browser.fill textbox … with …`, `browser.click button …`,
`expect browser.url …`, `expect browser.button …`) are the notation this
plugin must make executable.

## Decision

Ship `browser` as a built-in plugin (`packages/spec/src/plugins/browser.ts`,
`createBrowserPlugin`) registered after `http` in the runner. Each tool is a
thin mapping onto one or more `agent-browser` invocations. Where
`agent-browser` cannot express an accessibility-first operation directly, the
plugin builds it on top of the accessibility snapshot rather than falling back
to coordinates.

### 1. The accessibility-first tool set

The tool names are the canonical teaching notation of ADR-005, made
executable. Roles arrive as bare words (`click button "Sign in"`), matching the
suite's notation, because roles are an open set; accessible names and values
arrive as strings; state and separator tokens (`checked`, `with`) arrive as the
symbolic words the grammar already distinguishes from strings.

| Tool                        | Kind       | `requires` | Arguments                    | Maps onto                      |
| --------------------------- | ---------- | ---------- | ---------------------------- | ------------------------------ |
| `open url`                  | action     | net        | url (value)                  | `open <url>`                   |
| `navigate url`              | action     | net        | url (value)                  | `open <url>`                   |
| `click role name`           | action     | net        | role (word), name (value)    | snapshot → `click @ref`        |
| `fill role name with value` | action     | net        | role, name, `with`, value    | snapshot → `fill @ref <value>` |
| `check role name`           | action     | net        | role (word), name (value)    | snapshot → `check @ref`        |
| `press key`                 | action     | net        | key (value)                  | `press <key>`                  |
| `click_selector selector`   | action     | net        | selector (value)             | `click <css>` (escape hatch)   |
| `heading name`              | observable | net        | name (value)                 | snapshot → role/name lookup    |
| `link name`                 | observable | net        | name (value)                 | snapshot → role/name lookup    |
| `button name`               | observable | net        | name (value)                 | snapshot → role/name lookup    |
| `text substring`            | observable | net        | substring (value)            | `get text body` → substring    |
| `checkbox name checked`     | observable | net        | name (value), `checked` word | snapshot → `is checked @ref`   |
| `url [expected]`            | observable | net        | expected (value, optional)   | `get url`                      |

`describe()` returns this set as a static constant. It never launches a
browser, so merely running a suite that does not touch `browser.*` costs
nothing and never requires `agent-browser` to be installed — the binary is
consulted only when a tool actually runs. `open` collides with no `fs`, `cli`,
or `http` tool name, so importing `browser` alongside them raises no
ambiguity.

**How the accessibility path is built.** For every element-addressing tool the
plugin runs `agent-browser snapshot -i --json`, reads the returned `refs` map
(`{ e3: { role: "textbox", name: "Email" }, … }`), finds the node whose role
equals the requested role and whose accessible name — normalized by trimming
and collapsing internal whitespace — equals the requested name, and then acts
on that node by its `@ref`. This is used instead of `agent-browser find role …
--name …` deliberately: `find` with the `check` action does not locate the
element in practice, and driving every interaction and every observer through
the same snapshot lookup gives one consistent name-matching rule across the
whole family. It is the "read the accessibility snapshot, find the node by
role+name, act on it" strategy ADR-005 implies, made literal.

**Observers report like `fs`.** Existence observers (`heading`, `link`,
`button`, `text`) and the `checkbox` state observer return `true` when the
assertion holds and an `ExpectationError` carrying expected/observed when it
does not — exactly the convention `fs.file`/`fs.directory` use, so `expect`
renders every surface's failures uniformly. `url` with no argument returns the
current URL string (so `expect browser.url` asserts a location exists); with an
argument it asserts exact equality and reports expected/observed on mismatch.

**Absolute URLs only (v1 provisional).** `open`/`navigate` reject a relative
URL with a `ToolError` pointing at
[ADR-008](./ADR-008-environments-and-compatibility.md), mirroring the `http`
plugin, because v1 ships no environments mechanism to bind a base URL against.
Consequently `url` compares full absolute URLs; ADR-005's `expect browser.url
"/"` awaits environments. Non-http(s) schemes are refused the same way.

### 2. Permissions: net, not run

Every browser tool declares `requires: "net"`. Reaching web content is the
privileged act, so the family is gated by `--allow-net`, enforced centrally by
the runtime before the plugin runs. `open` and `navigate` additionally call
`ctx.permissions.checkNet(host, port)` for scoped, per-destination enforcement
(so `--allow-net=localhost:3000` admits exactly that origin), mirroring `http`;
the interaction and observer tools rely on the coarse family gate, since they
act within a page already opened under a scoped grant.

The family does **not** additionally require `--allow-run`. This is the
distinction ADR-007 §4 fixes: starting a fixed, trusted plugin binary is not
the same as letting a spec execute arbitrary host commands. `agent-browser` is
chosen and installed by the operator, so it belongs to the runtime's trusted
computing base; the process names it spawns are not authored by the
specification. Collapsing the two would ruin both — if trusted-plugin startup
consumed `--allow-run`, the flag would appear on every browser invocation and
mean nothing. So the plugin spawns `agent-browser` directly (via `Bun.spawn`,
not `cli.run`), and `--allow-run` stays reserved for spec-requested execution.
A denied `net` grant fails `browser.open` with a `PermissionDeniedError` naming
`--allow-net` before any process spawns; a missing `agent-browser` binary is a
`ToolError` telling the caller to install it globally.

### 3. Sessions follow the workspace (v1 provisional)

`agent-browser` is daemon-backed: a named `--session` persists a live browser
across separate CLI invocations, so each tool call is a stateless process that
reuses the session's browser. The plugin derives the session name from the
basename of the test's isolated workspace directory
([ADR-006](./ADR-006-isolated-test-workspaces.md)). This reuses an
already-per-test value, so it needs no new isolation machinery, and it gives
the only defensible semantics for a test tool:

- **Within a test**, `given`/`when`/`then` share one workspace, hence one
  session, so a browser opened in `when` is still open in `then` — required by
  ADR-005 §5's canonical example.
- **Across tests**, each test has its own workspace, hence its own isolated
  browser (own cookies, storage, tabs).

Cleanup uses a new **optional** `dispose?(): Promise<void>` hook on the `Plugin`
interface. The browser plugin tracks the sessions it drove and closes each
(`agent-browser --session <s> close`) on dispose; the runner calls
`plugin.dispose?.()` for every plugin once, in a `finally`, after the whole run.
The hook is optional so `fs`, `cli`, and `http` are unaffected — they hold
nothing to release — and best-effort so a failed teardown never turns a
completed run into a failure. Closing only the plugin's own sessions leaves
unrelated `agent-browser` sessions on the host untouched.

## Consequences

### Positive

- ADR-009's additivity claim holds: the browser family landed as one plugin
  plus a static registration line, with no change to the lexer, parser,
  executor semantics, or permission engine. The only interface change is the
  additive, optional `dispose` hook.
- The accessibility path is exercised end to end by a test that serves a tiny
  page in-process and drives `open`/`fill`/`click`/`check` and every observer
  against a real browser — proving role-and-name interaction, not just that the
  code compiles.
- Accessible UI is the cheapest UI to specify, per ADR-005's intent: the escape
  hatch is a separate, obviously-named `click_selector` tool, so a CSS selector
  in a spec reads as the marked coupling ADR-005 wants it to be.

### Negative

- The plugin binds v1 to `agent-browser` as the automation technology. This is
  contained by the family contract — a future plugin could satisfy `browser`
  over WebDriver or Playwright with the same tool surface — but v1 ships exactly
  one implementation, and its absence disables the family at call time.
- Element-addressing tools spend an extra `snapshot` round-trip per action.
  That is the cost of one consistent, `find`-independent name-matching rule; it
  is acceptable at v1's scale and revisitable if it ever matters.

### Neutral

- The `Plugin` interface now carries an optional `dispose`. Existing plugins
  and external stdio plugins that omit it are unaffected.
- End-to-end browser tests are gated on `agent-browser` being on `PATH` and
  skip cleanly when it is absent, so CI without the binary stays green while
  still running the full unit surface.

## Open Questions

These are v1-provisional pressure points, not reopenings of the design suite;
the design-level versions live in ADR-005 and ADR-007.

- **Session isolation across tests and under parallelism.** Keying the session
  to the workspace isolates sequential tests, but ADR-005's broader question —
  what parallel execution means for a shared browser, and whether two tests may
  contend for one instance — is untouched. v1 runs tests sequentially, so it
  does not arise yet.
- **Diagnostics: screenshots and downloaded artifacts.** `agent-browser` can
  screenshot and record, and ADR-005 §6 describes browser downloads landing in
  the shared workspace. v1 exposes neither in tool results or failure
  diagnostics; how visual artifacts attach to a diagnostic is deferred with the
  richer-diagnostics work ADR-009 also defers.
- **The escape hatch's scope.** v1 offers `click_selector` only. Whether the
  escape hatch should extend to filling or asserting by selector, and how far,
  is left until a real inaccessible corner demands it — keeping the hatch
  deliberately minimal, per ADR-005 §3.
