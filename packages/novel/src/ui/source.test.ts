/**
 * Picking an asset's file for a locale, with URLs and Blobs alike, and a Blob's URL where a
 * server renders the stage: empty, so the page sets the object URL when it hydrates.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { objectUrl, pickSource, resolveSource } from "./source.js";

/** A generated file, as a game makes one in the browser. */
const CHIME = new Blob(["chime"], { type: "audio/wav" });

describe(pickSource, () => {
	test("answers a URL or a Blob as given", () => {
		expect(pickSource("/sfx/door.ogg", "en")).toBe("/sfx/door.ogg");
		expect(pickSource(CHIME, "en")).toBe(CHIME);
	});

	test("picks a locale map's Blob by locale, then language, then the first entry", () => {
		let ja = new Blob(["ja"]);
		let source = { en: "/sfx/door-en.ogg", ja };
		expect(pickSource(source, "ja")).toBe(ja);
		expect(pickSource(source, "ja-JP")).toBe(ja);
		expect(pickSource(source, "fr")).toBe("/sfx/door-en.ogg");
		expect(pickSource({}, "en")).toBe("");
	});
});

describe(resolveSource, () => {
	test("answers a URL unchanged", () => {
		expect(resolveSource({ en: "/cg/letter-en.webp", ja: "/cg/letter-ja.webp" }, "ja-JP")).toBe(
			"/cg/letter-ja.webp",
		);
	});

	test("answers no URL for a Blob outside a document", () => {
		expect(resolveSource(CHIME, "en")).toBe("");
		expect(objectUrl(CHIME)).toBe("");
	});
});
