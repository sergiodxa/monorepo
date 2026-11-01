/**
 * Tests `GET /demo` through the real router: the gallery lists every demo landing and every
 * demo docs site the registries discover, each link answers, and the page stays out of search.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/test/router";
import { demoDocsHref, listDemoDocsSites, listDemoDocsSlugs } from "~/resources/views/demo-docs";
import { listDemoLandings } from "~/resources/views/demos";

describe("GET /demo", () => {
	test("lists every demo landing with its kind, tagline and art direction, each link answering", async () => {
		let response = await fetchApp("/demo");
		let body = await response.text();
		let landings = await listDemoLandings();

		expect(response.status).toBe(200);
		expect(landings.map((demo) => demo.slug)).toEqual(
			expect.arrayContaining(["app", "book", "saas"]),
		);
		for (let demo of landings) {
			expect(body).toContain(`href="/demo/${demo.slug}"`);
			expect(body).toContain(demo.kind);
			expect(body).toContain(escape(demo.tagline));
			expect(body).toContain(escape(demo.artDirection));
			expect((await fetchApp(`/demo/${demo.slug}`)).status).toBe(200);
		}
	});

	test("lists every demo docs site with its kind, tagline and art direction, each link answering", async () => {
		let body = await (await fetchApp("/demo")).text();
		let sites = await listDemoDocsSites();

		expect(sites.map((site) => site.slug)).toEqual(
			expect.arrayContaining(["driftwood", "lattice", "parcelo", "tempo"]),
		);
		for (let site of sites) {
			let href = demoDocsHref(site.slug)();
			expect(body).toContain(`href="${href}"`);
			expect(body).toContain(site.kind);
			expect(body).toContain(escape(site.tagline));
			expect(body).toContain(escape(site.artDirection));
			expect((await fetchApp(href)).status).toBe(200);
		}
	});

	test("makes each card one link, named by the demo alone", async () => {
		let body = await (await fetchApp("/demo")).text();
		let demos = [
			...(await listDemoLandings()).map((demo) => ({
				href: `/demo/${demo.slug}`,
				name: demo.title.split(" — ")[0] ?? demo.title,
			})),
			...(await listDemoDocsSites()).map((site) => ({
				href: demoDocsHref(site.slug)(),
				name: site.name,
			})),
		];
		let links = [...body.matchAll(/<a\b[^>]*data-slot="demo-link"[^>]*>([^<]*)<\/a>/g)];

		expect(links).toHaveLength(demos.length);
		for (let demo of demos) {
			let link = links.find((match) => match[0].includes(`href="${demo.href}"`));
			expect(link?.[1]).toBe(escape(demo.name));
			expect(body.split(`href="${demo.href}"`)).toHaveLength(2);
		}
		expect(body).not.toContain(">Open ");
	});

	test("draws every card's miniature hidden from assistive tech, leading with the flagship", async () => {
		let body = await (await fetchApp("/demo")).text();
		let count = (await listDemoLandings()).length + (await listDemoDocsSites()).length;
		let miniatures = [...body.matchAll(/<div\b[^>]*data-slot="demo-miniature"[^>]*>/g)];

		expect(miniatures).toHaveLength(count);
		for (let [tag] of miniatures) expect(tag).toContain('aria-hidden="true"');
		expect(body.indexOf('href="/demo/saas"')).toBeLessThan(body.indexOf('href="/demo/book"'));
		expect(body.indexOf('href="/demo/book"')).toBeLessThan(body.indexOf('href="/demo/app"'));
	});

	test("gives every card the same size, so the grid rounds its own outer corners", async () => {
		let body = await (await fetchApp("/demo")).text();

		expect(body).not.toMatch(/<[a-z][^<>]*\sdata-span="/);
	});

	test("introduces the demos with the counts it lists and a link to their source", async () => {
		let body = await (await fetchApp("/demo")).text();
		let landings = await listDemoLandings();

		expect(body).toMatch(
			new RegExp(
				`${landings.length}(<!-- -->)?\\s+landing pages and ${listDemoDocsSlugs().length} documentation sites`,
			),
		);
		expect(body).toContain(
			'href="https://github.com/sergiodxa/monorepo/tree/main/apps/sdxc-site/resources/views"',
		);
	});

	test("carries one h1 and tells search engines to leave it out", async () => {
		let body = await (await fetchApp("/demo")).text();

		expect(body.match(/<h1[\s>]/g)).toHaveLength(1);
		expect(body).toMatch(/<meta name="robots" content="noindex, nofollow"/);
	});
});

/** The text as the server renders it inside an element, where `'` and `&` are escaped. */
function escape(value: string): string {
	return value.replaceAll("&", "&amp;").replaceAll("'", "&#39;");
}
