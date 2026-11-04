---
name: sdxc-ci
description: Run this monorepo's CI locally with `sdxc ci` (the script in .config/sdxc/ci.ts) while you work, narrowed to the workspaces your change touches, and sign a commit off before pushing it so GitHub Actions skips its own run. Use after changing code in an app or package, before committing or pushing, when the user asks to run CI, push, or sign a commit off, and when a CI run failed and you need to find out why.
---

# sdxc ci

`sdxc ci` runs `.config/sdxc/ci.ts`, the same script GitHub Actions runs: typegen, then doctor,
`bun check` and the commit-body check in parallel, then one test entry per workspace. A green
run of every step on a clean tree posts an `sdxc/ci` commit status, and the hosted workflow
skips a commit that carries one. `bun run ci` is the same command where `sdxc` is not on PATH.

## While you work: run only what you touched

Run it from the workspace you changed. The run keeps that workspace's test entry and the
entries of every workspace that depends on it, so a package change also tests its dependents:

```sh
cd packages/jwt && sdxc ci        # jwt plus every workspace that depends on it
cd apps/blog && sdxc ci           # blog alone
```

From the root, the same narrowing takes flags, repeatable and combinable:

```sh
sdxc ci --scope packages/jwt --scope apps/blog
sdxc ci --since origin/main        # workspaces your commits (and dirty files) changed
sdxc ci --only "Tests/apps/blog"   # one matrix entry; * spans /
sdxc ci --skip Tests               # the static checks only
sdxc ci list --scope packages/jwt  # what a run would take, running nothing
sdxc ci --watch                    # re-run when files change; cached steps replay
```

`--since` diffs `<ref>...HEAD` plus uncommitted changes, maps each file to its workspace, and
widens to dependents exactly like `--scope`. A changed file outside every workspace (the root
`package.json`, the lockfile, root config, `.config/sdxc/ci.ts`) falls back to every entry and
names that file. A scoped or `--since` run also narrows typegen and doctor to the scoped apps;
Check uses `vp check <paths>` for those workspaces. Unchanged steps replay from the cache.

After a red run, fix it and run only what failed:

```sh
sdxc ci --rerun-failed
```

A cold full run takes about ten minutes. Start a full or scoped run in the background and wait
for it to finish, never poll it. Read a failed step's output under its line; every step's full
log is in the folder the run prints last (`.git/sdxc-ci/runs/<id>/logs/`).

## Before pushing: sign the commit off

Sign off only when the user asked you to push. A narrowed run (`--only`, `--skip`, `--scope`,
`--since`, `--rerun-failed`, `--watch`) never signs off, so run the whole script from the
repository root. Other sessions share this checkout; use a clean worktree of HEAD:

```sh
sdxc ci --worktree --push
```

`--worktree` creates a temporary detached worktree at its canonical path (on macOS
`/private/var/…`, the path Vitest resolves), installs with a frozen lockfile there
(workspace package links must point at the worktree — a symlink of the main `node_modules`
would test the dirty checkout), runs the script, signs off, and removes the worktree even on
failure or Ctrl-C. The shared step cache and run logs stay in the main clone. `--push` pushes
the tested SHA as usual.

On a green run it pushes exactly the tested commit to its upstream, then posts the signoff. It
signs off only when the run ran every step, the tree had no uncommitted or untracked files at
its start and end, and HEAD stayed on one commit throughout. So:

- Commit first. With `--worktree`, other sessions' dirty files in the main checkout no longer
  block the signoff.
- When the push is rejected because `main` moved, `git pull --rebase`, then run
  `sdxc ci --worktree --push` again: the signoff belongs to the commit that was tested.
- A green run whose commit GitHub does not have yet records it; after pushing, post that record
  with `sdxc ci signoff` and skip a second run.

The token comes from `GITHUB_TOKEN`, or `gh auth token`.

## Reading a failure

- Exit 1 is a failed step; exit 2 is a usage error, such as a filter that matches nothing or
  `--watch` combined with `--push`.
- Locally each test entry runs Vitest with `--maxWorkers=2` and holds two of the run's
  concurrency slots (`LOCAL_TEST_WORKERS` in the script), so `--concurrency` — the core count by
  default — keeps about one test worker per core. On a CI host each entry has its own machine
  and keeps Vitest's default.
- A test that times out only under a full run's load is load, not your change: rerun that entry
  alone with `--only "Tests/<workspace>"` before you change code for it. A run on a busy machine
  (another session's run, a build) takes `--concurrency` lower. Browser suites reserve `2GB` of
  the run's memory budget so they share the machine with fewer peers.
- When a cached pass looks wrong, `--no-cache` runs every step fresh.

`sdxc ci verify <sha>` answers whether a commit is signed off (exit 0 yes, 1 no), and
`sdxc ci clean` empties the step cache and run history when a cached pass looks wrong.
