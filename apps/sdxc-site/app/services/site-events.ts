/**
 * What readers and agents ask sdxc.dev for: searches that found nothing, and which MCP tools
 * are called for which packages, counted per day in the site cache so the stats page can show
 * what the documentation is missing.
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

/** Queries shorter than this are a reader still typing, and are not recorded as misses. */
const MIN_QUERY_LENGTH = 3;

/** Longer queries are cut to this, which is also the longest the MCP tools accept. */
const MAX_QUERY_LENGTH = 200;

/** Longest package name kept from a `get_package` call. */
const MAX_PACKAGE_LENGTH = 100;

/** Distinct missed queries one day keeps, so a flood of junk cannot grow an entry unbounded. */
const MAX_MISSES_PER_DAY = 500;

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

/** A missed query as one day stores it. */
interface StoredMiss {
	count: number;
	surfaces: string[];
}

/** One day's counts, as the entry under `site-events:<YYYY-MM-DD>` holds them. */
export interface SiteEventsDay {
	/** Searches per surface; the dialog counts only its misses, since it searches per keystroke. */
	searches: Record<string, number>;
	/** Normalized queries that found nothing. */
	misses: Record<string, StoredMiss>;
	/** Calls per MCP tool name. */
	tools: Record<string, number>;
	/** `get_package` calls per package name asked for, published or not. */
	packages: Record<string, number>;
}

/** What a stored day must look like to be counted; anything else reads as an empty day. */
const DAY_SCHEMA = s.object({
	searches: s.record(s.string(), s.number()),
	misses: s.record(s.string(), s.object({ count: s.number(), surfaces: s.array(s.string()) })),
	tools: s.record(s.string(), s.number()),
	packages: s.record(s.string(), s.number()),
});

/** A query that found nothing, summed over the window. */
export interface MissedQuery {
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
	/** Searches per surface; the dialog's figure is its misses alone. */
	searches: Record<SearchSurface, number>;
	/** Every search that found nothing, each surface included. */
	missCount: number;
	/** The most frequent missed queries, most frequent first. */
	misses: MissedQuery[];
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
 * Counts a search into the day. The dialog re-searches on every keystroke, so it counts only
 * a miss of three characters or more, skips one that extends no further than a miss it already
 * recorded, and takes back one count from each dialog-only miss the new one extends.
 *
 * @returns Whether the day changed.
 */
function foldSearch(day: SiteEventsDay, search: SiteEvent["search"]): boolean {
	if (search === undefined) return false;
	let { surface } = search;
	let query = normalizeQuery(search.query);
	let missed = search.results === 0 && query.length >= MIN_QUERY_LENGTH;

	if (surface === "dialog") {
		if (!missed) return false;
		if (extendsNoFurther(day, query)) return false;
		retractPrefixes(day, query);
	}

	increment(day.searches, surface);
	if (!missed) return true;

	let miss = day.misses[query];
	if (miss === undefined) {
		if (Object.keys(day.misses).length >= MAX_MISSES_PER_DAY) return true;
		day.misses[query] = { count: 1, surfaces: [surface] };
		return true;
	}
	miss.count += 1;
	if (!miss.surfaces.includes(surface)) miss.surfaces.push(surface);
	return true;
}

/** Whether a dialog miss already recorded today starts with `query`: a reader backspacing. */
function extendsNoFurther(day: SiteEventsDay, query: string): boolean {
	return Object.entries(day.misses).some(
		([recorded, miss]) =>
			recorded !== query && recorded.startsWith(query) && miss.surfaces.includes("dialog"),
	);
}

/**
 * Takes one count back from each dialog-only miss that `query` extends, on the reading that
 * the reader who typed the shorter query kept typing; a miss left at zero is removed.
 */
function retractPrefixes(day: SiteEventsDay, query: string): void {
	for (let [recorded, miss] of Object.entries(day.misses)) {
		if (recorded === query || !query.startsWith(recorded)) continue;
		if (miss.surfaces.length !== 1 || miss.surfaces[0] !== "dialog") continue;
		miss.count -= 1;
		let dialog = day.searches.dialog ?? 0;
		if (dialog > 0) day.searches.dialog = dialog - 1;
		if (miss.count <= 0) delete day.misses[recorded];
	}
}

/** Adds one to a counter, starting it at one. */
function increment(counts: Record<string, number>, key: string): void {
	counts[key] = (counts[key] ?? 0) + 1;
}

/** A stored day, or an empty one when nothing is stored or what is stored has another shape. */
function parseDay(value: unknown): SiteEventsDay {
	let parsed = s.parseSafe(DAY_SCHEMA, value);
	if (parsed.success) return parsed.value;
	return { searches: {}, misses: {}, tools: {}, packages: {} };
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
	let misses = new Map<string, MissedQuery>();
	let tools: Record<string, number> = {};
	let packages: Record<string, number> = {};

	for (let { day, counts } of stored) {
		for (let surface of SEARCH_SURFACES) searches[surface] += counts.searches[surface] ?? 0;
		for (let [query, miss] of Object.entries(counts.misses)) {
			let total = misses.get(query) ?? { query, count: 0, surfaces: [], lastSeen: day };
			total.count += miss.count;
			total.lastSeen = day;
			for (let surface of miss.surfaces) {
				if (isSurface(surface) && !total.surfaces.includes(surface)) total.surfaces.push(surface);
			}
			misses.set(query, total);
		}
		for (let [name, count] of Object.entries(counts.tools))
			tools[name] = (tools[name] ?? 0) + count;
		for (let [name, count] of Object.entries(counts.packages)) {
			packages[name] = (packages[name] ?? 0) + count;
		}
	}

	let allMisses = [...misses.values()];
	return {
		days,
		searches,
		missCount: allMisses.reduce((sum, miss) => sum + miss.count, 0),
		misses: allMisses
			.sort((a, b) => b.count - a.count || b.lastSeen.localeCompare(a.lastSeen))
			.slice(0, TOP_ROWS),
		toolCallCount: Object.values(tools).reduce((sum, count) => sum + count, 0),
		tools: ranked(tools),
		packages: ranked(packages).slice(0, TOP_ROWS),
	};
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
