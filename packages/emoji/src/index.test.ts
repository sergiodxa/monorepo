/**
 * Exercises merge, replace, tokenize, search and HTML render against a small
 * hand-built catalog so generator output is not required for unit coverage.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { EmojiEntry } from "./index.js";

import {
	indexEntries,
	merge,
	preferredName,
	replaceShortcodes,
	searchEmojis,
	segmentsToHTML,
	tokenize,
} from "./index.js";

const BASE: EmojiEntry[] = [
	{
		emoji: "👍",
		shortcodes: ["+1", "thumbsup"],
		category: "people-body",
		tags: ["approve"],
		emoticons: [":+)"],
	},
	{
		emoji: "😄",
		shortcodes: ["smile", "smiley"],
		category: "smileys-emotion",
		emoticons: [":)", ":-)"],
	},
];

const CUSTOM: EmojiEntry[] = [
	{
		shortcodes: ["blobcat"],
		src: "https://example.com/blobcat.png",
		category: "custom",
		label: "blobcat",
	},
	{
		shortcodes: ["smile"],
		src: "https://example.com/custom-smile.png",
		category: "custom",
	},
];

describe("merge", () => {
	test("lets custom shortcodes override Unicode", () => {
		let catalog = merge(BASE, CUSTOM);
		let index = indexEntries(catalog);
		expect(index.get("smile")?.category).toBe("custom");
		expect(index.get("+1") && "emoji" in index.get("+1")!).toBe(true);
	});
});

describe("replaceShortcodes", () => {
	test("replaces complete Unicode tokens and leaves customs", () => {
		let index = indexEntries(merge(BASE, CUSTOM));
		expect(replaceShortcodes("hi :smile: and :blobcat:", index)).toBe("hi :smile: and :blobcat:");
		expect(replaceShortcodes(":+1: please", indexEntries(BASE))).toBe("👍 please");
	});

	test("replaces ASCII emoticons", () => {
		expect(replaceShortcodes("ok :)", indexEntries(BASE))).toBe("ok 😄");
	});
});

describe("tokenize", () => {
	test("emits custom segments for image shortcodes", () => {
		let index = indexEntries(merge(BASE, CUSTOM));
		expect(tokenize("x :blobcat: y", index)).toEqual([
			{ type: "text", value: "x " },
			{ type: "custom", name: "blobcat", src: "https://example.com/blobcat.png", label: "blobcat" },
			{ type: "text", value: " y" },
		]);
	});
});

describe("segmentsToHTML", () => {
	test("renders https customs as img and rejects other schemes", () => {
		expect(
			segmentsToHTML([
				{ type: "custom", name: "blobcat", src: "https://example.com/a.png", label: "blob" },
			]),
		).toContain('src="https://example.com/a.png"');
		expect(segmentsToHTML([{ type: "custom", name: "x", src: "javascript:alert(1)" }])).toBe(":x:");
	});
});

describe("searchEmojis", () => {
	test("ranks primary prefix first and returns preferred names", () => {
		let hits = searchEmojis(BASE, "sm");
		expect(preferredName(hits[0]!)).toBe("smile");
	});
});
