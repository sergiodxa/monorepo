/**
 * The `pins` check: every `@sdxc/*` pin in `package.json` is the package's version at the
 * project's release, read from the npm registry the way `sdxc upgrade` resolves one, since a
 * daily release republishes only what changed and an older date alone is no drift.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { compare } from "@sdxc/semver";

import type { Packument } from "../releases.js";

import { datedPin, versionAtRelease } from "../releases.js";
import { currentRelease, listedScopedPackages } from "../upgrade/project.js";
import { RELEASE_PACKAGE } from "../upgrade/registry.js";

import type { Check, CheckResult } from "./check.js";

import { passed, rangeOf, skipped } from "./check.js";
import { exactInstallCommand } from "./install.js";

/**
 * Fails on a pin older than the package's version at the project's release, and warns on a pin
 * that names no dated version; the fix pins each one to its version at the release.
 */
export const pinsCheck: Check = {
	name: "pins",
	async run(context): Promise<CheckResult> {
		let scoped = listedScopedPackages(context.manifest);
		if (scoped.length === 0) return skipped("package.json lists no @sdxc package");
		let release = currentRelease(context.manifest);
		if (release === null) return skipped("package.json pins no @sdxc package to a release");
		let fetched = await Promise.all(
			[RELEASE_PACKAGE, ...scoped].map((name) => context.packument(name)),
		);
		let packuments = new Map<string, Packument>();
		for (let packument of fetched) {
			if (isFailure(packument)) return skipped(packument.error.message);
			packuments.set(packument.data.name, packument.data);
		}
		let latest = packuments.get(RELEASE_PACKAGE)?.latest ?? null;
		let upgradeTo = latest !== null && compare(latest, release) > 0 ? latest : null;

		let findings: string[] = [];
		let versions = new Map<string, string>();
		let lagging = 0;
		for (let name of scoped) {
			let packument = packuments.get(name);
			let expected = packument === undefined ? null : versionAtRelease(packument, release);
			if (packument === undefined || expected === null) continue;
			let range = rangeOf(context.manifest, name);
			let pinned = datedPin(range);
			if (pinned !== null && compare(pinned, expected) >= 0) continue;
			if (pinned !== null) lagging += 1;
			let next = upgradeTo === null ? null : versionAtRelease(packument, upgradeTo);
			let upgrade = next === null ? "" : ` (sdxc upgrade moves it to ${next})`;
			findings.push(`${name} ${range} -> ${expected}${upgrade}`);
			versions.set(name, expected);
		}
		if (findings.length === 0) {
			let newer = upgradeTo === null ? "" : `; sdxc upgrade moves them to ${upgradeTo}`;
			return passed(`Every @sdxc package is at release ${release}${newer}`);
		}
		let fix = exactInstallCommand(context.manager, context.manifest, versions);
		if (lagging === 0) {
			return {
				status: "warn",
				message: `${count(findings.length)} not pinned to a release`,
				findings,
				fix,
			};
		}
		return {
			status: "fail",
			message: `${count(findings.length)} behind release ${release}`,
			findings,
			fix,
		};
	},
};

/** `1 @sdxc package is` or `2 @sdxc packages are`. */
function count(total: number): string {
	return total === 1 ? "1 @sdxc package is" : `${total} @sdxc packages are`;
}
