/**
 * Download and release history for every published package, read from npm's registry and
 * downloads API into one snapshot in the site cache. npm rate-limits its downloads API hard,
 * so a refresh reads one package at a time, stops when npm says so, and the next resumes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Cache } from "@sdxc/cache";
import type { Result } from "@sdxc/result";

import { failure, isFailure, isSuccess, success } from "@sdxc/result";
import * as s from "remix/data-schema";

import { listPackages } from "~/app/services/packages";

/** The entry the snapshot is read from and the refresh writes. */
export const NPM_STATS_CACHE_KEY = "npm-stats:snapshot";

/**
 * The first day the history asks for, the week before the first package was published, so
 * every series starts at zero and the chart shows each package arriving.
 */
const HISTORY_START = "2026-09-01";

/** The longest range npm's downloads API answers in one request. */
const MAX_RANGE_DAYS = 540;

/** How long a stored snapshot stays readable when no refresh replaces it. */
const SNAPSHOT_TTL = "30 days";

/** How many times a rate-limited request is retried before the run stops. */
const RATE_LIMIT_RETRIES = 3;

/** How many packages a run reads between writes, so a run cut short keeps its progress. */
const SAVE_EVERY = 10;

/** One day in milliseconds, for stepping through calendar days in UTC. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** One published package's history and registry facts. */
export interface PackageStats {
	/** The published name, `@sdxc/<directory>`. */
	name: string;
	directory: string;
	/** Downloads per day, aligned with the snapshot's `days`. */
	daily: number[];
	/** When the package was first published, or `null` while npm knows no such package. */
	createdAt: string | null;
	/** The version `latest` points at. */
	latest: string | null;
	latestPublishedAt: string | null;
	/** How many versions have been published. */
	versions: number;
	/** The size of the latest version once installed, in bytes. */
	unpackedSize: number | null;
	/** Downloads over the last seven days, split by the version that was installed. */
	versionDownloads: Record<string, number>;
	/** The last day npm was read through for this package; behind the window means due. */
	through: string;
}

/** Every package's history over one shared run of days. */
export interface NpmStatsSnapshot {
	/** When npm was read, as an ISO timestamp. */
	fetchedAt: string;
	/** Each day the series cover, oldest first, as `YYYY-MM-DD`. */
	days: string[];
	packages: PackageStats[];
}

/** Daily downloads over a range, as `api.npmjs.org/downloads/range` answers. */
const rangeSchema = s.object({
	downloads: s.array(s.object({ day: s.string(), downloads: s.number() })),
});

/** One version in a registry document, of which only its installed size is read. */
const manifestSchema = s.object({
	dist: s.optional(s.object({ unpackedSize: s.optional(s.number()) })),
});

/** The parts of a registry document the page reads. */
const packumentSchema = s.object({
	time: s.optional(s.record(s.string(), s.string())),
	"dist-tags": s.optional(s.record(s.string(), s.string())),
	versions: s.optional(s.record(s.string(), manifestSchema)),
});

/** Last week's downloads by version, as `api.npmjs.org/versions` answers. */
const versionsSchema = s.object({ downloads: s.record(s.string(), s.number()) });

/**
 * The calendar days from `start` through `end`, inclusive.
 *
 * @param start The first day, as `YYYY-MM-DD`.
 * @param end The last day, as `YYYY-MM-DD`.
 * @returns Every day between them in order; empty when `end` is before `start`.
 */
export function daysBetween(start: string, end: string): string[] {
	let days: string[] = [];
	let last = Date.parse(`${end}T00:00:00Z`);
	for (let time = Date.parse(`${start}T00:00:00Z`); time <= last; time += DAY_MS) {
		days.push(new Date(time).toISOString().slice(0, 10));
	}
	return days;
}

/**
 * The days a snapshot taken at `now` covers: from the history's start, or as far back as
 * npm answers, through yesterday, the last day whose counts npm has published.
 */
export function historyWindow(now: Date): { start: string; end: string } {
	let end = new Date(now.getTime() - DAY_MS).toISOString().slice(0, 10);
	let earliest = new Date(now.getTime() - MAX_RANGE_DAYS * DAY_MS).toISOString().slice(0, 10);
	return { start: HISTORY_START < earliest ? earliest : HISTORY_START, end };
}

/**
 * Reads one npm URL as JSON. A `404` is npm saying the package has not been published yet,
 * which is an answer worth keeping, so it succeeds with `null`.
 */
async function readJSON(url: string): Promise<Result<unknown, Error>> {
	try {
		let response = await fetch(url, { headers: { accept: "application/json" } });
		if (response.status === 404) return success(null);
		if (response.status === 429) return failure(new RateLimitedError(url));
		if (!response.ok) return failure(new Error(`npm answered ${response.status} for ${url}`));
		return success(await response.json());
	} catch (error) {
		return failure(error instanceof Error ? error : new Error(String(error)));
	}
}

/** npm refused a request for sending too many; a run that meets one stops reading. */
export class RateLimitedError extends Error {
	override name = "RateLimitedError";

	/**
	 * @param url The request npm refused.
	 */
	constructor(url: string) {
		super(`npm rate-limited ${url}`);
	}
}

/**
 * Reads one npm URL, waiting and retrying while npm rate-limits it.
 *
 * @param url What to read.
 * @param delay The wait before the first retry, doubling after each.
 * @returns The body, or a {@link RateLimitedError} once the retries are spent.
 */
async function readNpm(url: string, delay: number): Promise<Result<unknown, Error>> {
	let result = await readJSON(url);
	for (let attempt = 0; attempt < RATE_LIMIT_RETRIES; attempt++) {
		if (!isFailure(result) || !(result.error instanceof RateLimitedError)) break;
		await new Promise((resolve) => setTimeout(resolve, delay * 2 ** attempt));
		result = await readJSON(url);
	}
	return result;
}

/**
 * Reads one package from npm: its daily downloads over `days`, its registry document, and
 * last week's split by version.
 *
 * @param directory The workspace directory, which names the package.
 * @param days The days the series must cover, oldest first.
 * @param retryDelay The wait before retrying a rate-limited request.
 * @returns The package's stats, or why npm could not be read.
 */
export async function fetchPackageStats(
	directory: string,
	days: string[],
	retryDelay = 2000,
): Promise<Result<PackageStats, Error>> {
	let name = `@sdxc/${directory}`;
	let encoded = `@sdxc%2F${directory}`;
	let first = days[0];
	let last = days.at(-1);
	if (first === undefined || last === undefined) return failure(new Error("No days to read"));

	let [range, packument, versions] = await Promise.all([
		readNpm(`https://api.npmjs.org/downloads/range/${first}:${last}/${name}`, retryDelay),
		readNpm(`https://registry.npmjs.org/${encoded}`, retryDelay),
		readNpm(`https://api.npmjs.org/versions/${encoded}/last-week`, retryDelay),
	]);

	if (isFailure(range)) return range;
	if (isFailure(packument)) return packument;
	if (isFailure(versions)) return versions;

	let counts = new Map<string, number>();
	if (range.data !== null) {
		let parsed = s.parseSafe(rangeSchema, range.data);
		if (!parsed.success) return failure(new Error(`Unreadable downloads for ${name}`));
		for (let entry of parsed.value.downloads) counts.set(entry.day, entry.downloads);
	}

	let registry = packument.data === null ? null : s.parseSafe(packumentSchema, packument.data);
	if (registry !== null && !registry.success) {
		return failure(new Error(`Unreadable registry document for ${name}`));
	}

	let time = registry?.value.time ?? {};
	let latest = registry?.value["dist-tags"]?.latest ?? null;
	let published = registry?.value.versions ?? {};

	let split = versions.data === null ? null : s.parseSafe(versionsSchema, versions.data);

	return success({
		name,
		directory,
		daily: days.map((day) => counts.get(day) ?? 0),
		createdAt: time.created ?? null,
		latest,
		latestPublishedAt: latest === null ? null : (time[latest] ?? null),
		versions: Object.keys(published).length,
		unpackedSize: latest === null ? null : (published[latest]?.dist?.unpackedSize ?? null),
		versionDownloads: split?.success ? split.value.downloads : {},
		through: last,
	});
}

/**
 * Lines a stored package's series up with a new run of days, padding the days it has not
 * been read for with zeros until a run reads it again.
 */
function realign(stats: PackageStats, from: string[], to: string[]): PackageStats {
	let byDay = new Map(from.map((day, index) => [day, stats.daily[index] ?? 0]));
	return { ...stats, daily: to.map((day) => byDay.get(day) ?? 0) };
}

/**
 * The stored snapshot.
 *
 * @param cache Where the snapshot is kept.
 * @returns The snapshot, or `null` when nothing is stored or the store cannot be read.
 */
export async function readNpmStats(cache: Cache): Promise<NpmStatsSnapshot | null> {
	let stored = await cache.read<NpmStatsSnapshot>(NPM_STATS_CACHE_KEY);
	if (!isSuccess(stored) || stored.data === null) return null;
	return stored.data;
}

/**
 * How many published packages the snapshot holds through yesterday, the last day npm has
 * counts for; fewer than every package means a refresh has more to read.
 *
 * @param snapshot The stored snapshot.
 * @param now The moment to compare against.
 */
export function currentPackages(snapshot: NpmStatsSnapshot, now = new Date()): number {
	let { end } = historyWindow(now);
	return snapshot.packages.filter((stats) => stats.through === end).length;
}

/**
 * Whether a refresh has anything to read: a package npm has newer counts for, or one the
 * snapshot does not hold yet.
 *
 * @param snapshot The stored snapshot.
 * @param now The moment to compare against.
 */
export function needsRefresh(snapshot: NpmStatsSnapshot, now = new Date()): boolean {
	return currentPackages(snapshot, now) < listPackages().length;
}

/** How a refresh paces itself. */
export interface RefreshOptions {
	/** The moment the snapshot is taken. */
	now?: Date;
	/** How long the run may keep starting packages, in milliseconds. */
	budget?: number;
	/** The wait before retrying a rate-limited request, doubling after each. */
	retryDelay?: number;
}

/** What one refresh did. */
export interface RefreshOutcome {
	snapshot: NpmStatsSnapshot;
	/** Packages read this run. */
	read: number;
	/** Packages npm answered with an error for, which keep their previous history. */
	failed: number;
	/** Packages still behind when the run stopped. */
	remaining: number;
	/** Whether the run stopped because npm rate-limited it. */
	rateLimited: boolean;
}

/**
 * Reads every package that is behind from npm, one at a time, and stores the snapshot as it
 * goes. A package npm fails for keeps its previous history; a rate limit or the end of the
 * budget stops the run, and the next one picks up the packages still behind.
 *
 * @param cache Where the snapshot is kept.
 * @param options How the run paces itself.
 * @returns What the run read and what it left for the next one.
 */
export async function refreshNpmStats(
	cache: Cache,
	options: RefreshOptions = {},
): Promise<RefreshOutcome> {
	let { budget = Number.POSITIVE_INFINITY, now = new Date(), retryDelay = 2000 } = options;
	let window = historyWindow(now);
	let days = daysBetween(window.start, window.end);
	let previous = await readNpmStats(cache);
	let stored = new Map(
		previous?.packages.map((stats) => [stats.directory, realign(stats, previous.days, days)]),
	);
	let packages = listPackages();
	let due = packages.filter((entry) => stored.get(entry.directory)?.through !== window.end);
	let deadline = Date.now() + budget;
	let read = 0;
	let failed = 0;
	let rateLimited = false;

	let snapshot = (): NpmStatsSnapshot => ({
		fetchedAt: now.toISOString(),
		days,
		packages: packages.flatMap((entry) => stored.get(entry.directory) ?? []),
	});

	for (let entry of due) {
		if (Date.now() > deadline) break;

		let result = await fetchPackageStats(entry.directory, days, retryDelay);
		if (isFailure(result)) {
			if (result.error instanceof RateLimitedError) {
				rateLimited = true;
				break;
			}
			failed++;
			continue;
		}

		stored.set(entry.directory, result.data);
		read++;
		if (read % SAVE_EVERY === 0)
			await cache.write(NPM_STATS_CACHE_KEY, snapshot(), { ttl: SNAPSHOT_TTL });
	}

	let final = snapshot();
	await cache.write(NPM_STATS_CACHE_KEY, final, { ttl: SNAPSHOT_TTL });

	return {
		snapshot: final,
		read,
		failed,
		remaining: packages.length - currentPackages(final, now),
		rateLimited,
	};
}

/** The figures a row of the stats table and a package's headline show. */
export interface PackageSummary {
	stats: PackageStats;
	total: number;
	last7: number;
	previous7: number;
	last30: number;
	previous30: number;
	/** Week-over-week change as a fraction, or `null` when last week had no downloads. */
	growth7: number | null;
	growth30: number | null;
	/** The share of last week's installs that took the latest version, or `null` with none. */
	latestShare: number | null;
}

/**
 * The sum of the `length` days ending `offset` days before the end of `series`.
 *
 * @param series Daily counts, oldest first.
 * @param length How many days to add up.
 * @param offset How many of the most recent days to skip first.
 */
export function windowSum(series: number[], length: number, offset = 0): number {
	let end = series.length - offset;
	let total = 0;
	for (let index = Math.max(0, end - length); index < end; index++) total += series[index] ?? 0;
	return total;
}

/**
 * The change from `before` to `after` as a fraction.
 *
 * @returns `null` when `before` is zero, where a percentage would be infinite.
 */
export function growth(after: number, before: number): number | null {
	if (before === 0) return null;
	return (after - before) / before;
}

/**
 * The headline figures for one package.
 *
 * @param stats The package's stored history.
 */
export function summarizePackage(stats: PackageStats): PackageSummary {
	let last7 = windowSum(stats.daily, 7);
	let previous7 = windowSum(stats.daily, 7, 7);
	let last30 = windowSum(stats.daily, 30);
	let previous30 = windowSum(stats.daily, 30, 30);
	let weekly = Object.values(stats.versionDownloads).reduce((sum, count) => sum + count, 0);
	let onLatest = stats.latest === null ? 0 : (stats.versionDownloads[stats.latest] ?? 0);

	return {
		stats,
		total: stats.daily.reduce((sum, count) => sum + count, 0),
		last7,
		previous7,
		last30,
		previous30,
		growth7: growth(last7, previous7),
		growth30: growth(last30, previous30),
		latestShare: weekly === 0 ? null : onLatest / weekly,
	};
}

/**
 * Every package's downloads added up per day, the series the collection's chart draws.
 *
 * @param snapshot The stored snapshot.
 * @returns One count per day of `snapshot.days`.
 */
export function collectionDaily(snapshot: NpmStatsSnapshot): number[] {
	return snapshot.days.map((_, index) =>
		snapshot.packages.reduce((sum, stats) => sum + (stats.daily[index] ?? 0), 0),
	);
}

/**
 * The trailing average of `series` over `length` days, the line that reads through the
 * weekday and weekend swing.
 *
 * @param series Daily counts, oldest first.
 * @param length How many days each point averages; early points average what exists.
 */
export function rollingAverage(series: number[], length: number): number[] {
	let sum = 0;
	return series.map((value, index) => {
		sum += value;
		if (index >= length) sum -= series[index - length] ?? 0;
		return sum / Math.min(index + 1, length);
	});
}

/**
 * The running total of `series`, the line that shows growth as a slope.
 *
 * @param series Daily counts, oldest first.
 */
export function cumulative(series: number[]): number[] {
	let sum = 0;
	return series.map((value) => (sum += value));
}
