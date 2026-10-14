/**
 * Reads the workspace manifests the landing page describes. Names and descriptions
 * come from the manifests themselves, inlined into the bundle by `import.meta.glob`,
 * so the page cannot disagree with what is published: a description edited in a
 * manifest is the description the site shows on the next deploy.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { APPLICATIONS } from "~/resources/content/apps";
import { OTHER_GROUP, PACKAGE_GROUPS } from "~/resources/content/groups";

/** The manifest fields the site reads; everything else in the file is ignored. */
interface Manifest {
	name?: string;
	description?: string;
	license?: string;
	private?: boolean;
	dependencies?: Record<string, string>;
	exports?: Record<string, unknown> | string;
}

const manifests = import.meta.glob<Manifest>("../../../../packages/*/package.json", {
	eager: true,
	import: "default",
});

/**
 * The applications whose dependency lists a package page may quote. The patterns are
 * written out one by one because the glob is what decides which apps the bundle
 * carries, and a wildcard over `apps/*` would quietly widen the claim.
 */
const applicationManifests = import.meta.glob<Manifest>(
	[
		"../../../auth-saas/package.json",
		"../../../blog/package.json",
		"../../../books/package.json",
		"../../../reader/package.json",
		"../../../uptime/package.json",
	],
	{ eager: true, import: "default" },
);

/**
 * Each package's own README, loaded lazily: the corpus runs to well over a megabyte
 * of text, and a page that renders one of them has no use for the other fifty-nine.
 */
const readmes = import.meta.glob<string>("../../../../packages/*/README.md", {
	query: "?raw",
	import: "default",
});

/** One package as the page draws it. */
export interface PackageEntry {
	/** The workspace directory, which is also the name's last segment. */
	directory: string;
	/** The published name, as it is installed. */
	name: string;
	description: string;
	/** The licence it is published under, as the manifest names it. */
	license: string | null;
	/** Whether the package pulls in nothing from outside the collection. */
	standalone: boolean;
	/** Whether the package depends on no framework. */
	frameworkFree: boolean;
	/** The subpaths it publishes, `.` first, as they are written in an import. */
	subpaths: string[];
	/** Directories of the packages in this collection it installs alongside itself. */
	internalDependencies: string[];
	/** Names of the releases outside this collection it installs alongside itself. */
	externalDependencies: string[];
}

/** A titled run of packages, as the landing page lists them. */
export interface PackageGroup {
	title: string;
	packages: PackageEntry[];
}

/** Totals the landing copy states, so a sentence about the collection counts it. */
export interface PackageFacts {
	published: number;
	/** Published packages whose dependencies are all inside the collection. */
	standalone: number;
	/** Published packages that depend on no framework. */
	frameworkFree: number;
	/** How many target Remix directly, which is the framework these are written for. */
	remixTargeted: number;
}

/**
 * Whether a dependency name belongs to the collection itself, which is what makes a
 * package "no dependencies" to someone installing it: an internal one arrives as part
 * of the same set rather than as a third party's release schedule.
 */
function isInternal(dependency: string): boolean {
	return dependency.startsWith("@sdxc/");
}

/** Whether a dependency name is the framework the site says most packages avoid. */
function isFramework(dependency: string): boolean {
	return dependency === "remix" || dependency.startsWith("@remix-run/");
}

/** The workspace directory a name inside the collection belongs to. */
function toDirectory(name: string): string {
	return name.slice("@sdxc/".length);
}

/**
 * The subpaths a manifest publishes, written as they appear after the package name.
 * The root comes first because it is what a reader installs and imports before
 * anything else; the rest keep the order the manifest declares them in, which is the
 * order their author grouped them. A wildcard sitting under a subpath that is itself
 * exported is left out, since it says only that the family has members — which is
 * what the family's own page is for, and what thirty of them in a row obscures.
 */
function readSubpaths(manifest: Manifest): string[] {
	if (typeof manifest.exports !== "object" || manifest.exports === null) return ["."];

	let keys = Object.keys(manifest.exports);
	let named = new Set(keys);
	let listed = keys.filter((key) => !key.endsWith("/*") || !named.has(key.slice(0, -2)));

	return listed.includes(".") ? [".", ...listed.filter((key) => key !== ".")] : listed;
}

/**
 * Every published package, read fresh so the manifests are walked per request rather
 * than in the worker's global scope, where the upload validator rejects the work.
 */
function readPublished(): PackageEntry[] {
	let entries: PackageEntry[] = [];

	for (let [path, manifest] of Object.entries(manifests)) {
		if (manifest.private === true) continue;
		if (!manifest.name || !manifest.description) continue;

		let directory = path.split("/").at(-2);
		if (!directory) continue;

		let dependencies = Object.keys(manifest.dependencies ?? {});

		entries.push({
			directory,
			name: manifest.name,
			description: manifest.description,
			license: manifest.license ?? null,
			standalone: dependencies.every(isInternal),
			frameworkFree: !dependencies.some(isFramework),
			subpaths: readSubpaths(manifest),
			internalDependencies: dependencies.filter(isInternal).map(toDirectory).sort(),
			externalDependencies: dependencies.filter((name) => !isInternal(name)).sort(),
		});
	}

	return entries;
}

/**
 * The published packages under the landing page's taxonomy. A group with no member
 * left is dropped, and anything the taxonomy misses lands in a trailing group, so the
 * page lists every package whether or not the taxonomy was updated with it.
 */
export function listPackageGroups(): PackageGroup[] {
	let remaining = new Map(readPublished().map((entry) => [entry.directory, entry]));
	let groups: PackageGroup[] = [];

	for (let definition of PACKAGE_GROUPS) {
		let packages: PackageEntry[] = [];

		for (let directory of definition.packages) {
			let entry = remaining.get(directory);
			if (!entry) continue;
			remaining.delete(directory);
			packages.push(entry);
		}

		if (packages.length > 0) groups.push({ title: definition.title, packages });
	}

	let ungrouped = Array.from(remaining.values()).sort((a, b) =>
		a.directory.localeCompare(b.directory),
	);
	if (ungrouped.length > 0) groups.push({ title: OTHER_GROUP, packages: ungrouped });

	return groups;
}

/** The counts the landing copy quotes, counted rather than written down. */
export function readPackageFacts(): PackageFacts {
	let published = readPublished();

	return {
		published: published.length,
		standalone: published.filter((entry) => entry.standalone).length,
		frameworkFree: published.filter((entry) => entry.frameworkFree).length,
		remixTargeted: published.filter((entry) => !entry.frameworkFree).length,
	};
}

/** One published package, or `null` when no directory answers to that name. */
export function findPackage(directory: string): PackageEntry | null {
	return readPublished().find((entry) => entry.directory === directory) ?? null;
}

/** Every published package, in the order a reader scans an alphabetical list. */
export function listPackages(): PackageEntry[] {
	return readPublished().sort((a, b) => a.directory.localeCompare(b.directory));
}

/** The README of one package, or `null` when the directory publishes none. */
export async function readPackageReadme(directory: string): Promise<string | null> {
	let load = readmes[`../../../../packages/${directory}/README.md`];
	if (!load) return null;
	return await load();
}

/**
 * The applications that install a package, named the way the site names them. The
 * list is the curated one, so a page claiming five users and a site listing five
 * applications agree; a workspace outside it never appears here.
 */
export function listApplicationsUsing(name: string): string[] {
	let users: string[] = [];

	for (let application of APPLICATIONS) {
		let manifest = applicationManifests[`../../../${application.directory}/package.json`];
		if (!manifest?.dependencies) continue;
		if (name in manifest.dependencies) users.push(application.title);
	}

	return users;
}

/**
 * How many packages from this collection an application installs, read from its own
 * manifest so the showcase quotes a number a reader can check against the same file.
 *
 * @param directory - The application's workspace directory.
 * @returns Its count of `@sdxc/*` dependencies; zero for a directory outside the
 * curated set, which is the set the site is willing to speak about.
 */
export function countApplicationPackages(directory: string): number {
	let manifest = applicationManifests[`../../../${directory}/package.json`];
	if (!manifest?.dependencies) return 0;
	return Object.keys(manifest.dependencies).filter(isInternal).length;
}
