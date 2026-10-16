/**
 * Tests that answers to frame requests reach the reader untransformed, so the edge appends
 * no analytics script for a frame to render in place of its content, while full pages keep
 * the cache policy their handlers set.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/test/router";

/** A page whose handler sets a cache policy of its own. */
const GUIDE = "/docs/building-remix-apps/search-dialog";

/** The `Cache-Control` `path` answers with, asked for as a frame when `frame` is set. */
async function cacheControl(path: string, frame: boolean): Promise<string | null> {
	let headers = frame ? { "X-Remix-Frame": "true" } : undefined;
	let response = await fetchApp(path, { headers });
	return response.headers.get("Cache-Control");
}

describe("frame-transforms", () => {
	test("marks the search dialog's frame no-transform", async () => {
		expect(await cacheControl("/frames/search?q=dialog", true)).toBe("no-transform");
	});

	test("keeps the handler's own cache directives beside no-transform", async () => {
		let page = await cacheControl(GUIDE, false);
		let frame = await cacheControl(GUIDE, true);

		expect(page).toBeTypeOf("string");
		expect(frame).toBe(`${page}, no-transform`);
	});

	test("leaves a full page load as its handler answered it", async () => {
		expect(await cacheControl("/frames/search?q=dialog", false)).toBeNull();
		expect(await cacheControl(GUIDE, false)).not.toContain("no-transform");
	});
});
