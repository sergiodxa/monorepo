# ADR-168: No ADR Citations in Code Comments

## Status

**Accepted** - 2026-10-20

## Background

Agents documenting new behavior often append `(ADR-0xx)` to JSDoc and other code
comments so a reader can find the decision. A review of the flow-monitor Performance
trace work corrected that habit: comments must not mention ADRs.

## Context

- `AGENTS.md` already requires JSDoc to state the _why_ on the symbol's own terms —
  intent, contract, invariant — and forbids describing a symbol by how it was built or
  by naming another app as the source of a pattern.
- ADRs live under `docs/adr/` (and app subdirectories). They are the place that links a
  decision to related ADRs, alternatives, and history.
- A parenthetical ADR number in a comment adds a cross-reference without adding the
  contract a caller needs, and it goes stale when ADRs are superseded or renumbered in
  prose.

## Decision

**Code comments and JSDoc never cite ADRs.** The comment states the behavior or
invariant the code guarantees. The architectural decision, if it needs a record, is
written as an ADR; the code does not point at that file.

This applies to module headers, symbol JSDoc, inline JSDoc on callbacks, SQL migration
headers, and comments inside config files such as `wrangler.jsonc`. It does not restrict
`AGENTS.md`, package READMEs, guides, or ADR prose from linking to ADRs.

## Consequences

### Positive

- Comments stay useful when read next to the code alone.
- Agents stop treating ADR numbers as a substitute for stating the contract.

### Negative

- A reader who wants the decision history opens `docs/adr/` (or follows links from
  `AGENTS.md` / guides) instead of jumping from a comment.

### Neutral

- Existing comments that still cite ADRs are cleaned when those lines are touched; this
  decision does not require a repo-wide sweep.
