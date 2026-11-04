/**
 * Reads the public pages back through `@sdxc/seo`'s JSON-LD and `@sdxc/microformats`'
 * parser, so the structured data and the h-entry markup are what a consumer sees.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SchemaOrg } from "@sdxc/seo";

import { findItem, parse } from "@sdxc/microformats";
import { readEntry, readFeed, representativeCard } from "@sdxc/microformats/vocabulary";
import { unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { fetchApp, ORIGIN } from "~/app/test/router";
import { AUTHOR_NAME, AUTHOR_URL, SITE_URL } from "~/config/constants";

/** What the home page's release pin reads, as GitHub sends it. */
const RELEASES = "https://api.github.com/repos/sergiodxa/monorepo/releases";

const server = setupServer(
	http.get(RELEASES, () =>
		HttpResponse.json([
			{
				tag_name: "v2026.10.30",
				body: "Notes for the release.",
				published_at: "2026-10-30T02:46:27Z",
				html_url: "https://github.com/sergiodxa/monorepo/releases/tag/v2026.10.30",
				draft: false,
				prerelease: false,
			},
		]),
	),
);

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** The page at `path`, as HTML. */
async function page(path: string): Promise<string> {
	let response = await fetchApp(path);
	expect(response.status).toBe(200);
	return await response.text();
}

/** The structured-data nodes one page emits. */
function nodes(html: string): SchemaOrg.Node[] {
	let body = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
	expect(body).toBeTruthy();
	let parsed: unknown = JSON.parse(body ?? "");
	return Array.isArray(parsed) ? (parsed as SchemaOrg.Node[]) : [parsed as SchemaOrg.Node];
}

/** The page parsed as microformats2, with the request URL as the base. */
function parsed(html: string, path: string) {
	return unwrap(parse(html, new URL(path, ORIGIN).href));
}

describe("public page markup", () => {
	test("names the project and the site search on the home page", async () => {
		let html = await page("/");
		let data = nodes(html);
		let organization = data.find((node) => node["@type"] === "Organization");
		let website = data.find((node) => node["@type"] === "WebSite");

		expect(organization).toMatchObject({ name: "sdxc", url: SITE_URL });
		expect(website).toMatchObject({
			potentialAction: {
				"@type": "SearchAction",
				target: {
					urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
				},
			},
		});

		let document = parsed(html, "/");
		expect(document.rels.me).toEqual(
			expect.arrayContaining([
				AUTHOR_URL,
				"https://x.com/sergiodxa",
				"https://github.com/sergiodxa",
			]),
		);
		expect(representativeCard(document, new URL("/", ORIGIN).href)).toMatchObject({
			name: AUTHOR_NAME,
			url: AUTHOR_URL,
		});
	});

	test("marks a guide as an article with the trail the page shows", async () => {
		let path = "/docs/getting-started/what-these-are";
		let html = await page(path);
		let data = nodes(html);
		let article = data.find((node) => node["@type"] === "Article");
		let trail = data.find((node) => node["@type"] === "BreadcrumbList");

		expect(article).toMatchObject({
			headline: "What these are",
			datePublished: "2026-10-25",
			dateModified: "2026-10-25",
			author: { name: AUTHOR_NAME, url: `${AUTHOR_URL}/` },
		});
		expect(trail).toMatchObject({
			itemListElement: [
				{ position: 1, name: "Documentation", item: `${SITE_URL}/docs` },
				{ position: 2, name: "What these are", item: `${SITE_URL}${path}` },
			],
		});

		let entry = unwrap(readEntry(findItem(parsed(html, path), "h-entry")!));
		expect(entry).toMatchObject({
			name: "What these are",
			url: `${ORIGIN}${path}`,
			summary:
				"A collection of small TypeScript packages that agree with each other, built on what the web platform already provides.",
			author: { name: AUTHOR_NAME, url: AUTHOR_URL },
		});
		expect(entry.updated?.value.startsWith("2026-10-25")).toBe(true);
	});

	test("marks a package as a free application and an entry", async () => {
		let html = await page("/api/result");
		let application = nodes(html).find((node) => node["@type"] === "SoftwareApplication");

		expect(application).toMatchObject({
			name: "@sdxc/result",
			applicationCategory: "DeveloperApplication",
			offers: {
				price: "0",
				priceCurrency: "USD",
				url: `${SITE_URL}/api/result`,
			},
		});

		let entry = unwrap(readEntry(findItem(parsed(html, "/api/result"), "h-entry")!));
		expect(entry.name).toBe("@sdxc/result");
		expect(entry.url).toBe(`${ORIGIN}/api/result`);
	});

	test("lists the packages as a feed of entries", async () => {
		let html = await page("/api");
		let feed = unwrap(readFeed(findItem(parsed(html, "/api"), "h-feed")!));
		let result = feed.entries.find((entry) => entry.name === "@sdxc/result");

		expect(feed.name).toBe("Every package");
		expect(result?.url).toBe(`${ORIGIN}/api/result`);
	});

	test("indexes the blank search page and leaves a query out", async () => {
		let blank = await page("/search");
		expect(nodes(blank).find((node) => node["@type"] === "WebPage")).toMatchObject({
			name: "Search",
			url: `${SITE_URL}/search`,
		});

		let response = await fetchApp("/search?q=result");
		let html = await response.text();

		expect(response.headers.get("X-Robots-Tag")).toBe("noindex, follow");
		expect(html).toContain('name="robots" content="noindex, follow"');
		expect(html).not.toContain("application/ld+json");
	});
});
