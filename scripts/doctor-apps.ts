#!/usr/bin/env bun
/**
 * Back-compat entry for `bun scripts/doctor-apps.ts`: forwards to the monorepo CLI's `doctor`
 * command. Prefer `bun run doctor` or `bun run cli doctor` (ADR-169).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { REPO_ROOT } from "./release/workspace.js";

let ran = spawnSync("bun", [join(REPO_ROOT, "cli/index.ts"), "doctor", ...process.argv.slice(2)], {
	cwd: REPO_ROOT,
	stdio: "inherit",
});
process.exitCode = ran.status === null ? 1 : ran.status;
