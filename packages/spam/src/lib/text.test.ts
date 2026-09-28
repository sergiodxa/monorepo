/**
 * Tests link and word extraction, which every link rule reads, so the rules agree on what a
 * link is: sentence punctuation stripped, markup brackets excluded, duplicates counted once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import { extractLinks, extractWords } from "./text.js";

test("strips trailing sentence punctuation", () => {
	expect(extractLinks("see https://example.com/a.").map((url) => url.href)).toEqual([
		"https://example.com/a",
	]);
});

test("reads a www host as http", () => {
	expect(extractLinks("www.example.com").map((url) => url.href)).toEqual([
		"http://www.example.com/",
	]);
});

test("stops at Markdown and BBCode brackets", () => {
	let content = "[a](https://a.example/x) [url=https://b.example]b[/url]";
	expect(extractLinks(content).map((url) => url.hostname)).toEqual(["a.example", "b.example"]);
});

test("counts a repeated link once", () => {
	expect(extractLinks("https://a.example https://a.example")).toHaveLength(1);
});

test("splits words on anything that is not a letter or digit, without links", () => {
	expect(extractWords("Don't visit https://x.example, ok?")).toEqual(["Don't", "visit", "ok"]);
});
