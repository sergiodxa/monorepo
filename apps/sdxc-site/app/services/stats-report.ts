/**
 * Everything the stats page and its data twins draw from, loaded in one place: the npm,
 * adoption, GitHub and site-event snapshots, each refreshed when stale, so `/stats`,
 * `/stats.json` and `/stats.md` always describe the same numbers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Cache } from "@sdxc/cache";

import { currentLog } from "@sdxc/logger";
import { env, waitUntil } from "cloudflare:workers";

import type { AdoptionSnapshot, RepositoriesNote } from "~/app/services/adoption";
import type { GitHubStatsSnapshot } from "~/app/services/github-stats";
import type { NpmStatsSnapshot } from "~/app/services/npm-stats";
import type { SiteEventsSnapshot } from "~/app/services/site-events";

import { needsAdoptionRefresh, readAdoption, refreshAdoption } from "~/app/services/adoption";
import {
	GITHUB_REPOSITORY,
	needsGitHubStatsRefresh,
	readGitHubStats,
	refreshGitHubStats,
} from "~/app/services/github-stats";
import {
	collectionDaily,
	currentPackages,
	needsRefresh,
	readNpmStats,
	refreshNpmStats,
	summarizePackage,
	windowSum,
} from "~/app/services/npm-stats";
import { readSiteEvents } from "~/app/services/site-events";

/**
 * How long a refresh a request starts may keep reading npm: inside the request when nothing
 * is stored yet, and inside the time the runtime grants work after the response otherwise.
 */
const REFRESH_BUDGET = { inline: 20_000, background: 25_000 };

/** The response directive every stats format carries, which keeps them out of search engines. */
export const STATS_ROBOTS = "noindex, nofollow";

/** Every snapshot the stats formats draw from. */
export interface StatsData {
	npm: NpmStatsSnapshot;
	adoption: AdoptionSnapshot | null;
	github: GitHubStatsSnapshot | null;
	events: SiteEventsSnapshot | null;
}

/**
 * Reads every snapshot and starts the refreshes they need. Only a missing npm snapshot is
 * read before answering, so a first visit shows what one budget could read; every other
 * stale snapshot is replaced after the response, ready for the next visit.
 *
 * @param cache Where the snapshots are kept.
 * @returns The snapshots to render.
 */
export async function loadStats(cache: Cache): Promise<StatsData> {
	let [stored, adoption, github, events] = await Promise.all([
		readNpmStats(cache),
		readAdoption(cache),
		readGitHubStats(cache),
		readSiteEvents(cache),
	]);

	if (needsAdoptionRefresh(adoption)) {
		waitUntil(refreshAdoption(cache, env.GITHUB_TOKEN).catch(() => undefined));
	}
	if (needsGitHubStatsRefresh(github)) {
		waitUntil(refreshGitHubStats(cache, env.GITHUB_TOKEN).catch(() => undefined));
	}

	if (stored === null) {
		let outcome = await refreshNpmStats(cache, { budget: REFRESH_BUDGET.inline });
		currentLog()?.set({ npmStats: "inline", read: outcome.read, remaining: outcome.remaining });
		return { npm: outcome.snapshot, adoption, github, events };
	}

	if (needsRefresh(stored)) {
		currentLog()?.set({ npmStats: "background" });
		waitUntil(refreshNpmStats(cache, { budget: REFRESH_BUDGET.background }).catch(() => undefined));
	}

	return { npm: stored, adoption, github, events };
}

/**
 * The stats as one JSON document: every stored snapshot as it is kept, plus each package's
 * computed figures, so an agent can analyse the history or quote the page's numbers.
 *
 * @param data The loaded snapshots.
 * @param published How many packages are published, which `upToDate` reaches once npm is read.
 */
export function statsJSON(data: StatsData, published: number) {
	let packages = data.npm.packages.map(summarizePackage);
	let collection = collectionDaily(data.npm);

	return {
		generatedAt: new Date().toISOString(),
		npm: {
			fetchedAt: data.npm.fetchedAt,
			days: data.npm.days,
			published,
			upToDate: currentPackages(data.npm),
			collection: {
				daily: collection,
				last7: windowSum(collection, 7),
				previous7: windowSum(collection, 7, 7),
				last30: windowSum(collection, 30),
				previous30: windowSum(collection, 30, 30),
				total: windowSum(collection, collection.length),
			},
			packages,
		},
		adoption: data.adoption,
		github: data.github,
		events: data.events,
	};
}

/** How counts read in the markdown report. */
const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

/** How a change or share reads in the markdown report. */
const PERCENT_FORMAT = new Intl.NumberFormat("en-US", {
	style: "percent",
	maximumFractionDigits: 0,
	signDisplay: "exceptZero",
});

/**
 * A markdown table, escaping the pipes a cell could hold so a value never splits a row.
 *
 * @param head The column titles.
 * @param rows One array of cells per row.
 */
export function markdownTable(head: string[], rows: Array<Array<string | number>>): string {
	let cell = (value: string | number) => String(value).replaceAll("|", "\\|");
	return [
		`| ${head.map(cell).join(" | ")} |`,
		`| ${head.map(() => "---").join(" | ")} |`,
		...rows.map((row) => `| ${row.map(cell).join(" | ")} |`),
	].join("\n");
}

/**
 * The npm part of the report: the collection's headline figures and every package's row,
 * busiest last week first.
 */
function npmMarkdown(data: StatsData, published: number): string {
	let collection = collectionDaily(data.npm);
	let last7 = windowSum(collection, 7);
	let previous7 = windowSum(collection, 7, 7);
	let last30 = windowSum(collection, 30);
	let previous30 = windowSum(collection, 30, 30);
	let change = (after: number, before: number) =>
		before === 0 ? "new" : PERCENT_FORMAT.format((after - before) / before);
	let rows = data.npm.packages
		.map(summarizePackage)
		.sort((a, b) => b.last7 - a.last7 || a.stats.directory.localeCompare(b.stats.directory));

	return [
		"## npm downloads",
		"",
		`Counts through ${data.npm.days.at(-1) ?? "—"}, read ${data.npm.fetchedAt}. ${currentPackages(data.npm)} of ${published} packages are up to date. npm counts every tarball fetch, CI and mirrors included.`,
		"",
		`- Last 7 days: ${NUMBER_FORMAT.format(last7)} (${change(last7, previous7)})`,
		`- Last 30 days: ${NUMBER_FORMAT.format(last30)} (${change(last30, previous30)})`,
		`- All time: ${NUMBER_FORMAT.format(windowSum(collection, collection.length))}`,
		"",
		markdownTable(
			[
				"Package",
				"7 days",
				"Change",
				"30 days",
				"Total",
				"jsDelivr, 30 days",
				"Latest",
				"On latest",
				"Versions",
			],
			rows.map((row) => [
				row.stats.name,
				row.last7,
				row.growth7 === null ? "—" : PERCENT_FORMAT.format(row.growth7),
				row.last30,
				row.total,
				row.jsdelivr30,
				row.stats.latest ?? "unpublished",
				row.latestShare === null ? "—" : `${Math.round(row.latestShare * 100)}%`,
				row.stats.versions,
			]),
		),
	].join("\n");
}

/** Why the repository list may be empty, in words a reader of the report follows. */
const REPOSITORIES_NOTES: Record<RepositoriesNote, string> = {
	"no-token": "the worker has no GitHub token for code search",
	failed: "GitHub's code search failed on the last read",
};

/** A line for a section whose snapshot has not been read yet. */
function pending(title: string): string {
	return [
		`## ${title}`,
		"",
		"Not read yet; it fills in after the next visit or the daily refresh.",
	].join("\n");
}

/**
 * The adoption part of the report: each package's dependents outside the collection, an
 * estimate from deps.dev's default version less the collection's own dependents.
 */
function adoptionMarkdown(adoption: AdoptionSnapshot | null): string {
	if (adoption === null) return pending("Adoption");
	let adopted = adoption.packages
		.filter((entry) => entry.outsideDependents > 0)
		.sort((a, b) => b.outsideDependents - a.outsideDependents || a.name.localeCompare(b.name));
	let repositories = adoption.repositories.map(
		(repository) =>
			`- [${repository.fullName}](${repository.url})${repository.packages.length > 0 ? `: ${repository.packages.join(", ")}` : ""}`,
	);

	return [
		"## Adoption",
		"",
		`Read ${adoption.fetchedAt}. Outside dependents are deps.dev's direct dependents of each default version, less the packages in this collection that depend on it.${adoption.missing.length > 0 ? ` ${adoption.missing.length} packages have not been read from deps.dev yet.` : ""}`,
		"",
		adopted.length > 0
			? markdownTable(
					["Package", "Outside (estimate)", "Direct on deps.dev", "In this collection"],
					adopted.map((entry) => [
						entry.name,
						entry.outsideDependents,
						entry.directDependents,
						entry.collectionDependents,
					]),
				)
			: "No package has dependents outside the collection.",
		"",
		"### Repositories installing the collection",
		"",
		...(repositories.length > 0
			? repositories
			: [
					`None found${adoption.repositoriesNote ? `: ${REPOSITORIES_NOTES[adoption.repositoriesNote]}` : ""}.`,
				]),
	].join("\n");
}

/** The GitHub part of the report: stars, open work from other people, and traffic. */
function githubMarkdown(github: GitHubStatsSnapshot | null): string {
	if (github === null) return pending("GitHub");
	let stars = (github.stars ?? []).reduce((sum, day) => sum + day.count, 0);
	let traffic = github.traffic;
	let items = [...(github.issues?.items ?? []), ...(github.pulls?.items ?? [])].sort((a, b) =>
		b.createdAt.localeCompare(a.createdAt),
	);
	let sources = (title: string, rows: Array<{ name: string; count: number; uniques: number }>) =>
		rows.length > 0
			? [
					`### ${title}`,
					"",
					markdownTable(
						["Name", "Views", "Unique"],
						rows.map((row) => [row.name, row.count, row.uniques]),
					),
					"",
				]
			: [];

	return [
		"## GitHub",
		"",
		`Read ${github.fetchedAt} for ${GITHUB_REPOSITORY}.`,
		"",
		`- Stars: ${github.stars === null ? "—" : NUMBER_FORMAT.format(stars)}`,
		`- Open issues from others: ${github.issues?.total ?? "—"}`,
		`- Open pull requests from others: ${github.pulls?.total ?? "—"}`,
		traffic
			? `- Views, last 14 days: ${NUMBER_FORMAT.format(traffic.views14.count)} (${NUMBER_FORMAT.format(traffic.views14.uniques)} unique); clones ${NUMBER_FORMAT.format(traffic.clones14.count)} (${NUMBER_FORMAT.format(traffic.clones14.uniques)} unique)`
			: "- Traffic: the token cannot read repository traffic.",
		"",
		...(traffic && traffic.views.length > 0
			? [
					"### Views and clones per day",
					"",
					markdownTable(
						["Day", "Views", "Unique views", "Clones", "Unique clones"],
						traffic.views.map((view) => {
							let clone = traffic.clones.find((entry) => entry.day === view.day);
							return [view.day, view.count, view.uniques, clone?.count ?? 0, clone?.uniques ?? 0];
						}),
					),
					"",
				]
			: []),
		...sources("Referrers", traffic?.referrers ?? []),
		...sources("Popular paths", traffic?.paths ?? []),
		...(items.length > 0
			? [
					"### Open issues and pull requests from others",
					"",
					...items.map(
						(item) =>
							`- [#${item.number} ${item.title}](${item.url}) by ${item.author}, ${item.createdAt.slice(0, 10)}`,
					),
				]
			: []),
	].join("\n");
}

/** The site-events part of the report: what readers and agents asked sdxc.dev for. */
function eventsMarkdown(events: SiteEventsSnapshot | null): string {
	if (events === null) {
		return ["## Searches and MCP calls", "", "Nothing recorded in the last 30 days."].join("\n");
	}
	let searches = Object.values(events.searches).reduce((sum, count) => sum + count, 0);

	return [
		"## Searches and MCP calls",
		"",
		`Last 30 days, ${events.days[0] ?? "—"} to ${events.days.at(-1) ?? "—"}. The search dialog's keystrokes are collapsed into the query the reader meant.`,
		"",
		`- Searches: ${NUMBER_FORMAT.format(searches)} (${Object.entries(events.searches)
			.map(([surface, count]) => `${surface} ${count}`)
			.join(", ")})`,
		`- Found something: ${NUMBER_FORMAT.format(events.hitCount)}`,
		`- Found nothing: ${NUMBER_FORMAT.format(events.missCount)}`,
		`- MCP calls: ${NUMBER_FORMAT.format(events.toolCallCount)}`,
		"",
		...(events.hits.length > 0
			? [
					"### Top searches",
					"",
					markdownTable(
						["Query", "Times", "Where", "Last seen"],
						events.hits.map((hit) => [hit.query, hit.count, hit.surfaces.join(", "), hit.lastSeen]),
					),
					"",
				]
			: []),
		...(events.misses.length > 0
			? [
					"### Searches that found nothing",
					"",
					markdownTable(
						["Query", "Times", "Where", "Last seen"],
						events.misses.map((miss) => [
							miss.query,
							miss.count,
							miss.surfaces.join(", "),
							miss.lastSeen,
						]),
					),
					"",
				]
			: []),
		...(events.tools.length > 0
			? [
					"### MCP calls per tool",
					"",
					markdownTable(
						["Tool", "Calls"],
						events.tools.map((tool) => [tool.name, tool.count]),
					),
					"",
				]
			: []),
		...(events.packages.length > 0
			? [
					"### Packages asked for through MCP",
					"",
					markdownTable(
						["Package", "Calls"],
						events.packages.map((entry) => [entry.name, entry.count]),
					),
				]
			: []),
	].join("\n");
}

/**
 * The stats as a markdown report, the figures the page shows in the order it shows them,
 * for an agent to read rather than parse HTML.
 *
 * @param data The loaded snapshots.
 * @param published How many packages are published.
 */
export function statsMarkdown(data: StatsData, published: number): string {
	return [
		"# sdxc stats",
		"",
		`Generated ${new Date().toISOString()}. The raw snapshots are at /stats.json.`,
		"",
		npmMarkdown(data, published),
		"",
		adoptionMarkdown(data.adoption),
		"",
		githubMarkdown(data.github),
		"",
		eventsMarkdown(data.events),
		"",
	].join("\n");
}
