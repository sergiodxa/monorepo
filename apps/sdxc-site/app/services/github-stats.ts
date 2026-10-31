/**
 * The repository's own signals from GitHub: stars per day, and the traffic GitHub keeps for
 * fourteen days, stored daily so the history outlives GitHub's window.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Cache } from "@sdxc/cache";
import type { Result } from "@sdxc/result";

import { failure, isFailure, isSuccess, success } from "@sdxc/result";
import * as s from "remix/data-schema";

/** The entry the snapshot is read from and the refresh writes. */
export const GITHUB_STATS_CACHE_KEY = "github-stats:snapshot";

/** The repository the section describes. */
export const GITHUB_REPOSITORY = "sergiodxa/monorepo";

/**
 * How long a stored snapshot stays readable. The traffic history lives only here once GitHub's
 * fourteen-day window moves past it, so the entry outlives any plausible gap in refreshes.
 */
const SNAPSHOT_TTL = "365 days";

/** How old a snapshot may get before a page visit starts a refresh. */
const REFRESH_AFTER_MS = 20 * 60 * 60 * 1000;

/** The most weeks GitHub's star history answers with in one page. */
const STAR_WEEKS_PER_PAGE = 30;

/** The most star-history pages GitHub serves, which reaches back about 57 years of weeks. */
const MAX_STAR_PAGES = 100;

/** One day in seconds, for stepping through a star-history week. */
const DAY_SECONDS = 24 * 60 * 60;

/** Identifies this site to GitHub, which requires a caller to name itself. */
const USER_AGENT = "sdxc.dev";

/** A count for one calendar day, `YYYY-MM-DD` in UTC. */
export interface DailyCount {
	day: string;
	count: number;
}

/** One day of views or clones, as GitHub counts them. */
export interface TrafficDay extends DailyCount {
	/** Distinct visitors or cloners that day. */
	uniques: number;
}

/** A total over GitHub's fourteen-day window. */
export interface TrafficTotal {
	count: number;
	/** Distinct visitors over the whole window, which is fewer than the daily uniques added up. */
	uniques: number;
}

/** A site that sent visitors, or a page they visited, over the last fourteen days. */
export interface TrafficSource extends TrafficTotal {
	/** The referring site, or the visited path. */
	name: string;
	/** The page's title, for a path; `null` for a referrer. */
	title: string | null;
}

/** What GitHub says about visits and clones. */
export interface GitHubTraffic {
	/** Views per day, grown past GitHub's window by merging every read, oldest first. */
	views: TrafficDay[];
	clones: TrafficDay[];
	/** The fourteen-day totals as of the latest read. */
	views14: TrafficTotal;
	clones14: TrafficTotal;
	/** Referrers and paths as of the latest read, busiest first. */
	referrers: TrafficSource[];
	paths: TrafficSource[];
}

/** The repository's stars and traffic history. */
export interface GitHubStatsSnapshot {
	/** When the sources were read, as an ISO timestamp. */
	fetchedAt: string;
	/** Stars gained per day, oldest first, only days with a star; `null` until read once. */
	stars: DailyCount[] | null;
	/** `false` when the token was refused traffic on the latest read, and the page says so. */
	trafficReadable: boolean;
	/** The stored traffic, kept through refusals; `null` until read once. */
	traffic: GitHubTraffic | null;
}

/**
 * A popular path as it reads inside the repository. GitHub reports every path from the site's
 * root, so each one starts with the repository's own; the repository home becomes `/`.
 *
 * @param path The path GitHub reported, e.g. `/sergiodxa/monorepo/tree/main/apps`.
 * @returns The rest of it, e.g. `/tree/main/apps`.
 */
export function repositoryPath(path: string): string {
	let prefix = `/${GITHUB_REPOSITORY}`;
	if (path !== prefix && !path.startsWith(`${prefix}/`)) return path;
	return path.slice(prefix.length) || "/";
}

/** A GitHub request that did not succeed, carrying the status a caller branches on. */
export class GitHubRequestError extends Error {
	override name = "GitHubRequestError";

	/**
	 * @param url The request GitHub refused or failed.
	 * @param status The response status, or `0` when no response arrived.
	 */
	constructor(
		url: string,
		readonly status: number,
	) {
		super(`GitHub answered ${status} for ${url}`);
	}
}

/** A page of star history: each week's start in Unix seconds and its stars per day from Sunday. */
const starHistorySchema = s.array(s.object({ week: s.number(), days: s.array(s.number()) }));

/** Daily views or clones, under `views` or `clones` respectively. */
const trafficDaysSchema = s.object({
	count: s.number(),
	uniques: s.number(),
	views: s.optional(
		s.array(s.object({ timestamp: s.string(), count: s.number(), uniques: s.number() })),
	),
	clones: s.optional(
		s.array(s.object({ timestamp: s.string(), count: s.number(), uniques: s.number() })),
	),
});

/** The referrers GitHub lists for the window. */
const referrersSchema = s.array(
	s.object({ referrer: s.string(), count: s.number(), uniques: s.number() }),
);

/** The most visited paths GitHub lists for the window. */
const pathsSchema = s.array(
	s.object({ path: s.string(), title: s.string(), count: s.number(), uniques: s.number() }),
);

/** A successful GitHub answer: the parsed body, and the `Link` header pagination reads. */
interface GitHubAnswer {
	body: unknown;
	link: string | null;
}

/**
 * Reads one GitHub REST path as JSON, with the token when there is one; public reads work
 * without it at a lower rate limit.
 *
 * @param path The path under `https://api.github.com`, query included.
 * @param token The credential, when the worker has one.
 * @param accept The media type to ask for.
 */
async function readGitHub(
	path: string,
	token: string | undefined,
	accept = "application/vnd.github+json",
): Promise<Result<GitHubAnswer, GitHubRequestError>> {
	let url = `https://api.github.com${path}`;
	let headers = new Headers({ accept, "user-agent": USER_AGENT });
	if (token) headers.set("authorization", `Bearer ${token}`);
	try {
		let response = await fetch(url, { headers });
		if (!response.ok) return failure(new GitHubRequestError(url, response.status));
		return success({ body: await response.json(), link: response.headers.get("link") });
	} catch {
		return failure(new GitHubRequestError(url, 0));
	}
}

/**
 * Turns a timestamp into its UTC calendar day.
 *
 * @param timestamp An ISO timestamp.
 */
function toDay(timestamp: string): string {
	return timestamp.slice(0, 10);
}

/**
 * Reads the repository's star history and counts stars per day. GitHub lists individual
 * stargazers only to admins and collaborators, so the weekly history, which any caller may
 * read, is the source; it pages backward from this week until a page comes back short.
 *
 * @param token The credential, when the worker has one.
 * @returns Stars per day, oldest first, or why GitHub could not be read.
 */
export async function fetchStars(token: string | undefined): Promise<Result<DailyCount[], Error>> {
	let counts = new Map<string, number>();
	for (let page = 1; page <= MAX_STAR_PAGES; page++) {
		let answer = await readGitHub(
			`/repos/${GITHUB_REPOSITORY}/stargazers/history?per_page=${STAR_WEEKS_PER_PAGE}&page=${page}`,
			token,
		);
		if (isFailure(answer)) return answer;
		let parsed = s.parseSafe(starHistorySchema, answer.data.body);
		if (!parsed.success) return failure(new Error("Unreadable star history"));
		for (let { days, week } of parsed.value) {
			for (let [offset, count] of days.entries()) {
				if (count === 0) continue;
				let day = toDay(new Date((week + offset * DAY_SECONDS) * 1000).toISOString());
				counts.set(day, (counts.get(day) ?? 0) + count);
			}
		}
		if (parsed.value.length < STAR_WEEKS_PER_PAGE) break;
	}
	return success(
		[...counts.entries()]
			.map(([day, count]) => ({ day, count }))
			.sort((a, b) => a.day.localeCompare(b.day)),
	);
}

/** What one traffic read found: the data, or that the token may not read traffic at all. */
export type TrafficRead = { readable: true; traffic: GitHubTraffic } | { readable: false };

/**
 * Reads the four traffic endpoints. GitHub answers `403` or `404` to a token without push
 * access, which is a usable answer — the page says so — rather than a failure.
 *
 * @param token The credential; traffic is unreadable without one.
 */
export async function fetchTraffic(token: string | undefined): Promise<Result<TrafficRead, Error>> {
	if (!token) return success({ readable: false });
	let base = `/repos/${GITHUB_REPOSITORY}/traffic`;
	let answers = await Promise.all([
		readGitHub(`${base}/views`, token),
		readGitHub(`${base}/clones`, token),
		readGitHub(`${base}/popular/referrers`, token),
		readGitHub(`${base}/popular/paths`, token),
	]);

	for (let answer of answers) {
		if (!isFailure(answer)) continue;
		if (answer.error.status === 403 || answer.error.status === 404) {
			return success({ readable: false });
		}
		return answer;
	}

	let [views, clones, referrers, paths] = answers.map((answer) =>
		isSuccess(answer) ? answer.data.body : null,
	);
	let viewsParsed = s.parseSafe(trafficDaysSchema, views);
	let clonesParsed = s.parseSafe(trafficDaysSchema, clones);
	let referrersParsed = s.parseSafe(referrersSchema, referrers);
	let pathsParsed = s.parseSafe(pathsSchema, paths);
	if (!viewsParsed.success || !clonesParsed.success) {
		return failure(new Error("Unreadable traffic"));
	}
	if (!referrersParsed.success || !pathsParsed.success) {
		return failure(new Error("Unreadable popular traffic"));
	}

	let days = (entries: Array<{ timestamp: string; count: number; uniques: number }> = []) =>
		entries.map((entry) => ({
			day: toDay(entry.timestamp),
			count: entry.count,
			uniques: entry.uniques,
		}));

	return success({
		readable: true,
		traffic: {
			views: days(viewsParsed.value.views),
			clones: days(clonesParsed.value.clones),
			views14: { count: viewsParsed.value.count, uniques: viewsParsed.value.uniques },
			clones14: { count: clonesParsed.value.count, uniques: clonesParsed.value.uniques },
			referrers: referrersParsed.value.map((entry) => ({
				name: entry.referrer,
				title: null,
				count: entry.count,
				uniques: entry.uniques,
			})),
			paths: pathsParsed.value.map((entry) => ({
				name: entry.path,
				title: entry.title,
				count: entry.count,
				uniques: entry.uniques,
			})),
		},
	});
}

/**
 * Merges a fresh read of daily traffic into the stored history by day. The fresh read wins on
 * every day both hold, since GitHub keeps counting the current day until it ends.
 *
 * @param stored The history so far.
 * @param fresh The days GitHub answered with now.
 * @returns Every day either holds, oldest first.
 */
export function mergeTrafficDays(stored: TrafficDay[], fresh: TrafficDay[]): TrafficDay[] {
	let byDay = new Map(stored.map((entry) => [entry.day, entry]));
	for (let entry of fresh) byDay.set(entry.day, entry);
	return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/**
 * The stored snapshot.
 *
 * @param cache Where the snapshot is kept.
 * @returns The snapshot, or `null` when nothing is stored or the store cannot be read.
 */
export async function readGitHubStats(cache: Cache): Promise<GitHubStatsSnapshot | null> {
	let stored = await cache.read<GitHubStatsSnapshot>(GITHUB_STATS_CACHE_KEY);
	if (!isSuccess(stored) || stored.data === null) return null;
	return stored.data;
}

/**
 * Whether the stored snapshot is old or missing enough for a page to start a refresh.
 *
 * @param snapshot The stored snapshot, or `null`.
 * @param now The moment to compare against.
 */
export function needsGitHubStatsRefresh(
	snapshot: GitHubStatsSnapshot | null,
	now = new Date(),
): boolean {
	if (snapshot === null) return true;
	let fetched = Date.parse(snapshot.fetchedAt);
	if (Number.isNaN(fetched)) return true;
	return now.getTime() - fetched > REFRESH_AFTER_MS;
}

/**
 * Reads the sources and stores a new snapshot; what the daily schedule and a page finding a
 * stale snapshot call. Each part that fails keeps its stored value, and a run where every part
 * fails writes nothing, so the traffic history survives any outage.
 *
 * @param cache Where the snapshot is kept.
 * @param token The GitHub credential, absent where the worker has none.
 * @param now The moment the snapshot is taken.
 * @returns The snapshot now stored, or `null` when nothing could be read.
 */
export async function refreshGitHubStats(
	cache: Cache,
	token: string | undefined,
	now = new Date(),
): Promise<GitHubStatsSnapshot | null> {
	let [previous, stars, traffic] = await Promise.all([
		readGitHubStats(cache),
		fetchStars(token),
		fetchTraffic(token),
	]);

	if (isFailure(stars) && isFailure(traffic)) return null;

	let snapshot: GitHubStatsSnapshot = {
		fetchedAt: now.toISOString(),
		stars: isSuccess(stars) ? stars.data : (previous?.stars ?? null),
		trafficReadable: isSuccess(traffic)
			? traffic.data.readable
			: (previous?.trafficReadable ?? false),
		traffic: mergeTraffic(previous?.traffic ?? null, isSuccess(traffic) ? traffic.data : null),
	};

	await cache.write(GITHUB_STATS_CACHE_KEY, snapshot, { ttl: SNAPSHOT_TTL });
	return snapshot;
}

/**
 * The traffic a new snapshot stores: the stored history with a readable fresh read merged in,
 * and the stored traffic as it was when the read was refused or failed.
 *
 * @param stored The traffic the previous snapshot held.
 * @param read This run's read, or `null` when it failed.
 */
function mergeTraffic(
	stored: GitHubTraffic | null,
	read: TrafficRead | null,
): GitHubTraffic | null {
	if (read === null || !read.readable) return stored;
	return {
		...read.traffic,
		views: mergeTrafficDays(stored?.views ?? [], read.traffic.views),
		clones: mergeTrafficDays(stored?.clones ?? [], read.traffic.clones),
	};
}
