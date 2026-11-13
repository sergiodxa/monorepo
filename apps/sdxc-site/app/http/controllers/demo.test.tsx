/**
 * Tests `GET /demo/:slug` through the real router over a fixture demo: a demo renders
 * `noindex, nofollow` with no site chrome, a named frame answers alone, an unknown slug answers
 * the site's 404, and no demo reaches robots-allowed paths, the sitemap, `/llms.txt` or search.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { afterEach, describe, expect, test, vi } from "vitest";

import type { DemoLanding } from "~/resources/views/demos";

import * as caching from "~/app/http/caching";

/** The one demo the registry answers with in these tests. */
const FIXTURE: DemoLanding = {
	title: "Fixture Co",
	description: "A demo standing in for a real one.",
	kind: "Fixture landing",
	tagline: "A stand-in demo.",
	artDirection: "Plain and quiet.",
	thumbnail: () => <div id="fixture-thumbnail" />,
	render: () => <main id="fixture-demo">Fixture landing</main>,
	target: (name, url) =>
		name === "fixture-bill" ? <p id="fixture-bill">{url.searchParams.get("hours")} h</p> : null,
};

/** The real registry, read before the router sees the fixture in its place. */
let registry =
	await vi.importActual<typeof import("~/resources/views/demos")>("~/resources/views/demos");

vi.doMock("~/resources/views/demos", () => ({
	...registry,
	findDemoLanding: async (slug: string) => (slug === "fixture" ? FIXTURE : null),
}));

let { fetchApp } = await import("~/app/test/router");

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
});

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

	test("reuses a stored landing before rendering its demo", async () => {
		vi.spyOn(caching, "withStreamCache").mockResolvedValue(new Response("cached landing"));
		let render = vi.spyOn(FIXTURE, "render");
		let response = await fetchApp("/demo/fixture");

		expect(await response.text()).toBe("cached landing");
		expect(render).not.toHaveBeenCalled();
	});

	test("gives a landing the shared cache policy and revalidates its build", async () => {
		vi.stubEnv("PROD", true);
		let response = await fetchApp("/demo/fixture");
		let tag = response.headers.get("ETag");

		expect(response.headers.get("Cache-Control")).toContain("public");
		expect(response.headers.get("Cache-Control")).toContain("s-maxage=3600");
		expect(tag).toBeTruthy();
		expect((await fetchApp("/demo/fixture", { headers: { "If-None-Match": tag! } })).status).toBe(
			304,
		);
	});

	test("answers a named frame with its content alone, varying by target", async () => {
		let response = await fetchApp("/demo/fixture?hours=12", {
			headers: { "X-Remix-Target": "fixture-bill", "X-Remix-Frame": "true" },
		});
		let body = await response.text();

		expect(body).toContain('<p id="fixture-bill">12 h</p>');
		expect(body).not.toContain("fixture-demo");
		expect(response.headers.get("Vary")).toContain("X-Remix-Target");
	});

	test("answers a target the demo lacks with the whole landing", async () => {
		let response = await fetchApp("/demo/fixture", { headers: { "X-Remix-Target": "nope" } });

		expect(await response.text()).toContain('<main id="fixture-demo">Fixture landing</main>');
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
	test("robots.txt disallows the gallery and every demo", async () => {
		let body = await (await fetchApp("/robots.txt")).text();

		expect(body).toMatch(/^Disallow: \/demo$/m);
	});

	test.each(["/sitemap.xml", "/llms.txt", "/search.json"])("%s names no demo", async (path) => {
		let response = await fetchApp(path);

		expect(response.status).toBe(200);
		expect(await response.text()).not.toContain("/demo/");
	});
});
