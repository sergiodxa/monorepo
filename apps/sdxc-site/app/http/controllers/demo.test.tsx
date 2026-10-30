/**
 * Tests `GET /demo/:slug` through the real router over a fixture demo: a demo renders
 * `noindex, nofollow` with no site chrome, an unknown slug answers the site's 404, and no
 * demo reaches robots-allowed paths, the sitemap, `/llms.txt` or the search index.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test, vi } from "vitest";

import type { DemoLanding } from "~/resources/views/demos";

/** The one demo the registry answers with in these tests. */
const FIXTURE: DemoLanding = {
	title: "Fixture Co",
	description: "A demo standing in for a real one.",
	render: () => <main id="fixture-demo">Fixture landing</main>,
};

/** The real registry, read before the router sees the fixture in its place. */
let registry =
	await vi.importActual<typeof import("~/resources/views/demos")>("~/resources/views/demos");

vi.doMock("~/resources/views/demos", () => ({
	...registry,
	findDemoLanding: async (slug: string) => (slug === "fixture" ? FIXTURE : null),
}));

let { fetchApp } = await import("~/app/test/router");

describe("GET /demo/:slug", () => {
	test("renders the demo alone and tells search engines to leave it out", async () => {
		let response = await fetchApp("/demo/fixture");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain('<main id="fixture-demo">Fixture landing</main>');
		expect(body).toContain("<title>Fixture Co");
		expect(body).toMatch(/<meta name="robots" content="noindex, nofollow"/);
		expect(body).not.toContain("<footer");
		expect(body).not.toContain("<header");
	});

	test("answers the site's 404 for a slug no demo answers to", async () => {
		let response = await fetchApp("/demo/no-such-demo");

		expect(response.status).toBe(404);
	});
});

describe("findDemoLanding", () => {
	test("finds nothing for a slug with no folder, an inherited key or a path", async () => {
		expect(await registry.findDemoLanding("no-such-demo")).toBeNull();
		expect(await registry.findDemoLanding("constructor")).toBeNull();
		expect(await registry.findDemoLanding("../demos")).toBeNull();
	});
});

describe("demo discoverability", () => {
	test("robots.txt disallows every demo", async () => {
		let body = await (await fetchApp("/robots.txt")).text();

		expect(body).toMatch(/^Disallow: \/demo\/$/m);
	});

	test.each(["/sitemap.xml", "/llms.txt", "/search.json"])("%s names no demo", async (path) => {
		let response = await fetchApp(path);

		expect(response.status).toBe(200);
		expect(await response.text()).not.toContain("/demo/");
	});
});
