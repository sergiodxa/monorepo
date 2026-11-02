/**
 * Tests the docs demos' feedback form: a vote sends the reader back to the page with its
 * thanks, a vote aimed at the feedback frame answers the frame's thanks, and a vote naming a
 * page outside the demo is refused, so the form can never redirect elsewhere.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/test/router";

/** Posts a vote about `page` to the Driftwood demo, as the frame runtime does when `target` is set. */
async function vote(page: string, target?: string): Promise<Response> {
	let headers = new Headers();
	if (target !== undefined) {
		headers.set("X-Remix-Frame", "true");
		headers.set("X-Remix-Target", target);
	}
	return await fetchApp("/demo/docs/driftwood/feedback", {
		method: "POST",
		headers,
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

	test("a vote aimed at the feedback frame answers the frame's thanks", async () => {
		let response = await vote("/demo/docs/driftwood/start/quickstart", "feedback");

		expect(response.status).toBe(303);
		let location = response.headers.get("Location");
		expect(location).toBe("/demo/frames/docs/driftwood/feedback/start/quickstart?feedback=sent");

		let frame = await fetchApp(location!);
		let body = await frame.text();
		expect(frame.status).toBe(200);
		expect(body).toContain("Thanks for telling us");
		expect(body).not.toContain('data-slot="docs-feedback-form"');
	});

	test("the action's address, left in the location bar by a frame vote, returns to the page", async () => {
		let response = await fetchApp(
			"/demo/docs/driftwood/feedback?page=/demo/docs/driftwood/start/quickstart",
			{ redirect: "manual" },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			"/demo/docs/driftwood/start/quickstart?feedback=sent#feedback",
		);
		let bare = await fetchApp("/demo/docs/driftwood/feedback", { redirect: "manual" });
		expect(bare.headers.get("Location")).toBe("/demo/docs/driftwood");
	});

	test("a frame vote about a page the demo lacks is refused", async () => {
		expect((await vote("/demo/docs/driftwood/no/such-page", "feedback")).status).toBe(400);
	});

	test.each([
		"https://evil.example/",
		"//evil.example/demo/docs/driftwood/x",
		"/demo/docs/other/page",
	])("refuses a vote about %s", async (page) => {
		expect((await vote(page)).status).toBe(400);
	});
});
