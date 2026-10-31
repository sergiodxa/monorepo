/**
 * Tests `/for/:slug`: every way of reading answers with translated copy and its own queue,
 * and a slug nobody wrote is a 404.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { AppRouter } from "~/app/test/controller";

import useCase from "~/app/http/controllers/marketing/use-case";
import { createTestRouter, fetchRoute } from "~/app/test/controller";
import { USE_CASE_SLUGS } from "~/config/marketing";
import { USE_CASES } from "~/resources/components/marketing/use-cases";
import routes from "~/routes/web";

/** A router with the use-case pages mapped and nobody signed in. */
function createRouter(): AppRouter {
	let router = createTestRouter(null);
	router.map(routes.marketing.useCase, useCase);
	return router;
}

describe("GET /for/:slug", () => {
	test.each(USE_CASE_SLUGS)("renders %s with its own queue", async (slug) => {
		let response = await fetchRoute(createRouter(), routes.marketing.useCase.href({ slug }));
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).not.toMatch(/landing\.[a-z]+\.[a-zA-Z.]+/);
		expect(html).toContain(USE_CASES[slug].posts[0]?.title.replace("'", "&#39;"));
	});

	test("answers a slug nobody wrote with the 404 page", async () => {
		let response = await fetchRoute(createRouter(), "/for/astronauts");

		expect(response.status).toBe(404);
	});
});
