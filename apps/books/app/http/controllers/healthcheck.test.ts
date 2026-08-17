/**
 * Tests for `GET /healthcheck` — answers plain-text `OK` without reaching Buttondown or
 * Polar, so an external monitor measures this worker rather than a third-party API.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/lib/test/router";

describe("GET /healthcheck", () => {
	test("answers plain-text OK", async () => {
		let response = await fetchApp("/healthcheck");

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/plain");
		expect(await response.text()).toBe("OK");
	});
});
