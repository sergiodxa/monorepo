/**
 * Tests Wakaba's landing and privacy policy through the real renderer and routes: each page
 * answers at the URL the App Store listing names, in Wakaba's own document with one `h1`, and
 * the policy serves its Markdown twin. Before release the download call is a status, not a link.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { AppContext } from "~/app/initializers/router";

import { pageRenderer } from "~/app/test/renderer";
import { EN } from "~/resources/content/wakaba/en";
import { wakabaMeta } from "~/resources/layouts/wakaba";
import routes from "~/routes/web";

import landingPage from "./wakaba";
import privacyPage, { markdownPage } from "./wakaba-privacy";

/** Fetches a page through a router carrying only what the controllers need. */
async function fetchPage(path: string, headers: Record<string, string> = {}): Promise<Response> {
	let router = createRouter<AppContext>({ middleware: pageRenderer() });
	router.map(routes.wakaba, landingPage);
	router.map(routes.wakabaPrivacy, privacyPage);
	router.map(routes.wakabaPrivacyMarkdown, markdownPage);

	return await router.fetch(new Request(new URL(path, "https://sergiodxa.com"), { headers }));
}

/** How many `h1` elements the markup opens. */
function headingCount(html: string): number {
	return html.match(/<h1[\s>]/g)?.length ?? 0;
}

describe("GET /apps/wakaba", () => {
	test("renders the landing in Wakaba's own scope with one h1", async () => {
		let response = await fetchPage("/apps/wakaba");
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toMatch(/<html lang="en" class="system wakaba/);
		expect(headingCount(html)).toBe(1);
		expect(html).toMatch(/<h1[^>]*>[\s\S]*Grow with every[\s\S]*session[\s\S]*<\/h1>/);
		expect(html).toMatch(/<title[^>]*>Wakaba: Japanese vocabulary for iPhone and iPad<\/title>/);
	});

	test("describes the page off the site with the social card and the Wakaba icons", async () => {
		let html = await (await fetchPage("/apps/wakaba")).text();

		expect(html).toContain('name="description"');
		expect(html).toContain(
			'property="og:image" content="https://sergiodxa.com/apps/wakaba/branding/social-card.png"',
		);
		expect(html).toContain('name="twitter:card" content="summary_large_image"');
		expect(html).toContain('rel="canonical" href="https://sergiodxa.com/apps/wakaba"');
		expect(html).toContain('href="/apps/wakaba/branding/logo/favicon.svg"');
		expect(html).toContain('rel="apple-touch-icon"');
	});

	test("shows the App Store as coming soon, with no link and no smart banner", async () => {
		let html = await (await fetchPage("/apps/wakaba")).text();

		expect(html).toContain('data-app-store="coming-soon"');
		expect(html).toContain("Coming soon to the");
		expect(html).not.toContain('data-app-store="available"');
		expect(html).not.toContain("apps.apple.com");
		expect(html).not.toContain("apple-itunes-app");
	});

	test("shows each of the small things with its real screen, in both appearances", async () => {
		let html = await (await fetchPage("/apps/wakaba")).text();

		for (let screen of [
			"en/kanji-index",
			"en/particle",
			"en/phrases",
			"es/flashcards-water",
			"en/add-word",
		]) {
			expect(html).toContain(`src="/apps/wakaba/screenshots/${screen}-light.webp"`);
			expect(html).toContain(`srcset="/apps/wakaba/screenshots/${screen}-dark.webp"`);
		}
		expect(html).toContain('src="/apps/wakaba/screenshots/en/hiragana.webp"');
		expect(html).toContain("Everything else in your pocket");
	});

	test("frames the iPad capture as a tablet and every other screen as a phone", async () => {
		let html = await (await fetchPage("/apps/wakaba")).text();

		expect(html).toMatch(
			/src="\/apps\/wakaba\/screenshots\/en\/kana-tracing-light\.webp"[^>]*width="744"/,
		);
		expect(html).toMatch(
			/src="\/apps\/wakaba\/screenshots\/en\/stroke-guide-light\.webp"[^>]*width="560"/,
		);
	});

	test("names only iPhone and iPad", async () => {
		let html = await (await fetchPage("/apps/wakaba")).text();

		expect(html).toContain("iPhone and iPad");
		expect(html).not.toMatch(/\bMac\b|macOS/);
	});
});

describe("GET /apps/wakaba in Spanish", () => {
	test("answers a Spanish reader in Spanish, with the Spanish captures", async () => {
		let response = await fetchPage("/apps/wakaba", { "accept-language": "es-MX,es;q=0.9" });
		let html = await response.text();

		expect(response.headers.get("content-language")).toBe("es-AR");
		expect(response.headers.get("vary")).toContain("Accept-Language");
		expect(html).toMatch(/<html lang="es-AR" class="system wakaba/);
		expect(headingCount(html)).toBe(1);
		expect(html).toMatch(/<h1[^>]*>[\s\S]*Crece con cada[\s\S]*práctica[\s\S]*<\/h1>/);
		expect(html).toContain('src="/apps/wakaba/screenshots/es/path-progress-light.webp"');
		expect(html).toContain('srcset="/apps/wakaba/screenshots/es/path-progress-dark.webp"');
		expect(html).toContain("Muy pronto en la");
		expect(html).toContain(
			'content="https://sergiodxa.com/apps/wakaba/branding/social-card-es.png"',
		);
		expect(html).not.toContain("/apps/wakaba/screenshots/en/path-progress");
	});

	test("keeps the language out of the header", async () => {
		let html = await (await fetchPage("/apps/wakaba")).text();

		expect(html).not.toContain(">Español<");
		expect(html).not.toMatch(/<a [^>]*hreflang=/);
	});

	test("lets ?lang= override the browser and lists both languages for search engines", async () => {
		let html = await (
			await fetchPage("/apps/wakaba?lang=en", { "accept-language": "es-AR" })
		).text();

		expect(html).toMatch(/<html lang="en"/);
		expect(html).toContain('hreflang="es" href="https://sergiodxa.com/apps/wakaba?lang=es-AR"');
		expect(html).toContain('hreflang="x-default" href="https://sergiodxa.com/apps/wakaba"');
	});

	test("shows the languages card in the page's other language", async () => {
		let english = await (await fetchPage("/apps/wakaba?lang=en")).text();
		let spanish = await (await fetchPage("/apps/wakaba?lang=es-AR")).text();

		expect(english).toContain('src="/apps/wakaba/screenshots/es/flashcards-water-light.webp"');
		expect(spanish).toContain('src="/apps/wakaba/screenshots/en/flashcards-water-light.webp"');
	});
});

describe("wakabaMeta", () => {
	test("adds the smart banner once the listing has an id", () => {
		let tags = wakabaMeta("Wakaba", "About", "https://sergiodxa.com/apps/wakaba", EN, {
			id: "6740000000",
		});

		expect(tags).toContainEqual({ name: "apple-itunes-app", content: "app-id=6740000000" });
	});
});

describe("GET /apps/wakaba/privacy", () => {
	test("renders the policy in Wakaba's document with one h1 and its sections", async () => {
		let response = await fetchPage("/apps/wakaba/privacy");
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toMatch(/class="system wakaba/);
		expect(headingCount(html)).toBe(1);
		expect(html).toMatch(/<title[^>]*>Wakaba Privacy Policy<\/title>/);
		expect(html).toContain("iCloud sync");
		expect(html).toContain("Speaking practice");
		expect(html).toContain('href="/apps/wakaba/privacy.md"');
		expect(html).toContain('href="https://sergiodxa.com/apps/wakaba/support"');
	});

	test("answers Markdown when the request prefers it", async () => {
		let response = await fetchPage("/apps/wakaba/privacy", { accept: "text/markdown" });

		expect(response.headers.get("content-type")).toContain("text/markdown");
		expect(await response.text()).toContain("## iCloud sync");
	});
});

describe("GET /apps/wakaba/privacy in Spanish", () => {
	test("answers a Spanish reader with the Spanish policy, in Wakaba's Spanish shell", async () => {
		let response = await fetchPage("/apps/wakaba/privacy", { "accept-language": "es" });
		let html = await response.text();

		expect(response.headers.get("content-language")).toBe("es-AR");
		expect(html).toMatch(/<html lang="es-AR"/);
		expect(headingCount(html)).toBe(1);
		expect(html).toMatch(/<title[^>]*>Política de privacidad de Wakaba<\/title>/);
		expect(html).toContain("Sincronización con iCloud");
		expect(html).toContain('href="/apps/wakaba/privacy.md?lang=es-AR"');
		expect(html).toContain('href="/apps/wakaba/support?lang=es-AR"');
	});

	test("serves the Spanish Markdown at the .md route with ?lang=", async () => {
		let response = await fetchPage("/apps/wakaba/privacy.md?lang=es-AR");
		let body = await response.text();

		expect(response.headers.get("content-language")).toBe("es-AR");
		expect(body).toContain("Última actualización: 6 de noviembre de 2026");
		expect(body).toContain("## Práctica de pronunciación");
		expect(body).not.toContain("title: Política de privacidad de Wakaba");
	});
});

describe("GET /apps/wakaba/privacy.md", () => {
	test("serves the policy as Markdown without its frontmatter", async () => {
		let response = await fetchPage("/apps/wakaba/privacy.md");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/markdown");
		expect(body).toContain("Last updated: November 6, 2026");
		expect(body).toContain("requires on-device recognition");
		expect(body).not.toContain("title: Wakaba Privacy Policy");
	});
});
