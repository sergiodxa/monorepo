/**
 * Unit tests for `X-API-Version` resolution: accepting a published date, defaulting
 * to the oldest one when the header is absent, refusing an unpublished one, and
 * announcing a deprecated one's retirement.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import {
	API_VERSION_DEPRECATIONS,
	API_VERSION_HEADER,
	apiVersioning,
	applyApiVersionHeader,
	PUBLISHED_API_VERSIONS,
	resolveApiVersion,
} from "~/app/http/middleware/api-version";

describe("resolveApiVersion", () => {
	test("accepts a published version", () => {
		let request = new Request("https://api.example.com/x", {
			headers: { [API_VERSION_HEADER]: "2026-09-21" },
		});

		expect(resolveApiVersion(request)).toEqual({ ok: true, version: "2026-09-21" });
	});

	test("defaults to the oldest published version when the header is absent", () => {
		let request = new Request("https://api.example.com/x");

		expect(resolveApiVersion(request)).toEqual({ ok: true, version: PUBLISHED_API_VERSIONS[0] });
	});

	test("refuses a date this API never published", () => {
		let request = new Request("https://api.example.com/x", {
			headers: { [API_VERSION_HEADER]: "2020-01-01" },
		});

		expect(resolveApiVersion(request)).toEqual({ ok: false, published: PUBLISHED_API_VERSIONS });
	});
});

describe("applyApiVersionHeader", () => {
	test("echoes the resolved version onto the response", () => {
		let response = applyApiVersionHeader(new Response("ok"), "2026-09-21");
		expect(response.headers.get(API_VERSION_HEADER)).toBe("2026-09-21");
		expect(response.headers.get("Deprecation")).toBeNull();
	});

	test("echoes onto a response whose headers are immutable", () => {
		let response = applyApiVersionHeader(Response.redirect("https://example.com/"), "2026-09-21");
		expect(response.status).toBe(302);
		expect(response.headers.get(API_VERSION_HEADER)).toBe("2026-09-21");
	});

	test("serves an invalid notice without it rather than failing the request", () => {
		let response = applyApiVersionHeader(new Response("ok"), "2026-09-21", {
			deprecation: new Date("2027-07-01T00:00:00Z"),
			sunset: new Date("2027-01-01T00:00:00Z"),
		});

		expect(response.headers.get(API_VERSION_HEADER)).toBe("2026-09-21");
		expect(response.headers.get("Deprecation")).toBeNull();
	});
});

describe("API_VERSION_DEPRECATIONS", () => {
	test("deprecates no published version yet", () => {
		expect(API_VERSION_DEPRECATIONS).toEqual({});
	});
});

describe("apiVersioning middleware", () => {
	function buildRouter() {
		let router = createRouter({ middleware: [apiVersioning()] });
		router.get("/x", () => new Response("ok"));
		return router;
	}

	test("echoes X-API-Version on a successful response", async () => {
		let router = buildRouter();
		let response = await router.fetch(new Request("https://api.example.com/x"));

		expect(response.status).toBe(200);
		expect(response.headers.get(API_VERSION_HEADER)).toBe(PUBLISHED_API_VERSIONS[0]);
	});

	test("refuses an unpublished version with a problem+json body naming what is published", async () => {
		let router = buildRouter();
		let response = await router.fetch(
			new Request("https://api.example.com/x", { headers: { [API_VERSION_HEADER]: "1999-01-01" } }),
		);

		expect(response.status).toBe(400);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");

		let body = (await response.json()) as Record<string, unknown>;
		expect(body.detail).toContain(PUBLISHED_API_VERSIONS[0]);
	});

	test("announces a deprecated version's retirement on every response it serves", async () => {
		let router = createRouter({
			middleware: [
				apiVersioning({
					deprecations: {
						"2026-09-21": {
							deprecation: new Date("2027-01-01T00:00:00Z"),
							sunset: new Date("2027-07-01T00:00:00Z"),
							deprecationLink: "https://docs.example.com/changelog",
						},
					},
				}),
			],
		});
		router.get(
			"/x",
			() => new Response("ok", { headers: { Link: '<https://a.example>; rel="next"' } }),
		);

		let response = await router.fetch(
			new Request("https://api.example.com/x", { headers: { [API_VERSION_HEADER]: "2026-09-21" } }),
		);

		expect(response.headers.get(API_VERSION_HEADER)).toBe("2026-09-21");
		expect(response.headers.get("Deprecation")).toBe("@1798761600");
		expect(response.headers.get("Sunset")).toBe("Thu, 01 Jul 2027 00:00:00 GMT");
		expect(response.headers.get("Link")).toBe(
			'<https://a.example>; rel="next", <https://docs.example.com/changelog>; rel="deprecation"',
		);
	});

	test("leaves a current version's responses without a notice", async () => {
		let response = await buildRouter().fetch(new Request("https://api.example.com/x"));

		expect(response.headers.get("Deprecation")).toBeNull();
		expect(response.headers.get("Sunset")).toBeNull();
	});
});
