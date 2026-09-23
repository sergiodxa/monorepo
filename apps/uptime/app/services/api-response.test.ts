/**
 * Unit tests for the API v1 success envelope. The exact envelope shape matters
 * because existing API integrations parse `data` and `meta` directly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Forbidden, Ok } from "@sdxc/http/status-code";
import { describe, expect, test } from "vitest";

import { apiSuccess } from "~/app/services/api-response";

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
