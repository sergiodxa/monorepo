/**
 * Every Worker app under `apps/` that has a `package.json`, as the monorepo CLI and CI use to
 * fan out doctor (and later other per-app commands) without hard-coding the list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { REPO_ROOT } from "../scripts/release/workspace.js";

/**
 * Paths relative to the repo root (`apps/<name>`), in name order, for every directory under
 * `apps/` that holds a `package.json`.
 */
export function listApps(root: string = REPO_ROOT): string[] {
	return readdirSync(join(root, "apps"), { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => `apps/${entry.name}`)
		.filter((dir) => existsSync(join(root, dir, "package.json")))
		.sort();
}
