---
title: Run CI
description: Run your project's CI script on your machine with sdxc ci, narrow it while you work, and sign a green commit off on GitHub so the hosted run can skip it.
section:
    title: The sdxc command
    order: 2
order: 8.5
lastUpdated: 2026-11-04
outcomes:
    - "Which script `sdxc ci` runs, and which workspaces a run covers"
    - "What each flag changes, and when a run signs a commit off"
    - "How to sign off later, check a signoff, and find a run's logs"
---

`sdxc ci` runs your project's CI script, the same script GitHub Actions runs, on your machine.
When every step passes on a clean tree, it marks the commit green on GitHub:

```bash
sdxc ci
```

It prints one line per step as it finishes, with a failed step's output under it, and exits 0
when every step passed and 1 when one failed. Writing the script itself is covered in
[Run CI on your machine](/docs/operations-and-testing/run-ci-locally).

## Where it runs

`sdxc ci` looks for the script from the current directory upward: the nearest project whose
`ci.script` file exists wins. That is `.config/sdxc/ci.ts` unless
[`.config/sdxc.jsonc`](/docs/sdxc/configuration) names another one. With no script at or above
the current directory, it exits 2 and names the default path.

Run it from a workspace below that project, such as one app in a monorepo, and the run keeps
that workspace's matrix entries and those of every workspace that depends on it, exactly as
`--scope` does:

```bash
cd apps/blog
sdxc ci
```

## Before the script

A local run starts with the package manager's frozen-lockfile install:
`bun install --frozen-lockfile`, `npm ci`, `pnpm install --frozen-lockfile` or
`yarn install --immutable`. A lockfile out of step with a `package.json` fails the run before
any step starts. Pass `--no-install` to start from the `node_modules` you have.

A remote run skips the install, since the CI host's workflow installs first. A run is remote
when the `CI` environment variable is set to anything but `0` or `false`, or with
`--runner remote`.

## Flags

- `--only <pattern>` and `--skip <pattern>` keep or leave out steps, groups and matrix entries
  by name. Repeat them to give several. `*` matches across `/`, and a matrix entry is
  `Matrix/key`: `--only "Workspaces/@acme/ui"`.
- `--scope <workspace>` keeps the matrix entries for a workspace, by path or name, and its
  dependents.
- `--since <ref>` keeps the matrix entries for workspaces changed since that ref (the range
  `<ref>...HEAD` plus uncommitted changes) and their dependents, and sets `ci.scope` the same
  way `--scope` does. A changed file outside every workspace (the root lockfile, root config,
  the CI script) covers every entry, and the run names that file.
- `--rerun-failed` runs only the steps the last recorded run failed.
- `--runner local|remote` runs as on your machine or as on a CI host.
- `--worktree` runs the script in a temporary detached worktree of HEAD, so a dirty checkout
  can still sign off; the worktree gets its own frozen install, and the shared step cache and
  run logs stay in the main clone.
- `--watch` re-runs when tracked files change; unchanged cached steps replay, a run in progress
  aborts for a newer change, and the command never signs off or pushes. Combining it with
  `--push` is a usage error.
- `--push` pushes the tested commit to its upstream branch after a green run, then signs off,
  and exits 1 when either fails.
- `--no-signoff` turns the script's `ci.signoff` into a plain success that posts nothing.
- `--no-cache` runs every step, including those whose inputs match an earlier pass.
- `--concurrency <n>` caps how many steps run at once; the machine's available parallelism by
  default.
- `--memory <size>` caps the RAM budget step `memory` reservations draw from (`2GB`, `512MB`);
  three quarters of total RAM by default.
- `--remote <name>` is the git remote to push to and read the GitHub repository from; the
  upstream's by default, else `origin`.
- `--token-env <NAME>` names the variable holding the GitHub token, `GITHUB_TOKEN` by default.
  When it is unset, `gh auth token` supplies one.
- `-v, --verbose` prints every step's log, passing steps included.
- `--json` prints the run's report as JSON, with the log folder in it.

```bash
sdxc ci --only Test
sdxc ci --skip "Workspaces/*" --no-cache
sdxc ci --since origin/main
sdxc ci --worktree --push
sdxc ci --watch
```

A run narrowed by `--only`, `--skip`, `--scope`, `--since` or `--rerun-failed` never signs off,
so a commit turns green only from a run of every step. A usage error, such as a filter that
matches nothing, exits 2.

## Sign off

When the script calls `ci.signoff` on a passing local run, `sdxc ci` posts an `sdxc/ci` commit
status on GitHub. It signs off only when the run:

- ran every step,
- started and ended with no uncommitted or untracked files,
- ended on the same commit it started on,
- tested a commit GitHub already has; `--push` pushes exactly that commit first.

A run that passes these guards but finds the commit missing on GitHub keeps a record of the
green run. Push the commit, then post that record without running the script again:

```bash
sdxc ci signoff
sdxc ci signoff 1d9090458
```

It signs off HEAD, or the commit you name, and exits 1 when no green run is recorded for it.

## Check a signoff

`sdxc ci verify` answers whether a contributor signed a commit off, which is what a hosted
workflow asks before it decides to skip its own run:

```bash
sdxc ci verify "$GITHUB_SHA" --wait 60s
```

It exits 0 when the commit has a successful `sdxc/ci` status from someone with write, maintain
or admin permission on the repository, 1 when it has none, and 2 when GitHub cannot be reached.
`--wait` polls until a signoff appears or the time passes (`30s`, `2m`, `500ms`), and
`--repo owner/name` names the repository when the git remote cannot.

## List the steps

`sdxc ci list` prints the steps and matrix entries a fully passing run takes, running none of
them. It takes the same `--only`, `--skip`, `--scope` and `--runner` filters. With `--matrix`,
it prints one matrix's entry keys, which is how a GitHub Actions workflow builds its job matrix:

```bash
sdxc ci list --runner remote --matrix Workspaces --json
```

```text
["@acme/ui","@acme/blog"]
```

## Logs and cache

Every run keeps each step's full log in the repository's git directory, under
`sdxc-ci/runs/`, and prints that run's folder as its last line. The last 20 runs stay, and
`--rerun-failed` reads the most recent one. Cached step passes live beside them, and a pass no
run has reused in 30 days is pruned.

To start both over, remove them:

```bash
sdxc ci clean
```

Recorded green runs stay, so `sdxc ci signoff` still works for them.

## Where to go next

- [Run CI on your machine](/docs/operations-and-testing/run-ci-locally) — write the script's
  steps, parallel groups and workspace matrix, and set up the workflow that skips signed-off
  commits.
- [Check a project](/docs/sdxc/check-a-project) — what `sdxc doctor` checks in the script's
  Doctor step.
- [Deploy](/docs/sdxc/deploy) — ship the commit you just signed off.
- [Configuration](/docs/sdxc/configuration) — point `ci.script` at another file.
