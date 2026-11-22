/**
 * Tests `GET /showcase/:slug/demo/frames/*part` through the real router: every docs demo page's
 * feedback frame answers its form, or its thanks once sent, an unknown piece answers `404`,
 * and a page inlines its feedback frame in the document a reader without scripts receives.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/test/router";
import { demoDocsHref, findDemoDocsSite, listDemoDocsSlugs } from "~/resources/views/demo-docs";

/** Every demo's slug with its site, loaded once for the table-driven tests below. */
let sites = await Promise.all(
	listDemoDocsSlugs().map(async (slug) => ({ slug, site: (await findDemoDocsSite(slug))! })),
);

/** Every docs frame address a page's HTML names, wherever it appears in the markup. */
function frameSources(html: string): string[] {
	return [...html.matchAll(/\/showcase\/[\w-]+\/demo\/frames\/[^"'\s<>\\]+/g)].map((match) =>
		match[0].replaceAll("&amp;", "&"),
	);
}

describe("GET /showcase/:slug/demo/frames/*part", () => {
	test.each(sites)("every frame $slug's pages name answers", async ({ slug, site }) => {
		for (let path of Object.keys(site.pages)) {
			let html = await (await fetchApp(demoDocsHref(slug)(path))).text();
			let sources = frameSources(html);

			expect(sources, path).toContain(`/showcase/${slug}/demo/frames/feedback/${path}`);
			for (let source of new Set(sources)) {
				expect((await fetchApp(source)).status, source).toBe(200);
			}
		}
	});

	test("the feedback frame answers the form, and the thanks once sent", async () => {
		let form = await fetchApp("/showcase/driftwood/demo/frames/feedback/start/quickstart");
		let sent = await fetchApp(
			"/showcase/driftwood/demo/frames/feedback/start/quickstart?feedback=sent",
		);
		let formBody = await form.text();
		let sentBody = await sent.text();

		expect(form.status).toBe(200);
		expect(formBody).toContain('data-slot="docs-feedback-form"');
		expect(formBody).toContain('data-rmx-target="feedback"');
		expect(formBody).not.toMatch(/<h1[\s>]/);
		expect(sent.status).toBe(200);
		expect(sentBody).toContain("Thanks for telling us");
	});

	test.each([
		"/showcase/driftwood/demo/frames/feedback/no/such-page",
		"/showcase/driftwood/demo/frames/unknown-piece",
		"/showcase/no-such-site/demo/frames/feedback/start/quickstart",
	])("%s answers 404", async (address) => {
		expect((await fetchApp(address)).status).toBe(404);
	});
});

describe("a docs demo page's feedback block", () => {
	test("is inlined whole into the page's HTML, so it posts without scripts", async () => {
		let html = await (await fetchApp("/showcase/driftwood/demo/start/quickstart")).text();
		let end = html.indexOf("</html>");
		let form = html.indexOf('data-slot="docs-feedback-form"');

		expect(form).toBeGreaterThan(-1);
		expect(html.indexOf("</form>", form)).toBeLessThan(end);
		expect(html.indexOf("Was this page helpful?")).toBeLessThan(end);
	});

	test("renders the thanks inline after a document vote", async () => {
		let html = await (
			await fetchApp("/showcase/driftwood/demo/start/quickstart?feedback=sent")
		).text();
		let end = html.indexOf("</html>");

		expect(html.indexOf("Thanks for telling us")).toBeGreaterThan(-1);
		expect(html.indexOf("Thanks for telling us")).toBeLessThan(end);
	});
});
