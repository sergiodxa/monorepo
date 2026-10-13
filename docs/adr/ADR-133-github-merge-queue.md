# ADR-133: GitHub Auto-Merge for Pull Requests

## Status

**Accepted** - 2026-10-13 (revised the same day)

## Background

Pull requests sit until CI finishes before anyone can click merge. On a monorepo
whose CI fans out across every workspace with tests, that wait turns "merge when
green" into babysitting. The goal is to opt in once and let GitHub merge when
checks pass.

## Context

- The repo squash-merges only and deletes the head branch on merge.
- GitHub's **merge queue** would also re-test each PR on a temporary merge group
  against the tip of `main`. That rule is only available on
  **organization-owned** repositories. This repo is user-owned
  (`sergiodxa/monorepo`), so creating a `merge_queue` ruleset returns
  `422 Invalid rule 'merge_queue'`.
- **Auto-merge** is available on the user-owned repo and already covers the
  "click once, do not watch CI" workflow.

## Decision

Use repository auto-merge only:

1. Keep `allow_auto_merge` enabled on the repository (squash only).
2. Do not configure a merge-queue ruleset while the repo stays user-owned.
3. Drop the unused `merge_group` CI trigger; it only matters for a merge queue.
4. Keep `scripts/setup-auto-merge.sh` as the idempotent admin helper if settings
   drift.

On a PR: **Enable auto-merge** / `gh pr merge --auto --squash`. GitHub merges
when required checks (and any other requirements) pass.

If the repo later moves to an organization, revisit a merge-queue ruleset and
re-add `merge_group` to CI.

## Consequences

### Positive

- Reviewers enqueue with auto-merge without watching CI.
- No ruleset blocks direct pushes to `main` for the existing agent workflow.

### Negative

- No merge-group revalidation against the tip of `main` or other queued PRs;
  two green PRs can still conflict or break when landed in sequence.
- Auto-merge waits on whatever checks GitHub considers required; with no
  branch protection today, that is mainly the checks that have been reported
  for the PR (CI still runs on `pull_request`).

### Neutral

- CodeQL stays on `pull_request` / `push` and is not a merge gate.
- Transferring the repo to an org is the unlock for a real merge queue later.

## References

- [Automatically merging a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/automatically-merging-a-pull-request)
- [Managing a merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue) (org-owned repos only)
- `scripts/setup-auto-merge.sh`
