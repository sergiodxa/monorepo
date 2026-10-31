/**
 * Tests for the single-book URLs — `/release`, `/sample` and `/upgrade` — published in
 * newsletters and posts before every book had its own path. Each must keep landing a reader
 * on the same page, permanently, with the campaign query and the request method intact.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { memoryBilling } from "~/app/test/billing";
import { fetchApp } from "~/app/test/router";

describe("the single-book URLs", () => {
	test.each([
		["/release", "/react-router-oauth2"],
		["/sample", "/react-router-oauth2/sample"],
		["/upgrade", "/react-router-oauth2/upgrade"],
	])("%s redirects permanently to %s", async (from, to) => {
		let response = await fetchApp(from);

		expect(response.status).toBe(308);
		expect(response.headers.get("location")).toBe(to);
	});

	test("keeps the campaign query, so attribution still credits the old link", async () => {
		let response = await fetchApp("/release?utm_source=newsletter&utm_campaign=launch");

		expect(response.headers.get("location")).toBe(
			"/react-router-oauth2?utm_source=newsletter&utm_campaign=launch",
		);
	});

	test("keeps a form posted from a cached page a POST to the new URL", async () => {
		let response = await fetchApp("/sample", {
			method: "POST",
			body: new URLSearchParams({ email: "hello@sergiodxa.com" }),
		});

		expect(response.status).toBe(308);
		expect(response.headers.get("location")).toBe("/react-router-oauth2/sample");
	});

	test("lands on a page that renders", async () => {
		let location = (await fetchApp("/release")).headers.get("location") ?? "";

		let response = await fetchApp(location, { billing: memoryBilling() });

		expect(response.status).toBe(200);
	});
});

describe("the per-book routes", () => {
	test.each([["/a-book-not-in-the-catalogue/sample"], ["/a-book-not-in-the-catalogue/upgrade"]])(
		"%s answers 404",
		async (path) => {
			let response = await fetchApp(path);

			expect(response.status).toBe(404);
		},
	);

	test("keeps static paths ahead of a book slug", async () => {
		let response = await fetchApp("/sample/download");

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe("/react-router-oauth2/sample");
	});
});
