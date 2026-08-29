/**
 * Covers the cache status reader: the header values that map onto each status,
 * the case and whitespace tolerance, and that an absent or unrecognized value
 * reads as unknown, a status distinct from a miss.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { cacheStatus } from "./cache-status";
import { CACHE_STATUS_HEADER } from "./platform";

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
