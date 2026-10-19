#!/usr/bin/env bun
/**
 * `bun run doctor`: runs `sdxc doctor` from the workspace's kit in every app under `apps/`, each
 * from its own directory, the way CI does, and exits 1 when any app fails. Extra arguments go to
 * every run, so `bun run doctor --only migrations` narrows all of them alike.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { REPO_ROOT } from "./release/workspace.js";

/** The kit's command line in this checkout, so the run checks against the kit being changed. */
const KIT_BIN = join(REPO_ROOT, "packages/kit/src/bin.ts");

/** GitHub Actions folds each app's report under a collapsible group in the job log. */
const IN_ACTIONS = process.env.GITHUB_ACTIONS === "true";

/** Every directory under `apps/` with a `package.json`, in name order. */
function apps(): string[] {
	return readdirSync(join(REPO_ROOT, "apps"), { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => `apps/${entry.name}`)
		.filter((dir) => existsSync(join(REPO_ROOT, dir, "package.json")))
		.sort();
}

/**
 * Runs doctor in each app, its report folded under the app's name, and answers the apps whose
 * run exited non-zero; every app runs, so one failure leaves the others' reports in the log.
 */
function runAll(args: string[]): string[] {
	let failed: string[] = [];
	for (let app of apps()) {
		process.stdout.write(IN_ACTIONS ? `::group::${app}\n` : `\n== ${app}\n`);
		let ran = spawnSync("bun", [KIT_BIN, "doctor", ...args], {
			cwd: join(REPO_ROOT, app),
			stdio: "inherit",
		});
		if (IN_ACTIONS) process.stdout.write("::endgroup::\n");
		if (ran.status === 0) continue;
		failed.push(app);
		if (IN_ACTIONS) process.stdout.write(`::error title=sdxc doctor::${app} failed sdxc doctor\n`);
	}
	return failed;
}

const FAILED = runAll(process.argv.slice(2));
if (FAILED.length > 0) {
	process.stderr.write(`\nsdxc doctor failed in ${FAILED.join(", ")}\n`);
	process.exitCode = 1;
}
