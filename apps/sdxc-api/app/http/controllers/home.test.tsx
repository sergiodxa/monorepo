/**
 * Landing page: HTML for browsers, Markdown when preferred, and the head metadata,
 * JSON-LD and microformats a crawler reads back from the HTML.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MF2 } from "@sdxc/microformats";

import { findItem, parse, values } from "@sdxc/microformats";
import { postType, readCard, readEntry, representativeCard } from "@sdxc/microformats/vocabulary";
import { unwrap } from "@sdxc/result";
import { beforeAll, describe, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import { STYLESHEET_HREF } from "~/app/test/assets-manifest";
import { OPERATIONS } from "~/config/catalog";
import {
	AUTHOR_NAME,
	AUTHOR_PHOTO,
	AUTHOR_PROFILES,
	AUTHOR_URL,
	AUTHOR_X_HANDLE,
	SITE_BRAND,
	SITE_DESCRIPTION,
	SITE_ORIGIN,
	SITE_TAGLINE,
	SITE_TITLE,
} from "~/config/site";

/** Fetches the HTML landing and returns the response with its body. */
async function landing(router: ReturnType<typeof createWebRouter>, url = "https://api.sdxc.dev/") {
	let response = await router.fetch(new Request(url, { headers: { accept: "text/html" } }));
	return { response, html: await response.text() };
}

/** The JSON-LD array in the landing's head, parsed back from the script body. */
function jsonLd(html: string): unknown[] {
	let match = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/u.exec(html);
	expect(match?.[1]).toBeTruthy();
	let parsed: unknown = JSON.parse(match?.[1] ?? "[]");
	expect(Array.isArray(parsed)).toBe(true);
	if (!Array.isArray(parsed)) return [];
	return parsed;
}

/** Every item of `type`, including items nested in properties and children. */
function itemsOfType(items: MF2.Item[], type: string): MF2.Item[] {
	let found: MF2.Item[] = [];
	for (let item of items) {
		if (item.type.includes(type)) found.push(item);
		for (let list of Object.values(item.properties)) {
			for (let value of list) {
				if (typeof value === "object" && "type" in value) found.push(...itemsOfType([value], type));
			}
		}
		if (item.children) found.push(...itemsOfType(item.children, type));
	}
	return found;
}

describe("GET /", () => {
	let router: ReturnType<typeof createWebRouter>;

	beforeAll(() => {
		router = createWebRouter();
	});

	test("renders an HTML landing with brand, MCP and charging sections", async () => {
		let response = await router.fetch(
			new Request("https://api.sdxc.dev/", {
				headers: { accept: "text/html" },
			}),
		);
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toMatch(/text\/html/);
		let html = await response.text();
		expect(html).toContain(SITE_BRAND);
		expect(html).toContain("How charging works");
		expect(html).toContain("Connect over MCP");
		expect(html).toContain(`${SITE_ORIGIN}/mcp`);
		expect(html).toContain("semver.satisfies");
		expect(html).toContain("PAYMENT-REQUIRED");
		expect(html).toContain(STYLESHEET_HREF);
	});

	test("answers Markdown when Accept prefers it", async () => {
		let response = await router.fetch(
			new Request("https://api.sdxc.dev/", {
				headers: { accept: "text/markdown" },
			}),
		);
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toMatch(/text\/markdown/);
		let body = await response.text();
		expect(body).toContain(`# ${SITE_BRAND}`);
		expect(body).toContain(`${SITE_ORIGIN}/mcp`);
		expect(body).toContain("x402");
		expect(body).toContain("semver.satisfies");
		expect(body).not.toContain("application/ld+json");
	});

	test("canonicalizes onto the production origin and spells out index, follow", async () => {
		let { response, html } = await landing(
			router,
			"https://preview.workers.dev/?utm_source=newsletter",
		);
		expect(response.status).toBe(200);
		expect(html).toContain(`rel="canonical" href="${SITE_ORIGIN}/"`);
		expect(html).toContain('name="robots" content="index, follow"');
		expect(html).toContain(`property="og:url" content="${SITE_ORIGIN}/"`);
		expect(html).toContain(`property="og:site_name" content="${SITE_BRAND}"`);
		expect(html).toContain('property="og:locale" content="en_US"');
		expect(html).toContain('name="twitter:card" content="summary"');
		expect(html).toContain(`name="twitter:site" content="${AUTHOR_X_HANDLE}"`);
		expect(html).toContain(`<title>${SITE_TITLE}</title>`);
		expect(html).toContain(`name="description" content="${SITE_DESCRIPTION}"`);

		let csp = response.headers.get("content-security-policy") ?? "";
		let nonce = /'nonce-([^']+)'/u.exec(csp)?.[1];
		expect(nonce).toBeTruthy();
		expect(html).toContain(`<script type="application/ld+json" nonce="${nonce}">`);
	});

	test("describes the publisher, the site, the page and the API in JSON-LD", async () => {
		let { html } = await landing(router);
		let nodes = jsonLd(html);
		expect(nodes).toEqual([
			expect.objectContaining({ "@type": "Organization" }),
			expect.objectContaining({ "@type": "WebSite" }),
			expect.objectContaining({ "@type": "WebPage" }),
			expect.objectContaining({ "@type": "SoftwareApplication" }),
		]);
		expect(nodes[0]).toMatchObject({
			"@type": "Organization",
			name: AUTHOR_NAME,
			sameAs: [...AUTHOR_PROFILES],
		});
		expect(nodes[3]).toMatchObject({
			"@type": "SoftwareApplication",
			name: SITE_BRAND,
			applicationCategory: "DeveloperApplication",
			featureList: OPERATIONS.map((operation) => operation.description),
		});
		expect(nodes[3]).not.toHaveProperty("offers");
	});

	test("is an h-entry whose author is the representative h-card", async () => {
		let { response, html } = await landing(router);
		let document = unwrap(parse(html, response.url));
		let entryItem = findItem(document, "h-entry");
		expect(entryItem).not.toBeNull();
		if (!entryItem) return;

		let entry = unwrap(readEntry(entryItem));
		expect(entry.name).toBe(SITE_TAGLINE);
		expect(entry.url).toBe(SITE_ORIGIN);
		expect(entry.uid).toBe(SITE_ORIGIN);
		expect(entry.summary).toContain("x402");
		expect(entry.content?.value).toContain("How charging works");
		expect(entry.author?.name).toBe(AUTHOR_NAME);
		expect(postType(entryItem)).toBe("article");

		let card = representativeCard(document, response.url);
		expect(card?.name).toBe(AUTHOR_NAME);
		expect(card?.photo?.value).toBe(AUTHOR_PHOTO);
		expect(card?.note).toContain("Docs and packages stay free");
		expect(card?.urls).toEqual(expect.arrayContaining([AUTHOR_URL, SITE_ORIGIN]));
		let cardItem = findItem(document, "h-card");
		expect(cardItem).not.toBeNull();
		if (!cardItem) return;
		expect(unwrap(readCard(cardItem)).name).toBe(AUTHOR_NAME);

		expect(document.rels.me).toEqual([...AUTHOR_PROFILES]);
		expect(document.rels.author).toEqual([AUTHOR_URL]);

		let cites = itemsOfType(document.items, "h-cite");
		expect(cites).toHaveLength(OPERATIONS.length);
		let firstCite = cites[0];
		expect(firstCite).toBeDefined();
		if (!firstCite) return;
		expect(values(firstCite, "name")).toEqual(["qr.encode"]);
		expect(values(firstCite, "url")).toEqual(["https://www.npmjs.com/package/@sdxc/qr"]);
		expect(values(firstCite, "x-price")).toEqual(["$0.001"]);
	});
});
