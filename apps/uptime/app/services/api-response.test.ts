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

import { apiError, apiSuccess } from "~/app/services/api-response";

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

	test("sends the headers a paginated list annotated", () => {
		let headers = new Headers({ Link: '<https://example.com?cursor=abc>; rel="next"' });
		let response = apiSuccess({ results: [] }, Ok, { headers });
		expect(response.headers.get("Link")).toBe('<https://example.com?cursor=abc>; rel="next"');
	});

	test("carries a page's cursors in meta", async () => {
		let response = apiSuccess({ results: [] }, Ok, {
			pagination: { next: "cursor-next", prev: null, perPage: 25 },
		});

		let body = (await response.json()) as { meta: { pagination: unknown } };
		expect(body.meta.pagination).toEqual({ next: "cursor-next", prev: null, perPage: 25 });
	});

	test("omits pagination from meta on a response that is not a page", async () => {
		let response = apiSuccess({ monitor: { id: "m1" } });

		let body = (await response.json()) as { meta: Record<string, unknown> };
		expect(body.meta).not.toHaveProperty("pagination");
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
