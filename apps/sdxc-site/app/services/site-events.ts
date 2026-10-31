/**
 * What readers and agents ask sdxc.dev for: what they search, split by whether it found
 * anything, and which MCP tools are called for which packages, counted per day in the site
 * cache so the stats page shows what people look for and what the documentation is missing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Cache } from "@sdxc/cache";
import type { Result } from "@sdxc/result";

import { currentLog } from "@sdxc/logger";
import { failure, isFailure, isSuccess, success } from "@sdxc/result";
import { waitUntil } from "cloudflare:workers";
import * as s from "remix/data-schema";

import { siteCache } from "~/app/initializers/cache";

/** Where a search was typed: the `/search` page, the ⌘K dialog, or one of the MCP search tools. */
export type SearchSurface = "page" | "dialog" | "search_docs" | "search_packages";

/** Every surface, in the order the stats page lists them. */
export const SEARCH_SURFACES: readonly SearchSurface[] = [
	"page",
	"dialog",
	"search_docs",
	"search_packages",
];

/** Prefix of the one entry per UTC day every event of that day is folded into. */
export const SITE_EVENTS_KEY_PREFIX = "site-events:";

/** How long a day's entry is kept; the page reads only the last {@link WINDOW_DAYS}. */
const DAY_TTL = "90 days";

/** How many days, today included, the stats page sums. */
const WINDOW_DAYS = 30;

/** Queries shorter than this are a reader still typing, and are not recorded. */
const MIN_QUERY_LENGTH = 3;

/** Longer queries are prose or payloads rather than something to look up, and are not recorded. */
const MAX_RECORDED_QUERY_LENGTH = 80;

/**
 * The characters a lookup is written in: words, numbers, and the punctuation of package names,
 * paths and versions. Quotes, brackets, `=` and `;` are the stuff of injection probes.
 */
const PLAUSIBLE_QUERY = /^[\p{L}\p{N} ._\-/@:#+]+$/u;

/** Longer queries are cut to this, which is also the longest the MCP tools accept. */
const MAX_QUERY_LENGTH = 200;

/** Longest package name kept from a `get_package` call. */
const MAX_PACKAGE_LENGTH = 100;

/** Distinct queries one day keeps per outcome, so a flood of junk cannot grow an entry unbounded. */
const MAX_QUERIES_PER_DAY = 500;

/** How many rows each of the page's tables shows. */
const TOP_ROWS = 25;

/** One day in milliseconds, for stepping back through UTC days. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** One request's worth of what to count. */
export interface SiteEvent {
	/** A search that ran, with how many results it found. */
	search?: { surface: SearchSurface; query: string; results: number };
	/** An MCP tool call, with the package it asked about when it names one. */
	tool?: { name: string; package?: string };
}

/** A query as one day stores it. */
interface StoredQuery {
	count: number;
	surfaces: string[];
}

/** One day's counts, as the entry under `site-events:<YYYY-MM-DD>` holds them. */
export interface SiteEventsDay {
	/** Searches per surface; the dialog's keystrokes are collapsed into the query the reader meant. */
	searches: Record<string, number>;
	/** Normalized queries that found something. */
	hits: Record<string, StoredQuery>;
	/** Normalized queries that found nothing. */
	misses: Record<string, StoredQuery>;
	/** Queries rejected as probes or junk, counted without keeping what they said. */
	rejected: number;
	/** Calls per MCP tool name. */
	tools: Record<string, number>;
	/** `get_package` calls per package name asked for, published or not. */
	packages: Record<string, number>;
}

/** A day's queries for one outcome; anything else in a stored day reads as an empty day. */
const QUERIES_SCHEMA = s.record(
	s.string(),
	s.object({ count: s.number(), surfaces: s.array(s.string()) }),
);

/** What a stored day must look like to be counted; days stored before hits were kept have none. */
const DAY_SCHEMA = s.object({
	searches: s.record(s.string(), s.number()),
	hits: s.optional(QUERIES_SCHEMA),
	misses: QUERIES_SCHEMA,
	rejected: s.optional(s.number()),
	tools: s.record(s.string(), s.number()),
	packages: s.record(s.string(), s.number()),
});

/** A query, summed over the window. */
export interface QueryCount {
	query: string;
	count: number;
	/** Every surface it was typed on. */
	surfaces: SearchSurface[];
	/** The latest day it was recorded, as `YYYY-MM-DD`. */
	lastSeen: string;
}

/** Searches with no results and MCP tool calls, summed over the last 30 days. */
export interface SiteEventsSnapshot {
	/** Each day the counts cover, oldest first, as `YYYY-MM-DD`. */
	days: string[];
	/** Searches per surface, the dialog's keystrokes collapsed into the queries meant. */
	searches: Record<SearchSurface, number>;
	/** Every search that found something, each surface included. */
	hitCount: number;
	/** The most frequent queries that found something, most frequent first. */
	hits: QueryCount[];
	/** Every search that found nothing, each surface included. */
	missCount: number;
	/** The most frequent missed queries, most frequent first. */
	misses: QueryCount[];
	/** Queries left out as injection probes, payloads or junk; only how many is kept. */
	rejectedCount: number;
	/** Every MCP tool call. */
	toolCallCount: number;
	/** Calls per tool, most called first. */
	tools: Array<{ name: string; count: number }>;
	/** Packages asked for through `get_package`, most asked first. */
	packages: Array<{ name: string; count: number }>;
}

/**
 * The form a query is counted under, so "WebSockets " and "websockets" are one row.
 *
 * @param query What was typed.
 * @returns The query trimmed, lowercased, with runs of whitespace collapsed and cut to 200.
 */
export function normalizeQuery(query: string): string {
	return query.trim().toLowerCase().replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH);
}

/**
 * Whether a normalized query reads as something a person or agent looks up. Scanners send SQL
 * and script payloads to every search box, and those would otherwise top the tables.
 *
 * @param query A normalized query.
 * @returns `true` for 3 to 80 characters with a letter, written only in word characters and
 * the punctuation of names, paths and versions.
 */
export function isPlausibleQuery(query: string): boolean {
	if (query.length < MIN_QUERY_LENGTH || query.length > MAX_RECORDED_QUERY_LENGTH) return false;
	return PLAUSIBLE_QUERY.test(query) && /\p{L}/u.test(query);
}

/**
 * Counts one request's event after the response, in the invocation's `waitUntil`. A failure is
 * logged and dropped: the counts are a sample, and a request never fails over them.
 *
 * @param event What the request asked for.
 */
export function recordSiteEvent(event: SiteEvent): void {
	let log = currentLog();
	let work = (async () => {
		let result = await applySiteEvent(siteCache(), event, new Date());
		if (isFailure(result)) log?.warn("site_events.unrecorded", { reason: result.error.message });
	})().catch((error: unknown) => {
		log?.warn("site_events.unrecorded", { reason: String(error) });
	});
	waitUntil(work);
}

/**
 * Folds one event into today's entry with a read and at most one write. Two requests folding
 * at once each write what they read plus their own event, so one of the increments is lost;
 * the page shows a sample, and that is the cost of one key per day rather than one per event.
 *
 * @param cache Where the days are kept.
 * @param event What to count.
 * @param now When it happened, which picks the UTC day.
 * @returns Whether the day was written; an event with nothing to count writes nothing.
 */
export async function applySiteEvent(
	cache: Cache,
	event: SiteEvent,
	now: Date,
): Promise<Result<boolean, Error>> {
	let key = `${SITE_EVENTS_KEY_PREFIX}${dayOf(now)}`;
	let stored = await cache.read<SiteEventsDay>(key);
	if (isFailure(stored)) return failure(stored.error);

	let day = parseDay(stored.data);
	let changed = foldSearch(day, event.search);
	if (event.tool !== undefined) {
		increment(day.tools, event.tool.name);
		let name = event.tool.package?.trim().toLowerCase().slice(0, MAX_PACKAGE_LENGTH);
		if (name) increment(day.packages, name);
		changed = true;
	}
	if (!changed) return success(false);

	let written = await cache.write(key, day, { ttl: DAY_TTL });
	if (isFailure(written)) return failure(written.error);
	return success(true);
}

/**
 * Counts a search into the day, as a hit or a miss. The dialog re-searches on every keystroke,
 * so a dialog query that a recorded dialog query already extends is skipped (a reader
 * backspacing), and each dialog-only query the new one extends gives back one count.
 *
 * @returns Whether the day changed. A query under three characters is a reader still typing and
 * changes nothing; an implausible one only adds to the rejected count.
 */
function foldSearch(day: SiteEventsDay, search: SiteEvent["search"]): boolean {
	if (search === undefined) return false;
	let { surface } = search;
	let query = normalizeQuery(search.query);
	if (query.length < MIN_QUERY_LENGTH) return false;
	if (!isPlausibleQuery(query)) {
		day.rejected += 1;
		return true;
	}

	if (surface === "dialog") {
		if (extendsNoFurther(day, query)) return false;
		retractPrefixes(day, query);
	}

	increment(day.searches, surface);
	let queries = search.results === 0 ? day.misses : day.hits;
	let stored = queries[query];
	if (stored === undefined) {
		if (Object.keys(queries).length >= MAX_QUERIES_PER_DAY) return true;
		queries[query] = { count: 1, surfaces: [surface] };
		return true;
	}
	stored.count += 1;
	if (!stored.surfaces.includes(surface)) stored.surfaces.push(surface);
	return true;
}

/** Whether a dialog query already recorded today starts with `query`: a reader backspacing. */
function extendsNoFurther(day: SiteEventsDay, query: string): boolean {
	return [day.hits, day.misses].some((queries) =>
		Object.entries(queries).some(
			([recorded, stored]) =>
				recorded !== query && recorded.startsWith(query) && stored.surfaces.includes("dialog"),
		),
	);
}

/**
 * Takes one count back from each dialog-only query that `query` extends, hit or miss, on the
 * reading that the reader who typed the shorter query kept typing; one left at zero is removed.
 */
function retractPrefixes(day: SiteEventsDay, query: string): void {
	for (let queries of [day.hits, day.misses]) {
		for (let [recorded, stored] of Object.entries(queries)) {
			if (recorded === query || !query.startsWith(recorded)) continue;
			if (stored.surfaces.length !== 1 || stored.surfaces[0] !== "dialog") continue;
			stored.count -= 1;
			let dialog = day.searches.dialog ?? 0;
			if (dialog > 0) day.searches.dialog = dialog - 1;
			if (stored.count <= 0) delete queries[recorded];
		}
	}
}

/** Adds one to a counter, starting it at one. */
function increment(counts: Record<string, number>, key: string): void {
	counts[key] = (counts[key] ?? 0) + 1;
}

/** A stored day, or an empty one when nothing is stored or what is stored has another shape. */
function parseDay(value: unknown): SiteEventsDay {
	let parsed = s.parseSafe(DAY_SCHEMA, value);
	if (parsed.success) {
		return { ...parsed.value, hits: parsed.value.hits ?? {}, rejected: parsed.value.rejected ?? 0 };
	}
	return { searches: {}, hits: {}, misses: {}, rejected: 0, tools: {}, packages: {} };
}

/** The UTC calendar day of a moment, as `YYYY-MM-DD`. */
function dayOf(moment: Date): string {
	return moment.toISOString().slice(0, 10);
}

/**
 * The counts the stats page shows: the last 30 days, today included, read in parallel and
 * summed. A day that cannot be read counts as empty.
 *
 * @param cache Where the counts are kept.
 * @param now The moment the window ends at.
 * @returns The counts, or `null` when nothing has been recorded.
 */
export async function readSiteEvents(
	cache: Cache,
	now: Date = new Date(),
): Promise<SiteEventsSnapshot | null> {
	let days: string[] = [];
	for (let back = WINDOW_DAYS - 1; back >= 0; back--) {
		days.push(dayOf(new Date(now.getTime() - back * DAY_MS)));
	}

	let reads = await Promise.all(
		days.map((day) => cache.read<SiteEventsDay>(`${SITE_EVENTS_KEY_PREFIX}${day}`)),
	);
	let stored = reads.flatMap((read, index) =>
		isSuccess(read) && read.data !== null ? [{ day: days[index] ?? "", data: read.data }] : [],
	);
	if (stored.length === 0) return null;

	return summarize(
		days,
		stored.map(({ day, data }) => ({ day, counts: parseDay(data) })),
	);
}

/** Sums days, oldest first, into the snapshot the page renders. */
function summarize(
	days: string[],
	stored: Array<{ day: string; counts: SiteEventsDay }>,
): SiteEventsSnapshot {
	let searches: Record<SearchSurface, number> = {
		page: 0,
		dialog: 0,
		search_docs: 0,
		search_packages: 0,
	};
	let hits = new Map<string, QueryCount>();
	let misses = new Map<string, QueryCount>();
	let tools: Record<string, number> = {};
	let packages: Record<string, number> = {};
	let rejected = 0;

	for (let { day, counts } of stored) {
		for (let surface of SEARCH_SURFACES) searches[surface] += counts.searches[surface] ?? 0;
		rejected += counts.rejected;
		rejected += addQueries(hits, counts.hits, day);
		rejected += addQueries(misses, counts.misses, day);
		for (let [name, count] of Object.entries(counts.tools))
			tools[name] = (tools[name] ?? 0) + count;
		for (let [name, count] of Object.entries(counts.packages)) {
			packages[name] = (packages[name] ?? 0) + count;
		}
	}

	return {
		days,
		searches,
		hitCount: totalCount(hits),
		hits: topQueries(hits),
		missCount: totalCount(misses),
		misses: topQueries(misses),
		rejectedCount: rejected,
		toolCallCount: Object.values(tools).reduce((sum, count) => sum + count, 0),
		tools: ranked(tools),
		packages: ranked(packages).slice(0, TOP_ROWS),
	};
}

/**
 * Adds one day's queries into the window's totals, that day becoming each one's last seen. Days
 * stored before probes were rejected can hold some, which are counted as rejected instead.
 *
 * @returns How many searches were left out as implausible.
 */
function addQueries(
	totals: Map<string, QueryCount>,
	queries: Record<string, StoredQuery>,
	day: string,
): number {
	let rejected = 0;
	for (let [query, stored] of Object.entries(queries)) {
		if (!isPlausibleQuery(query)) {
			rejected += stored.count;
			continue;
		}
		let total = totals.get(query) ?? { query, count: 0, surfaces: [], lastSeen: day };
		total.count += stored.count;
		total.lastSeen = day;
		for (let surface of stored.surfaces) {
			if (isSurface(surface) && !total.surfaces.includes(surface)) total.surfaces.push(surface);
		}
		totals.set(query, total);
	}
	return rejected;
}

/** Every search counted in a window's queries. */
function totalCount(totals: Map<string, QueryCount>): number {
	return [...totals.values()].reduce((sum, query) => sum + query.count, 0);
}

/** The most frequent queries, ties broken by the most recently seen. */
function topQueries(totals: Map<string, QueryCount>): QueryCount[] {
	return [...totals.values()]
		.sort((a, b) => b.count - a.count || b.lastSeen.localeCompare(a.lastSeen))
		.slice(0, TOP_ROWS);
}

/** Counters as rows, most first, ties by name so the order is stable between reads. */
function ranked(counts: Record<string, number>): Array<{ name: string; count: number }> {
	return Object.entries(counts)
		.map(([name, count]) => ({ name, count }))
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Whether a stored surface name is one this page knows how to label. */
function isSurface(value: string): value is SearchSurface {
	return (SEARCH_SURFACES as readonly string[]).includes(value);
}
