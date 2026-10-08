/**
 * Checks the visitor that turns a pasted URL on a line of its own into an embed tag:
 * which paragraphs qualify, what the produced tag carries, and the URL forms each
 * built-in provider recognises and refuses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Markdown as MarkdownTypes } from "../index.js";

import { Markdown } from "../index.js";

import type { EmbedProvider } from "./embeds.js";

import { embeds, gist, vimeo, x, youtube } from "./embeds.js";

/**
 * @param source - The markdown to read
 * @param providers - The providers the visitor tries, all built-ins when omitted
 * @returns The first block of the walked document
 */
function embed(
	source: string,
	providers: EmbedProvider[] = [youtube(), vimeo(), gist(), x()],
): MarkdownTypes.Block | undefined {
	let document = unwrap(Markdown.parse(source)).document;
	return unwrap(Markdown.walk(document, embeds(providers))).children[0];
}

/**
 * @param provider - The provider to ask
 * @param url - The URL to hand it
 * @returns What the provider matched, or `null`
 */
function match(provider: EmbedProvider, url: string) {
	return provider.match(new URL(url));
}

describe("embeds", () => {
	test("replaces a paragraph holding only a pasted URL with the provider's tag", () => {
		let source = "https://youtu.be/dQw4w9WgXcQ";
		let paragraph = unwrap(Markdown.parse(source)).document.children[0];

		expect(embed(source)).toEqual({
			type: "tag",
			name: "youtube",
			attributes: { id: "dQw4w9WgXcQ", url: "https://youtu.be/dQw4w9WgXcQ" },
			children: [],
			position: paragraph?.position,
		});
	});

	test("embeds the angle-bracket autolink form", () => {
		expect(embed("<https://youtu.be/dQw4w9WgXcQ>")).toMatchObject({
			type: "tag",
			name: "youtube",
		});
	});

	test("embeds a www autolink, whose href gained a scheme its text lacks", () => {
		expect(embed("www.youtube.com/watch?v=dQw4w9WgXcQ")).toMatchObject({
			type: "tag",
			attributes: { id: "dQw4w9WgXcQ", url: "http://www.youtube.com/watch?v=dQw4w9WgXcQ" },
		});
	});

	test("leaves a link with its own label alone", () => {
		expect(embed("[Watch this](https://youtu.be/dQw4w9WgXcQ)")).toMatchObject({
			type: "paragraph",
		});
	});

	test("leaves a URL sharing its paragraph with text alone", () => {
		expect(embed("Watch https://youtu.be/dQw4w9WgXcQ")).toMatchObject({ type: "paragraph" });
		expect(embed("https://youtu.be/dQw4w9WgXcQ.")).toMatchObject({ type: "paragraph" });
		expect(embed("https://youtu.be/dQw4w9WgXcQ\nhttps://vimeo.com/76979871")).toMatchObject({
			type: "paragraph",
		});
	});

	test("leaves a URL no provider recognises alone", () => {
		expect(embed("https://example.com/watch?v=dQw4w9WgXcQ")).toMatchObject({
			type: "paragraph",
		});
	});

	test("keeps the paragraph's annotation under the matched attributes", () => {
		let source = '{% .wide id="ignored" %}\nhttps://youtu.be/dQw4w9WgXcQ';

		expect(embed(source)).toMatchObject({
			type: "tag",
			attributes: { class: "wide", id: "dQw4w9WgXcQ", url: "https://youtu.be/dQw4w9WgXcQ" },
		});
	});

	test("hands back an untouched paragraph as the same object", () => {
		let document = unwrap(Markdown.parse("Just text\n\nhttps://youtu.be/dQw4w9WgXcQ")).document;
		let walked = unwrap(Markdown.walk(document, embeds([youtube()])));

		expect(walked.children[0]).toBe(document.children[0]);
		expect(walked.children[1]).toMatchObject({ type: "tag" });
	});

	test("embeds a URL inside a list item or a blockquote", () => {
		expect(embed("> https://vimeo.com/76979871")).toMatchObject({
			type: "blockquote",
			children: [{ type: "tag", name: "vimeo" }],
		});
	});

	test("lets the first provider that matches win", () => {
		let anything: EmbedProvider = { name: "card", match: () => ({}) };
		let url = "https://youtu.be/dQw4w9WgXcQ";

		expect(embed(url, [anything, youtube()])).toMatchObject({ name: "card" });
		expect(embed(url, [youtube(), anything])).toMatchObject({ name: "youtube" });
	});

	test("lets the URL attribute override a provider that returned one", () => {
		let provider: EmbedProvider = { name: "card", match: () => ({ url: "other" }) };

		expect(embed("https://example.com", [provider])).toMatchObject({
			attributes: { url: "https://example.com" },
		});
	});

	test("renames a built-in provider's tag", () => {
		expect(embed("https://youtu.be/dQw4w9WgXcQ", [youtube({ name: "video" })])).toMatchObject({
			type: "tag",
			name: "video",
		});
	});
});

describe("youtube", () => {
	test.each([
		["https://www.youtube.com/watch?v=dQw4w9WgXcQ", { id: "dQw4w9WgXcQ" }],
		["https://youtube.com/watch?v=dQw4w9WgXcQ&list=PL1", { id: "dQw4w9WgXcQ" }],
		["https://m.youtube.com/watch?v=dQw4w9WgXcQ", { id: "dQw4w9WgXcQ" }],
		["https://youtu.be/dQw4w9WgXcQ", { id: "dQw4w9WgXcQ" }],
		["https://www.youtube.com/shorts/dQw4w9WgXcQ", { id: "dQw4w9WgXcQ" }],
		["https://www.youtube.com/embed/dQw4w9WgXcQ", { id: "dQw4w9WgXcQ" }],
		["https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", { id: "dQw4w9WgXcQ" }],
		["https://www.youtube.com/live/dQw4w9WgXcQ", { id: "dQw4w9WgXcQ" }],
		["https://youtu.be/dQw4w9WgXcQ?t=42", { id: "dQw4w9WgXcQ", start: 42 }],
		["https://youtu.be/dQw4w9WgXcQ?t=42s", { id: "dQw4w9WgXcQ", start: 42 }],
		["https://youtu.be/dQw4w9WgXcQ?t=1h2m3s", { id: "dQw4w9WgXcQ", start: 3723 }],
		["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s", { id: "dQw4w9WgXcQ", start: 90 }],
		["https://www.youtube.com/embed/dQw4w9WgXcQ?start=15", { id: "dQw4w9WgXcQ", start: 15 }],
		["https://youtu.be/dQw4w9WgXcQ?t=soon", { id: "dQw4w9WgXcQ" }],
	])("matches %s", (url, expected) => {
		expect(match(youtube(), url)).toEqual(expected);
	});

	test.each([
		"https://www.youtube.com/",
		"https://www.youtube.com/watch",
		"https://www.youtube.com/watch?v=short",
		"https://www.youtube.com/@channel",
		"https://www.youtube.com/playlist?list=PL1",
		"https://youtu.be/",
		"https://notyoutube.com/watch?v=dQw4w9WgXcQ",
		"ftp://youtu.be/dQw4w9WgXcQ",
	])("refuses %s", (url) => {
		expect(match(youtube(), url)).toBeNull();
	});

	test("names its tag youtube by default", () => {
		expect(youtube().name).toBe("youtube");
	});
});

describe("vimeo", () => {
	test.each([
		["https://vimeo.com/76979871", { id: "76979871" }],
		["https://www.vimeo.com/76979871", { id: "76979871" }],
		["https://vimeo.com/76979871/8272103f6e", { id: "76979871", hash: "8272103f6e" }],
		["https://player.vimeo.com/video/76979871", { id: "76979871" }],
		[
			"https://player.vimeo.com/video/76979871?h=8272103f6e",
			{ id: "76979871", hash: "8272103f6e" },
		],
	])("matches %s", (url, expected) => {
		expect(match(vimeo(), url)).toEqual(expected);
	});

	test.each([
		"https://vimeo.com/",
		"https://vimeo.com/channels",
		"https://vimeo.com/user123",
		"https://player.vimeo.com/76979871",
		"https://example.com/76979871",
	])("refuses %s", (url) => {
		expect(match(vimeo(), url)).toBeNull();
	});

	test("names its tag vimeo by default", () => {
		expect(vimeo().name).toBe("vimeo");
	});
});

describe("gist", () => {
	test.each([
		["https://gist.github.com/sergiodxa/1a2b3c4d5e6f", { user: "sergiodxa", id: "1a2b3c4d5e6f" }],
		["https://gist.github.com/sergiodxa/1a2b3c4d5e6f/", { user: "sergiodxa", id: "1a2b3c4d5e6f" }],
	])("matches %s", (url, expected) => {
		expect(match(gist(), url)).toEqual(expected);
	});

	test.each([
		"https://gist.github.com/",
		"https://gist.github.com/sergiodxa",
		"https://gist.github.com/sergiodxa/not-a-gist",
		"https://github.com/sergiodxa/1a2b3c4d5e6f",
	])("refuses %s", (url) => {
		expect(match(gist(), url)).toBeNull();
	});

	test("names its tag gist by default", () => {
		expect(gist().name).toBe("gist");
	});
});

describe("x", () => {
	test.each([
		["https://x.com/sergiodxa/status/1234567890", { user: "sergiodxa", id: "1234567890" }],
		["https://www.x.com/sergiodxa/status/1234567890", { user: "sergiodxa", id: "1234567890" }],
		["https://twitter.com/sergiodxa/status/1234567890", { user: "sergiodxa", id: "1234567890" }],
		[
			"https://mobile.twitter.com/sergio_dxa/status/1234567890?s=20",
			{ user: "sergio_dxa", id: "1234567890" },
		],
	])("matches %s", (url, expected) => {
		expect(match(x(), url)).toEqual(expected);
	});

	test.each([
		"https://x.com/sergiodxa",
		"https://x.com/sergiodxa/status/",
		"https://x.com/sergiodxa/status/abc",
		"https://x.com/sergiodxa/likes",
		"https://example.com/sergiodxa/status/1234567890",
	])("refuses %s", (url) => {
		expect(match(x(), url)).toBeNull();
	});

	test("names its tag x by default", () => {
		expect(x().name).toBe("x");
	});
});
