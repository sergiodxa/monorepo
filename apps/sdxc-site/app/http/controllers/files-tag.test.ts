/**
 * Tests for the `files` tag, exercised where a guide actually writes one. A tag that
 * is not registered stays raw HTML rather than failing, so the assertion that matters
 * is that the names arrive inside the card's markup rather than as an unparsed
 * `<folder>` sitting in the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/test/router";

/** The guide whose prose draws an app's folder layout. */
const GUIDE = "/docs/getting-started/how-it-fits-together";

describe("the files tag", () => {
	test("draws every folder and file the guide writes", async () => {
		let response = await fetchApp(GUIDE);
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain("links");

		for (let name of ["bootstrap", "worker.ts", "app", "controllers", "initializers", "database"]) {
			expect(body).toContain(`>${name}</span>`);
		}
	});

	test("renders the structure rather than leaving the tags as text", async () => {
		let body = await (await fetchApp(GUIDE)).text();

		expect(body).not.toContain("&lt;folder");
		expect(body).not.toContain('<folder name="bootstrap">');
		expect(body).toContain("<ul");
	});
});
