# ADR-173: Kit Doctor Quality Gates Beyond Complexity

## Status

**Accepted** - 2026-10-22

## Background

ADR-171 added complexity, module size, dependency-rule and CRAP checks. Agents still paste
blocks, leave unreferenced modules, hub one file to half the app, skip tests, throw instead of
returning `@sdxc/result`, and scatter a feature folder across layers unevenly. Oxlint cannot see
those project-level shapes (ADR-172).

## Context

- `sdxc stats` already reports code-to-test ratio; doctor had no gate on it.
- The import graph from ADR-171 already powers `dependencies` and `sdxc diagram`; fan-out and
  orphans are the same graph read another way.
- Mutation testing is optional in consumer apps; a missing report must skip, like CRAP without
  coverage.
- Monorepo-only rules (`console.*`, UUID-as-secret) stay in `.config/sdxc/checks/` (ADR-170,
  ADR-172). Function-shape rules (`max-params`, nesting, …) stay in oxlint.

## Decision

1. **Seven more built-in doctor checks** (all **warn**, each with its own `doctor.*` group when
   it takes a threshold):
   - `fan-out` — distinct project imports per module; `doctor.fanOut.max` (default 15)
   - `orphans` — non-entry modules nothing imports (entries: bootstrap, routes, initializers,
     migrations, factories, config)
   - `feature-scatter` — a feature name that already spans two layers should appear in every
     layer that hosts multi-layer features (ADR-129)
   - `duplication` — identical code blocks of `doctor.duplication.minLines` (default 8) in more
     than one module
   - `result-throws` — bare `throw` in app source (convention: `@sdxc/result`)
   - `test-ratio` — `tests / code` from `sdxc stats`; `doctor.testRatio.min` (default 0.3)
   - `mutation` — survivors in a mutation report; `doctor.mutation.report` /
     `doctor.mutation.maxSurvived`; **skip** when the report file is absent
2. Report order after `dependencies`: fan-out, orphans, feature-scatter, duplication,
   result-throws, test-ratio, crap, mutation, then `ui`.
3. Oxlint in this monorepo enables `max-params`, `max-depth`, `max-nested-callbacks`,
   `max-lines-per-function`, `max-statements` and `no-nested-ternary` as **warn**. Repo doctor
   checks `console` and `uuid-secrets` live under `.config/sdxc/checks/`.

## Consequences

### Positive

- Agents get portable, thresholded gates for the failure modes oxlint cannot see.
- Mutation and CRAP stay honest: no artifact means skip.

### Negative

- Duplication matching is line-window based; short shared idioms can warn until
  `doctor.duplication.minLines` is raised.
- `result-throws` assumes `@sdxc/result`; apps that throw on purpose warn until they skip the
  check or stop throwing.

### Neutral

- Feature folders that exist in only one layer do not warn — scatter only fires once a name is
  already multi-layer.

## References

- [ADR-129: App folder layout](./ADR-129-app-folder-layout.md)
- [ADR-160: `sdxc doctor`](./ADR-160-sdxc-doctor.md)
- [ADR-170: Monorepo lint belongs in `doctor.checks`](./ADR-170-monorepo-lint-is-doctor-checks.md)
- [ADR-171: Architecture diagram and clean-code doctor checks](./ADR-171-kit-architecture-diagram-and-clean-code-doctor.md)
- [ADR-172: Oxlint vs kit vs repo doctor checks](./ADR-172-oxlint-vs-kit-vs-repo-doctor-checks.md)
