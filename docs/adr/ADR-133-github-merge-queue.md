# ADR-133: GitHub Merge Queue for `main`

## Status

**Accepted** - 2026-10-13

## Background

Pull requests sit until CI finishes before anyone can click merge. On a monorepo
whose CI fans out to every workspace with tests, that wait is long enough that
"merge when green" becomes a babysitting task. GitHub's merge queue lets a
reviewer click **Merge when ready** immediately; the PR enters the queue when
requirements are met, CI re-runs on a temporary merge group against the tip of
`main`, and the queue squash-merges without another human round trip.

## Context

- The repo already squash-merges only, deletes the head branch on merge, and
  leaves `main` unprotected (no rulesets, no branch protection).
- CI lives in `.github/workflows/ci.yml` and must also run on `merge_group`, or
  the queue waits forever for a check that never starts.
- `AGENTS.md` still expects local agent sessions to commit straight to `main`.
  A ruleset that requires the merge queue for PR merges must not lock owners out
  of that path.

## Decision

1. Trigger CI on `merge_group` (no path filters on that event).
2. Turn on repository auto-merge.
3. Add an active branch ruleset on `refs/heads/main` that:
   - Requires the merge queue with squash, `ALLGREEN` grouping, a 60-minute
     check timeout, and small build concurrency (CI is already wide).
   - Requires `.github/workflows/ci.yml` via the `workflows` rule.
   - Lets the repository **Admin** role bypass always, so owner pushes to
     `main` keep working.
4. Apply the ruleset with `scripts/setup-merge-queue.sh` (needs `gh` with admin),
   because cloud-agent tokens cannot write repository settings.

## Consequences

### Positive

- Reviewers enqueue with **Merge when ready** / `gh pr merge --auto --squash`
  without watching CI.
- The queue re-validates against the current tip of `main`, so green-on-branch
  does not mean green-on-merge.
- Direct pushes by admins remain available for the existing agent workflow.

### Negative

- Every queued PR pays for a second CI run on the merge group.
- Non-admin writers cannot merge a PR outside the queue, and cannot push to
  `main` without bypassing (they have no bypass).

### Neutral

- CodeQL stays on `pull_request` / `push` only; it is not a merge-queue gate.
- Docs-only PRs still skip CI on `pull_request` via path filters, but run CI
  once they are in the merge queue.

## References

- [Managing a merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue)
- `scripts/setup-merge-queue.sh`
- `.github/workflows/ci.yml`
