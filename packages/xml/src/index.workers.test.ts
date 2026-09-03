/**
 * Exercises the package inside workerd, the runtime it ships to, where the whole
 * of parsing and serialization runs on the package's own code. Guards the feed
 * behavior every caller depends on: content, round trips and element name case.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { XML } from "./index";

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
	<channel>
		<title>Feed &amp; Friends</title>
		<lastBuildDate>Mon, 01 Sep 2026 00:00:00 GMT</lastBuildDate>
		<item>
			<title>Hello</title>
			<content:encoded><![CDATA[<p>Markup</p>]]></content:encoded>
		</item>
	</channel>
</rss>`;

describe("XML on workerd", () => {
	test("parses a feed and reaches its content", () => {
		let parsed = XML.parse(FEED);
		if (isFailure(parsed)) throw parsed.error;

		expect(parsed.data.query("channel/title")?.children).toEqual(["Feed & Friends"]);
		expect(parsed.data.query("channel/item/content:encoded")?.children).toEqual(["<p>Markup</p>"]);
		expect(parsed.data.declaration).toEqual({ version: "1.0", encoding: "UTF-8" });
	});

	test("serializes back to XML that parses into the same tree", () => {
		let parsed = XML.parse(FEED);
		if (isFailure(parsed)) throw parsed.error;

		let reparsed = XML.parse(parsed.data.toString());
		if (isFailure(reparsed)) throw reparsed.error;

		expect(reparsed.data.toJSON()).toEqual(parsed.data.toJSON());
	});

	test("preserves element name case, which RSS depends on", () => {
		let parsed = XML.parse(FEED);
		if (isFailure(parsed)) throw parsed.error;

		expect(parsed.data.toString()).toContain("<lastBuildDate>");
	});
});
