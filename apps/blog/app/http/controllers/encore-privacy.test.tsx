/**
 * Tests Encore's privacy policy in both formats, rendered through the real renderer and
 * routes: the App Store listings and the support form link here, so the page has to serve
 * the policy's own text at the published URLs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { blankSearchFrame } from "~/app/test/frames";
import routes from "~/routes/web";

import { htmlRenderer } from "../../../bootstrap/app";

import privacyPage, { markdownPage } from "./encore-privacy";

/** Fetches a page through a router carrying only what the controllers need. */
async function fetchPage(path: string, headers: Record<string, string> = {}): Promise<Response> {
	let router = createRouter({ middleware: htmlRenderer() });
	router.map(routes.searchFrame, blankSearchFrame);
	router.map(routes.encorePrivacy, privacyPage);
	router.map(routes.encorePrivacyMarkdown, markdownPage);

	return await router.fetch(new Request(new URL(path, "https://sergiodxa.com"), { headers }));
}

describe("GET /apps/encore/privacy", () => {
	test("renders the policy with its title, description and sections", async () => {
		let response = await fetchPage("/apps/encore/privacy");
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toMatch(/<title[^>]*>Encore Privacy Policy<\/title>/);
		expect(html).toContain('name="description"');
		expect(html).toContain("Your singing stays private");
		expect(html).toContain('href="https://sergiodxa.com/apps/encore/support"');
		expect(html).toContain('href="/apps/encore/privacy.md"');
	});

	test("answers Markdown when the request prefers it", async () => {
		let response = await fetchPage("/apps/encore/privacy", { accept: "text/markdown" });

		expect(response.headers.get("content-type")).toContain("text/markdown");
		expect(await response.text()).toContain("## Your singing stays private");
	});
});

describe("GET /apps/encore/privacy.md", () => {
	test("serves the policy as Markdown without its frontmatter", async () => {
		let response = await fetchPage("/apps/encore/privacy.md");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/markdown");
		expect(body).toContain("Last updated: September 28, 2026");
		expect(body).not.toContain("title: Encore Privacy Policy");
	});
});
