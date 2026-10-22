# ADR-170: Monorepo Lint Belongs in `doctor.checks`

## Status

**Accepted** - 2026-10-22

## Background

ADR-169 moved release and related monorepo scripts onto `cli/` under `@sdxc/cli`, including
`release check-commits` for Conventional Commit bodies and capitalized summaries. That verb is
read-only lint of the repository: the same shape as a project check `sdxc doctor` already runs
from `.config/sdxc/checks/` (ADR-160). Putting it on the release command line taught agents a
second discovery path for "is this repo healthy?" and duplicated the doctor surface.

## Context

- `sdxc doctor` is the kit's read-only report; projects extend it with `defineCheck` modules in
  `doctor.checks` (default `.config/sdxc/checks/`).
- The monorepo already runs `bun run doctor` (kit doctor in every app) in CI.
- Commit-body enforcement needs a message file (commit-msg hook) or a revision range (CI). Those
  are inputs to one rule, not reasons for a separate CLI verb — the check reads
  `SDXC_COMMIT_MSG_FILE` / `SDXC_COMMIT_RANGE` when set, and skips when neither is present so a
  plain `doctor` run stays useful without git history flags.
- Mutating or orchestrating monorepo work (`release`, `package create`, `app register`) stays on
  the root CLI: doctor never writes (ADR-160).

## Decision

**Read-only monorepo rules are custom `sdxc doctor` checks under `.config/sdxc/checks/`, not
one-off commands on `bun run cli`.** The root CLI's `doctor` runs kit doctor at the repository
root first (so those checks run), then in every app. CI and the commit-msg hook invoke
`doctor --only <check>` with the env the check documents; they do not call a dedicated
`release check-commits` (or similar) verb.

Apply the same cut when adding further monorepo lint: if the step only diagnoses and names a
fix, it is a doctor check. Candidates include deploy-workflow drift (choices that name apps
not yet shipped), public-package table gaps, and other repo rules today enforced only in
`test/` or CI scripts. If it publishes, scaffolds, or wires the repo, it stays a CLI command.

## Consequences

### Positive

- One discovery path for agents and CI: `sdxc doctor` / `bun run doctor`, with `--only` /
  `--json` already understood.
- New monorepo rules reuse `defineCheck` instead of growing `cli/commands/`.
- Release CLI stays about releasing (and bootstrap), not lint.

### Negative

- Hook and CI must set env vars the check reads; a forgotten env yields `skip`, not a false
  pass on an empty range.
- Root doctor runs built-in kit checks that mostly skip on the monorepo package.json; that is
  acceptable noise on a `--only commits` job and a short prefix on a full doctor run.

### Neutral

- `scripts/release/check-commits.ts` remains the rule implementation; the doctor check and any
  future caller share it.

## References

- [ADR-160: `sdxc doctor`](./ADR-160-sdxc-doctor.md)
- [ADR-169: Encode Static Agent Work in Code](./ADR-169-kit-automates-static-agent-work.md)
- [ADR-140: Commit Bodies Are Release Notes](./ADR-140-commit-bodies-are-release-notes.md)

## Current Progress

- [x] Decision recorded
- [x] `.config/sdxc/checks/commits.ts` + root doctor pass
- [x] CI and commit-msg hook call `doctor --only commits`
- [x] Remove `release check-commits` from the monorepo CLI contract
