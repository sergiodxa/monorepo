# ADR-017: Zero-Argument Tool Calls on a `let`/`return` Right-Hand Side

## Status

**Proposed** - 2026-08-09

This ADR records a narrow refinement to how a bare path is resolved on the
right-hand side of `let`/`return`, so a zero-argument tool such as
`browser.url` can be captured into a binding: `let current = browser.url`. Like
[ADR-009](./ADR-009-v1-typescript-implementation.md) through
[ADR-016](./ADR-016-oauth-oidc-testing-tools.md), it is an implementation ADR:
not standalone, free to reference this monorepo's packages and conventions, and
bound by the design suite
([ADR-001](./ADR-001-executable-specification-language.md) through
[ADR-008](./ADR-008-environments-and-compatibility.md)) rather than amending it.
Its parents are [ADR-009](./ADR-009-v1-typescript-implementation.md) (the v1
implementation and its grammar) and
[ADR-016](./ADR-016-oauth-oidc-testing-tools.md), whose "bind the landing URL"
step (Consequences) this makes expressible. It does **not** reopen ADR-016's
first Open Question — a bare scalar binding still reaches a tool only through a
dotted reference — it removes the separate obstacle that the landing URL could
not be bound at all. The choice recorded here is **v1-provisional**: binding on
this implementation, invisible to the design record, cheap to revisit.

## Context

[ADR-016](./ADR-016-oauth-oidc-testing-tools.md) closed ADR-015's stated
`authorization_code` gap by adding the `url` capability, so a spec could read
the `?code=` out of a redirect URL with `url.query` instead of string surgery.
Its Consequences describe the intended chain as "`browser` authorize → **bind
the landing URL** → `url.query … "code"`". But the middle step could not be
written: the `browser.url` observable returns the current URL when called with
zero arguments, yet there was no way to _bind_ it.

The obstacle is a resolution rule, not the grammar. A bare path with no
arguments on a `let`/`return` right-hand side
([ADR-009](./ADR-009-v1-typescript-implementation.md) §C3;
`GRAMMAR.md`) parsed and evaluated as a **reference** — a dotted lookup into the
scope. `let current = browser.url` therefore looked for a binding named
`browser`, found none, and failed with an unknown-name error. A tool observation
could be _asserted_ (`expect browser.url "…"`, the observable form of `expect`)
but never _captured_.

The design constraint is unchanged: capability is delivered as tools, never
grammar ([ADR-002](./ADR-002-specification-language-design.md)). This refinement
adds **no syntax** — no new production, no new token, no operator. The parser is
untouched; only name resolution on an existing form (a bare path RHS) gains one
case.

## Decision

On a `let`/`return` right-hand side that is a bare path (a `PATH` with no
arguments — the syntactic reference form), resolve it as follows, in order:

1. **Head is a binding → reference.** If the path's head segment names a
   binding in scope, it is a reference (a dotted lookup), exactly as before.
   `let e = user.email` is unchanged. A binding always wins, so a binding and a
   tool can never collide here — a reference _requires_ a bound head, so the two
   candidate sets are disjoint by construction, and the runtime never guesses.
2. **Head is not a binding, and the path resolves to an argument-less tool →
   zero-argument tool call.** Resolve the whole path through the registry,
   honoring the file's `use` imports (so both the qualified `browser.url` and a
   `use`-imported bare `url` work). If it resolves to a _tool_ whose descriptor
   declares no required parameters, invoke it with no arguments and bind its
   returned value. `let current = browser.url` captures the current URL. This
   generalizes to any argument-less tool, not just `browser.url`.
3. **Otherwise → the reference path, unchanged.** Anything else — an unknown or
   ambiguous path, a path resolving to a command, or a tool that has a required
   argument — falls through to the ordinary reference evaluation, which
   produces the same unknown-name error it always did. A tool that needs
   arguments is never silently called with none.

Two invariants make this safe and honest:

- **Scope confined to the RHS.** The change touches only the `let`/`return`
  right-hand side. A bare path in _argument_ position is untouched: to a tool it
  is still a symbolic word, and to a command or the value form of `expect` it is
  still a binding read ([ADR-002](./ADR-002-specification-language-design.md)).
  The documented cost that a bare scalar binding reaches a tool only through a
  dotted reference (ADR-016 Open Questions) still stands — a captured
  `browser.url` is boxed (`let where = { url: current }`) before `url.query`
  reads it.
- **Permission-correct.** The invocation is dispatched through the ordinary tool
  path, so the runtime's coarse permission gate applies before the plugin runs.
  `browser.url` requires `net`; captured or asserted, it is denied without
  `--allow-net` just the same. Deny-by-default
  ([ADR-007](./ADR-007-deny-by-default-permissions.md)) is preserved.

Implemented in `packages/spec/src/executor.ts` as a single resolution case on
the `let`/`return` RHS (`zeroArgToolCall`), reusing the existing tool-dispatch
and gate; no other module changes. `GRAMMAR.md` (Notes and Evaluation) and the
README record the rule.

## Consequences

- The `authorization_code` chain ADR-016 described is now expressible end to
  end: `browser` authorize → `let landing = browser.url` → box → `url.query …
"code"` → token exchange → `jwt.verify`. The middle step is no longer a gap.
- The refinement is general: any argument-less observable (present or future)
  becomes capturable into a binding with no further work.
- The grammar did not grow — this is a resolution rule on an existing form, and
  it is the second piece of evidence (after ADR-016) that the OAuth gaps needed
  small runtime moves, not language operators.
- Existing suites are unaffected: a bare-path RHS whose head is bound is still a
  reference, and one that resolves to nothing is still the same unknown-name
  error. The only newly-legal program is one that previously errored
  (`let x = <argument-less-tool>`).

## Open Questions

These are v1-provisional pressure points, not reopenings of the design suite.

- **Argument-less _commands_.** The rule admits tools only; a bare-path RHS that
  resolves to a zero-parameter suite command is still the unknown-name error
  (a command is invoked with the explicit `call-expr` form). Admitting commands
  too would be a natural, additive extension if a real suite wants it, but it is
  deliberately out of scope until then — a command call reads more clearly with
  its name in call position.
- **Optional-argument tools.** A tool with only optional parameters (like
  `browser.url`, whose `expected` argument is optional) is treated as
  argument-less and called with none — the observe form. That is exactly the
  intent for `browser.url`; whether any future tool would want the no-argument
  RHS to mean something other than "all defaults" is unknown, and can be
  revisited per tool if it ever arises.
