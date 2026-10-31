/**
 * Tests `/`: a visitor gets the landing with figures read from the limits the app enforces
 * and no untranslated key, and a signed-in reader is sent to their queue.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";
import type { AppRouter } from "~/app/test/controller";

import home from "~/app/http/controllers/home";
import { TIER_LIMITS } from "~/app/services/entitlement";
import { HISTORY_ENTRY_LIMIT } from "~/app/services/history";
import { createTestRouter, fetchRoute, VIEWER } from "~/app/test/controller";
import routes from "~/routes/web";

/** A router with the home mapped, as `viewer` or as nobody. */
function createRouter(viewer: Viewer | null = null): AppRouter {
	let router = createTestRouter(viewer);
	router.map(routes.home, home);
	return router;
}

describe("GET /", () => {
	test("renders the landing with figures from the plan limits", async () => {
		let response = await fetchRoute(createRouter(), routes.home.href());
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toContain(TIER_LIMITS.free.posts.toLocaleString("en"));
		expect(html).toContain(HISTORY_ENTRY_LIMIT.toLocaleString("en"));
		expect(html).toContain("15 min");
		expect(html).not.toMatch(/landing\.[a-z]+\.[a-zA-Z.]+/);
	});

	test("prints the year as a year, without a thousands separator", async () => {
		let html = await (await fetchRoute(createRouter(), routes.home.href())).text();

		expect(html).toContain(`© ${new Date().getFullYear()} `);
	});

	test("sends a signed-in reader to their queue", async () => {
		let response = await fetchRoute(createRouter(VIEWER), routes.home.href());

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.reading.index.href());
	});
});
