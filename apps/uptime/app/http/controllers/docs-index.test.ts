/**
 * Tests the `/docs` controller: it redirects every visitor to the overview doc.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import docsIndex from "~/app/http/controllers/docs-index";
import routes from "~/routes/web";

/** Dispatches a real GET request to `/docs` and captures the redirect response. */
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
