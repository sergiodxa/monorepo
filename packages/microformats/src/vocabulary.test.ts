/**
 * Exercises the typed views and the IndieWeb algorithms on markup shaped like the
 * examples on the IndieWeb wiki: replies citing their target, authorship through a feed
 * and `rel=author`, representative cards, Post Type Discovery and mention detection.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { number, object, string } from "remix/data-schema";
import { describe, expect, test } from "vitest";

import {
	authorOf,
	postType,
	readCard,
	readEntry,
	readFeed,
	readItem,
	representativeCard,
	responseTo,
} from "./vocabulary.js";

import type { MF2 } from "./index.js";

import { findItem, MicroformatsShapeError, parse } from "./index.js";

/** Parses markup served from `url`. */
function page(source: string, url = "https://ada.example/"): MF2.Document {
	return unwrap(parse(source, url));
}

/** The first item of a type, failing the test when there is none. */
function item(document: MF2.Document, type: string): MF2.Item {
	let found = findItem(document, type);
	if (!found) throw new Error(`Expected an ${type}.`);
	return found;
}

/** An entry built from properties alone, which is how Micropub hands one over. */
function entry(properties: MF2.Item["properties"]): MF2.Item {
	return { type: ["h-entry"], properties };
}

describe(readEntry, () => {
	test("reads a reply citing its target, its author and its dates", () => {
		let document = page(
			`<article class="h-entry">
				<a class="p-author h-card" href="https://ada.example/">Ada</a>
				<div class="u-in-reply-to h-cite">
					<a class="p-author h-card" href="https://sergiodxa.com">Sergio</a>:
					<a class="u-url p-name" href="https://sergiodxa.com/articles/some-slug">Some post</a>
				</div>
				<p class="e-content">Loved <b>this</b>.</p>
				<time class="dt-published" datetime="2026-09-23 10:15:00-0300">yesterday</time>
				<a class="u-syndication" href="https://social.example/@ada/1">elsewhere</a>
				<a class="p-category" href="/tags/remix">remix</a>
			</article>`,
			"https://ada.example/replies/1",
		);

		let reply = unwrap(readEntry(item(document, "h-entry")));

		expect(reply.author).toEqual({
			name: "Ada",
			url: "https://ada.example/",
			photo: null,
			urls: ["https://ada.example/"],
			uid: null,
			note: null,
		});
		expect(reply.inReplyTo).toEqual([
			{
				url: "https://sergiodxa.com/articles/some-slug",
				name: "Some post",
				author: expect.objectContaining({ name: "Sergio", url: "https://sergiodxa.com" }),
				content: null,
				published: null,
			},
		]);
		expect(reply.content).toEqual({ html: "Loved <b>this</b>.", value: "Loved this." });
		expect(reply.published).toEqual({
			value: "2026-09-23 10:15:00-0300",
			instant: new Date("2026-09-23T13:15:00Z"),
		});
		expect(reply.syndication).toEqual(["https://social.example/@ada/1"]);
		expect(reply.category).toEqual(["remix"]);
	});

	test("reads bare URLs and text as they appear in a Micropub body", () => {
		let reply = unwrap(
			readEntry(
				entry({
					"like-of": ["https://sergiodxa.com/articles/some-slug"],
					content: ["Nice <3"],
					author: ["https://ada.example/"],
					photo: ["https://ada.example/a.jpg", { value: "https://ada.example/b.jpg", alt: "B" }],
					rsvp: ["Maybe"],
				}),
			),
		);

		expect(reply.likeOf).toEqual([
			{
				url: "https://sergiodxa.com/articles/some-slug",
				name: null,
				author: null,
				content: null,
				published: null,
			},
		]);
		expect(reply.content).toEqual({ html: "Nice &lt;3", value: "Nice <3" });
		expect(reply.author?.url).toBe("https://ada.example/");
		expect(reply.photo).toEqual([
			{ value: "https://ada.example/a.jpg", alt: "" },
			{ value: "https://ada.example/b.jpg", alt: "B" },
		]);
		expect(reply.rsvp).toBe("maybe");
	});

	test("names no instant for a date alone or a time without a timezone", () => {
		let post = unwrap(
			readEntry(entry({ published: ["2026-09-23"], updated: ["2026-09-23 10:15"] })),
		);

		expect(post.published).toEqual({ value: "2026-09-23", instant: null });
		expect(post.updated).toEqual({ value: "2026-09-23 10:15", instant: null });
	});

	test("fails on an item that is not an h-entry", () => {
		let result = readEntry({ type: ["h-card"], properties: {} });

		expect(isFailure(result) && result.error).toBeInstanceOf(MicroformatsShapeError);
	});
});

describe(readCard, () => {
	test("reads every url, the first as url, and the photo with its alt", () => {
		let document = page(
			`<div class="h-card">
				<img class="u-photo" src="/me.jpg" alt="Ada">
				<a class="p-name u-url u-uid" href="/">Ada</a>
				<a class="u-url" href="https://github.com/ada">GitHub</a>
				<p class="p-note">Writes code.</p>
			</div>`,
		);

		expect(unwrap(readCard(item(document, "h-card")))).toEqual({
			name: "Ada",
			url: "https://ada.example/",
			photo: { value: "https://ada.example/me.jpg", alt: "Ada" },
			urls: ["https://ada.example/", "https://github.com/ada"],
			uid: "https://ada.example/",
			note: "Writes code.",
		});
	});
});

describe(readFeed, () => {
	test("reads its h-entry children as entries", () => {
		let document = page(
			`<div class="h-feed">
				<h1 class="p-name">Notes</h1>
				<a class="p-author h-card" href="/">Ada</a>
				<article class="h-entry"><p class="p-name">One</p></article>
				<article class="h-entry"><p class="p-name">Two</p></article>
			</div>`,
		);

		let feed = unwrap(readFeed(item(document, "h-feed")));

		expect(feed.name).toBe("Notes");
		expect(feed.author?.name).toBe("Ada");
		expect(feed.entries.map((post) => post.name)).toEqual(["One", "Two"]);
	});
});

describe(readItem, () => {
	test("hands the schema single-valued properties unwrapped", () => {
		let recipe = {
			type: ["h-recipe"],
			properties: { name: ["Bread"], yield: ["2"], ingredient: ["Flour", "Water"] },
		};
		let schema = object({ name: string(), yield: string().transform(Number) });

		expect(unwrap(readItem(recipe, schema))).toEqual({ name: "Bread", yield: 2 });
	});

	test("fails with the schema's issues", () => {
		let result = readItem(
			{ type: ["h-x-thing"], properties: { count: ["many"] } },
			object({ count: number() }),
		);

		if (!isFailure(result)) throw new Error("Expected a failure.");
		expect(result.error.issues.length).toBeGreaterThan(0);
	});
});

describe(authorOf, () => {
	test("uses the entry's own author card", () => {
		let document = page(`<div class="h-entry"><a class="p-author h-card" href="/">Ada</a></div>`);

		expect(authorOf(item(document, "h-entry"), document, "https://ada.example/")).toEqual(
			expect.objectContaining({ name: "Ada", url: "https://ada.example/" }),
		);
	});

	test("ends at a URL when the author is one, leaving the fetch to the caller", () => {
		let document = page(`<div class="h-entry"><a class="u-author" href="/about">me</a></div>`);

		expect(authorOf(item(document, "h-entry"), document, "https://ada.example/")).toEqual({
			url: "https://ada.example/about",
		});
	});

	test("reads a plain author as a name", () => {
		let document = page(`<div class="h-entry"><span class="p-author">Ada</span></div>`);

		expect(authorOf(item(document, "h-entry"), document, "https://ada.example/")).toEqual(
			expect.objectContaining({ name: "Ada", url: null }),
		);
	});

	test("falls back to the author of the feed holding the entry", () => {
		let document = page(
			`<div class="h-feed">
				<a class="p-author h-card" href="/">Ada</a>
				<div class="h-entry"><p class="p-name">Hello</p></div>
			</div>`,
		);

		expect(authorOf(item(document, "h-entry"), document, "https://ada.example/")).toEqual(
			expect.objectContaining({ name: "Ada" }),
		);
	});

	test("falls back to rel=author on the entry's permalink page", () => {
		let source = `<link rel="author" href="/about"><div class="h-entry"><p class="p-name">Hello</p></div>`;
		let document = page(source, "https://ada.example/notes/1");

		expect(authorOf(item(document, "h-entry"), document, "https://ada.example/notes/1")).toEqual({
			url: "https://ada.example/about",
		});
	});

	test("finds no author when the page names none", () => {
		let document = page(`<div class="h-entry"><p class="p-name">Hello</p></div>`);

		expect(authorOf(item(document, "h-entry"), document, "https://ada.example/")).toBeNull();
	});
});

describe(representativeCard, () => {
	test("prefers the card whose uid and url are the page", () => {
		let document = page(
			`<div class="h-card"><a class="p-name u-url" href="https://friend.example">Friend</a></div>
			<div class="h-card"><a class="p-name u-url u-uid" href="/">Ada</a></div>`,
		);

		expect(representativeCard(document, "https://ada.example")?.name).toBe("Ada");
	});

	test("then the card with a url the page links with rel=me", () => {
		let document = page(
			`<a rel="me" href="https://github.com/ada">GitHub</a>
			<div class="h-card"><a class="p-name u-url" href="https://friend.example">Friend</a></div>
			<div class="h-card"><span class="p-name">Ada</span><a class="u-url" href="https://github.com/ada">gh</a></div>`,
		);

		expect(representativeCard(document, "https://ada.example/")?.name).toBe("Ada");
	});

	test("then the only card, when its url is the page", () => {
		let only = page(`<a class="h-card" href="/">Ada</a>`);
		let elsewhere = page(`<a class="h-card" href="https://friend.example">Friend</a>`);

		expect(representativeCard(only, "https://ada.example/")?.name).toBe("Ada");
		expect(representativeCard(elsewhere, "https://ada.example/")).toBeNull();
	});
});

describe(postType, () => {
	test.each([
		["rsvp", { rsvp: ["yes"], "in-reply-to": ["https://event.example"] }],
		["repost", { "repost-of": ["https://a.example/1"], "like-of": ["https://a.example/1"] }],
		["like", { "like-of": ["https://a.example/1"] }],
		["reply", { "in-reply-to": ["https://a.example/1"], content: ["Yes!"] }],
		["bookmark", { "bookmark-of": ["https://a.example/1"], name: ["A page"] }],
		["video", { video: ["https://a.example/v.mp4"], photo: ["https://a.example/p.jpg"] }],
		["photo", { photo: ["https://a.example/p.jpg"], content: ["Sunset"] }],
		["article", { name: ["On parsing"], content: ["Microformats are class names."] }],
		["note", { content: ["Just a thought."] }],
		["note", { name: ["Just a  thought."], content: ["Just a thought. With more after it."] }],
	] as const)("reads %s", (type, properties) => {
		let copied = Object.fromEntries(
			Object.entries(properties).map(([key, list]) => [key, [...list]]),
		);

		expect(postType(entry(copied))).toBe(type);
	});

	test("reads an implied name, which repeats the content, as a note", () => {
		let document = page(`<div class="h-entry"><p class="e-content">Hello world</p></div>`);

		expect(postType(item(document, "h-entry"))).toBe("note");
	});

	test("ignores an rsvp outside the vocabulary", () => {
		expect(postType(entry({ rsvp: ["perhaps"] }))).toBe("note");
	});
});

describe(responseTo, () => {
	let target = "https://sergiodxa.com/articles/some-slug";

	test("finds the reply and how it responds", () => {
		let document = page(
			`<div class="h-entry"><p class="p-name">Unrelated</p></div>
			<div class="h-entry"><a class="u-in-reply-to" href="${target}">re</a><p class="e-content">Yes</p></div>`,
		);

		let response = responseTo(document, target);

		expect(response?.type).toBe("reply");
		expect(response?.entry.properties.content).toEqual([{ html: "Yes", value: "Yes" }]);
	});

	test("matches a cited target through its url, whatever its spelling", () => {
		let document = page(
			`<div class="h-entry"><div class="u-like-of h-cite"><a class="u-url" href="HTTPS://SERGIODXA.COM/articles/some-slug">it</a></div></div>`,
		);

		expect(responseTo(document, target)?.type).toBe("like");
	});

	test("reads a link inside the content as a mention", () => {
		let document = page(
			`<div class="h-entry"><div class="e-content">As <a href="${target}">Sergio wrote</a>.</div></div>`,
		);

		expect(responseTo(document, target)?.type).toBe("mention");
	});

	test("finds nothing when no entry links to the target", () => {
		let document = page(`<div class="h-entry"><p class="e-content">Hello</p></div>`);

		expect(responseTo(document, target)).toBeNull();
	});
});
