/**
 * Exercises the XML public API for parsing, traversal, and serialization.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { XML, XMLParseError, XMLStringifyError } from "./index.js";

describe("XML.parse", () => {
	test("returns an XML instance for RSS-like XML", () => {
		let raw = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
	<channel>
		<title>Example Feed</title>
		<atom:link href="https://example.com/feed.xml" rel="self" type="application/rss+xml" />
		<item>
			<title>Hello</title>
			<description><![CDATA[World <strong>content</strong>]]></description>
			<content:encoded><![CDATA[<p>Markup</p>]]></content:encoded>
		</item>
	</channel>
</rss>`;

		let result = XML.parse(raw);

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect(result.data).toBeInstanceOf(XML);
			expect(result.data.declaration).toEqual({
				version: "1.0",
				encoding: "UTF-8",
			});
			expect(result.data.root).toEqual({
				name: "rss",
				attributes: {
					version: "2.0",
					"xmlns:atom": "http://www.w3.org/2005/Atom",
					"xmlns:content": "http://purl.org/rss/1.0/modules/content/",
				},
				children: [
					{
						name: "channel",
						attributes: {},
						children: [
							{
								name: "title",
								attributes: {},
								children: ["Example Feed"],
							},
							{
								name: "atom:link",
								attributes: {
									href: "https://example.com/feed.xml",
									rel: "self",
									type: "application/rss+xml",
								},
								children: [],
							},
							{
								name: "item",
								attributes: {},
								children: [
									{
										name: "title",
										attributes: {},
										children: ["Hello"],
									},
									{
										name: "description",
										attributes: {},
										children: ["World <strong>content</strong>"],
									},
									{
										name: "content:encoded",
										attributes: {},
										children: ["<p>Markup</p>"],
									},
								],
							},
						],
					},
				],
			});
		}
	});

	test("returns a failure for invalid XML", () => {
		let result = XML.parse("<rss><channel></rss>");

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error).toBeInstanceOf(XMLParseError);
		}
	});
});

describe("XML instance", () => {
	test("toJSON returns plain document data", () => {
		let parsed = XML.parse(
			`<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title></channel></rss>`,
		);
		if (isFailure(parsed)) throw parsed.error;

		expect(parsed.data.toJSON()).toEqual({
			declaration: { version: "1.0" },
			root: {
				name: "rss",
				attributes: { version: "2.0" },
				children: [
					{
						name: "channel",
						attributes: {},
						children: [{ name: "title", attributes: {}, children: ["Feed"] }],
					},
				],
			},
		});
	});

	test("toString serializes the current instance", () => {
		let parsed = XML.parse(
			`<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title></channel></rss>`,
		);
		if (isFailure(parsed)) throw parsed.error;

		let output = parsed.data.toString();

		expect(output).toContain('<?xml version="1.0"?>');
		expect(output).toContain('<rss version="2.0">');
		expect(output).toContain("<channel>");
		expect(output).toContain("<title>Feed</title>");
	});

	test("find and findAll traverse elements in depth-first order", () => {
		let parsed = XML.parse(`
<rss version="2.0">
	<channel>
		<item><title>One</title></item>
		<item><title>Two</title></item>
	</channel>
</rss>`);
		if (isFailure(parsed)) throw parsed.error;

		let firstItem = parsed.data.find((element) => element.name === "item");
		let allItems = parsed.data.findAll((element) => element.name === "item");

		expect(firstItem).toEqual({
			name: "item",
			attributes: {},
			children: [{ name: "title", attributes: {}, children: ["One"] }],
		});
		expect(allItems).toHaveLength(2);
		expect(allItems[1]).toEqual({
			name: "item",
			attributes: {},
			children: [{ name: "title", attributes: {}, children: ["Two"] }],
		});
	});

	test("query and queryAll match simple slash-delimited paths", () => {
		let parsed = XML.parse(`
<rss version="2.0">
	<channel>
		<title>Feed</title>
		<item><title>One</title></item>
		<item><title>Two</title></item>
	</channel>
</rss>`);
		if (isFailure(parsed)) throw parsed.error;

		expect(parsed.data.query("channel")).toEqual({
			name: "channel",
			attributes: {},
			children: [
				{ name: "title", attributes: {}, children: ["Feed"] },
				{
					name: "item",
					attributes: {},
					children: [{ name: "title", attributes: {}, children: ["One"] }],
				},
				{
					name: "item",
					attributes: {},
					children: [{ name: "title", attributes: {}, children: ["Two"] }],
				},
			],
		});

		expect(parsed.data.query("rss/channel/title")).toEqual({
			name: "title",
			attributes: {},
			children: ["Feed"],
		});

		expect(parsed.data.queryAll("channel/item")).toEqual([
			{
				name: "item",
				attributes: {},
				children: [{ name: "title", attributes: {}, children: ["One"] }],
			},
			{
				name: "item",
				attributes: {},
				children: [{ name: "title", attributes: {}, children: ["Two"] }],
			},
		]);
	});
});

describe("XML.stringify", () => {
	test("serializes a root element", () => {
		let result = XML.stringify({
			name: "rss",
			attributes: {
				version: "2.0",
				"xmlns:atom": "http://www.w3.org/2005/Atom",
			},
			children: [
				{
					name: "channel",
					attributes: {},
					children: [
						{ name: "title", attributes: {}, children: ["Example Feed"] },
						{
							name: "atom:link",
							attributes: {
								href: "https://example.com/feed.xml",
								rel: "self",
								type: "application/rss+xml",
							},
							children: [],
						},
					],
				},
			],
		});

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect(result.data).toContain('<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">');
			expect(result.data).toContain("<channel>");
			expect(result.data).toContain("<title>Example Feed</title>");
			expect(result.data).toContain(
				'<atom:link href="https://example.com/feed.xml" rel="self" type="application/rss+xml"/>',
			);
		}
	});

	test("delegates to instance toString when given an XML instance", () => {
		let parsed = XML.parse(
			`<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title></channel></rss>`,
		);
		if (isFailure(parsed)) throw parsed.error;

		let serialized = XML.stringify(parsed.data);

		expect(isSuccess(serialized)).toBe(true);
		if (isSuccess(serialized)) {
			expect(serialized.data).toBe(parsed.data.toString());
		}
	});

	test("returns a failure when a namespace prefix is missing", () => {
		let result = XML.stringify({
			name: "rss",
			attributes: {},
			children: [{ name: "atom:link", attributes: {}, children: [] }],
		});

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error).toBeInstanceOf(XMLStringifyError);
			expect(result.error.message).toContain("Missing namespace declaration");
		}
	});
});
