/**
 * Pure release planning: the dated version, what counts as a package's first release, which
 * public packages a run ships and why, and the exact versions their internal pins take.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { Package } from "./workspace.js";

import { closeOverDependents, topologicalOrder } from "./workspace.js";

/**
 * The package carrying each release's changelog and component registry. It joins every release
 * that ships anything, so those files always describe the release they ship in.
 */
export const HISTORY_PACKAGE = "@sdxc/kit";

/** The placeholder the bootstrap script publishes so a trusted publisher can be configured. */
const BOOTSTRAP_VERSION = /^0\.0\.0-pre\.\d+$/;

/** What npm knows about a package's latest version; `gitHead` is missing when npm never stamped it. */
export interface Published {
	version: string;
	gitHead: string | null;
}

/**
 * Why a package is in a release: `new` for its first dated version, `changed` when a commit
 * touched what it ships, `dependency` when only an internal pin moves, `history` when only the
 * release's changelog and registry it carries move. In precedence order.
 */
export type MemberReason = "new" | "changed" | "dependency" | "history";

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
 * plus {@link HISTORY_PACKAGE} whenever any ships, closed over their public dependents through
 * runtime dependencies so every internal pin can move to `version`, ordered dependencies first.
 * A dependency cycle among them is the failure.
 */
export function planRelease({
	packages,
	touched,
	published,
	force,
	version,
}: PlanInput): Result<ReleasePlan, Error> {
	let seeds = packages
		.filter(
			(pkg) =>
				!pkg.isPrivate &&
				(force || touched.has(pkg.name) || isNew(latestVersion(published, pkg.name))),
		)
		.map((pkg) => pkg.name);
	let reached = closeOverDependents(seeds, packages);
	let carrier = packages.find((pkg) => pkg.name === HISTORY_PACKAGE && !pkg.isPrivate);
	let closed =
		reached.size > 0 && carrier !== undefined && !reached.has(carrier.name)
			? closeOverDependents([...reached, carrier.name], packages)
			: reached;
	let order = topologicalOrder(closed, packages);
	if (isFailure(order)) return order;
	let members = order.data.map((name) => ({
		name,
		reason:
			name === HISTORY_PACKAGE && !reached.has(name)
				? ("history" as const)
				: reasonFor(name, touched, published, force),
	}));
	return success({ version, members, order: order.data });
}

/**
 * Exact versions for `pkg`'s internal dependencies: `version` for fellow members, the latest
 * npm version otherwise. A dependency that is neither is a failure, since no installable pin
 * exists for it.
 */
export function dependencyPins(
	pkg: Package,
	members: string[],
	version: string,
	published: Map<string, Published | null>,
): Result<Record<string, string>, Error> {
	let pins: Record<string, string> = {};
	for (let dependency of pkg.dependencies) {
		if (members.includes(dependency)) {
			pins[dependency] = version;
			continue;
		}
		let current = published.get(dependency);
		if (current === undefined || current === null) {
			return failure(
				new Error(
					`${pkg.name} depends on ${dependency}, which is neither in this release nor published on npm`,
				),
			);
		}
		pins[dependency] = current.version;
	}
	return success(pins);
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
