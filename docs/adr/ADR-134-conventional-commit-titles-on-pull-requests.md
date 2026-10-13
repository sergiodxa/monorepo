# ADR-134: Conventional Commit Subjects Land Intact via Rebase

## Status

**Accepted** - 2026-10-13

## Background

Cloud agents open pull requests. When GitHub **squash-merged**, a prose PR title
replaced correct branch commits and became the only subject on `main` — PR #4 had
`fix(ui): …` and `fix(sdxc): …` on the branch, and landed as
`fix CodeQL polynomial ReDoS and incomplete sanitization alerts (#4)`. The daily
release ([ADR-007](./ADR-007-publishable-package-releases.md)) publishes commit
subjects verbatim; that squash subject parses as a scopeless `chore` and was
attributed to every package the commit touched.

The repository now uses **rebase and merge**, so each commit on the PR is replayed
onto `main` and remains the release input. Squash is not used.

## Context

- `scripts/release/commits.ts` accepts `type(scope)!: title`. A subject without that
  shape becomes `{ type: "chore", scope: null, title: <whole subject> }`.
- `scripts/release/notes.ts` renders `- ${type}: ${title}` per package.
- Rebase-and-merge preserves every individual commit (no merge commit, no squash).
  That matches the one-workspace-per-commit rule: a PR may touch several workspaces
  when it carries one Conventional commit per workspace.
- The failure mode under squash was the PR title. Under rebase, the failure mode is
  a non-Conventional **commit** subject on the branch.

## Decision

1. Every commit that will land on `main` — including every commit on a pull-request
   branch — uses a Conventional Commits subject: `type(scope): title` (or
   `type(scope)!: title`), with `scope` the workspace directory name. Root-only or
   docs-only work may omit the scope (`ci: …`, `docs: …`, `chore(deps): …`).
2. Each commit stays inside one package or one app (root and `docs/` may ride along).
   A change that spans two workspaces is two commits, whether they share a PR or not.
3. The commit title is what changed for a consumer of that workspace; the body (when
   present) is the explanation the release notes reader needs. Both are published
   verbatim.
4. Pull requests merge with **rebase and merge** (or a local fast-forward). Do not
   squash-merge and do not create a merge commit. The PR title is for humans on the
   PR page; it is not the release subject once rebase is the merge method.
5. Prefer a Conventional PR title when the PR is a single commit or a single
   workspace; multi-workspace PRs may use a short prose summary, because the commits
   carry the release lines.

## Consequences

### Positive

- Rebase keeps scoped subjects on `main`, so agent PRs produce the same release-note
  lines as direct commits.
- Multi-workspace cleanups can ship as one PR with one Conventional commit per
  workspace.

### Negative

- Agents must get every branch commit right before merge; fixing a subject after
  rebase-and-merge means another commit (or a history rewrite).

### Neutral

- Local sessions that commit straight to `main` are unchanged.
- An earlier squash onto `main` (PR #4) still carries a bad subject until rewritten or
  superseded in the notes by later commits; rebase does not repair history already
  landed.

## References

- [ADR-007](./ADR-007-publishable-package-releases.md)
- `scripts/release/commits.ts`, `scripts/release/notes.ts`
- `AGENTS.md` commit and pull-request conventions
