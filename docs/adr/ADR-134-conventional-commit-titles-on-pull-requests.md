# ADR-134: Conventional Commit Titles on Pull Requests

## Status

**Accepted** - 2026-10-13

## Background

Cloud agents open pull requests whose titles describe the work in prose (for example
"Fix CodeQL polynomial ReDoS and incomplete sanitization alerts"). GitHub squash-merges
those PRs onto `main`, so the PR title becomes the only commit subject the daily release
reads. [ADR-007](./ADR-007-publishable-package-releases.md) publishes that subject
verbatim into the GitHub Release notes. A non-Conventional title lands as a `chore` with
the whole subject as the line, and a squash that spanned two workspaces attributes one
useless line to every package it touched.

## Context

- `scripts/release/commits.ts` accepts `type(scope)!: title`. A subject without that
  shape becomes `{ type: "chore", scope: null, title: <whole subject> }`.
- `scripts/release/notes.ts` renders `- ${type}: ${title}` per package. The scope is
  dropped from the rendered line; the title is what consumers read.
- Branch commits on PR #4 were already correct (`fix(ui): …`, `fix(sdxc): …`). The
  squash replaced both with the PR title, so the release range lost the scoped subjects
  and gained one cross-workspace commit.
- `AGENTS.md` already requires Conventional Commits and one workspace per commit for
  local pushes to `main`. It did not say the same about PR titles, which is what ships
  when GitHub squash-merges.

## Decision

1. Every pull request title is a Conventional Commits subject:
   `type(scope): title` (or `type(scope)!: title`), with `scope` the workspace directory
   name (`jwt`, `uptime`, `ui`, …). Root-only or docs-only work may omit the scope
   (`ci: …`, `docs: …`, `chore(deps): …`).
2. A PR that will be squash-merged touches exactly one package or app. Root and `docs/`
   files may ride along. A change that spans two workspaces is two PRs, matching the
   one-workspace-per-commit rule.
3. The PR title is written for a consumer of that workspace — the same wording the
   release notes will show. The body may explain; it is not what the release script
   prints as the bullet.
4. Branch commits on the PR keep the same Conventional shape so review history matches
   what will land; under squash, the title is still the subject that matters.

## Consequences

### Positive

- Squash-merged agent PRs produce the same release-note lines as direct commits to
  `main`.
- Cross-workspace squash commits stop appearing under every package they touched with a
  generic `chore:` line.

### Negative

- Multi-workspace cleanup cannot ship as one squash-merged PR; agents open one PR per
  workspace.

### Neutral

- Local sessions that commit straight to `main` are unchanged: their commit subjects
  remain the release input. This ADR only closes the PR-title gap.
- A merge queue that squash-merges onto `main` depends on this rule; without it, every
  queued merge would risk poisoning the next dated release.

## References

- [ADR-007](./ADR-007-publishable-package-releases.md)
- `scripts/release/commits.ts`, `scripts/release/notes.ts`
- `AGENTS.md` commit and pull-request conventions
