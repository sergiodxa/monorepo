/**
 * Tests for the protocol messages: list queries and search bodies with RFC 7644's clamping,
 * the response builders and the RFC 7644 §3.12 error document, request bodies, versions and
 * conditional requests, and attribute projection.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { ENTERPRISE_USER_DEFINITION, GROUP_DEFINITION, USER_DEFINITION } from "./discovery.js";
import { stringifyPath } from "./filter.js";
import { ENTERPRISE_USER, FULL_USER, GROUP } from "./fixtures/rfc7643-users.js";

import {
	ENTERPRISE_USER_SCHEMA,
	ERROR_SCHEMA,
	errorResponse,
	LIST_RESPONSE_SCHEMA,
	listResponse,
	matchesVersion,
	MEDIA_TYPE,
	parseListQuery,
	parseSearchRequest,
	project,
	readBody,
	ScimError,
	scimResponse,
	SEARCH_REQUEST_SCHEMA,
	version,
} from "./index.js";

const DEFINITIONS = {
	[USER_DEFINITION.id]: USER_DEFINITION,
	[ENTERPRISE_USER_DEFINITION.id]: ENTERPRISE_USER_DEFINITION,
};

const ENTERPRISE = ENTERPRISE_USER_DEFINITION.id;

/**
 * Parses a list query string, failing the test on error.
 *
 * @param search - The query string
 * @param options - Parser options
 * @returns The query
 */
function query(search: string, options: Parameters<typeof parseListQuery>[1] = {}) {
	return unwrap(parseListQuery(new URL(`https://example.com/scim/v2/Users?${search}`), options));
}

describe("parseListQuery", () => {
	test("fills RFC 7644 defaults when the request names nothing", () => {
		expect(query("")).toEqual({
			filter: null,
			startIndex: 1,
			count: 100,
			sortBy: null,
			sortOrder: "ascending",
			attributes: [],
			excludedAttributes: [],
		});
	});

	test("reads the RFC 7644 §3.4.2 examples", () => {
		expect(query("attributes=userName").attributes.map(stringifyPath)).toEqual(["userName"]);
		expect(query("startIndex=1&count=10")).toMatchObject({ startIndex: 1, count: 10 });
		expect(query('filter=userName eq "bjensen"').filter).toMatchObject({
			operator: "eq",
			value: "bjensen",
		});
	});

	test("clamps startIndex below 1 to 1, count below 0 to 0, and count to maxCount", () => {
		expect(query("startIndex=-5&count=-1")).toMatchObject({ startIndex: 1, count: 0 });
		expect(query("count=500", { maxCount: 200 }).count).toBe(200);
		expect(query("", { maxCount: 50 }).count).toBe(50);
		expect(query("", { defaultCount: 20 }).count).toBe(20);
	});

	test("reads sorting, attribute lists and sortOrder in any case", () => {
		let parsed = query(
			"sortBy=name.familyName&sortOrder=Descending&excludedAttributes=emails, urn:ietf:params:scim:schemas:extension:enterprise:2.0:User",
		);
		expect(parsed.sortBy && stringifyPath(parsed.sortBy)).toBe("name.familyName");
		expect(parsed.sortOrder).toBe("descending");
		expect(parsed.excludedAttributes.map(stringifyPath)).toEqual(["emails", ENTERPRISE]);
	});

	test.each([
		["filter=userName%20eq", "invalidFilter"],
		["startIndex=abc", "invalidValue"],
		["count=1.5", "invalidValue"],
		["sortOrder=up", "invalidValue"],
		["sortBy=emails[type%20eq%20%22work%22]", "invalidPath"],
	])("refuses %s", (search, scimType) => {
		let result = parseListQuery(new URL(`https://example.com/Users?${search}`));
		expect(isFailure(result) && result.error.scimType).toBe(scimType);
	});

	test("checks the filter and paths against definitions when given", () => {
		let options = { attributes: DEFINITIONS };
		let unknownFilter = parseListQuery(
			new URL('https://example.com/Users?filter=color eq "red"'),
			options,
		);
		expect(isFailure(unknownFilter) && unknownFilter.error.scimType).toBe("invalidFilter");
		let unknownPath = parseListQuery(
			new URL("https://example.com/Users?attributes=color"),
			options,
		);
		expect(isFailure(unknownPath) && unknownPath.error.scimType).toBe("invalidPath");
		expect(query(`attributes=userName,${ENTERPRISE}`, options).attributes).toHaveLength(2);
	});
});

describe("parseSearchRequest", () => {
	test("reads the RFC 7644 §3.4.3 search body", () => {
		let parsed = unwrap(
			parseSearchRequest({
				schemas: [SEARCH_REQUEST_SCHEMA],
				attributes: ["displayName", "userName"],
				filter: 'displayName sw "smith"',
				startIndex: 1,
				count: 10,
			}),
		);
		expect(parsed.attributes.map(stringifyPath)).toEqual(["displayName", "userName"]);
		expect(parsed.filter).toMatchObject({ operator: "sw", value: "smith" });
		expect(parsed).toMatchObject({ startIndex: 1, count: 10 });
	});

	test("refuses a body without the SearchRequest schema", () => {
		let result = parseSearchRequest({ filter: "title pr" });
		expect(isFailure(result) && result.error.scimType).toBe("invalidSyntax");
	});
});

describe("responses", () => {
	test("types every body application/scim+json", async () => {
		let response = scimResponse(
			{ ok: true },
			{ status: 201, headers: { "Content-Type": "text/plain", Location: "/x" } },
		);
		expect(response.status).toBe(201);
		expect(response.headers.get("Content-Type")).toBe(MEDIA_TYPE);
		expect(response.headers.get("Location")).toBe("/x");
		expect(await response.json()).toEqual({ ok: true });
	});

	test("writes the RFC 7644 §3.12 error document with status as a string", async () => {
		let response = errorResponse(
			new ScimError(400, "Request is unparsable, syntactically incorrect, or violates schema.", {
				scimType: "invalidSyntax",
			}),
		);
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			schemas: [ERROR_SCHEMA],
			status: "400",
			scimType: "invalidSyntax",
			detail: "Request is unparsable, syntactically incorrect, or violates schema.",
		});
	});

	test("leaves scimType out when the error has none and keeps extra headers", async () => {
		let response = errorResponse(new ScimError(429, "Slow down."), {
			headers: { "Retry-After": "30" },
		});
		expect(response.headers.get("Retry-After")).toBe("30");
		expect(await response.json()).toEqual({
			schemas: [ERROR_SCHEMA],
			status: "429",
			detail: "Slow down.",
		});
	});

	test("wraps a page in ListResponse with itemsPerPage as the page length", async () => {
		let response = listResponse({ resources: [1, 2], totalResults: 10, startIndex: 3 }, (n) => ({
			id: String(n),
		}));
		expect(await response.json()).toEqual({
			schemas: [LIST_RESPONSE_SCHEMA],
			totalResults: 10,
			startIndex: 3,
			itemsPerPage: 2,
			Resources: [{ id: "1" }, { id: "2" }],
		});
	});
});

describe("readBody", () => {
	test("accepts application/scim+json, application/json and no content type", async () => {
		for (let type of ["application/scim+json; charset=utf-8", "application/json", null]) {
			let headers = type ? { "Content-Type": type } : undefined;
			let request = new Request("https://example.com", {
				method: "POST",
				body: '{"a":1}',
				headers,
			});
			if (!type) request.headers.delete("Content-Type");
			expect(unwrap(await readBody(request))).toEqual({ a: 1 });
		}
	});

	test("refuses other content types with 415 and bad JSON with invalidSyntax", async () => {
		let form = await readBody(
			new Request("https://example.com", {
				method: "POST",
				body: "a=1",
				headers: { "Content-Type": "text/plain" },
			}),
		);
		expect(isFailure(form) && form.error.status).toBe(415);
		let broken = await readBody(
			new Request("https://example.com", {
				method: "POST",
				body: "{",
				headers: { "Content-Type": MEDIA_TYPE },
			}),
		);
		expect(isFailure(broken) && broken.error.scimType).toBe("invalidSyntax");
	});
});

describe("version", () => {
	test("is a weak tag that ignores key order and meta", async () => {
		let tag = await version({ a: 1, b: { c: 2, d: 3 } });
		expect(tag).toMatch(/^W\/"[\w-]+"$/);
		expect(await version({ b: { d: 3, c: 2 }, a: 1, meta: { version: tag } })).toBe(tag);
		expect(await version({ a: 2, b: { c: 2, d: 3 } })).not.toBe(tag);
	});

	test("compares If-Match and If-None-Match weakly", () => {
		let current = 'W/"abc"';
		let request = (headers: Record<string, string>) =>
			new Request("https://example.com", { headers });
		expect(matchesVersion(request({}), current)).toBe(true);
		expect(matchesVersion(request({ "If-Match": 'W/"abc"' }), current)).toBe(true);
		expect(matchesVersion(request({ "If-Match": '"abc"' }), current)).toBe(true);
		expect(matchesVersion(request({ "If-Match": '"x", W/"abc"' }), current)).toBe(true);
		expect(matchesVersion(request({ "If-Match": "*" }), current)).toBe(true);
		expect(matchesVersion(request({ "If-Match": 'W/"old"' }), current)).toBe(false);
		expect(matchesVersion(request({ "If-None-Match": 'W/"abc"' }), current)).toBe(false);
		expect(matchesVersion(request({ "If-None-Match": 'W/"old"' }), current)).toBe(true);
		expect(matchesVersion(request({ "If-None-Match": "*" }), current)).toBe(false);
	});

	test("reads a conditional header of 50,000 stray characters in linear time", () => {
		let current = 'W/"abc"';
		let started = performance.now();
		let ifMatch = `${"!".repeat(50_000)} W/"abc"`;
		let request = new Request("https://example.com", { headers: { "If-Match": ifMatch } });
		expect(matchesVersion(request, current)).toBe(true);
		expect(performance.now() - started).toBeLessThan(500);
	});
});

describe("project", () => {
	let none = { attributes: [], excludedAttributes: [] };

	test("drops returned never attributes and keeps the rest by default", () => {
		let projected = project(FULL_USER, none, DEFINITIONS);
		expect("password" in projected).toBe(false);
		expect(projected.userName).toBe(FULL_USER.userName);
	});

	test("keeps only named attributes plus id and schemas", () => {
		let projected = project(FULL_USER, query("attributes=userName,name.givenName"), DEFINITIONS);
		expect(projected).toEqual({
			schemas: FULL_USER.schemas,
			id: FULL_USER.id,
			userName: FULL_USER.userName,
			name: { givenName: "Barbara" },
		});
	});

	test("removes excluded attributes and sub-attributes", () => {
		let projected = project(
			FULL_USER,
			query("excludedAttributes=emails,name.formatted,id"),
			DEFINITIONS,
		);
		expect("emails" in projected).toBe(false);
		expect(projected.id).toBe(FULL_USER.id);
		expect(projected.name).toEqual({
			familyName: "Jensen",
			givenName: "Barbara",
			middleName: "Jane",
			honorificPrefix: "Ms.",
			honorificSuffix: "III",
		});
	});

	test("selects and excludes extension attributes and whole extensions", () => {
		let department = project(
			ENTERPRISE_USER,
			query(`attributes=${ENTERPRISE}:department`),
			DEFINITIONS,
		);
		expect(department[ENTERPRISE]).toEqual({ department: "Tour Operations" });
		let whole = project(ENTERPRISE_USER, query(`attributes=${ENTERPRISE}`), DEFINITIONS);
		expect(whole[ENTERPRISE]).toEqual(ENTERPRISE_USER[ENTERPRISE_USER_SCHEMA]);
		expect("userName" in whole).toBe(false);
		let without = project(ENTERPRISE_USER, query(`excludedAttributes=${ENTERPRISE}`), DEFINITIONS);
		expect(ENTERPRISE in without).toBe(false);
	});

	test("resolves a group's attributes against its own schema", () => {
		let definitions = { ...DEFINITIONS, [GROUP_DEFINITION.id]: GROUP_DEFINITION };
		let projected = project(GROUP, query("excludedAttributes=members"), definitions);
		expect(projected).toEqual({
			schemas: GROUP.schemas,
			id: GROUP.id,
			displayName: GROUP.displayName,
			meta: GROUP.meta,
		});
	});
});
