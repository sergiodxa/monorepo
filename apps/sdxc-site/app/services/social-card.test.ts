/**
 * Checks how a page's card text is derived from its title, description and path, that the
 * advertised URL and the storage key follow the content, and that the image route reads
 * back from a rendered page the same facts the layout started from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { RGB } from "~/scripts/showcase-cards";

import { listCaseStudySlugs } from "~/app/services/case-studies";
import {
	pagePathFromCardPath,
	readPageFacts,
	SOCIAL_CARD_TEMPLATE,
	socialCardAlt,
	socialCardContent,
	socialCardHash,
	socialCardKey,
	socialCardUrl,
} from "~/app/services/social-card";
import { SECONDARY_TEXT_ALPHA } from "~/app/services/social-card-image";
import { SITE_DESCRIPTION } from "~/config/constants";
import { AA_CONTRAST, contrastRatio, parse } from "~/scripts/showcase-cards";

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
		if (content.kind !== "page") throw new Error("a package page gets a page card");
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

describe("socialCardAlt", () => {
	test("says everything a case study's card shows, its screenshot included", () => {
		let alt = socialCardAlt({ title: "Wayfern", description: "", path: "/showcase/wayfern" });

		expect(alt).toMatch(/^Wayfern \(App demo\): Stays, flights and cars from one search\. /);
		expect(alt).toContain("Beside it, a screenshot: ");
		expect(alt).toMatch(/From sdxc\.dev\/showcase\.$/);
		expect(socialCardAlt({ title: "uptime", description: "", path: "/showcase/uptime" })).toMatch(
			/^uptime \(App, in production\): /,
		);
	});

	test("reads a page's card as its eyebrow, title and description", () => {
		expect(
			socialCardAlt({
				title: "@sdxc/jwt — sdxc",
				description: "Sign tokens.",
				path: "/api/jwt",
			}),
		).toBe("Package: @sdxc/jwt. Sign tokens.");
	});
});

describe("every case study's card", () => {
	/** A colour set at `alpha` over a background, as the canvas composites it. */
	let over = (text: RGB, background: RGB, alpha: number) =>
		text.map((channel, index) => channel * alpha + (background[index] ?? 0) * (1 - alpha)) as RGB;

	test.each(listCaseStudySlugs())("%s sets its text at WCAG AA contrast", (slug) => {
		let content = socialCardContent({ title: slug, description: "", path: `/showcase/${slug}` });
		if (content.kind !== "showcase") throw new Error(`${slug} has no card`);
		let background = parse(content.background);
		let foreground = parse(content.foreground);

		expect(contrastRatio(foreground, background), "name").toBeGreaterThanOrEqual(AA_CONTRAST);
		expect(
			contrastRatio(over(foreground, background, SECONDARY_TEXT_ALPHA), background),
			"tagline and address",
		).toBeGreaterThanOrEqual(AA_CONTRAST);
		expect(
			contrastRatio(parse(content.onAccent), parse(content.accent)),
			"the status chip's label",
		).toBeGreaterThanOrEqual(AA_CONTRAST);
	});
});

describe("a case study's card", () => {
	test("wears its item's colours, chips and tagline, with the showcase's address", () => {
		let content = socialCardContent({
			title: "Wayfern — Showcase — sdxc",
			description: "A long description that the card never sets.",
			path: "/showcase/wayfern",
		});

		expect(content).toMatchObject({
			kind: "showcase",
			title: "Wayfern",
			tagline: "Stays, flights and cars from one search",
			chips: ["Demo", "App"],
			source: "/showcase/wayfern/card.png",
			url: "sdxc.dev/showcase",
		});
		expect(content).not.toHaveProperty("description");
	});

	test("names an application in production as one, and a page under a case study keeps the site's card", () => {
		let uptime = socialCardContent({ title: "uptime", description: "", path: "/showcase/uptime" });

		expect(uptime).toMatchObject({ kind: "showcase", chips: ["In production", "App"] });
		expect(pageCard({ title: "Showcase — sdxc", description: "", path: "/showcase" }).kind).toBe(
			"page",
		);
		expect(
			pageCard({ title: "Nothing — sdxc", description: "", path: "/showcase/no-such-thing" }).kind,
		).toBe("page");
	});
});
