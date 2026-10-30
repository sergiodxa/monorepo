/**
 * Tests for `GET /` — the landing page. The content file is parsed at request time
 * against the tag vocabulary, so a mistyped tag or attribute is a 500 rather than a
 * blank section; these assertions are what turn that into a failing test instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parseDocument } from "@sdxc/html/document";
import { unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { readPackageFacts } from "~/app/services/packages";
import { fetchApp } from "~/app/test/router";

/** What the release pin reads, as GitHub sends it. */
const ENDPOINT = "https://api.github.com/repos/sergiodxa/monorepo/releases";

/** The newest published release, which the pin names. */
const RELEASE = {
	tag_name: "v2026.10.30",
	body: "## @sdxc/result\n\n- feat: the thing that shipped\n",
	published_at: "2026-10-30T02:46:27Z",
	html_url: "https://github.com/sergiodxa/monorepo/releases/tag/v2026.10.30",
	draft: false,
	prerelease: false,
};

const server = setupServer(http.get(ENDPOINT, () => HttpResponse.json([RELEASE])));

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** The landing page, parsed. */
async function landing() {
	return unwrap(parseDocument(await (await fetchApp("/")).text()));
}

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
		/** The runtime writes one `rmx-data` script per inlined frame, which no label points at. */
		let ids = [...body.matchAll(/\sid="([^"]+)"/g)]
			.map((match) => match[1])
			.filter((id) => id !== "rmx-data");

		expect(ids.length).toBeGreaterThan(0);
		expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
	});

	test("pins the newest release, linking to its changelog entry", async () => {
		let page = await landing();
		let pin = page.querySelector('a[href="/docs/releases/changelog#2026.10.30"]');

		expect(pin?.textContent).toContain("Latest release");
		expect(pin?.querySelector("time")?.textContent).toBe("2026.10.30");
	});

	test("leaves the pin out when no release can be read", async () => {
		server.use(http.get(ENDPOINT, () => new HttpResponse(null, { status: 403 })));
		let body = await (await fetchApp("/")).text();

		expect(body).not.toContain("Latest release");
	});

	test("shows one handler on Workers, Bun, Deno and Node", async () => {
		let page = await landing();
		let tabs = Array.from(
			page.querySelectorAll('[data-slot="code-stage-tab"]'),
			(tab) => tab.textContent,
		);

		expect(tabs).toEqual(["Workers", "Bun", "Deno", "Node"]);
	});

	test("answers 404 for an unmapped path", async () => {
		let response = await fetchApp("/nothing-here");

		expect(response.status).toBe(404);
	});
});
