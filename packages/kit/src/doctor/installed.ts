/**
 * The `installed` check: every `@sdxc/*` package and `remix` that `package.json` lists is in
 * `node_modules` at the version it pins, found the way Node resolves it from the project root,
 * so a hoisted workspace install counts and a `package.json` edited without an install does not.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { isFailure, isSuccess, wrap } from "@sdxc/result";
import { parse } from "@sdxc/semver";

import { datedPin } from "../releases.js";
import { listedScopedPackages, lists } from "../upgrade/project.js";

import type { Check, CheckResult } from "./check.js";

import { passed, rangeOf, skipped } from "./check.js";

/** Fails on a listed package that is missing or installed at another version than its pin. */
export const installedCheck: Check = {
	name: "installed",
	async run(context): Promise<CheckResult> {
		let names = listedScopedPackages(context.manifest);
		if (lists(context.manifest, "remix")) names.push("remix");
		if (names.length === 0) return skipped("package.json lists no @sdxc package or remix");
		let findings: string[] = [];
		for (let name of names) {
			let range = rangeOf(context.manifest, name);
			let installed = await installedVersion(context.root, name);
			if (installed === null) {
				findings.push(`${name} is not installed`);
				continue;
			}
			let pinned = exactVersion(range);
			if (pinned !== null && pinned !== installed) {
				findings.push(`${name} ${installed} is installed, package.json pins ${pinned}`);
			}
		}
		if (findings.length === 0) {
			return passed(`${names.length} packages are installed at the versions package.json pins`);
		}
		return {
			status: "fail",
			message: "node_modules differs from package.json",
			findings,
			fix: context.manager.install.join(" "),
		};
	},
};

/**
 * The exact version a range pins, `null` for a range that admits several, which any installed
 * version satisfies as far as this check is concerned.
 */
function exactVersion(range: string): string | null {
	let dated = datedPin(range);
	if (dated !== null) return dated;
	let bare = range.trim().replace(/^=?v?/, "");
	return isSuccess(parse(bare)) ? bare : null;
}

/**
 * The version of `name` installed in the nearest `node_modules` at or above `root`, or `null`
 * when no directory up to the filesystem root holds it.
 */
async function installedVersion(root: string, name: string): Promise<string | null> {
	let directory = root;
	while (true) {
		let text = await wrap(() =>
			readFile(join(directory, "node_modules", name, "package.json"), "utf8"),
		);
		if (isSuccess(text)) {
			let manifest = wrap(() => JSON.parse(text.data) as { version?: unknown });
			if (isFailure(manifest)) return null;
			return typeof manifest.data.version === "string" ? manifest.data.version : null;
		}
		let parent = dirname(directory);
		if (parent === directory) return null;
		directory = parent;
	}
}
