/**
 * Unit tests for the API v1 JSON envelope helpers. The exact envelope shapes matter
 * because existing API integrations parse `data`/`meta` and `error.code`/`error.message`
 * directly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Forbidden, Ok, Unauthorized } from "@sdxc/http/status-code";
import { describe, expect, test } from "vitest";

import { apiError, apiSuccess, parsePaginationQuery } from "~/app/services/api-response";

describe("apiSuccess", () => {
	test("wraps the payload in a data/meta envelope with a 200 default", async () => {
		let response = apiSuccess({ monitor: { id: "m1" } });
		expect(response.status).toBe(Ok.status);

		let body = (await response.json()) as {
			data: { monitor: { id: string } };
			meta: { requestId: string; timestamp: string };
		};
		expect(body.data).toEqual({ monitor: { id: "m1" } });
		expect(body.meta.requestId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
		);
		expect(Number.isFinite(Date.parse(body.meta.timestamp))).toBe(true);
	});

	test("honors a custom status code", () => {
		let response = apiSuccess({ deleted: true }, Forbidden);
		expect(response.status).toBe(Forbidden.status);
	});
});

describe("apiError", () => {
	test("wraps a code and message in an error envelope with the given status", async () => {
		let response = apiError("UNAUTHORIZED", "Invalid or missing API key", Unauthorized);
		expect(response.status).toBe(Unauthorized.status);

		let body = (await response.json()) as { error: { code: string; message: string } };
		expect(body.error).toEqual({ code: "UNAUTHORIZED", message: "Invalid or missing API key" });
	});
});

describe("parsePaginationQuery", () => {
	test("falls back to defaults when limit/offset are absent", () => {
		let url = new URL("https://example.com/api/v1/monitors/m1/results");
		expect(parsePaginationQuery(url)).toEqual({ limit: 50, offset: 0 });
	});

	test("reads valid limit/offset from the query string", () => {
		let url = new URL("https://example.com/api/v1/monitors/m1/results?limit=10&offset=20");
		expect(parsePaginationQuery(url)).toEqual({ limit: 10, offset: 20 });
	});

	test("clamps limit to maxLimit", () => {
		let url = new URL("https://example.com/api/v1/monitors/m1/results?limit=500");
		expect(parsePaginationQuery(url, { defaultLimit: 50, maxLimit: 100 })).toEqual({
			limit: 100,
			offset: 0,
		});
	});

	test("falls back to defaults for non-numeric or negative values", () => {
		let url = new URL("https://example.com/api/v1/monitors/m1/results?limit=abc&offset=-5");
		expect(parsePaginationQuery(url)).toEqual({ limit: 50, offset: 0 });
	});
});
