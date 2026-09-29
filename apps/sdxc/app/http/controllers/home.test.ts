/**
 * Tests for `GET /` — the landing page. The content file is parsed at request time
 * against the tag vocabulary, so a mistyped tag or attribute is a 500 rather than a
 * blank section; these assertions are what turn that into a failing test instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/lib/test/router";
import { readPackageFacts } from "~/app/services/packages";

describe("GET /", () => {
	test("renders the landing document", async () => {
		let response = await fetchApp("/");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain("<!DOCTYPE html>");
		expect(body).toMatch(/<h1[^>]*>sdxc<\/h1>/);
		expect(body).toContain("Take one, or take the set.");
	});

	test("loads the file links in the footer as documents rather than as client navigations", async () => {
		let body = await (await fetchApp("/")).text();

		for (let href of ["/llms.txt", "/rss.xml"]) {
			let anchor = body.match(new RegExp(`<a[^>]*href="${href}"[^>]*>`))?.[0];
			expect(anchor).toContain("data-rmx-document");
		}
	});

	test("counts the collection rather than quoting a written-down number", async () => {
		let facts = readPackageFacts();
		let body = await (await fetchApp("/")).text();

		expect(facts.published).toBeGreaterThan(0);
		expect(body).toContain(`There are ${facts.published} of them`);
		expect(body).not.toContain("$packageCount");
	});

	test("lists every published package", async () => {
		let body = await (await fetchApp("/")).text();

		expect(body).toContain("@sdxc/result");
		expect(body).toContain("@sdxc/markdown");
	});

	test("gives every element a unique id, so no tab strip answers another's label", async () => {
		let body = await (await fetchApp("/")).text();
		let ids = [...body.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);

		expect(ids.length).toBeGreaterThan(0);
		expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
	});

	test("answers 404 for an unmapped path", async () => {
		let response = await fetchApp("/nothing-here");

		expect(response.status).toBe(404);
	});
});
