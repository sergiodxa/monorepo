/**
 * Checks how a card is read from a rendered page's microformats — a post's `h-entry` and a
 * listing's `h-feed` with its newest entries — and how cards are addressed and versioned.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	LISTING_ENTRIES,
	pagePathFromCardPath,
	readSocialCard,
	SOCIAL_CARD_TEMPLATE,
	socialCardKey,
	socialCardUrl,
	socialCardVersion,
} from "~/app/services/social-card";

/** A post page as the post view marks it up, reduced to what the card reads. */
const POST_PAGE = `<!doctype html><html><head>
<meta name="description" content="What I learned &amp; why.">
<meta property="og:title" content="The Remix Way">
</head><body><article class="h-entry">
<h1 class="p-name">The Remix Way</h1>
<a class="u-url" href="/articles/the-remix-way"><time class="dt-published" datetime="2026-10-02T15:00:00.000Z">Oct 2</time></a>
<div class="e-content"><p>Body.</p></div>
</article></body></html>`;

/** A listing page: an `h-feed` named by its heading over more entries than a card shows. */
const LISTING_PAGE = `<!doctype html><html><head>
<meta name="description" content="These are my articles.">
</head><body><main class="h-feed"><h1 class="p-name">Articles</h1><ol>
${["First", "Second", "Third", "Fourth"]
	.map(
		(title, index) =>
			`<li class="h-entry"><a class="u-url p-name" href="/articles/${index}">${title}</a><time class="dt-published" datetime="2026-07-2${index}T00:00:00.000Z">x</time></li>`,
	)
	.join("")}
</ol></main></body></html>`;

describe("readSocialCard", () => {
	test("a post page reads as a post card with its kind, summary and byline", () => {
		expect(readSocialCard(POST_PAGE, "/articles/the-remix-way")).toEqual({
			kind: "post",
			eyebrow: "Article",
			title: "The Remix Way",
			description: "What I learned & why.",
			byline: "By Sergio Xalambrí · October 2, 2026",
			url: "sergiodxa.com/articles/the-remix-way",
		});
	});

	test("a listing reads as its heading over its newest entries", () => {
		let card = readSocialCard(LISTING_PAGE, "/articles");
		expect(card).toEqual({
			kind: "listing",
			title: "Articles",
			description: "These are my articles.",
			url: "sergiodxa.com/articles",
			entries: [
				{ title: "First", date: "Jul 20, 26" },
				{ title: "Second", date: "Jul 21, 26" },
				{ title: "Third", date: "Jul 22, 26" },
			],
		});
		expect(card?.kind === "listing" && card.entries).toHaveLength(LISTING_ENTRIES);
	});

	test("an undated post keeps the author alone in its byline", () => {
		let undated = POST_PAGE.replace(/<time[^>]*>[^<]*<\/time>/, "");
		let card = readSocialCard(undated, "/notes/abc");
		expect(card?.kind === "post" && card.byline).toBe("By Sergio Xalambrí");
		expect(card?.kind === "post" && card.eyebrow).toBe("Note");
	});

	test("a page publishing no entry or feed has no card", () => {
		expect(readSocialCard("<p>Hello</p>", "/colors")).toBeNull();
	});
});

describe("card addresses", () => {
	test("a card URL names the page path and the version", () => {
		expect(socialCardUrl({ path: "/articles/x", version: "abc" })).toBe(
			"https://sergiodxa.com/social/articles/x.png?v=abc",
		);
		expect(socialCardUrl({ path: "/", version: "abc" })).toBe(
			"https://sergiodxa.com/social/index.png?v=abc",
		);
	});

	test("a card path maps back to its page path", () => {
		expect(pagePathFromCardPath("index")).toBe("/");
		expect(pagePathFromCardPath("articles/x")).toBe("/articles/x");
	});

	test("the version follows its parts", () => {
		expect(socialCardVersion("a", "b")).toBe(socialCardVersion("a", "b"));
		expect(socialCardVersion("a", "b")).not.toBe(socialCardVersion("a", "c"));
		expect(socialCardVersion("ab", "")).not.toBe(socialCardVersion("a", "b"));
	});

	test("the storage key is scoped to the template and follows the content", () => {
		let card = readSocialCard(POST_PAGE, "/articles/the-remix-way");
		if (!card) throw new Error("expected a card");
		expect(socialCardKey(card)).toMatch(new RegExp(`^${SOCIAL_CARD_TEMPLATE}/[0-9a-z]+\\.png$`));
		expect(socialCardKey(card)).not.toBe(socialCardKey({ ...card, title: "Changed" }));
	});
});
