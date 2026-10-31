/**
 * Tests `/vs/:slug`: every comparison answers with its table and the honest "might be
 * better" band, quotes the reader's own limits from code, and a slug nobody wrote is a 404.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { AppRouter } from "~/app/test/controller";

import comparison from "~/app/http/controllers/marketing/comparison";
import { TIER_LIMITS } from "~/app/services/entitlement";
import { createTestRouter, fetchRoute } from "~/app/test/controller";
import { COMPARISON_SLUGS } from "~/config/marketing";
import routes from "~/routes/web";

/** A router with the comparison pages mapped and nobody signed in. */
function createRouter(): AppRouter {
	let router = createTestRouter(null);
	router.map(routes.marketing.comparison, comparison);
	return router;
}

describe("GET /vs/:slug", () => {
	test.each(COMPARISON_SLUGS)("renders the %s comparison", async (slug) => {
		let response = await fetchRoute(createRouter(), routes.marketing.comparison.href({ slug }));
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toContain("<table");
		expect(html).toContain("might be better");
		expect(html).toContain(`${TIER_LIMITS.free.feeds} feeds, no ads`);
		expect(html).not.toMatch(/landing\.[a-z]+\.[a-zA-Z.]+/);
	});

	test("answers a slug nobody wrote with the 404 page", async () => {
		let response = await fetchRoute(createRouter(), "/vs/rolodex");

		expect(response.status).toBe(404);
	});
});
