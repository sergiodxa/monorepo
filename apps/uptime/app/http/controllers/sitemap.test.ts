/**
 * Tests the `/sitemap.xml` controller: it responds with the `xml()` helper's
 * content type and includes the homepage, at least one real `/features`, `/for`,
 * and `/vs` marketing page (sourced from `resources/content/marketing.ts`), the
 * legal pages, and at least one real `/docs/*` page sourced from the real Markdown
 * files under `resources/docs/**`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { audiences, comparisons, features } from "~/resources/content/marketing";
import routes from "~/routes/web";

import sitemap from "./sitemap";

/** Dispatches a real GET request through the sitemap action, router, and route table. */
async function getSitemap() {
	let router = createRouter();
	router.map(routes.sitemap, sitemap);

	let request = new Request(`https://uptime.test${routes.sitemap.href()}`);
	return router.fetch(request);
}

describe("GET /sitemap.xml", () => {
	test("responds with the xml() helper's content type", async () => {
		let response = await getSitemap();

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("text/xml");
	});

	test("includes the homepage", async () => {
		let response = await getSitemap();
		let body = await response.text();

		expect(body).toContain(`<loc>https://uptime.test${routes.home.href()}</loc>`);
	});

	test("includes real /features, /for, and /vs marketing pages", async () => {
		let response = await getSitemap();
		let body = await response.text();

		let featureSlug = Object.keys(features)[0];
		let audienceSlug = Object.keys(audiences)[0];
		let comparisonSlug = Object.keys(comparisons)[0];
		if (!featureSlug || !audienceSlug || !comparisonSlug) {
			throw new Error("expected at least one feature, audience, and comparison page");
		}

		expect(body).toContain(
			`<loc>https://uptime.test${routes.marketing.feature.href({ slug: featureSlug })}</loc>`,
		);
		expect(body).toContain(
			`<loc>https://uptime.test${routes.marketing.audience.href({ slug: audienceSlug })}</loc>`,
		);
		expect(body).toContain(
			`<loc>https://uptime.test${routes.marketing.comparison.href({ slug: comparisonSlug })}</loc>`,
		);
	});

	test("includes the legal pages", async () => {
		let response = await getSitemap();
		let body = await response.text();

		expect(body).toContain(`<loc>https://uptime.test${routes.legal.privacy.href()}</loc>`);
		expect(body).toContain(`<loc>https://uptime.test${routes.legal.terms.href()}</loc>`);
	});

	test("includes a real /docs page sourced from the real Markdown files", async () => {
		let response = await getSitemap();
		let body = await response.text();

		expect(body).toContain("<loc>https://uptime.test/docs/overview</loc>");
	});
});
