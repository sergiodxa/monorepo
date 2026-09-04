/**
 * Pure release planning: the dated version, what counts as a package's first release, which
 * public packages a run ships and why, and the exact versions their internal pins take.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Package } from "./workspace.js";

import { closeOverDependents, topologicalOrder } from "./workspace.js";

/** The placeholder the bootstrap script publishes so a trusted publisher can be configured. */
const BOOTSTRAP_VERSION = /^0\.0\.0-pre\.\d+$/;

/** What npm knows about a package's latest version; `gitHead` is missing when npm never stamped it. */
export interface Published {
	version: string;
	gitHead: string | null;
}

/**
 * Why a package is in a release: `new` for its first dated version, `changed` when a commit
 * touched what it ships, `dependency` when only an internal pin moves. In precedence order.
 */
export type MemberReason = "new" | "changed" | "dependency";

export interface Member {
	name: string;
	reason: MemberReason;
}

export interface PlanInput {
	packages: Package[];
	touched: Set<string>;
	published: Map<string, Published | null>;
	force: boolean;
	version: string;
}

/** The release to perform: `order` lists the members dependencies first, and `members` follows it. */
export interface ReleasePlan {
	version: string;
	members: Member[];
	order: string[];
}

/** The version for a run: `YYYY.M.D` from the UTC date, valid SemVer, one number per day. */
export function releaseVersion(date: Date): string {
	return `${date.getUTCFullYear()}.${date.getUTCMonth() + 1}.${date.getUTCDate()}`;
}

/** Whether a version is the bootstrap placeholder rather than a dated release. */
export function isBootstrapVersion(version: string): boolean {
	return BOOTSTRAP_VERSION.test(version);
}

/** Whether a package still awaits its first dated release: nothing on npm, or only the placeholder. */
export function isNew(latest: string | null): boolean {
	return latest === null || isBootstrapVersion(latest);
}

/**
 * The public packages to release: the touched and new ones (every public one under `force`),
 * closed over their public dependents through runtime dependencies so every internal pin can
 * move to `version`, ordered dependencies first.
 */
export function planRelease({
	packages,
	touched,
	published,
	force,
	version,
}: PlanInput): ReleasePlan {
	let seeds = packages
		.filter(
			(pkg) =>
				!pkg.isPrivate &&
				(force || touched.has(pkg.name) || isNew(latestVersion(published, pkg.name))),
		)
		.map((pkg) => pkg.name);
	let order = topologicalOrder(closeOverDependents(seeds, packages), packages);
	let members = order.map((name) => ({ name, reason: reasonFor(name, touched, published, force) }));
	return { version, members, order };
}

/**
 * Exact versions for `pkg`'s internal dependencies: `version` for fellow members, the latest
 * npm version otherwise. Throws when a dependency is neither, since no installable pin exists.
 */
export function dependencyPins(
	pkg: Package,
	members: string[],
	version: string,
	published: Map<string, Published | null>,
): Record<string, string> {
	let pins: Record<string, string> = {};
	for (let dependency of pkg.dependencies) {
		if (members.includes(dependency)) {
			pins[dependency] = version;
			continue;
		}
		let current = published.get(dependency);
		if (current === undefined || current === null) {
			throw new Error(
				`${pkg.name} depends on ${dependency}, which is neither in this release nor published on npm`,
			);
		}
		pins[dependency] = current.version;
	}
	return pins;
}

function reasonFor(
	name: string,
	touched: Set<string>,
	published: Map<string, Published | null>,
	force: boolean,
): MemberReason {
	if (isNew(latestVersion(published, name))) return "new";
	if (force || touched.has(name)) return "changed";
	return "dependency";
}

function latestVersion(published: Map<string, Published | null>, name: string): string | null {
	return published.get(name)?.version ?? null;
}
