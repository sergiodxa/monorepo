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

	test("shows each of the small things with its real screen", async () => {
		let html = await (await fetchPage("/apps/wakaba")).text();

		for (let screen of [
			"kanji-index",
			"particle",
			"phrases",
			"practice-reminder",
			"flashcards-water-es",
			"add-word",
		]) {
			expect(html).toContain(`src="/apps/wakaba/screenshots/${screen}.webp"`);
		}
		expect(html).toContain("Everything else in your pocket");
	});

	test("names only iPhone and iPad", async () => {
		let html = await (await fetchPage("/apps/wakaba")).text();

		expect(html).toContain("iPhone and iPad");
		expect(html).not.toMatch(/\bMac\b|macOS/);
	});
});

describe("wakabaMeta", () => {
	test("adds the smart banner once the listing has an id", () => {
		let tags = wakabaMeta("Wakaba", "About", "https://sergiodxa.com/apps/wakaba", {
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
