/**
 * Tests the `/docs` controller: it redirects every visitor straight to the overview
 * doc instead of rendering a page of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { createRouter } from "remix/router";

import docsIndex from "~/app/http/controllers/docs-index";
import routes from "~/routes/web";

/** Dispatches a real GET request to `/docs`, without following the redirect. */
async function getDocsIndex() {
	let router = createRouter();
	router.map(routes.docs.index, docsIndex);

	let request = new Request(`https://uptime.test${routes.docs.index.href()}`, {
		redirect: "manual",
	});
	return router.fetch(request);
}

describe("GET /docs", () => {
	test("redirects to the overview doc", async () => {
		let response = await getDocsIndex();

		expect(response.status).toBe(307);
		expect(response.headers.get("location")).toBe(routes.docs.show.href({ slug: "overview" }));
	});
});
