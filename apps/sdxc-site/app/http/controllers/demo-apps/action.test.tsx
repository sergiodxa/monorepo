/**
 * Tests the shared form action every demo app posts to: a redirect that names an element keeps
 * it as the `#hash` for a whole-page post, and carries it in the query for a post a frame sent,
 * whose fetch drops the fragment, so the browser can still scroll the new post into view.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { withoutToastNonce } from "~/app/test/demo-apps";
import { fetchApp } from "~/app/test/router";
import { demoAppActionHref, demoAppHref } from "~/resources/views/demo-apps";

/** Posts Chorus's composer, whose redirect names the new post's element. */
async function compose(headers: Record<string, string> = {}): Promise<Response> {
	return await fetchApp(demoAppActionHref("chorus")(""), {
		method: "POST",
		body: new URLSearchParams({ intent: "compose", text: "Anchored post" }),
		headers,
	});
}

describe("demo app form action", () => {
	test("keeps the element as the fragment for a whole-page post", async () => {
		let response = await compose();

		expect(withoutToastNonce(response.headers.get("location"))).toMatch(
			new RegExp(`^${demoAppHref("chorus")()}\\?toast=posted#post-n-[0-9a-f]{8}$`),
		);
	});

	test("carries the element in the query for a post a frame sent", async () => {
		let response = await compose({ "X-Remix-Target": "main" });
		let location = withoutToastNonce(response.headers.get("location")) ?? "";

		expect(location).toMatch(
			new RegExp(`^${demoAppHref("chorus")()}\\?toast=posted&at=post-n-[0-9a-f]{8}$`),
		);
		expect(location).not.toContain("#");
	});
});
