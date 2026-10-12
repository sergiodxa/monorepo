/**
 * Turns a week of GitHub releases into the packages the weekly releases post lists: which
 * packages a release actually changed, deduplicated across releases and repositories, each
 * with the page the post links it to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { GitHubRelease } from "~/app/services/releases/github";
import type { ReleaseSource } from "~/config/releases";

/** A package heading in a monorepo release body, such as `## @sdxc/result`. */
const PACKAGE_HEADING = /^##\s+(\S+)\s*$/;

/**
 * The only line of a section for a package that republished with no change of its own,
 * pinned to a new version of a dependency that did change.
 */
const REPUBLISHED = /^Republished because\b/;

/** The link to the full diff the release closes with, which belongs to no package. */
const COMPARE_FOOTER = /^Compare:\s+https?:\/\/\S+$/;

/** A package the post lists, linked to where a reader installs or reads about it. */
export interface ReleasedPackage {
	name: string;
	url: string;
}

/** What the weekly releases post is written from. */
export interface WeeklyReleaseSummary {
	/** The post's permalink segment, `<ISO year>-w<ISO week>`. */
	slug: string;
	/** Every package released during the week, sorted by name. */
	packages: ReleasedPackage[];
}

/**
 * The packages one monorepo release body announces with a change of their own. A section
 * whose only content is a "Republished because …" line is a version bump forced by a
 * dependency and is left out; headings outside `scope` are ignored.
 *
 * @param body The release notes as Markdown.
 * @param scope The npm scope, with its `@`, the repository publishes under.
 * @returns The package names in the order the body lists them.
 */
export function changedPackages(body: string, scope: string): string[] {
	let names: string[] = [];
	let current: { name: string; changed: boolean } | null = null;

	for (let line of body.split(/\r?\n/)) {
		let heading = PACKAGE_HEADING.exec(line);

		if (heading) {
			if (current?.changed) names.push(current.name);
			let name = heading[1] ?? "";
			current = name.startsWith(`${scope}/`) ? { name, changed: false } : null;
			continue;
		}

		if (current === null || current.changed) continue;

		let text = line.trim();
		if (text === "" || REPUBLISHED.test(text) || COMPARE_FOOTER.test(text)) continue;
		current.changed = true;
	}

	if (current?.changed) names.push(current.name);
	return names;
}

/**
 * The packages a set of releases shipped, each listed once however many releases or
 * repositories name it, sorted by name in code-point order so a rerun over the same releases
 * writes the same list. A release from a repository missing in `sources` contributes nothing.
 *
 * @param releases The releases to read, from any of the sources.
 * @param sources How each repository names its packages.
 */
export function releasedPackages(
	releases: GitHubRelease[],
	sources: ReleaseSource[],
): ReleasedPackage[] {
	let packages = new Map<string, ReleasedPackage>();

	for (let release of releases) {
		let source = sources.find((candidate) => candidate.repository === release.repository);
		if (source === undefined) continue;

		if (source.kind === "package") {
			let url =
				source.registry === "npm" ? npmUrl(source.name) : `https://github.com/${source.repository}`;
			if (!packages.has(source.name)) packages.set(source.name, { name: source.name, url });
			continue;
		}

		for (let name of changedPackages(release.body, source.scope)) {
			if (!packages.has(name)) packages.set(name, { name, url: npmUrl(name) });
		}
	}

	return [...packages.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/**
 * The summary the weekly releases post is written from.
 *
 * @param slug The week's permalink segment.
 * @param releases The releases published during the week.
 * @param sources How each repository names its packages.
 * @returns The summary, or `null` when no package qualifies, since such a week gets no post.
 */
export function weeklyReleaseSummary(
	slug: string,
	releases: GitHubRelease[],
	sources: ReleaseSource[],
): WeeklyReleaseSummary | null {
	let packages = releasedPackages(releases, sources);
	if (packages.length === 0) return null;
	return { slug, packages };
}

/** A package's page on npm; a scoped name keeps its `/`, as npm's own links do. */
function npmUrl(name: string): string {
	return `https://www.npmjs.com/package/${name}`;
}
