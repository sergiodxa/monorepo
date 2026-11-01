/**
 * Tests the docs demos' feedback form: a vote sends the reader back to the page with its
 * thanks, the page renders the thanks in place of the form, and a vote naming a page outside
 * the demo is refused, so the form can never redirect elsewhere.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/test/router";

/** Posts a vote about `page` to the Driftwood demo. */
async function vote(page: string): Promise<Response> {
	return await fetchApp("/demo/docs/driftwood/feedback", {
		method: "POST",
		body: new URLSearchParams({ helpful: "yes", page, note: "" }),
		redirect: "manual",
	});
}

describe("POST /demo/docs/:site/feedback", () => {
	test("redirects to the page with its thanks, which the page then shows", async () => {
		let response = await vote("/demo/docs/driftwood/start/quickstart");

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			"/demo/docs/driftwood/start/quickstart?feedback=sent#feedback",
		);

		let page = await (await fetchApp("/demo/docs/driftwood/start/quickstart?feedback=sent")).text();
		expect(page).toContain("Thanks for telling us");
	});

	test.each([
		"https://evil.example/",
		"//evil.example/demo/docs/driftwood/x",
		"/demo/docs/other/page",
	])("refuses a vote about %s", async (page) => {
		expect((await vote(page)).status).toBe(400);
	});
});
