/**
 * Tests for RFC 9865 cursor-based pagination: the `cursor` parameter in a query string and
 * a search body, the cursor attributes of `ListResponse`, the pagination errors, and the
 * `pagination` capability, checked against the RFC's own examples.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { serviceProviderConfig } from "./discovery.js";
import { stringifyPath } from "./filter.js";

import {
	errorResponse,
	LIST_RESPONSE_SCHEMA,
	listResponse,
	parseListQuery,
	parseSearchRequest,
	ScimError,
	SEARCH_REQUEST_SCHEMA,
} from "./index.js";

/** Parses a `/Users` query string with cursors enabled, unless the options say otherwise. */
function query(search: string, options: Parameters<typeof parseListQuery>[1] = { cursor: true }) {
	return parseListQuery(new URL(`https://example.com/scim/v2/Users?${search}`), options);
}

describe("parseListQuery with cursors", () => {
	test("reads the RFC 9865 §2 first-page request (its value quoted, as RFC 7644's grammar requires)", () => {
		let parsed = unwrap(query("filter=userName%20sw%20%22J%22&cursor&count=10"));
		expect(parsed).toMatchObject({ cursor: "", count: 10 });
		expect(parsed.filter).toMatchObject({ operator: "sw", value: "J" });
	});

	test("reads the RFC 9865 §2 follow-up request's cursor", () => {
		expect(
			unwrap(query("filter=username%20sw%20%22J%22&cursor=VZUTiyhEQJ94IR&count=10")),
		).toMatchObject({ cursor: "VZUTiyhEQJ94IR", count: 10 });
	});

	test("pages by index when the request names no cursor, unless cursor is the default", () => {
		expect(unwrap(query("count=10")).cursor).toBeNull();
		expect(unwrap(query("count=10", { cursor: true, defaultPagination: "cursor" })).cursor).toBe(
			"",
		);
		expect(
			unwrap(query("startIndex=11", { cursor: true, defaultPagination: "cursor" })).cursor,
		).toBeNull();
	});

	test("ignores cursor when the server does not read it", () => {
		expect(unwrap(query("cursor=VZUTiyhEQJ94IR", {})).cursor).toBeNull();
	});

	test.each([
		["cursor=not%20unreserved", "invalidCursor"],
		["cursor=a%2Fb", "invalidCursor"],
		["cursor=abc&startIndex=2", "invalidValue"],
	])("refuses %s with %s", (search, scimType) => {
		let result = query(search);
		if (!isFailure(result)) throw new Error("expected a failure");
		expect(result.error).toMatchObject({ status: 400, scimType });
	});
});

describe("parseSearchRequest with cursors", () => {
	test("reads the RFC 9865 §3 search body", () => {
		let parsed = unwrap(
			parseSearchRequest(
				{
					schemas: [SEARCH_REQUEST_SCHEMA],
					attributes: ["displayName", "userName"],
					filter: 'displayName sw "smith"',
					cursor: "",
					count: 10,
				},
				{ cursor: true },
			),
		);
		expect(parsed.attributes.map(stringifyPath)).toEqual(["displayName", "userName"]);
		expect(parsed).toMatchObject({ cursor: "", count: 10 });
	});

	test("refuses a cursor that is not a string", () => {
		let result = parseSearchRequest(
			{ schemas: [SEARCH_REQUEST_SCHEMA], cursor: 42 },
			{ cursor: true },
		);
		if (!isFailure(result)) throw new Error("expected a failure");
		expect(result.error.scimType).toBe("invalidCursor");
	});
});

describe("listResponse over a cursor page", () => {
	test("writes the RFC 9865 §2 first page, with nextCursor and no startIndex", async () => {
		let response = listResponse(
			{ resources: [], totalResults: 100, nextCursor: "VZUTiyhEQJ94IR" },
			(n) => n,
		);
		expect(await response.json()).toEqual({
			totalResults: 100,
			itemsPerPage: 0,
			nextCursor: "VZUTiyhEQJ94IR",
			schemas: [LIST_RESPONSE_SCHEMA],
			Resources: [],
		});
	});

	test("writes the RFC 9865 §2 middle page with both cursors", async () => {
		let response = listResponse(
			{
				resources: [{ id: "a" }],
				totalResults: 100,
				previousCursor: "ze7L30kMiiLX6x",
				nextCursor: "YkU3OF86Pz0rGv",
			},
			(resource) => resource,
		);
		expect(await response.json()).toEqual({
			schemas: [LIST_RESPONSE_SCHEMA],
			totalResults: 100,
			itemsPerPage: 1,
			previousCursor: "ze7L30kMiiLX6x",
			nextCursor: "YkU3OF86Pz0rGv",
			Resources: [{ id: "a" }],
		});
	});

	test("marks the last page by leaving nextCursor out, and the total when unknown", async () => {
		let response = listResponse({ resources: [1], nextCursor: null }, (n) => ({ n }));
		expect(await response.json()).toEqual({
			schemas: [LIST_RESPONSE_SCHEMA],
			itemsPerPage: 1,
			Resources: [{ n: 1 }],
		});
	});
});

describe("pagination errors", () => {
	test("answer the RFC 9865 §2.1 scimType values", async () => {
		for (let scimType of ["invalidCursor", "expiredCursor", "invalidCount"] as const) {
			let response = errorResponse(new ScimError(400, "Bad page.", { scimType }));
			expect(await response.json()).toMatchObject({ status: "400", scimType });
		}
	});
});

describe("serviceProviderConfig pagination", () => {
	test("advertises the RFC 9865 §4 example capability", () => {
		let pagination = {
			cursor: true,
			index: true,
			defaultPaginationMethod: "cursor" as const,
			defaultPageSize: 100,
			maxPageSize: 250,
			cursorTimeout: 3600,
		};
		let config = serviceProviderConfig({
			patch: true,
			filter: { supported: true, maxResults: 250 },
			sort: false,
			etag: false,
			authenticationSchemes: [],
			pagination,
		});
		expect(config.pagination).toEqual(pagination);
	});

	test("leaves pagination out when not given", () => {
		let config = serviceProviderConfig({
			patch: true,
			filter: { supported: true, maxResults: 250 },
			sort: false,
			etag: false,
			authenticationSchemes: [],
		});
		expect(config).not.toHaveProperty("pagination");
	});
});
