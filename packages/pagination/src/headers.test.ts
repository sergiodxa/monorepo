/**
 * Tests for `paginate()`.
 *
 * `Link` is shared with resource hints, so the merge is what is really under test:
 * a preload hint must survive, a second call must be idempotent, and a hint
 * whose URL contains a comma must come back out intact.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { KeysetPage, Page } from "./pagination";

import { paginate } from "./headers";
import { parseLinkHeader } from "./link";
import { Pagination } from "./pagination";

/** Builds an offset page whose rows are irrelevant to the headers under test. */
function offsetPage(page: number, perPage: number, total: number): Page<number> {
	return { items: [], pagination: new Pagination({ page, perPage, total }) };
}

function keysetPage(next: string | null, prev: string | null): KeysetPage<number> {
	return { items: [], cursors: { next, prev } };
}

/** Maps a header's links to `rel` and target pairs, so assertions read as navigation. */
function relations(headers: Headers): Record<string, string> {
	let entries: Record<string, string> = {};
	for (let link of parseLinkHeader(headers.get("Link"))) {
		for (let rel of link.rels) entries[rel] = link.target;
	}
	return entries;
}

/** A request URL carrying unrelated filters, so their survival is always asserted. */
const URL_BASE = "https://api.example.com/monitors?status=up&sort=name";

describe("paginate() with an offset page", () => {
	test("returns the same Headers instance so it can be used inline", () => {
		let headers = new Headers();

		expect(paginate(headers, offsetPage(3, 25, 892), { url: URL_BASE })).toBe(headers);
	});

	test("advertises all four relations and the total", () => {
		let headers = paginate(new Headers(), offsetPage(3, 25, 892), { url: URL_BASE });

		expect(relations(headers)).toEqual({
			first: "https://api.example.com/monitors?status=up&sort=name&page=1",
			prev: "https://api.example.com/monitors?status=up&sort=name&page=2",
			next: "https://api.example.com/monitors?status=up&sort=name&page=4",
			last: "https://api.example.com/monitors?status=up&sort=name&page=36",
		});
		expect(headers.get("X-Total-Count")).toBe("892");
	});

	test("omits prev on the first page and next on the last", () => {
		let first = relations(paginate(new Headers(), offsetPage(1, 25, 892), { url: URL_BASE }));
		let last = relations(paginate(new Headers(), offsetPage(36, 25, 892), { url: URL_BASE }));

		expect(Object.keys(first).sort()).toEqual(["first", "last", "next"]);
		expect(Object.keys(last).sort()).toEqual(["first", "last", "prev"]);
	});

	test("still advertises first and last for an empty result", () => {
		let headers = paginate(new Headers(), offsetPage(1, 25, 0), { url: URL_BASE });

		expect(Object.keys(relations(headers)).sort()).toEqual(["first", "last"]);
		expect(headers.get("X-Total-Count")).toBe("0");
	});

	test("preserves every unrelated query parameter", () => {
		let headers = paginate(new Headers(), offsetPage(2, 10, 100), {
			url: "https://api.example.com/x?q=a%20b&tag=one&tag=two",
		});

		let next = new URL(relations(headers).next ?? "");
		expect(next.searchParams.get("q")).toBe("a b");
		expect(next.searchParams.getAll("tag")).toEqual(["one", "two"]);
	});

	test("replaces a page parameter the request already carried", () => {
		let headers = paginate(new Headers(), offsetPage(2, 10, 100), {
			url: "https://api.example.com/x?page=2",
		});

		expect(relations(headers).next).toBe("https://api.example.com/x?page=3");
	});

	test("drops a stale cursor, which page numbers cannot navigate with", () => {
		let headers = paginate(new Headers(), offsetPage(2, 10, 100), {
			url: "https://api.example.com/x?cursor=abc",
		});

		expect(relations(headers).next).toBe("https://api.example.com/x?page=3");
	});

	test("accepts a URL instance as well as a string", () => {
		let headers = paginate(new Headers(), offsetPage(1, 10, 100), { url: new URL(URL_BASE) });

		expect(relations(headers).last).toContain("page=10");
	});

	test("does not mutate the URL it was handed", () => {
		let url = new URL(URL_BASE);
		paginate(new Headers(), offsetPage(1, 10, 100), { url });

		expect(url.searchParams.has("page")).toBe(false);
	});
});

describe("paginate() Link merging", () => {
	test("keeps a preload hint beside the paging relations", () => {
		let headers = new Headers();
		headers.set("Link", '</style.css>; rel="preload"; as="style"');

		paginate(headers, offsetPage(2, 10, 100), { url: URL_BASE });

		let links = parseLinkHeader(headers.get("Link"));
		expect(links[0]?.raw).toBe('</style.css>; rel="preload"; as="style"');
		expect(links.map((link) => link.rels.join())).toEqual([
			"preload",
			"first",
			"prev",
			"next",
			"last",
		]);
	});

	test("keeps a preload hint whose URL contains a comma", () => {
		let headers = new Headers();
		headers.set("Link", '</assets/a,b.css>; rel="preload"; as="style"');

		paginate(headers, offsetPage(2, 10, 100), { url: URL_BASE });

		let links = parseLinkHeader(headers.get("Link"));
		expect(links).toHaveLength(5);
		expect(links[0]?.target).toBe("/assets/a,b.css");
		expect(links[0]?.raw).toBe('</assets/a,b.css>; rel="preload"; as="style"');
	});

	test("keeps canonical, alternate, and preconnect hints", () => {
		let headers = new Headers();
		headers.set(
			"Link",
			'<https://example.com/x>; rel="canonical", <https://cdn.example.com>; rel="preconnect", </feed.xml>; rel="alternate"; type="application/atom+xml"',
		);

		paginate(headers, offsetPage(1, 10, 100), { url: URL_BASE });

		expect(Object.keys(relations(headers)).sort()).toEqual([
			"alternate",
			"canonical",
			"first",
			"last",
			"next",
			"preconnect",
		]);
	});

	test("is idempotent, so calling it twice writes the same header", () => {
		let headers = new Headers();
		headers.set("Link", '</style.css>; rel="preload"');

		paginate(headers, offsetPage(2, 10, 100), { url: URL_BASE });
		let once = headers.get("Link");

		paginate(headers, offsetPage(2, 10, 100), { url: URL_BASE });

		expect(headers.get("Link")).toBe(once);
		expect(parseLinkHeader(headers.get("Link"))).toHaveLength(5);
	});

	test("replaces its own relations rather than appending to them", () => {
		let headers = new Headers();
		paginate(headers, offsetPage(2, 10, 100), { url: URL_BASE });
		paginate(headers, offsetPage(5, 10, 100), { url: URL_BASE });

		expect(relations(headers).next).toContain("page=6");
		expect(parseLinkHeader(headers.get("Link"))).toHaveLength(4);
	});

	test("drops a stale paging relation left behind by an earlier page", () => {
		let headers = new Headers();
		paginate(headers, offsetPage(2, 10, 100), { url: URL_BASE });
		paginate(headers, offsetPage(1, 10, 100), { url: URL_BASE });

		expect(relations(headers).prev).toBeUndefined();
	});

	test("drops a link that pairs a paging relation with a hint", () => {
		let headers = new Headers();
		headers.set("Link", '</a>; rel="next preload"');

		paginate(headers, offsetPage(1, 10, 100), { url: URL_BASE });

		expect(relations(headers).next).toContain("page=2");
		expect(parseLinkHeader(headers.get("Link"))).toHaveLength(3);
	});

	test("leaves other headers on the response untouched", () => {
		let headers = new Headers();
		headers.set("Cache-Control", "private, max-age=60");

		paginate(headers, offsetPage(1, 10, 100), { url: URL_BASE });

		expect(headers.get("Cache-Control")).toBe("private, max-age=60");
	});
});

describe("paginate() with a keyset page", () => {
	test("advertises only the cursor relations and no total", () => {
		let headers = paginate(new Headers(), keysetPage("nextcursor", "prevcursor"), {
			url: "https://api.example.com/events?limit=50",
		});

		expect(relations(headers)).toEqual({
			prev: "https://api.example.com/events?limit=50&cursor=prevcursor",
			next: "https://api.example.com/events?limit=50&cursor=nextcursor",
		});
		expect(headers.get("X-Total-Count")).toBeNull();
	});

	test("omits a relation whose cursor is null", () => {
		let headers = paginate(new Headers(), keysetPage("nextcursor", null), { url: URL_BASE });

		expect(Object.keys(relations(headers))).toEqual(["next"]);
	});

	test("writes no Link at all for a page with no neighbours", () => {
		let headers = paginate(new Headers(), keysetPage(null, null), { url: URL_BASE });

		expect(headers.get("Link")).toBeNull();
		expect(headers.get("X-Total-Count")).toBeNull();
	});

	test("keeps a preload hint even when it adds no relations of its own", () => {
		let headers = new Headers();
		headers.set("Link", '</style.css>; rel="preload"');

		paginate(headers, keysetPage(null, null), { url: URL_BASE });

		expect(headers.get("Link")).toBe('</style.css>; rel="preload"');
	});

	test("replaces a cursor the request already carried", () => {
		let headers = paginate(new Headers(), keysetPage("fresh", null), {
			url: "https://api.example.com/events?cursor=stale&page=3",
		});

		let next = new URL(relations(headers).next ?? "");
		expect(next.searchParams.get("cursor")).toBe("fresh");
		expect(next.searchParams.has("page")).toBe(false);
	});

	test("is idempotent for a keyset page too", () => {
		let headers = new Headers();
		let page = keysetPage("nextcursor", "prevcursor");

		paginate(headers, page, { url: URL_BASE });
		let once = headers.get("Link");
		paginate(headers, page, { url: URL_BASE });

		expect(headers.get("Link")).toBe(once);
	});
});
