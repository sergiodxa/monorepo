/**
 * The `Server-Timing` header every response carries, checked through the app's router.
 */

import { describe, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";

describe("serverTiming", () => {
	test("reports how long the request took", async () => {
		let response = await createWebRouter().fetch("https://example.com/health");

		expect(response.headers.get("server-timing")).toMatch(/^app(;dur=[\d.]+)?$/);
	});
});
