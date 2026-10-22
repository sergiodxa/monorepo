# ADR-171: Oxlint Size and Shape Rules for Code Quality

## Status

**Implemented** - 2026-10-22

## Background

Oxlint in the root `vite.config.ts` already ran correctness plugins and a few explicit
denies (`no-unused-expressions`, jsx-a11y allowances). It did not enforce function size,
nesting depth, cyclomatic complexity, or related shape rules. Agents and humans could add
deeply nested, multi-parameter, or multi-hundred-line functions without CI feedback, while
editor tooling and Oxlint defaults for those rules stayed unused.

## Context

- Vite+ owns lint through the root `lint` block; there are no per-package `.oxlintrc` files.
- Enabling Oxlint's defaults for `max-params` (3), `max-statements` (10),
  `max-lines-per-function` (50), `max-lines` (300), and `react/jsx-max-depth` (2) fails on
  the order of ten thousand existing sites across apps and packages.
- Some rules exist in more than one plugin (`eslint/no-nested-ternary` and
  `unicorn/no-nested-ternary`; `eslint/no-lonely-if` and `unicorn/no-lonely-if`). Enabling
  both double-reports the same sites.
- `denyWarnings: true` means any plugin default that emits a warning fails CI when that
  plugin is loaded.
- Inline `oxlint-disable` / `oxlint-disable-next-line` comments hide violations from
  reviewers and from ratchet progress; they are the wrong tool for a repo-wide quality bar.

## Decision

**Turn on size, nesting, and shape rules in the root `lint.rules` (and targeted
`lint.overrides`), with adoption thresholds and scoped exemptions — never with per-line
disable comments.**

### Rules enabled

| Rule                         | Role                          | Notes                                                     |
| ---------------------------- | ----------------------------- | --------------------------------------------------------- |
| `max-params`                 | Parameter count               | Adoption max above Oxlint's 3                             |
| `max-depth`                  | Block nesting                 | Near default                                              |
| `max-lines-per-function`     | Function length               | Skip blank/comment lines; tests and apps overridden       |
| `max-lines`                  | File length                   | Skip blank/comment lines; data/locale catalogs overridden |
| `max-nested-callbacks`       | Callback nesting              | Oxlint default (10)                                       |
| `max-statements`             | Statements per function       | Adoption max above Oxlint's 10                            |
| `max-classes-per-file`       | Classes per file              | `ignoreExpressions`; `**/errors.ts` overridden            |
| `complexity`                 | Cyclomatic complexity         | Adoption max; not a CRAP gate                             |
| `no-else-return`             | Flatten `else` after `return` | Default                                                   |
| `eslint/no-nested-ternary`   | Nested `? :`                  | Eslint only — see oxfmt note below                        |
| `unicorn/max-nested-calls`   | Nested call depth             | Unicorn                                                   |
| `vitest/max-nested-describe` | `describe` nesting            | Vitest plugin only on test globs                          |
| `react/jsx-max-depth`        | JSX nesting                   | React plugin; apps overridden until screens split         |

Additional shape rules that keep control flow and collections readable without competing
with the size caps: `eqeqeq` (`always`, `null: "ignore"` for idiomatic `== null`),
`no-var`, `no-lonely-if` (eslint only), `no-unneeded-ternary`, `no-useless-return`,
`default-case-last`, `oxc/no-accumulating-spread`, `unicorn/prefer-array-flat-map`,
`unicorn/prefer-array-flat`, `no-param-reassign`, `promise/param-names`.

### Plugin ownership (no competing pairs)

- Nested ternary: `eslint/no-nested-ternary` deny; `unicorn/no-nested-ternary` allow.
  Unicorn's variant requires parentheses that Oxfmt strips, which thrash with
  `bun check:fix`. Banning nesting and rewriting to `if`/`else` (or a named local)
  matches the formatter.
- Lonely if: `no-lonely-if` deny; `unicorn/no-lonely-if` allow.
- Vitest: load the `vitest` plugin only in the test-file override, deny
  `vitest/max-nested-describe`, and allow the plugin's style defaults that would otherwise
  fail under `denyWarnings` (`require-mock-type-parameters`, `expect-expect`, …).
- React: load `react` for `jsx-max-depth`; allow `react/jsx-key` (a plugin default that
  is not part of this quality pass). Do not enable further React style packs here.

### Exemptions

Exemptions are **only** `lint.overrides` (or higher thresholds) in root `vite.config.ts`:

- Tests: size/complexity/JSX depth and nested-call caps off; describe-depth on.
- Apps: page-sized controllers and deep JSX off the package size caps; params and
  complexity still capped.
- Scripts/CLI: orchestration size caps off; complexity still capped.
- Generated/bulk data (`*.data.ts`, locales, icon registries, …): `max-lines` off.
- `**/errors.ts`: related error subclasses may share a file.

**Never** add `oxlint-disable`, `oxlint-disable-next-line`, or `oxlint-disable-line` to
silence these quality rules. Fix the code, extract a helper, or change the override in
`vite.config.ts` after recording why in this ADR (or a follow-up).

Tooling directives that suppress unrelated diagnostics (for example a typed
`typescript/no-explicit-any` site that already used `oxlint-disable-next-line`) stay
governed by the existing AGENTS.md comment rules; they are not a path for size/shape
exemptions.

### Thresholds

Numeric caps in `vite.config.ts` are an **adoption floor**: high enough that the monorepo
is green after shape fixes, low enough to stop further growth of the worst outliers.
Oxlint defaults remain the long-term target; tighten the numbers in `vite.config.ts` as
parsers and screens are split — still without inline disables.

## Consequences

### Positive

- Editor and CI share one quality bar for nesting, size, and shape.
- New code cannot quietly exceed today's worst package outliers.
- One plugin owns each overlapping check; autofix stays unambiguous.
- Exemptions are reviewable in one file.

### Negative

- Adoption thresholds are looser than Oxlint defaults until debt is paid down.
- Apps temporarily skip several size caps; package code carries the stricter floor.

### Neutral

- `complexity` here is cyclomatic complexity for lint, not a coverage CRAP score.

## Alternatives Considered

### Enable Oxlint defaults and mass-refactor in one change

**Rejected because**: defaults fail on thousands of sites (deep JSX in apps, long test
`it` bodies, SVG/`arcTo`-style parameter lists). A single PR cannot split every controller
and still stay reviewable.

### Warn-only rollout

**Rejected because**: `denyWarnings: true` already turns warnings into CI failures; a
separate warn tier would need that option off and would teach a second, weaker bar.

### Per-file `oxlint-disable` for known offenders

**Rejected because**: disables hide debt, copy-paste easily, and never appear in the
config reviewers read for policy. Overrides and thresholds stay visible.

## References

- Root `lint` block in [`vite.config.ts`](../../vite.config.ts)
- [Oxlint rules](https://oxc.rs/docs/guide/usage/linter/rules)
- [ADR-170: Monorepo Lint Belongs in `doctor.checks`](./ADR-170-monorepo-lint-is-doctor-checks.md)

## Current Progress

- [x] Decision recorded
- [x] Rules, plugins, and overrides in root `vite.config.ts`
- [x] Shape violations fixed without `oxlint-disable`
- [x] Nested ternaries rewritten for `eslint/no-nested-ternary` (Oxfmt-safe)
- [ ] Tighten adoption thresholds toward Oxlint defaults as files are split
