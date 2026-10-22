# ADR-171: Architecture Diagram and Clean-Code Doctor Checks

## Status

**Accepted** - 2026-10-22

## Background

Agents generate code faster than people review it. Uncle Bob's agent workflow keeps quality with
deterministic gates — cyclomatic complexity, CRAP, and an explicit dependency rule — and a live
architecture diagram so humans steer structure without reading every file. `sdxc doctor` already
owns read-only project health (ADR-160, ADR-169); oxlint can flag per-function complexity when
enabled, but it does not draw the app-layout graph, enforce Clean Architecture against ADR-129
folders, score CRAP from coverage, or ship agent-tuned defaults through `.config/sdxc.jsonc`.

## Context

- App code sits in ranked layout folders (ADR-129): models innermost, delivery (http, jobs, mcp,
  emails, commands) outside services and policies, routes/resources/bootstrap outermost.
- `@sdxc/codemod` already finds import edges for `layout` and other checks; `@sdxc/diagram`
  renders Mermaid flowcharts to SVG without a browser.
- CRAP = CC² × (1 − coverage)³ + CC. Uncle Bob's agent threshold sits around 12; cyclomatic
  limits for agents stay low (default 4) so generated branches stay testable.
- Istanbul's `coverage-final.json` is the coverage shape Vitest emits; without it CRAP cannot
  be scored honestly.

## Decision

1. **`sdxc diagram`** builds the project's import graph, collapses it to layout layers, prints
   Mermaid (and optional JSON), and with `--svg` draws via `@sdxc/diagram`. Dependency-rule
   breaches are dashed edges with an explicit label — no Mermaid `linkStyle`, which the diagram
   package skips.
2. **Four built-in doctor checks** after `jsdoc` and before `ui`:
   - `complexity` — cyclomatic complexity per function (oxc AST), default max 4
   - `module-size` — code lines per module (same counting as `sdxc stats`), default max 200
   - `dependencies` — import cycles and outward layer edges
   - `crap` — CRAP from complexity + Istanbul coverage; **skip** when the coverage file is absent
3. Each check that takes a threshold owns its own `doctor.*` group, as `migrations` already
   does: `doctor.complexity.max`, `doctor.moduleSize.maxLines`, `doctor.crap.max` and
   `doctor.crap.coverage`. There is no shared clean-code config object. All four checks
   **warn**, matching ADR-160's convention-vs-break split.
4. Kit depends on `oxc-parser` for complexity and `@sdxc/diagram` for SVG. Import graphs stay on
   `@sdxc/codemod` so doctor and diagram share one edge finder.

## Consequences

### Positive

- Agents get one command for structure (`diagram`) and one report for clean-code drift (`doctor`).
- Thresholds are project-configurable without enabling oxlint rules the monorepo leaves off.
- CRAP stays honest: no coverage means skip, not a fake score.

### Negative

- `oxc-parser` is a runtime dependency of `@sdxc/kit` (the codemod package deliberately avoided
  that for its own surface; kit metrics need a real AST).
- Full CRAP needs a coverage run; CI must produce `coverage/coverage-final.json` (or the
  configured path) before that check leaves `skip`.

### Neutral

- Further oxlint-supported style rules (params, nesting, function length) are configured in
  oxlint, not as kit doctor checks — see [ADR-172](./ADR-172-oxlint-vs-kit-vs-repo-doctor-checks.md).

## References

- [ADR-129: App folder layout](./ADR-129-app-folder-layout.md)
- [ADR-160: `sdxc doctor`](./ADR-160-sdxc-doctor.md)
- [ADR-169: Encode static agent work in code](./ADR-169-kit-automates-static-agent-work.md)
- [ADR-137: Codemod package](./ADR-137-codemod-package.md)
- [ADR-172: Oxlint vs kit doctor vs repo doctor checks](./ADR-172-oxlint-vs-kit-vs-repo-doctor-checks.md)
