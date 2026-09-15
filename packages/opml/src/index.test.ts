/**
 * Exercises OPML in both directions: the tree a reader exports flattening into a
 * subscription list, the fallbacks that keep a sloppy outline usable, and the round
 * trip that makes a document this package wrote readable by the parser beside it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { XML } from "@sdxc/xml";
import { describe, expect, test } from "vitest";

import type { OPML } from "./index.js";

import { OPMLParseError, parse, stringify } from "./index.js";

/**
 * Wraps outlines in the document around them, so each test writes only the markup it
 * is about.
 */
function document(body: string, head = "<head><title>Subscriptions</title></head>") {
	return `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">${head}<body>${body}</body></opml>`;
}

/**
 * An export in the shape feed readers actually ship: folders holding the feeds filed
 * under them, one feed at the top level, a subscription written with `title` instead
 * of `text`, one with nothing but its `xmlUrl`, and the same feed filed twice.
 */
const EXPORT = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
	<head>
		<title>Subscriptions</title>
		<dateCreated>Mon, 14 Sep 2026 09:15:00 GMT</dateCreated>
	</head>
	<body>
		<outline text="Daily" title="Daily">
			<outline type="rss" text="Frontend Weekly" title="Frontend Weekly" xmlUrl="https://frontend.example/feed.xml" htmlUrl="https://frontend.example/"/>
			<outline type="rss" title="Release Notes" xmlUrl="https://releases.example/atom"/>
		</outline>
		<outline text="Archive">
			<outline text="2024">
				<outline type="rss" text="Frontend Weekly" xmlUrl="https://frontend.example/feed.xml"/>
				<outline type="rss" xmlUrl="https://quiet.example/rss"/>
			</outline>
		</outline>
		<outline type="rss" text="Company Blog" xmlUrl="https://company.example/feed" htmlUrl="https://company.example"/>
	</body>
</opml>`;

describe(parse, () => {
	test("reads a reader's export into a flat list", () => {
		expect(unwrap(parse(EXPORT))).toEqual([
			{
				title: "Frontend Weekly",
				feedUrl: "https://frontend.example/feed.xml",
				siteUrl: "https://frontend.example/",
			},
			{ title: "Release Notes", feedUrl: "https://releases.example/atom" },
			{ title: "https://quiet.example/rss", feedUrl: "https://quiet.example/rss" },
			{
				title: "Company Blog",
				feedUrl: "https://company.example/feed",
				siteUrl: "https://company.example",
			},
		]);
	});

	test("finds feeds nested several folders deep", () => {
		let source = document(
			`<outline text="News"><outline text="Tech"><outline text="Deep" xmlUrl="https://deep.example/feed"/></outline></outline>`,
		);

		expect(unwrap(parse(source))).toEqual([
			{ title: "Deep", feedUrl: "https://deep.example/feed" },
		]);
	});

	test("skips a folder while keeping the feeds inside it", () => {
		let source = document(
			`<outline text="Folder"><outline text="Inside" xmlUrl="https://inside.example/feed"/></outline>`,
		);

		let outlines = unwrap(parse(source));
		expect(outlines).toHaveLength(1);
		expect(outlines[0]?.title).toBe("Inside");
	});

	test("takes the title from text", () => {
		let source = document(
			`<outline text="From text" title="From title" xmlUrl="https://a.example/feed"/>`,
		);
		expect(unwrap(parse(source))[0]?.title).toBe("From text");
	});

	test("takes the title from title when there is no text", () => {
		let source = document(`<outline title="From title" xmlUrl="https://a.example/feed"/>`);
		expect(unwrap(parse(source))[0]?.title).toBe("From title");
	});

	test("falls back to the site when neither title attribute carries anything", () => {
		let source = document(
			`<outline text="  " xmlUrl="https://a.example/feed" htmlUrl="https://a.example"/>`,
		);
		expect(unwrap(parse(source))[0]?.title).toBe("https://a.example");
	});

	test("falls back to the feed URL when an outline carries nothing else", () => {
		let source = document(`<outline xmlUrl="https://a.example/feed"/>`);
		expect(unwrap(parse(source))[0]).toEqual({
			title: "https://a.example/feed",
			feedUrl: "https://a.example/feed",
		});
	});

	test("leaves siteUrl absent when an outline names no site", () => {
		let source = document(`<outline text="A" xmlUrl="https://a.example/feed"/>`);
		expect(unwrap(parse(source))[0]).not.toHaveProperty("siteUrl");
	});

	test("keeps the first of a feed listed twice", () => {
		let source = document(
			`<outline text="First" xmlUrl="https://a.example/feed"/><outline text="Second" xmlUrl="https://a.example/feed"/>`,
		);

		expect(unwrap(parse(source))).toEqual([{ title: "First", feedUrl: "https://a.example/feed" }]);
	});

	test("reads attributes however an export spelled them", () => {
		let source = document(
			`<outline TEXT="Shouted" XMLURL="https://a.example/feed" HTMLURL="https://a.example"/>`,
		);

		expect(unwrap(parse(source))).toEqual([
			{ title: "Shouted", feedUrl: "https://a.example/feed", siteUrl: "https://a.example" },
		]);
	});

	test("trims the whitespace an export wrapped a value in", () => {
		let source = document(`<outline text="  Padded  " xmlUrl="  https://a.example/feed  "/>`);

		expect(unwrap(parse(source))).toEqual([{ title: "Padded", feedUrl: "https://a.example/feed" }]);
	});

	test("reads a document that lists no feeds as empty", () => {
		expect(unwrap(parse(document("")))).toEqual([]);
	});

	test("reads a document of nothing but folders as empty", () => {
		let source = document(`<outline text="Empty folder"><outline text="Nested"/></outline>`);
		expect(unwrap(parse(source))).toEqual([]);
	});

	test("reads a document with no body as empty", () => {
		expect(unwrap(parse(`<opml version="2.0"><head><title>Nothing</title></head></opml>`))).toEqual(
			[],
		);
	});

	test("fails on text that is not XML", () => {
		let result = parse("this is not a subscription list");
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(OPMLParseError);
	});

	test("fails on XML that is not OPML, naming the root that arrived", () => {
		let result = parse(`<html><body><p>Not found</p></body></html>`);
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.message).toBe("Expected an <opml> root, received <html>.");
		}
	});
});

describe(stringify, () => {
	let outlines: OPML.Outline[] = [
		{ title: "A Blog", feedUrl: "https://a.example/feed", siteUrl: "https://a.example" },
	];

	test("writes an OPML 2.0 document", () => {
		let xml = unwrap(XML.parse(stringify(outlines)));
		expect(xml.root.name).toBe("opml");
		expect(xml.root.attributes?.version).toBe("2.0");
		expect(xml.query("opml/head")).toBeDefined();
		expect(xml.query("opml/body")).toBeDefined();
	});

	test("writes one outline per subscription", () => {
		let xml = unwrap(XML.parse(stringify(outlines)));
		let outline = xml.query("opml/body/outline");

		expect(outline?.attributes).toEqual({
			type: "rss",
			text: "A Blog",
			title: "A Blog",
			xmlUrl: "https://a.example/feed",
			htmlUrl: "https://a.example",
		});
	});

	test("writes no htmlUrl for a subscription that names no site", () => {
		let source = stringify([{ title: "A Blog", feedUrl: "https://a.example/feed" }]);
		let outline = unwrap(XML.parse(source)).query("opml/body/outline");

		expect(outline?.attributes).not.toHaveProperty("htmlUrl");
	});

	test("writes the document title into the head", () => {
		let source = stringify(outlines, { title: "My Subscriptions" });
		expect(unwrap(XML.parse(source)).query("opml/head/title")?.children).toEqual([
			"My Subscriptions",
		]);
	});

	test("writes the creation date the way the head reads it", () => {
		let source = stringify(outlines, { dateCreated: new Date("2026-09-14T09:15:00Z") });
		expect(unwrap(XML.parse(source)).query("opml/head/dateCreated")?.children).toEqual([
			"Mon, 14 Sep 2026 09:15:00 GMT",
		]);
	});

	test("leaves the head empty when the caller describes nothing", () => {
		expect(unwrap(XML.parse(stringify(outlines))).query("opml/head")?.children ?? []).toEqual([]);
	});

	test("escapes the characters that would otherwise close the attribute", () => {
		let source = stringify([
			{ title: `Tom & Jerry's <b>"best"</b>`, feedUrl: "https://a.example/feed?a=1&b=2" },
		]);

		expect(source).not.toContain(`<b>`);
		expect(source).toContain("&amp;");
		expect(source).toContain("&quot;");
	});
});

describe("round trip", () => {
	test("reads back the subscriptions that were written", () => {
		let outlines: OPML.Outline[] = [
			{ title: "A Blog", feedUrl: "https://a.example/feed", siteUrl: "https://a.example" },
			{ title: "Another", feedUrl: "https://b.example/atom.xml" },
		];

		expect(unwrap(parse(stringify(outlines)))).toEqual(outlines);
	});

	test("survives titles carrying markup characters and quotes", () => {
		let outlines: OPML.Outline[] = [
			{ title: `Tom & Jerry`, feedUrl: "https://a.example/feed?a=1&b=2" },
			{ title: `<script>alert("hi")</script>`, feedUrl: "https://b.example/feed" },
			{
				title: `She said "hello"`,
				feedUrl: "https://c.example/feed",
				siteUrl: "https://c.example",
			},
		];

		expect(unwrap(parse(stringify(outlines)))).toEqual(outlines);
	});

	test("survives titles outside ASCII", () => {
		let outlines: OPML.Outline[] = [
			{ title: "Café — Diseño & Código", feedUrl: "https://es.example/feed" },
			{
				title: "日本語のブログ",
				feedUrl: "https://jp.example/feed",
				siteUrl: "https://jp.example",
			},
			{ title: "Здравствуйте 👋", feedUrl: "https://ru.example/feed" },
		];

		expect(unwrap(parse(stringify(outlines)))).toEqual(outlines);
	});

	test("reads back a document written with a described head", () => {
		let outlines: OPML.Outline[] = [{ title: "A Blog", feedUrl: "https://a.example/feed" }];
		let source = stringify(outlines, {
			title: "My Subscriptions",
			dateCreated: new Date("2026-09-14T09:15:00Z"),
		});

		expect(unwrap(parse(source))).toEqual(outlines);
	});
});
