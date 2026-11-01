/**
 * Tests `/docs/:slug`: every page in the registry renders its title, a heading for each
 * entry in its rail and no untranslated key, gated pages name their plan, the page ends on
 * a hand-picked next step, and an unknown slug answers the help 404.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { AppRouter } from "~/app/test/controller";

import show from "~/app/http/controllers/docs/show";
import { SUPPORTED_LANGUAGES } from "~/app/initializers/i18n";
import { createTestRouter, fetchRoute } from "~/app/test/controller";
import { DOC_PAGES, docHref, loadDocBody } from "~/resources/docs/registry";
import en from "~/resources/locales/en";
import es from "~/resources/locales/es";
import routes from "~/routes/web";

/** A message from one of the app's dictionaries, by its dotted key. */
function messageAt(language: string, path: string): string {
	let dictionary: unknown = language === "es" ? es : en;
	for (let key of path.split(".")) dictionary = (dictionary as Record<string, unknown>)[key];
	return String(dictionary);
}

/** A router with the help pages mapped and nobody signed in, as a visitor arrives. */
function createRouter(): AppRouter {
	let router = createTestRouter(null);
	router.map(routes.docs.show, show);
	return router;
}

/** Every page body on disk, keyed `<locale>/<slug>`, so a missing translation fails here. */
const BODIES = import.meta.glob("../../../../resources/docs/pages/*/*.tsx");

/** Requests a help page as a browser asking for `language` would. */
function fetchIn(router: AppRouter, path: string, language: string): Promise<Response> {
	return router.fetch(
		new Request(new URL(path, "https://reader.test"), { headers: { "accept-language": language } }),
	);
}

/** Every page in every language the app speaks. */
const CASES = DOC_PAGES.flatMap((page) =>
	SUPPORTED_LANGUAGES.map((language) => [page.slug, language] as const),
);

describe("GET /docs/:slug", () => {
	test.each(CASES)("renders %s in %s", async (slug, language) => {
		let module = await loadDocBody(slug, language);
		let response = await fetchIn(createRouter(), docHref(slug), language);
		let html = await response.text();
		let title = messageAt(language, `docs.pages.${slug}.title`);

		expect(response.status).toBe(200);
		expect(html).toContain(`lang="${language}"`);
		expect(html.replace(/&#x27;|&#39;/g, "'")).toContain(`>${title}<`);
		expect(html.match(/\b(docs|landing)\.[a-z]+\.[a-zA-Z.-]+/g)).toBeNull();
		for (let item of module.TOC) expect(html).toContain(`id="${item.id}"`);
	});

	test.each(SUPPORTED_LANGUAGES)("has a %s body for every page", (language) => {
		let missing = DOC_PAGES.filter(
			(page) => !Object.keys(BODIES).some((key) => key.endsWith(`/${language}/${page.slug}.tsx`)),
		);
		expect(missing.map((page) => page.slug)).toEqual([]);
	});

	test("says which plan a gated page needs, linked to the plan table", async () => {
		let response = await fetchRoute(createRouter(), docHref("folders"));
		let html = await response.text();

		expect(html).toContain('data-slot="plan-notice"');
		expect(html).toContain(`href="${docHref("plans")}"`);
		expect(html).toContain("Paid and Premium plans");
	});

	test("ends every page with its hand-picked next pages and the vote", async () => {
		let response = await fetchRoute(createRouter(), docHref("getting-started"));
		let html = await response.text();

		expect(html).toContain('data-slot="next-steps"');
		expect(html).toContain(`href="${docHref("import-opml")}"`);
		expect(html).toContain('id="docs-feedback"');
		expect(html).toContain('data-rmx-reset-scroll="manual"');
		expect(html).toContain('href="/support?from=getting-started"');
		expect(html).not.toContain("mailto:");
	});

	test("hands every next step to a page that exists", () => {
		let slugs = new Set(DOC_PAGES.map((page) => page.slug));
		for (let page of DOC_PAGES) {
			for (let next of page.next) expect(slugs.has(next), `${page.slug} → ${next}`).toBe(true);
		}
	});

	test("thanks a reader who just voted in place of the form", async () => {
		let response = await fetchRoute(createRouter(), `${docHref("plans")}?feedback=sent`);
		let html = await response.text();

		expect(html).toContain('data-state="sent"');
	});

	test("answers a slug nobody wrote with the help 404 and suggestions", async () => {
		let response = await fetchRoute(createRouter(), "/docs/telepathy");
		let html = await response.text();

		expect(response.status).toBe(404);
		expect(html).toContain('data-slot="docs-not-found"');
		expect(html).toContain(`href="${docHref("getting-started")}"`);
	});
});
