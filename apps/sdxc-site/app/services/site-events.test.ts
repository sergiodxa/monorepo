/**
 * Tests for the site event counters: what one event folds into its day, how the dialog's
 * per-keystroke searches are kept from counting every prefix, and the 30-day summary.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { MemoryCache } from "@sdxc/cache/memory";
import { isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { SiteEvent, SiteEventsDay } from "~/app/services/site-events";

import {
	applySiteEvent,
	isPlausibleQuery,
	normalizeQuery,
	readSiteEvents,
	SITE_EVENTS_KEY_PREFIX,
} from "~/app/services/site-events";

/** The moment events in these tests happen, on 2026-10-31 in UTC. */
const NOW = new Date("2026-10-31T12:00:00Z");

/** Today's key. */
const TODAY_KEY = `${SITE_EVENTS_KEY_PREFIX}2026-10-31`;

/** Applies events in order on one cache and answers today's stored day. */
async function fold(cache: MemoryCache, events: SiteEvent[]): Promise<SiteEventsDay | null> {
	for (let event of events) await applySiteEvent(cache, event, NOW);
	let stored = await cache.read<SiteEventsDay>(TODAY_KEY);
	return isSuccess(stored) ? stored.data : null;
}

/** A dialog search for `query` that found nothing. */
function dialogMiss(query: string): SiteEvent {
	return { search: { surface: "dialog", query, results: 0 } };
}

describe("normalizeQuery", () => {
	test("trims, lowercases and collapses whitespace", () => {
		expect(normalizeQuery("  Web   Sockets\t")).toBe("web sockets");
	});
});

describe("applySiteEvent", () => {
	test("counts a page search and records its miss under the normalized query", async () => {
		let day = await fold(new MemoryCache(), [
			{ search: { surface: "page", query: "WebSockets ", results: 0 } },
			{ search: { surface: "page", query: "result", results: 4 } },
			{ search: { surface: "search_docs", query: "websockets", results: 0 } },
		]);

		expect(day?.searches).toEqual({ page: 2, search_docs: 1 });
		expect(day?.misses).toEqual({
			websockets: { count: 2, surfaces: ["page", "search_docs"] },
		});
	});

	test("records nothing for a query under three characters", async () => {
		let cache = new MemoryCache();
		let written = await applySiteEvent(
			cache,
			{ search: { surface: "page", query: "ws", results: 0 } },
			NOW,
		);

		expect(isSuccess(written) && written.data).toBe(false);
		expect(await fold(cache, [])).toBeNull();
	});

	test("counts injection probes, payloads and bare numbers as rejected, keeping no text", async () => {
		let cache = new MemoryCache();
		let probes = [
			"1 and extractvalue(1,concat(0x7e,((select (elt(1=1,1)))),0x7e))",
			"1')",
			`1,'".)(abcd`,
			"98766",
			"<script>alert(1)</script>",
			"a".repeat(81),
		];
		for (let query of probes) {
			await applySiteEvent(cache, { search: { surface: "page", query, results: 0 } }, NOW);
		}

		let day = await fold(cache, []);
		expect(day?.rejected).toBe(probes.length);
		expect(day?.hits).toEqual({});
		expect(day?.misses).toEqual({});
		expect(day?.searches).toEqual({});
		expect(isPlausibleQuery("@sdxc/jwt")).toBe(true);
		expect(isPlausibleQuery("remix v3 middleware")).toBe(true);
	});

	test("records a search that found something as a hit", async () => {
		let day = await fold(new MemoryCache(), [
			{ search: { surface: "page", query: "Result", results: 3 } },
			{ search: { surface: "search_docs", query: "result", results: 1 } },
		]);

		expect(day?.hits).toEqual({ result: { count: 2, surfaces: ["page", "search_docs"] } });
		expect(day?.misses).toEqual({});
		expect(day?.searches).toEqual({ page: 1, search_docs: 1 });
	});

	test("collapses dialog keystrokes across hits and misses into the longest query", async () => {
		let day = await fold(new MemoryCache(), [
			{ search: { surface: "dialog", query: "web", results: 4 } },
			{ search: { surface: "dialog", query: "webso", results: 1 } },
			{ search: { surface: "dialog", query: "websockz", results: 0 } },
		]);

		expect(day?.hits).toEqual({});
		expect(day?.misses).toEqual({ websockz: { count: 1, surfaces: ["dialog"] } });
		expect(day?.searches).toEqual({ dialog: 1 });
	});

	test("records a reader typing in the dialog once, under the longest query", async () => {
		let day = await fold(new MemoryCache(), [
			dialogMiss("zzq"),
			dialogMiss("zzqx"),
			dialogMiss("zzqxy"),
			dialogMiss("zzqx"),
		]);

		expect(day?.misses).toEqual({ zzqxy: { count: 1, surfaces: ["dialog"] } });
		expect(day?.searches).toEqual({ dialog: 1 });
	});

	test("keeps a prefix another surface recorded when the dialog extends it", async () => {
		let day = await fold(new MemoryCache(), [
			{ search: { surface: "page", query: "zzq", results: 0 } },
			dialogMiss("zzqx"),
		]);

		expect(day?.misses).toEqual({
			zzq: { count: 1, surfaces: ["page"] },
			zzqx: { count: 1, surfaces: ["dialog"] },
		});
	});

	test("counts tool calls and the package asked for", async () => {
		let day = await fold(new MemoryCache(), [
			{ tool: { name: "get_package", package: " Result" } },
			{ tool: { name: "get_package", package: "result" } },
			{ tool: { name: "list_packages" } },
		]);

		expect(day?.tools).toEqual({ get_package: 2, list_packages: 1 });
		expect(day?.packages).toEqual({ result: 2 });
	});

	test("starts over from an entry stored in another shape", async () => {
		let cache = new MemoryCache();
		await cache.write(TODAY_KEY, { searches: "garbage" });
		let day = await fold(cache, [{ tool: { name: "list_packages" } }]);

		expect(day).toEqual({
			searches: {},
			hits: {},
			misses: {},
			rejected: 0,
			tools: { list_packages: 1 },
			packages: {},
		});
	});
});

describe("readSiteEvents", () => {
	test("answers null when nothing is recorded", async () => {
		expect(await readSiteEvents(new MemoryCache(), NOW)).toBeNull();
	});

	test("counts probes stored before rejection as rejected and leaves them out", async () => {
		let cache = new MemoryCache();
		await cache.write(TODAY_KEY, {
			searches: { page: 3 },
			misses: {
				"1')": { count: 2, surfaces: ["page"] },
				opml: { count: 1, surfaces: ["page"] },
			},
			tools: {},
			packages: {},
		});
		await applySiteEvent(
			cache,
			{ search: { surface: "page", query: "1 and sleep(5)", results: 0 } },
			NOW,
		);

		let snapshot = await readSiteEvents(cache, NOW);

		expect(snapshot?.rejectedCount).toBe(3);
		expect(snapshot?.misses.map((miss) => miss.query)).toEqual(["opml"]);
		expect(snapshot?.missCount).toBe(1);
	});

	test("sums the last 30 days and ranks what was asked for", async () => {
		let cache = new MemoryCache();
		let earlier = new Date("2026-10-20T12:00:00Z");
		let outside = new Date("2026-09-20T12:00:00Z");
		await applySiteEvent(
			cache,
			{ search: { surface: "page", query: "opml", results: 0 } },
			earlier,
		);
		await applySiteEvent(cache, { tool: { name: "get_package", package: "jwt" } }, earlier);
		await applySiteEvent(cache, { tool: { name: "get_package", package: "jwt" } }, outside);
		await fold(cache, [
			{ search: { surface: "search_packages", query: "opml", results: 0 } },
			{ search: { surface: "page", query: "zzzz", results: 0 } },
			{ search: { surface: "page", query: "result", results: 2 } },
			{ tool: { name: "get_package", package: "result" } },
			{ tool: { name: "get_package", package: "result" } },
		]);

		let snapshot = await readSiteEvents(cache, NOW);

		expect(snapshot?.days).toHaveLength(30);
		expect(snapshot?.days.at(0)).toBe("2026-10-02");
		expect(snapshot?.days.at(-1)).toBe("2026-10-31");
		expect(snapshot?.searches).toEqual({ page: 3, dialog: 0, search_docs: 0, search_packages: 1 });
		expect(snapshot?.hitCount).toBe(1);
		expect(snapshot?.hits).toEqual([
			{ query: "result", count: 1, surfaces: ["page"], lastSeen: "2026-10-31" },
		]);
		expect(snapshot?.missCount).toBe(3);
		expect(snapshot?.misses).toEqual([
			{ query: "opml", count: 2, surfaces: ["page", "search_packages"], lastSeen: "2026-10-31" },
			{ query: "zzzz", count: 1, surfaces: ["page"], lastSeen: "2026-10-31" },
		]);
		expect(snapshot?.toolCallCount).toBe(3);
		expect(snapshot?.tools).toEqual([{ name: "get_package", count: 3 }]);
		expect(snapshot?.packages).toEqual([
			{ name: "result", count: 2 },
			{ name: "jwt", count: 1 },
		]);
	});
});
