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
			/<h1[^>]*>[\s\S]*A little cute\. A little dramatic\. A lot of attitude\.[\s\S]*<\/h1>/,
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

	test("shows every one of the 60 stickers with its own alt text", async () => {
		let html = await (await fetchPage("/apps/malfoid")).text();

		expect(STICKERS).toHaveLength(60);
		for (let sticker of STICKERS) {
			expect(html).toContain(`srcset="/apps/malfoid/stickers/${sticker.id}-240.webp 240w`);
			expect(html).toContain(`alt="${sticker.alt.replaceAll("'", "&#39;")}"`);
		}
	});

	test("loads the hero at once and everything below it lazily", async () => {
		let html = await (await fetchPage("/apps/malfoid")).text();

		expect(html).toMatch(/src="\/apps\/malfoid\/stickers\/smug-480\.webp"[^>]*loading="eager"/);
		expect(html).toMatch(/src="\/apps\/malfoid\/stickers\/tantrum-480\.webp"[^>]*loading="lazy"/);
	});

	test("introduces the six moods, privacy, installation and the questions", async () => {
		let html = await (await fetchPage("/apps/malfoid")).text();

		for (let mood of [
			"Pride &amp; sarcasm",
			"Anger &amp; frustration",
			"Embarrassment &amp; tsundere",
			"Happiness &amp; affection",
			"Sadness &amp; exhaustion",
			"Everyday reactions",
		]) {
			expect(html).toContain(mood);
		}
		expect(html).toContain('id="install"');
		expect(html).toContain('id="faq"');
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

describe("malfoidMeta", () => {
	test("adds the smart banner once the listing has an id", () => {
		let tags = malfoidMeta("Malfoid", "About", "https://sergiodxa.com/apps/malfoid", {
			id: "6740000000",
		});

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
	});

	test("answers Markdown when the request prefers it", async () => {
		let response = await fetchPage("/apps/malfoid/privacy", { accept: "text/markdown" });

		expect(response.headers.get("content-type")).toContain("text/markdown");
		expect(await response.text()).toContain("## The app collects no data");
	});
});

describe("GET /apps/malfoid/privacy.md", () => {
	test("serves the policy as Markdown without its frontmatter", async () => {
		let response = await fetchPage("/apps/malfoid/privacy.md");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/markdown");
		expect(body).toContain("Last updated: November 24, 2026");
		expect(body).toContain("does not access your conversations, contacts, photos");
		expect(body).not.toContain("title: Malfoid Stickers Privacy Policy");
	});
});
