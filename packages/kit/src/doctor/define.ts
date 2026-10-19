/**
 * The API a project writes its own `sdxc doctor` checks against. A check module in the
 * `doctor.checks` folder default-exports one check, or a list of them, and `sdxc doctor` runs
 * each beside the built-in ones with a read-only view of the project.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Config } from "../config.js";
import type { RouteEntry } from "../routes/index.js";

import type { CheckStatus } from "./check.js";

export type { CheckStatus } from "./check.js";

/** What a project check answers; only `fail` makes `sdxc doctor` exit 1. */
export interface ProjectCheckResult {
	status: CheckStatus;
	/** One sentence summing up what the check found, or why it was skipped. */
	message: string;
	/** Each file, route or value the check flagged, printed after the message. */
	findings?: string[];
	/** The command or edit that clears a warning or failure. */
	fix?: string | null;
}

/**
 * The project as a check sees it. Every path is relative to the project root, and a path that
 * leads outside it throws, which reports the check as failed.
 */
export interface ProjectCheckContext {
	/** The project root, absolute. */
	root: string;
	/** `package.json`, parsed as written. */
	manifest: Record<string, unknown>;
	/** `.config/sdxc.jsonc`, with every default filled in. */
	config: Config;
	/** Every route and what maps it, as `sdxc routes --json` prints them. */
	routes: RouteEntry[];
	/** A file's text, or `null` when it does not exist. */
	readFile(path: string): Promise<string | null>;
	exists(path: string): Promise<boolean>;
	/**
	 * Every file under `folder`, recursively and sorted, relative to the project root;
	 * `node_modules` and dot-files are left out, and a missing folder lists nothing.
	 */
	files(folder: string): Promise<string[]>;
}

/** A check a project adds to `sdxc doctor`. */
export interface ProjectCheck {
	/**
	 * The check's name in the report and for `--only` and `--skip`: lowercase words joined by
	 * dashes, distinct from every built-in check and every other project check.
	 */
	name: string;
	run(context: ProjectCheckContext): ProjectCheckResult | Promise<ProjectCheckResult>;
}

/**
 * Types a project check, so `run` gets its context and result checked by the editor.
 *
 * @example export default defineCheck({ name: "readme", async run(ctx) { return (await ctx.exists("README.md")) ? { status: "pass", message: "README.md exists" } : { status: "warn", message: "No README.md", fix: "touch README.md" }; } });
 */
export function defineCheck(check: ProjectCheck): ProjectCheck {
	return check;
}
