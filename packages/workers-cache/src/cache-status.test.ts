/**
 * Covers the cache status readers: `cf-cache-status` values mapping onto each
 * status, with absent or unrecognized values reading as unknown, and RFC 9211
 * `Cache-Status` hops read from the RFC's own examples.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { cacheHops, cacheStatus } from "./cache-status.js";
import { CACHE_STATUS_HEADER } from "./platform.js";

function respond(status?: string): Response {
	return new Response("ok", {
		headers: status === undefined ? {} : { [CACHE_STATUS_HEADER]: status },
	});
}

describe("cacheStatus", () => {
	test("reads a hit and a miss", () => {
		expect(cacheStatus(respond("HIT"))).toBe("hit");
		expect(cacheStatus(respond("MISS"))).toBe("miss");
	});

	test("collapses stale-entry values onto expired", () => {
		expect(cacheStatus(respond("EXPIRED"))).toBe("expired");
		expect(cacheStatus(respond("STALE"))).toBe("expired");
		expect(cacheStatus(respond("REVALIDATED"))).toBe("expired");
		expect(cacheStatus(respond("UPDATING"))).toBe("expired");
	});

	test("collapses values meaning the cache took no part onto bypass", () => {
		expect(cacheStatus(respond("BYPASS"))).toBe("bypass");
		expect(cacheStatus(respond("DYNAMIC"))).toBe("bypass");
	});

	test("tolerates casing and surrounding whitespace", () => {
		expect(cacheStatus(respond("hit"))).toBe("hit");
		expect(cacheStatus(respond(" Miss "))).toBe("miss");
	});

	test("reads a missing header as unknown rather than a miss", () => {
		expect(cacheStatus(respond())).toBe("unknown");
		expect(cacheStatus(respond(""))).toBe("unknown");
	});

	test("reads an unrecognized value as unknown", () => {
		expect(cacheStatus(respond("NONE"))).toBe("unknown");
		expect(cacheStatus(respond("something-new"))).toBe("unknown");
	});
});

/** Builds a response carrying one `Cache-Status` line per argument. */
function withCacheStatus(...lines: string[]): Response {
	let headers = new Headers();
	for (let line of lines) headers.append("Cache-Status", line);
	return new Response("ok", { headers });
}

describe("cacheHops", () => {
	test("reads a hit with its remaining freshness", () => {
		expect(cacheHops(withCacheStatus("ReverseProxyCache; hit; ttl=376"))).toEqual([
			{ cache: "ReverseProxyCache", hit: true, ttl: 376 },
		]);
	});

	test("reads a forwarded request that the cache then stored", () => {
		expect(cacheHops(withCacheStatus("ForwardProxyCache; fwd=uri-miss; stored"))).toEqual([
			{ cache: "ForwardProxyCache", fwd: "uri-miss", stored: true },
		]);
	});

	test("reads a revalidation with the next hop's status and a stale ttl", () => {
		expect(
			cacheHops(withCacheStatus("ExampleCache; fwd=stale; fwd-status=304; ttl=-412; collapsed")),
		).toEqual([
			{ cache: "ExampleCache", fwd: "stale", fwdStatus: 304, ttl: -412, collapsed: true },
		]);
	});

	test("reads every hop in order, closest to the origin first", () => {
		let response = withCacheStatus('OriginCache; hit; ttl=1100, "CDN Company Here"; hit; ttl=545');

		expect(cacheHops(response)).toEqual([
			{ cache: "OriginCache", hit: true, ttl: 1100 },
			{ cache: "CDN Company Here", hit: true, ttl: 545 },
		]);
	});

	test("joins repeated field lines into one list", () => {
		let response = withCacheStatus("OriginCache; hit", "EdgeCache; fwd=miss");

		expect(cacheHops(response)).toEqual([
			{ cache: "OriginCache", hit: true },
			{ cache: "EdgeCache", fwd: "miss" },
		]);
	});

	test("reads key and detail, taking a Token detail as its text", () => {
		let response = withCacheStatus(
			'ExampleCache; hit; key="https://example.com/a"; detail=memory',
			'OtherCache; fwd=request; detail="client no-cache"',
		);

		expect(cacheHops(response)).toEqual([
			{ cache: "ExampleCache", hit: true, key: "https://example.com/a", detail: "memory" },
			{ cache: "OtherCache", fwd: "request", detail: "client no-cache" },
		]);
	});

	test("drops extension parameters", () => {
		expect(cacheHops(withCacheStatus("ExampleCache; hit; region=eu"))).toEqual([
			{ cache: "ExampleCache", hit: true },
		]);
	});

	test("reads an absent field as no hops", () => {
		expect(cacheHops(new Response("ok"))).toEqual([]);
	});

	test("ignores a field that is not a valid Structured Field List", () => {
		expect(cacheHops(withCacheStatus("ExampleCache; hit,"))).toEqual([]);
	});

	test("ignores a field whose parameters break RFC 9211", () => {
		expect(cacheHops(withCacheStatus("ExampleCache; fwd=teleported"))).toEqual([]);
		expect(cacheHops(withCacheStatus("ExampleCache; ttl=soon"))).toEqual([]);
	});
});
