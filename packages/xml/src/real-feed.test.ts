/**
 * Parses a production RSS feed captured from sergiodxa.com, so the package is
 * checked against a document a real reader would receive: 646 items, non-ASCII
 * titles and doubly-escaped markup inside descriptions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";

import { isFailure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { XML } from "./index";

const FEED = readFileSync(new URL("./fixtures/sergiodxa-rss.xml", import.meta.url), "utf8");

/**
 * Parses the fixture, failing the test with the parse error when it is rejected.
 */
function parseFeed() {
	let result = XML.parse(FEED);
	if (isFailure(result)) throw result.error;
	return result.data;
}

/**
 * Returns the text of an element whose only child is a text node.
 */
function textOf(element: XML.Element | undefined) {
	let [child] = element?.children ?? [];
	return typeof child === "string" ? child : undefined;
}

describe("a production RSS feed", () => {
	test("parses into a declaration and an rss root", () => {
		let feed = parseFeed();

		expect(feed.declaration).toEqual({ version: "1.0", encoding: "UTF-8" });
		expect(feed.root.name).toBe("rss");
		expect(feed.root.attributes).toEqual({ version: "2.0" });
	});

	test("reads channel metadata with its non-ASCII characters intact", () => {
		let feed = parseFeed();

		expect(textOf(feed.query("channel/title"))).toBe("Sergio Xalambrí");
		expect(textOf(feed.query("channel/link"))).toBe("https://sergiodxa.com");
	});

	test("reads every item with the elements a reader needs", () => {
		let items = parseFeed().queryAll("channel/item");

		expect(items).toHaveLength(646);

		for (let item of items) {
			let names = (item.children ?? []).map((child) =>
				typeof child === "string" ? child : child.name,
			);

			expect(names).toEqual(["title", "link", "description", "guid", "pubDate"]);
		}
	});

	test("decodes each reference exactly once", () => {
		let descriptions = parseFeed()
			.queryAll("channel/item/description")
			.map((element) => textOf(element));

		let doublyEscaped = descriptions.find((text) => text?.includes("&lt;form&gt;"));

		expect(doublyEscaped).toContain("replace the &lt;form&gt; tag");
	});

	test("serializes back into XML that parses into the same tree", () => {
		let feed = parseFeed();

		let reparsed = XML.parse(feed.toString());
		if (isFailure(reparsed)) throw reparsed.error;

		expect(reparsed.data.toJSON()).toEqual(feed.toJSON());
	});

	test("re-escapes the references it decoded", () => {
		let serialized = parseFeed().toString();

		expect(serialized).toContain("replace the &amp;lt;form&amp;gt; tag");
		expect(serialized).toContain("<title>Sergio Xalambrí</title>");
	});
});
