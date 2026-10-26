/**
 * Tests the press kit in both formats, rendered through the real renderer and routes:
 * organizers receive these URLs, so each has to serve the kit's own text, and the Markdown
 * twin has to stay free of the file's frontmatter.
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

import pressPage, { markdownPage } from "./press";

/** Fetches a page through a router carrying only what the controllers need. */
async function fetchPage(path: string, headers: Record<string, string> = {}): Promise<Response> {
	let router = createRouter<AppContext>({ middleware: pageRenderer() });
	router.map(routes.searchFrame, blankSearchFrame);
	router.map(routes.press, pressPage);
	router.map(routes.pressMarkdown, markdownPage);

	return await router.fetch(new Request(new URL(path, "https://sergiodxa.com"), { headers }));
}

describe("GET /press", () => {
	test("renders the kit with its title, sections and Markdown link", async () => {
		let response = await fetchPage("/press");
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toMatch(/<title[^>]*>Press Kit<\/title>/);
		expect(html).toContain('name="description"');
		expect(html).toContain("Quick facts");
		expect(html).toContain("Bios");
		expect(html).toContain('href="/press.md"');
	});

	test("answers Markdown when the request prefers it", async () => {
		let response = await fetchPage("/press", { accept: "text/markdown" });

		expect(response.headers.get("content-type")).toContain("text/markdown");
		expect(await response.text()).toContain("## Bios");
	});
});

describe("GET /press.md", () => {
	test("serves the kit as Markdown without its frontmatter", async () => {
		let response = await fetchPage("/press.md");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/markdown");
		expect(body).toContain("## Quick facts");
		expect(body).not.toContain("title: Press Kit");
	});
});
