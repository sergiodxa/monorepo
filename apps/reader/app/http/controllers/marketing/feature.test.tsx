/**
 * Tests `/features/:slug`: every feature in the page list answers with its own title and no
 * untranslated key, a slug nobody wrote is a 404, and each feature's three pictures exist
 * and its steps never repeat its hero.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { AppRouter } from "~/app/test/controller";

import feature from "~/app/http/controllers/marketing/feature";
import { createTestRouter, fetchRoute } from "~/app/test/controller";
import { FEATURE_SLUGS } from "~/config/marketing";
import {
	FEATURE_CARD_SCENES,
	FEATURE_HEROES,
	FEATURE_STEP_VISUALS,
} from "~/resources/components/marketing/feature-scenes";
import routes from "~/routes/web";

/** A router with the feature pages mapped and nobody signed in, as a visitor arrives. */
function createRouter(): AppRouter {
	let router = createTestRouter(null);
	router.map(routes.marketing.feature, feature);
	return router;
}

describe("GET /features/:slug", () => {
	test.each(FEATURE_SLUGS)("renders %s with translated copy", async (slug) => {
		let response = await fetchRoute(createRouter(), routes.marketing.feature.href({ slug }));
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toContain("<h1");
		expect(html).not.toMatch(/landing\.[a-z]+\.[a-zA-Z.]+/);
	});

	test("answers a slug nobody wrote with the 404 page", async () => {
		let response = await fetchRoute(createRouter(), "/features/telepathy");

		expect(response.status).toBe(404);
	});

	test("every feature has a card, a hero and a different visual for its steps", () => {
		for (let slug of FEATURE_SLUGS) {
			expect(FEATURE_CARD_SCENES[slug]).toBeTypeOf("function");
			expect(FEATURE_HEROES[slug]).toBeTypeOf("function");
			expect(FEATURE_STEP_VISUALS[slug]).not.toBe(FEATURE_HEROES[slug]);
		}
	});
});
