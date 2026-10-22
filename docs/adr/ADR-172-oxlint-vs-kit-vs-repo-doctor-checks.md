# ADR-172: Oxlint vs Kit Doctor vs Repo Doctor Checks

## Status

**Accepted** - 2026-10-22

## Background

While exploring further quality gates after ADR-171, an agent proposed built-in `@sdxc/kit`
doctor checks for rules oxlint already implements (`max-params`, nesting depth, and similar)
and for monorepo conventions (`crypto.randomUUID` / UUID-as-secret, `console.*` vs
`@sdxc/logger`). That splits discovery for agents and ships kit checks that do not apply to
every consumer app.

## Context

- Vite+ oxlint in the root `vite.config.ts` is the monorepo's (and a generated app's) lint
  surface for per-function style rules. Several useful rules exist there and are simply not
  enabled yet.
- `sdxc doctor` built-ins ship to every `@sdxc/kit` consumer. They must assume only what every
  Remix app on the stack shares (layout, routes, packages, migrations) — not that the app uses
  `@sdxc/uuid` or `@sdxc/logger`.
- Monorepo-only lint already belongs in `.config/sdxc/checks/` (ADR-170): `defineCheck` modules
  run with the repo's runtime and conventions.
- ADR-171's diagram, dependency rule, module size, and CRAP stay doctor concerns: oxlint has no
  project import graph, no layout ranks, and no coverage-combined score.

## Decision

1. **Oxlint-supported style rules** — `max-params`, nesting / `max-depth`,
   `max-lines-per-function`, and other eslint/oxc rules oxlint already provides — are configured
   in oxlint (`vite.config.ts` `lint.rules` / overrides), not added as kit doctor checks. Enable
   and tune them there when the monorepo wants them.
2. **Kit built-in doctor checks** stay for project structure and metrics oxlint does not own:
   release/layout/wiring (ADR-160), architecture diagram + dependency rule, module size, CRAP
   (ADR-171), and similar cross-file or coverage-backed gates.
3. **Monorepo conventions** — UUID/secret generation, `console` vs `@sdxc/logger`, and any rule
   that assumes this repo's packages — are custom checks under `.config/sdxc/checks/` (ADR-170),
   never new built-ins on `@sdxc/kit`.

## Consequences

### Positive

- Agents look in one place per kind of rule: oxlint for local style, kit doctor for portable
  project health, repo `doctor.checks` for monorepo-only policy.
- Consumer apps are not warned for conventions they never adopted.

### Negative

- Enabling `max-params` / nesting still needs an explicit oxlint config change; doctor will not
  paper over a disabled rule.
- Repo checks must be maintained beside the monorepo, not reused automatically in every
  generated app.

### Neutral

- ADR-171's `complexity` doctor check remains: it feeds CRAP and ships agent-facing thresholds
  through `doctor.complexity`. Further oxlint-available limits (params, nesting, function
  length) do not follow that path unless they gain a similar project-level reason.
- Follow-up gates that oxlint still cannot see (fan-out, orphans, duplication, test ratio,
  mutation, and related) are kit doctor checks under
  [ADR-173](./ADR-173-kit-doctor-quality-gates.md).

## References

- [ADR-160: `sdxc doctor`](./ADR-160-sdxc-doctor.md)
- [ADR-170: Monorepo lint belongs in `doctor.checks`](./ADR-170-monorepo-lint-is-doctor-checks.md)
- [ADR-171: Architecture diagram and clean-code doctor checks](./ADR-171-kit-architecture-diagram-and-clean-code-doctor.md)
- [ADR-173: Kit doctor quality gates beyond complexity](./ADR-173-kit-doctor-quality-gates.md)
