/**
 * Tests Malfoid Stickers' landing and privacy policy through the real renderer and routes: each
 * page answers at the URL the App Store listing names, in the pack's own document with one
 * `h1`, and the policy serves its Markdown twin. Before release the download call is a status,
 * not a link, and no store link appears anywhere.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { AppContext } from "~/app/initializers/router";

import { pageRenderer } from "~/app/test/renderer";
import { APP_STORE } from "~/config/malfoid";
import { LANDING_COPY } from "~/resources/content/malfoid/landing";
import { STICKERS } from "~/resources/content/malfoid/stickers";
import { malfoidMeta } from "~/resources/layouts/malfoid";
import routes from "~/routes/web";

import landingPage from "./malfoid";
import privacyPage, { markdownPage } from "./malfoid-privacy";

/** Fetches a page through a router carrying only what the controllers need. */
async function fetchPage(path: string, headers: Record<string, string> = {}): Promise<Response> {
	let router = createRouter<AppContext>({ middleware: pageRenderer() });
	router.map(routes.malfoid.landing, landingPage);
	router.map(routes.malfoid.privacy, privacyPage);
	router.map(routes.malfoid.privacyMarkdown, markdownPage);

	return await router.fetch(new Request(new URL(path, "https://sergiodxa.com"), { headers }));
}

/** How many `h1` elements the markup opens. */
function headingCount(html: string): number {
	return html.match(/<h1[\s>]/g)?.length ?? 0;
}

describe("GET /apps/malfoid", () => {
	test("renders the landing in the pack's own scope with one h1", async () => {
		let response = await fetchPage("/apps/malfoid");
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toMatch(/<html lang="en" class="system malfoid/);
		expect(headingCount(html)).toBe(1);
		expect(html).toMatch(
			/<h1[^>]*>[\s\S]*A little cute\. A little dramatic\. A lot of attitude\.[\s\S]*Cute\. Dramatic\. All attitude\.[\s\S]*<\/h1>/,
		);
		expect(html).toMatch(
			/<title[^>]*>Malfoid Stickers: Cute &amp; Sassy Reactions for iMessage<\/title>/,
		);
	});

	test("describes the page off the site with the social card and the pack's icons", async () => {
		let html = await (await fetchPage("/apps/malfoid")).text();

		expect(html).toContain('name="description"');
		expect(html).toContain(
			'property="og:image" content="https://sergiodxa.com/apps/malfoid/branding/social-card.png"',
		);
		expect(html).toContain('property="og:site_name" content="Malfoid Stickers"');
		expect(html).toContain('name="twitter:card" content="summary_large_image"');
		expect(html).toContain('rel="canonical" href="https://sergiodxa.com/apps/malfoid"');
		expect(html).toContain('href="/apps/malfoid/branding/favicon.png"');
		expect(html).toContain('rel="apple-touch-icon"');
	});

	test("shows a coming-soon status and no store link before the listing exists", async () => {
		let html = await (await fetchPage("/apps/malfoid")).text();

		expect(APP_STORE.id).toBeNull();
		expect(html).toContain('data-app-store="coming-soon"');
		expect(html).not.toContain('data-app-store="available"');
		expect(html).not.toContain("apps.apple.com");
		expect(html).not.toContain("testflight");
		expect(html).not.toContain('name="apple-itunes-app"');
	});

	test("opens every one of the 170 stickers in the viewer, named by its alt text", async () => {
		let html = await (await fetchPage("/apps/malfoid")).text();

		expect(STICKERS).toHaveLength(170);
		for (let sticker of STICKERS) {
			expect(html).toContain(`srcset="/apps/malfoid/stickers/${sticker.id}-240.webp 240w`);
			expect(html).toContain(
				`aria-label="Open sticker: ${sticker.alt.en.replaceAll("'", "&#39;")}"`,
			);
		}
	});

	test("loads the hero at once and everything below it lazily", async () => {
		let html = await (await fetchPage("/apps/malfoid")).text();

		expect(html).toMatch(/src="\/apps\/malfoid\/stickers\/smug-480\.webp"[^>]*loading="eager"/);
		expect(html).toMatch(/src="\/apps\/malfoid\/stickers\/tantrum-480\.webp"[^>]*loading="lazy"/);
	});

	test("introduces every set, privacy, installation and the questions", async () => {
		let html = await (await fetchPage("/apps/malfoid")).text();

		for (let mood of [
			"Pride &amp; sarcasm",
			"Anger &amp; frustration",
			"Embarrassment &amp; tsundere",
			"Happiness &amp; affection",
			"Sadness &amp; exhaustion",
			"Everyday reactions",
			"Friendship",
			"Memes",
			"Lunar New Year",
			"Mother’s &amp; Father’s Day",
			"Earth Day",
		]) {
			expect(html).toContain(mood);
		}
		expect(html).toContain('id="install"');
		expect(html).toContain('id="faq"');
		expect(html).toContain('href="#halloween"');
		expect(html).toContain('id="halloween"');
		expect(html).toContain(
			"Completely free. No ads. No subscriptions. No data collection. Just Malfoid.",
		);
		expect(html).toContain('href="/apps/malfoid/privacy"');
		expect(html).toContain('href="/apps/malfoid/support"');
	});

	test("names only iPhone and iPad", async () => {
		let html = await (await fetchPage("/apps/malfoid")).text();

		expect(html).toContain("iPhone and iPad");
		expect(html).not.toMatch(/\bMac\b|macOS|Apple Watch/);
	});
});

describe("the sticker viewer", () => {
	test("shows each sticker answering a friend's message, with its description", async () => {
		let html = await (await fetchPage("/apps/malfoid")).text();

		expect(html).toMatch(/<dialog[^>]*id="malfoid-stickers"/);
		expect(html).toContain('commandfor="malfoid-stickers"');
		expect(html).toContain("I ate the last slice of your cake.");
		expect(html).toContain("Should I text my ex?");
		expect(html).toContain(
			"A friend writes “Should I text my ex?” and the reply is a sticker: Malfoid gives a dramatic thumbs-down.",
		);
		expect(html).toContain("1 / 170");
	});

	test("gives every sticker a message in both languages", () => {
		for (let sticker of STICKERS) {
			expect(sticker.prompt.en.length).toBeGreaterThan(0);
			expect(sticker.prompt["es-AR"].length).toBeGreaterThan(0);
			expect(sticker.alt["es-AR"].length).toBeGreaterThan(0);
		}
	});
});

describe("GET /apps/malfoid in Spanish", () => {
	test("answers a Spanish reader in Spanish, alt text and viewer included", async () => {
		let response = await fetchPage("/apps/malfoid", { "accept-language": "es-MX,es;q=0.9" });
		let html = await response.text();

		expect(response.headers.get("content-language")).toBe("es-AR");
		expect(response.headers.get("vary")).toContain("Accept-Language");
		expect(html).toMatch(/<html lang="es-AR" class="system malfoid/);
		expect(headingCount(html)).toBe(1);
		expect(html).toMatch(
			/<h1[^>]*>[\s\S]*Un poco tierna\. Un poco dramática\. Mucha actitud\.[\s\S]*Tierna\. Dramática\. Con actitud\.[\s\S]*<\/h1>/,
		);
		expect(html).toContain("Muy pronto en la");
		expect(html).toContain("Abrir sticker: Malfoid sonríe con aire de superioridad");
		expect(html).toContain("¿Le escribo a mi ex?");
		expect(html).toContain('property="og:locale" content="es_AR"');
		expect(html).toContain(
			'property="og:image" content="https://sergiodxa.com/apps/malfoid/branding/social-card.es-AR.png"',
		);
		expect(html).toContain("Malfoid Stickers, reacciones tiernas y atrevidas");
	});

	test("lets ?lang= override the browser and lists both languages for search engines", async () => {
		let html = await (
			await fetchPage("/apps/malfoid?lang=en", { "accept-language": "es-AR" })
		).text();

		expect(html).toMatch(/<html lang="en"/);
		expect(html).toContain('hreflang="es" href="https://sergiodxa.com/apps/malfoid?lang=es-AR"');
		expect(html).toContain('hreflang="x-default" href="https://sergiodxa.com/apps/malfoid"');
	});

	test("keeps a Spanish reader in Spanish on the support and privacy links", async () => {
		let html = await (await fetchPage("/apps/malfoid?lang=es-AR")).text();

		expect(html).toContain('href="/apps/malfoid/support?lang=es-AR"');
		expect(html).toContain('href="/apps/malfoid/privacy?lang=es-AR"');
		expect(html).toContain('href="/apps/malfoid?lang=es-AR"');
		expect(html).not.toMatch(/<a [^>]*hreflang=/);
	});
});

describe("malfoidMeta", () => {
	test("adds the smart banner once the listing has an id", () => {
		let tags = malfoidMeta(
			"Malfoid",
			"About",
			"https://sergiodxa.com/apps/malfoid",
			LANDING_COPY.en,
			"landing",
			{ id: "6740000000" },
		);

		expect(tags).toContainEqual({ name: "apple-itunes-app", content: "app-id=6740000000" });
	});
});

describe("GET /apps/malfoid/privacy", () => {
	test("renders the policy in the pack's document with one h1 and its sections", async () => {
		let response = await fetchPage("/apps/malfoid/privacy");
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toMatch(/class="system malfoid/);
		expect(headingCount(html)).toBe(1);
		expect(html).toMatch(/<title[^>]*>Malfoid Stickers Privacy Policy<\/title>/);
		expect(html).toContain("The app collects no data");
		expect(html).toContain("Support requests through this website");
		expect(html).toContain('href="/apps/malfoid/privacy.md"');
		expect(html).toContain('href="https://sergiodxa.com/apps/malfoid/support"');
		expect(html).toContain(
			'property="og:image" content="https://sergiodxa.com/apps/malfoid/branding/social-card-privacy.png"',
		);
	});

	test("answers Markdown when the request prefers it", async () => {
		let response = await fetchPage("/apps/malfoid/privacy", { accept: "text/markdown" });

		expect(response.headers.get("content-type")).toContain("text/markdown");
		expect(await response.text()).toContain("## The app collects no data");
	});
});

describe("GET /apps/malfoid/privacy in Spanish", () => {
	test("answers a Spanish reader with the Spanish policy, in the pack's Spanish shell", async () => {
		let response = await fetchPage("/apps/malfoid/privacy", { "accept-language": "es" });
		let html = await response.text();

		expect(response.headers.get("content-language")).toBe("es-AR");
		expect(html).toMatch(/<html lang="es-AR"/);
		expect(headingCount(html)).toBe(1);
		expect(html).toMatch(/<title[^>]*>Política de privacidad de Malfoid Stickers<\/title>/);
		expect(html).toContain("La app no recopila datos");
		expect(html).toContain('href="/apps/malfoid/privacy.md?lang=es-AR"');
		expect(html).toContain('href="https://sergiodxa.com/apps/malfoid/support?lang=es-AR"');
		expect(html).toContain(
			'property="og:image" content="https://sergiodxa.com/apps/malfoid/branding/social-card-privacy.es-AR.png"',
		);
		expect(html).toContain("Política de privacidad de Malfoid Stickers: la app no recopila datos.");
	});

	test("serves the Spanish Markdown at the .md route with ?lang=", async () => {
		let response = await fetchPage("/apps/malfoid/privacy.md?lang=es-AR");
		let body = await response.text();

		expect(response.headers.get("content-language")).toBe("es-AR");
		expect(body).toContain("Última actualización: 26 de noviembre de 2026");
		expect(body).toContain("## A qué puede acceder la app");
		expect(body).not.toContain("title: Política de privacidad");
	});
});

describe("GET /apps/malfoid/privacy.md", () => {
	test("serves the policy as Markdown without its frontmatter", async () => {
		let response = await fetchPage("/apps/malfoid/privacy.md");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/markdown");
		expect(body).toContain("Last updated: November 26, 2026");
		expect(body).toContain("does not access your conversations, contacts, photos");
		expect(body).not.toContain("title: Malfoid Stickers Privacy Policy");
	});
});
