/**
 * Tests for the page cache policy's validator. A reader's stored copy is only revalidated
 * against a name for the code that rendered it, so the dev server, whose code changes under
 * one process, answers every request with the page as the code renders it now.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test, vi } from "vitest";

import { withBundleCache } from "./caching";

afterEach(() => {
	vi.unstubAllGlobals();
});

/** A rendered page, as the controller hands it over. */
function page(): Response {
	return new Response("<p>current</p>", { headers: { "content-type": "text/html" } });
}

describe(withBundleCache.name, () => {
	test("answers a copy validated against the same build with a 304", async () => {
		vi.stubGlobal("__BUILD_ID__", "b1");
		let first = await withBundleCache(new Request("https://sdxc.com/docs"), page());
		let tag = first.headers.get("ETag") ?? "";

		let second = await withBundleCache(
			new Request("https://sdxc.com/docs", { headers: { "If-None-Match": tag } }),
			page(),
		);

		expect(tag).not.toBe("");
		expect(second.status).toBe(304);
	});

	/**
	 * The dev server once stamped one build for its whole run, so a page cached before an
	 * edit kept answering 304 and the browser kept rendering the markup the edit had fixed.
	 */
	test("renders every dev-server request afresh, whatever the reader holds", async () => {
		vi.stubGlobal("__BUILD_ID__", "b1");
		let stale = await withBundleCache(new Request("https://sdxc.com/docs"), page());
		vi.stubGlobal("__BUILD_ID__", null);

		let response = await withBundleCache(
			new Request("https://sdxc.com/docs", {
				headers: { "If-None-Match": stale.headers.get("ETag") ?? "" },
			}),
			page(),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("ETag")).toBeNull();
		expect(await response.text()).toBe("<p>current</p>");
	});
});
