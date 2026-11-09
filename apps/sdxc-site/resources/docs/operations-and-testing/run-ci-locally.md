---
title: Run CI on your machine
description: Write your app's CI as a TypeScript script, run it with sdxc ci before you push, and let GitHub Actions skip its own run for a commit you already signed off.
section:
    title: Testing & monitoring
    order: 9
order: 6
lastUpdated: 2026-11-04
outcomes:
    - "How to write a CI script with steps, parallel groups and a matrix over workspaces"
    - "How `sdxc ci --push` tests, pushes and signs a commit off in one go"
    - "How the GitHub workflow skips its run for a commit a contributor signed off"
---

`sdxc create` starts every app with `.config/sdxc/ci.ts`, a CI script that runs on your machine
and on GitHub Actions alike. Run it before you push: when it passes, it marks the commit green
on GitHub, and the workflow skips its own run.

## Run it

```bash
sdxc ci
```

It prints one line per step, with a failed step's output under it, and exits 1 when a step
failed. While you work, narrow it with `--since origin/main` or `--only`, re-run on save with
`--watch`, or run just what failed with `--rerun-failed`. When other sessions leave the tree
dirty, `sdxc ci --worktree --push` signs off from a clean worktree of HEAD.
[Run CI](/docs/sdxc/run-ci) covers every flag and where the logs go.

## Write steps

The script is a function that receives `ci`. `await` runs steps one after another, and
`ci.parallel` runs a group at once:

```typescript
import { defineCI } from "@sdxc/ci";

export default defineCI(async (ci) => {
	await ci.step("Install browsers", "bunx playwright install chromium", {
		halt: true,
	});

	await ci.parallel("Checks", [
		() => ci.step("Doctor", "bunx sdxc doctor"),
		() => ci.step("Format, lint and types", "bun run check"),
	]);

	await ci.step("Test", "bun run test", { cache: true });

	if (ci.status === "passing") await ci.signoff("All systems go.");
	else
		ci.failure(
			"CI failed. Do not push.",
			"Fix the steps above and run `sdxc ci` again.",
		);
});
```

- A failed step leaves the run going, so you see every failure in one pass. Add `halt: true`
  when nothing after the step can succeed without it.
- `cache: true` skips a step whose inputs haven't changed since it last passed. The step's
  output from that earlier pass is kept.
- `retry: 1` runs a failed step once more; a pass on the retry is listed as flaky in the
  summary. `weight: 4` lets a heavy step hold four of the run's concurrency slots.
  `memory: "2GB"` reserves that much of the run's memory budget so a browser suite leaves room
  for fewer peers; a reservation above the budget runs alone.
- `ci.scope` lists the workspaces a `--scope` or `--since` run covers, so the script can narrow
  typegen and doctor to those apps while a full run stays unchanged.
- `ci.runner` is `"remote"` on GitHub Actions and `"local"` on your machine. Use it for steps
  that belong in only one place, such as copying `.env.example` to `.dev.vars` on CI.

## Test every workspace

In a monorepo, `ci.matrix` runs one entry per workspace, each with its own steps and status:

```typescript
let tested = (await ci.workspaces()).filter((ws) => ws.has("**/*.test.ts"));

await ci.matrix("Workspaces", tested, async (ws) => {
	await ci.step(`Tests for ${ws.name}`, "bun run test", {
		cwd: ws.path,
		cache: true,
	});
});
```

Run `sdxc ci` from inside a workspace and only that workspace's entry runs, plus every
workspace that depends on it.

## Sign off and push

```bash
sdxc ci --push
```

When every step passes on a clean tree, it pushes exactly the tested commit and posts an
`sdxc/ci` commit status on GitHub. A narrowed run never signs off;
[Run CI](/docs/sdxc/run-ci#sign-off) lists every condition.

## Skip the hosted run

The workflow `sdxc create` writes, `.github/workflows/ci.yml`, starts with a gate job:

```bash
bunx sdxc ci verify "$SHA" --wait 60s
```

It exits 0 when someone with write access to the repository signed the commit off, and the
workflow then skips its CI job. Every other commit runs the full script on GitHub Actions with
`sdxc ci --runner remote`.

## Where to go next

- [Test your app](/docs/operations-and-testing/test-your-app) — the tests `bun run test` runs in
  the script's Test step.
- [Check a project](/docs/sdxc/check-a-project) — what the Doctor step checks.
- [Deploy](/docs/sdxc/deploy) — ship the commit you just signed off.
