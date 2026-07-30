/**
 * Tests for parameter parsing and the `createPaging()` factory.
 *
 * Page parameters are untrusted text, so every way they can be wrong is asserted to
 * be a failure rather than a surprising offset. The factory is tested by round-trip:
 * a `Link` URL it advertises is fed back through its own `parse`, which is the only
 * check that actually proves the two halves cannot drift apart.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { isFailure, unwrap } from "@pkg/result";
import { ValidationError } from "@pkg/validate";

import { paginate } from "./headers";
import { parseLinkHeader } from "./link";
import { DEFAULT_MAX_PER_PAGE, DEFAULT_PAGING_NAMES, DEFAULT_PER_PAGE } from "./names";
import { Pagination } from "./pagination";
import { createPaging, parsePageParams } from "./params";

/** Builds search parameters from a query string fragment, as a request URL would carry. */
function params(query: string): URLSearchParams {
	return new URL(`https://api.example.com/x?${query}`).searchParams;
}

/** Reads the `next` link's target out of an annotated header. */
function nextLink(headers: Headers): string {
	for (let link of parseLinkHeader(headers.get("Link"))) {
		if (link.rels.includes("next")) return link.target;
	}
	throw new Error("no next link was advertised");
}

describe("parsePageParams", () => {
	test("defaults everything a request left out", () => {
		let parsed = unwrap(parsePageParams(params("")));

		expect(parsed).toEqual({ page: 1, perPage: DEFAULT_PER_PAGE, cursor: null });
	});

	test("reads a page and a page size", () => {
		expect(unwrap(parsePageParams(params("page=3&perPage=50")))).toEqual({
			page: 3,
			perPage: 50,
			cursor: null,
		});
	});

	test("rejects a non-numeric page", () => {
		let result = parsePageParams(params("page=abc"));

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error).toBeInstanceOf(ValidationError);
			expect(result.error.issues.length).toBeGreaterThan(0);
		}
	});

	test("rejects a negative page", () => {
		expect(isFailure(parsePageParams(params("page=-1")))).toBe(true);
	});

	test("rejects page zero, since pages are 1-based", () => {
		expect(isFailure(parsePageParams(params("page=0")))).toBe(true);
	});

	test("rejects a fractional page", () => {
		expect(isFailure(parsePageParams(params("page=1.5")))).toBe(true);
	});

	test("rejects a page size above maxPerPage, so a client cannot ask for everything", () => {
		let result = parsePageParams(params("perPage=5000"), { perPage: 25, maxPerPage: 100 });

		expect(isFailure(result)).toBe(true);
	});

	test("accepts a page size exactly at maxPerPage", () => {
		expect(unwrap(parsePageParams(params("perPage=100"), { maxPerPage: 100 })).perPage).toBe(100);
	});

	test("rejects a page size above the default ceiling when none is given", () => {
		expect(isFailure(parsePageParams(params(`perPage=${DEFAULT_MAX_PER_PAGE + 1}`)))).toBe(true);
	});

	test("rejects a page size below 1", () => {
		expect(isFailure(parsePageParams(params("perPage=0")))).toBe(true);
		expect(isFailure(parsePageParams(params("perPage=-10")))).toBe(true);
	});

	test("rejects a non-numeric page size", () => {
		expect(isFailure(parsePageParams(params("perPage=all")))).toBe(true);
	});

	test("honours a custom default page size", () => {
		expect(unwrap(parsePageParams(params(""), { perPage: 10 })).perPage).toBe(10);
	});

	test("is null for a missing cursor", () => {
		expect(unwrap(parsePageParams(params("page=2"))).cursor).toBeNull();
	});

	test("passes an opaque cursor straight through, uninterpreted", () => {
		expect(unwrap(parsePageParams(params("cursor=eyJ2IjoxfQ"))).cursor).toBe("eyJ2IjoxfQ");
	});

	test("treats a blank parameter as absent rather than malformed", () => {
		expect(unwrap(parsePageParams(params("page=&perPage=&cursor=")))).toEqual({
			page: 1,
			perPage: DEFAULT_PER_PAGE,
			cursor: null,
		});
	});

	test("does not clamp a page past the end, which needs a total to know about", () => {
		expect(unwrap(parsePageParams(params("page=99999"))).page).toBe(99999);
	});

	test("ignores parameters it does not own", () => {
		expect(unwrap(parsePageParams(params("status=up&page=2"))).page).toBe(2);
	});

	test("reads the default names", () => {
		expect(DEFAULT_PAGING_NAMES).toEqual({ page: "page", perPage: "perPage", cursor: "cursor" });
	});
});

describe("createPaging", () => {
	test("parses the custom names it was bound with", () => {
		let paging = createPaging({
			names: { page: "page", perPage: "per_page", cursor: "cursor" },
			perPage: 25,
			maxPerPage: 100,
		});

		expect(unwrap(paging.parse(params("page=2&per_page=50&cursor=abc")))).toEqual({
			page: 2,
			perPage: 50,
			cursor: "abc",
		});
	});

	test("ignores the default spelling once a custom one is bound", () => {
		let paging = createPaging({ names: { perPage: "per_page" } });

		expect(unwrap(paging.parse(params("perPage=50"))).perPage).toBe(DEFAULT_PER_PAGE);
	});

	test("defaults the names a caller did not rename", () => {
		let paging = createPaging({ names: { perPage: "per_page" } });

		expect(unwrap(paging.parse(params("page=4&cursor=abc")))).toMatchObject({
			page: 4,
			cursor: "abc",
		});
	});

	test("applies the page-size limits it was bound with", () => {
		let paging = createPaging({ perPage: 10, maxPerPage: 20 });

		expect(unwrap(paging.parse(params(""))).perPage).toBe(10);
		expect(isFailure(paging.parse(params("perPage=21")))).toBe(true);
	});

	test("writes the bound page name into every Link URL", () => {
		let paging = createPaging({ names: { page: "p", perPage: "per_page", cursor: "c" } });
		let page = { items: [], pagination: new Pagination({ page: 2, perPage: 25, total: 892 }) };

		let headers = paging.paginate(new Headers(), page, {
			url: "https://api.example.com/monitors?per_page=25",
		});

		let next = new URL(nextLink(headers));
		expect(next.searchParams.get("p")).toBe("3");
		expect(next.searchParams.get("per_page")).toBe("25");
		expect(next.searchParams.has("page")).toBe(false);
	});

	test("writes the bound cursor name into a keyset Link URL", () => {
		let paging = createPaging({ names: { page: "p", perPage: "per_page", cursor: "c" } });

		let headers = paging.paginate(
			new Headers(),
			{ items: [], cursors: { next: "abc", prev: null } },
			{ url: "https://api.example.com/events" },
		);

		expect(new URL(nextLink(headers)).searchParams.get("c")).toBe("abc");
	});

	test("round-trips its own advertised page back through its own parse", () => {
		let paging = createPaging({
			names: { page: "p", perPage: "per_page", cursor: "c" },
			perPage: 25,
			maxPerPage: 100,
		});
		let page = { items: [], pagination: new Pagination({ page: 2, perPage: 50, total: 892 }) };

		let headers = paging.paginate(new Headers(), page, {
			url: "https://api.example.com/monitors?per_page=50&status=up",
		});

		let advertised = new URL(nextLink(headers));

		expect(unwrap(paging.parse(advertised.searchParams))).toEqual({
			page: 3,
			perPage: 50,
			cursor: null,
		});
	});

	test("round-trips a keyset cursor back through its own parse", () => {
		let paging = createPaging({ names: { page: "p", perPage: "per_page", cursor: "c" } });

		let headers = paging.paginate(
			new Headers(),
			{ items: [], cursors: { next: "cursor-value", prev: null } },
			{ url: "https://api.example.com/events?per_page=50" },
		);

		expect(unwrap(paging.parse(new URL(nextLink(headers)).searchParams)).cursor).toBe(
			"cursor-value",
		);
	});

	test("the standalone functions agree with each other on the default names", () => {
		let page = { items: [], pagination: new Pagination({ page: 1, perPage: 25, total: 100 }) };
		let headers = paginate(new Headers(), page, { url: "https://api.example.com/x" });

		expect(unwrap(parsePageParams(new URL(nextLink(headers)).searchParams)).page).toBe(2);
	});
});
