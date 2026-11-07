/**
 * Tests Encore's landing and privacy policy through the real renderer and routes: each page
 * answers at the URL the App Store listing names, in Encore's own document with one `h1`, in
 * English, Argentine Spanish or Japanese, and the download call links the live listing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { AppContext } from "~/app/initializers/router";

import { blankSearchFrame } from "~/app/test/frames";
import { pageRenderer } from "~/app/test/renderer";
import routes from "~/routes/web";

import landingPage from "./encore";
import privacyPage, { markdownPage } from "./encore-privacy";

/** Fetches a page through a router carrying only what the controllers need. */
async function fetchPage(path: string, headers: Record<string, string> = {}): Promise<Response> {
	let router = createRouter<AppContext>({ middleware: pageRenderer() });
	router.map(routes.searchFrame, blankSearchFrame);
	router.map(routes.encore, landingPage);
	router.map(routes.encorePrivacy, privacyPage);
	router.map(routes.encorePrivacyMarkdown, markdownPage);

	return await router.fetch(new Request(new URL(path, "https://sergiodxa.com"), { headers }));
}

/** How many `h1` elements the markup opens. */
function headingCount(html: string): number {
	return html.match(/<h1[\s>]/g)?.length ?? 0;
}

describe("GET /apps/encore", () => {
	test("renders the landing in Encore's own scope with one h1", async () => {
		let response = await fetchPage("/apps/encore");
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-language")).toBe("en");
		expect(html).toMatch(/<html lang="en" class="system encore/);
		expect(headingCount(html)).toBe(1);
		expect(html).toMatch(/<h1[^>]*>[\s\S]*Your next night starts with a song\.[\s\S]*<\/h1>/);
		expect(html).toMatch(/<title[^>]*>Encore: a music party game for iPhone/);
	});

	test("links Apple's badge to the listing and names the app for Safari's banner", async () => {
		let html = await (await fetchPage("/apps/encore")).text();

		expect(html).toContain('data-app-store="available"');
		expect(html).toContain('href="https://apps.apple.com/app/id6813754400"');
		expect(html).toContain('src="/apps/app-store/badge-en-us-black.svg"');
		expect(html).toContain('alt="Download on the App Store"');
		expect(html).toContain('name="apple-itunes-app" content="app-id=6813754400"');
		expect(html).not.toContain('data-app-store="coming-soon"');
	});

	test("holds each screenshot's place with a placeholder naming its file", async () => {
		let html = await (await fetchPage("/apps/encore")).text();

		for (let screen of ["card-back", "challenge", "swipe", "shuffle", "watch-ready"]) {
			expect(html).toContain(`data-placeholder="${screen}"`);
		}
		expect(html).toContain("screenshots/en/challenge-{light,dark}.webp");
	});

	test("draws the deck's cards with the app's own words", async () => {
		let html = await (await fetchPage("/apps/encore")).text();

		expect(html).toContain("GUILTY PLEASURE");
		expect(html).toContain("slightly embarrassed to admit you love.");
		expect(html).toContain("Sing a nostalgic song from the 1990s.");
	});

	test("names the price, Family Sharing and Mac as the iPad app", async () => {
		let html = await (await fetchPage("/apps/encore")).text();

		expect(html).toContain("US$4.99");
		expect(html).toContain("Family Sharing");
		expect(html).toContain("or play on a Mac");
	});

	test("lists every language for search engines and links them from the footer", async () => {
		let html = await (await fetchPage("/apps/encore")).text();

		expect(html).toContain('hreflang="es" href="https://sergiodxa.com/apps/encore?lang=es-AR"');
		expect(html).toContain('hreflang="ja" href="https://sergiodxa.com/apps/encore?lang=ja"');
		expect(html).toContain('hreflang="x-default" href="https://sergiodxa.com/apps/encore"');
		expect(html).toContain('href="/apps/encore?lang=ja"');
	});
});

describe("The playable card", () => {
	test("deals from the real deck, face down, in the page's language", async () => {
		let english = await (await fetchPage("/apps/encore")).text();
		let japanese = await (await fetchPage("/apps/encore?lang=ja")).text();

		expect(english).toContain("Pick a card, any card");
		expect(english).toContain('aria-label="Tap to reveal"');
		expect(english).toContain("KARAOKE CHAMPION");
		expect(japanese).toContain("好きなカードを一枚どうぞ");
		expect(japanese).toContain("カラオケチャンピオン");
	});
});

describe("GET /apps/encore in Spanish and Japanese", () => {
	test("answers a Spanish reader in Argentine Spanish", async () => {
		let response = await fetchPage("/apps/encore", { "accept-language": "es-MX,es;q=0.9" });
		let html = await response.text();

		expect(response.headers.get("content-language")).toBe("es-AR");
		expect(response.headers.get("vary")).toContain("Accept-Language");
		expect(html).toMatch(/<html lang="es-AR" class="system encore/);
		expect(headingCount(html)).toBe(1);
		expect(html).toContain("Tu próxima noche empieza con una canción.");
		expect(html).toContain("PLACER CULPOSO");
		expect(html).toContain('src="/apps/app-store/badge-es-mx-black.svg"');
		expect(html).toContain('href="/apps/encore/support?lang=es-AR"');
	});

	test("answers a Japanese reader in Japanese", async () => {
		let response = await fetchPage("/apps/encore", { "accept-language": "ja-JP" });
		let html = await response.text();

		expect(response.headers.get("content-language")).toBe("ja");
		expect(html).toMatch(/<html lang="ja" class="system encore/);
		expect(headingCount(html)).toBe(1);
		expect(html).toContain("次の夜は、一曲から始まる。");
		expect(html).toContain("90年代のなつかしい曲を歌おう。");
		expect(html).toContain("screenshots/ja/challenge-{light,dark}.webp");
		expect(html).toContain('src="/apps/app-store/badge-ja-jp-black.svg"');
	});

	test("lets ?lang= override the browser", async () => {
		let html = await (await fetchPage("/apps/encore?lang=en", { "accept-language": "ja" })).text();

		expect(html).toMatch(/<html lang="en"/);
	});
});

describe("GET /apps/encore/privacy", () => {
	test("renders the policy in Encore's document with one h1", async () => {
		let response = await fetchPage("/apps/encore/privacy");
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toMatch(/class="system encore/);
		expect(headingCount(html)).toBe(1);
		expect(html).toContain('href="/apps/encore/privacy.md"');
	});

	test("answers a Japanese reader with the Japanese policy and its Markdown link", async () => {
		let response = await fetchPage("/apps/encore/privacy", { "accept-language": "ja" });
		let html = await response.text();

		expect(response.headers.get("content-language")).toBe("ja");
		expect(headingCount(html)).toBe(1);
		expect(html).toMatch(/<title[^>]*>Encore プライバシーポリシー<\/title>/);
		expect(html).toContain('href="/apps/encore/privacy.md?lang=ja"');
		expect(html).toContain('href="https://sergiodxa.com/apps/encore/support?lang=ja"');
	});

	test("serves the Spanish Markdown at the .md route with ?lang=", async () => {
		let response = await fetchPage("/apps/encore/privacy.md?lang=es-AR");
		let body = await response.text();

		expect(response.headers.get("content-type")).toContain("text/markdown");
		expect(response.headers.get("content-language")).toBe("es-AR");
		expect(body).toContain("Última actualización: 28 de septiembre de 2026");
		expect(body).not.toContain("title:");
	});
});
