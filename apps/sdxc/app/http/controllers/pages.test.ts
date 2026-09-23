/**
 * Tests for the three pages outside the bundle-rendered tree: the changelog, which is
 * the one page whose content is fetched, and the two policy pages a reader checks
 * before depending on anything. The changelog's assertions are mostly about what it
 * does when GitHub will not answer, because that is the case a deploy cannot rehearse.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { fetchApp } from "~/app/lib/test/router";
import { buildNavTree } from "~/app/services/navigation";

/** What the changelog reads, as GitHub sends it. */
const ENDPOINT = "https://api.github.com/repos/sergiodxa/monorepo/releases";

/** One published release, which is the only kind the page has an entry for. */
const RELEASE = {
	tag_name: "v2026.9.17",
	body: "## @sdxc/result\n\n- feat: the thing that shipped\n",
	published_at: "2026-09-17T02:46:27Z",
	html_url: "https://github.com/sergiodxa/monorepo/releases/tag/v2026.9.17",
	draft: false,
	prerelease: false,
};

const server = setupServer(http.get(ENDPOINT, () => HttpResponse.json([RELEASE])));

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("GET /docs/releases/changelog", () => {
	test("lists a release with its date and its notes", async () => {
		let response = await fetchApp("/docs/releases/changelog");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain("2026.9.17");
		expect(body).toContain("September 17, 2026");
		expect(body).toContain("the thing that shipped");
	});

	test("keeps answering when GitHub refuses the call", async () => {
		server.use(http.get(ENDPOINT, () => new HttpResponse(null, { status: 403 })));

		let response = await fetchApp("/docs/releases/changelog");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain("Changelog");
		expect(body).toContain("could not be read just now");
	});

	test("joins the Releases section beside the versioning guide", async () => {
		let tree = await buildNavTree();
		let releases = tree.guides.find((group) => group.title === "Releases");

		expect(releases?.entries.map((entry) => entry.title)).toContain("Versioning");
		expect(releases?.entries.map((entry) => entry.href)).toContain("/docs/releases/changelog");
	});
});

describe("GET /security", () => {
	test("states which releases get fixes, and where to report privately", async () => {
		let response = await fetchApp("/security");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain("Which releases get fixes");
		expect(body).toContain("hello+security@sergiodxa.com");
	});

	test("promises no response window and no bounty", async () => {
		let body = await (await fetchApp("/security")).text();

		expect(body).toContain("no stated response time");
		expect(body).toContain("no paid");
	});
});

describe("GET /maintenance", () => {
	test("states that a dated release carries no compatibility promise", async () => {
		let response = await fetchApp("/maintenance");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain("may change or remove");
		expect(body).toContain("There are no supported versions");
	});

	test("says there are no backports rather than naming a support window", async () => {
		let body = await (await fetchApp("/maintenance")).text();

		expect(body).toContain("No backports");
		expect(body).toContain("long-term-support");
	});
});

describe("the footer", () => {
	test("offers both policy pages from a root-level page", async () => {
		let body = await (await fetchApp("/security")).text();

		expect(body).toContain('href="/maintenance"');
		expect(body).toContain('href="/security"');
		expect(body).toContain('href="/docs/releases/changelog"');
	});
});
