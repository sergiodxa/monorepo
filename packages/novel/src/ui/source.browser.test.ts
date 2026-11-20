/**
 * A Blob asset's object URL in a real browser: made once per Blob and shared by every lookup,
 * picked from a locale map like a URL, and loading the Blob's own bytes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { objectUrl, resolveSource } from "./source.js";

describe(objectUrl, () => {
	test("makes one URL per Blob and answers it on every call", () => {
		let first = new Blob(["first"]);
		let second = new Blob(["first"]);
		let url = objectUrl(first);
		expect(url).toMatch(/^blob:/);
		expect(objectUrl(first)).toBe(url);
		expect(objectUrl(second)).not.toBe(url);
	});

	test("loads the Blob's bytes", async () => {
		let url = objectUrl(new Blob(["chime"], { type: "text/plain" }));
		expect(await (await fetch(url)).text()).toBe("chime");
	});
});

describe(resolveSource, () => {
	test("answers a localized Blob's object URL", () => {
		let ja = new Blob(["ja"]);
		let source = { en: "/cg/letter-en.webp", ja };
		expect(resolveSource(source, "ja-JP")).toBe(objectUrl(ja));
		expect(resolveSource(ja, "en")).toBe(objectUrl(ja));
	});
});
