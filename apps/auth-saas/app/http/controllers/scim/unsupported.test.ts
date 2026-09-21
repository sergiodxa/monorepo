/**
 * `POST /scim/v2/Bulk` and `GET /scim/v2/Me` are reachable routes that always
 * answer `501`, rather than falling through to the router's generic `404`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { buildScimHarness } from "./test-harness";

describe("SCIM unsupported routes", () => {
	test("POST /scim/v2/Bulk answers 501", async () => {
		let harness = await buildScimHarness();

		let response = await harness.router.fetch(
			harness.request("/scim/v2/Bulk", "irrelevant-token", { method: "POST", body: "{}" }),
		);

		expect(response.status).toBe(501);
		expect(response.headers.get("Content-Type")).toBe("application/scim+json");
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.schemas).toEqual(["urn:ietf:params:scim:api:messages:2.0:Error"]);
	});

	test("GET /scim/v2/Me answers 501", async () => {
		let harness = await buildScimHarness();

		let response = await harness.router.fetch(harness.request("/scim/v2/Me", "irrelevant-token"));

		expect(response.status).toBe(501);
		expect(response.headers.get("Content-Type")).toBe("application/scim+json");
	});
});
