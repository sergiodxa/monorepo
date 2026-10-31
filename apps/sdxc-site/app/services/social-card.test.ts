/**
 * Checks how a page's card text is derived from its title, description and path, that the
 * advertised URL and the storage key follow the content, and that the image route reads
 * back from a rendered page the same facts the layout started from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	pagePathFromCardPath,
	readPageFacts,
	SOCIAL_CARD_TEMPLATE,
	socialCardContent,
	socialCardHash,
	socialCardKey,
	socialCardUrl,
} from "~/app/services/social-card";
import { SITE_DESCRIPTION } from "~/config/constants";

/** The card for a page other than the home page, which every such page draws. */
function pageCard(page: Parameters<typeof socialCardContent>[0]) {
	let content = socialCardContent(page);
	if (content.kind !== "page") throw new Error(`expected a page card for ${page.path}`);
	return content;
}

describe("socialCardContent", () => {
	test("a package page names itself and gets its install command", () => {
		expect(
			socialCardContent({
				title: "@sdxc/jwt — sdxc",
				description: "JSON Web Tokens.",
				path: "/api/jwt",
			}),
		).toEqual({
			kind: "page",
			eyebrow: "Package",
			title: "@sdxc/jwt",
			description: "JSON Web Tokens.",
			url: "sdxc.dev/api/jwt",
			footer: "npm add @sdxc/jwt",
		});
	});

	test("a title suffix other than the site's name is the eyebrow", () => {
		let content = pageCard({
			title: "Dialog — @sdxc/ui",
			description: "A modal.",
			path: "/api/ui/dialog",
		});
		expect(content.eyebrow).toBe("@sdxc/ui");
		expect(content.title).toBe("Dialog");
		expect(content.footer).toBe("sdxc.dev");
	});

	test("guides and the reference index take their eyebrow from the path", () => {
		expect(
			pageCard({
				title: "Naming — sdxc",
				description: "",
				path: "/docs/conventions/naming",
			}).eyebrow,
		).toBe("Guide");
		expect(pageCard({ title: "API — sdxc", description: "", path: "/api" }).eyebrow).toBe(
			"API reference",
		);
		expect(
			pageCard({ title: "Philosophy — sdxc", description: "", path: "/philosophy" }).eyebrow,
		).toBe("sdxc");
	});

	test("the home page gets its own card with the pitch and the collection's counts", () => {
		let content = socialCardContent({ title: "sdxc", description: SITE_DESCRIPTION, path: "/" });
		expect(content.kind).toBe("home");
		if (content.kind !== "home") return;
		expect(content.tagline).toBe("Take one, or take the set.");
		expect(content.description).toMatch(/^\d+ packages built on web standards/);
		expect(content.stats.map((stat) => stat.label)).toContain("packages");
		for (let stat of content.stats) expect(stat.value).toMatch(/^\d+$/);
	});

	test("a title with a dash inside keeps it", () => {
		expect(
			pageCard({ title: "Before — after — sdxc", description: "", path: "/docs/x" }).title,
		).toBe("Before — after");
	});
});

describe("card addresses", () => {
	let page = { title: "@sdxc/jwt — sdxc", description: "JSON Web Tokens.", path: "/api/jwt" };

	test("the URL names the page path and the content's hash", () => {
		let hash = socialCardHash(socialCardContent(page));
		expect(socialCardUrl(page)).toBe(`https://sdxc.dev/api/jwt.png?v=${hash}`);
		expect(socialCardUrl({ ...page, path: "/" })).toMatch(/^https:\/\/sdxc\.dev\/index\.png\?v=/);
	});

	test("the hash changes with the content and is stable for the same content", () => {
		let content = socialCardContent(page);
		expect(socialCardHash(content)).toBe(socialCardHash({ ...content }));
		expect(socialCardHash(content)).not.toBe(
			socialCardHash({ ...content, description: "Changed." }),
		);
	});

	test("the storage key is scoped to the template", () => {
		expect(socialCardKey(socialCardHash(socialCardContent(page)))).toMatch(
			new RegExp(`^sdxc/${SOCIAL_CARD_TEMPLATE}/[0-9a-z]+\\.png$`),
		);
	});

	test("a card path maps back to its page path", () => {
		expect(pagePathFromCardPath("index")).toBe("/");
		expect(pagePathFromCardPath("api/jwt")).toBe("/api/jwt");
	});
});

describe("readPageFacts", () => {
	test("reads the Open Graph title and description, decoding references", () => {
		let html = `<head><meta property="og:type" content="article"><meta property="og:title" content="Tom &amp; Jerry &#8212; sdxc"><meta property="og:description" content="&quot;Quoted&quot; &lt;tag&gt;"></head>`;
		expect(readPageFacts(html, "/docs/x")).toEqual({
			title: "Tom & Jerry — sdxc",
			description: '"Quoted" <tag>',
			path: "/docs/x",
		});
	});

	test("falls back to the site description as the page's tags do", () => {
		expect(readPageFacts(`<meta property="og:title" content="sdxc">`, "/")?.description).toBe(
			SITE_DESCRIPTION,
		);
	});

	test("a document with no title is no page", () => {
		expect(readPageFacts("<p>hi</p>", "/")).toBeNull();
	});
});
