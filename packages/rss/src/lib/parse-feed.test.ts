import { describe, expect, test } from "bun:test";

import { isFailure, isSuccess } from "@pkg/result";
import { XML } from "@pkg/xml";

import { parseFeed } from "./parse-feed";

let FULL_SPEC_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:slash="http://purl.org/rss/1.0/modules/slash/" xmlns:media="http://search.yahoo.com/mrss/">
	<channel>
		<title>Example Feed</title>
		<link>https://example.com</link>
		<description>Full spec example</description>
		<language>en-us</language>
		<category domain="topics">Technology/AI</category>
		<atom:link href="https://example.com/feed.xml" rel="self" type="application/rss+xml" />
		<dc:creator>Channel Editor</dc:creator>
		<media:rating scheme="urn:simple">adult</media:rating>
		<item>
			<title>First Post</title>
			<description>Summary</description>
			<guid isPermaLink="false">tag:example.com,2026:1</guid>
			<content:encoded><![CDATA[<p>Full content</p>]]></content:encoded>
			<slash:comments>7</slash:comments>
		</item>
	</channel>
</rss>`;

describe("parseFeed", () => {
	test("parses a rich RSS document", () => {
		let parsed = XML.parse(FULL_SPEC_XML);
		if (isFailure(parsed)) throw parsed.error;

		let result = parseFeed(parsed.data);

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect(result.data.channel.title).toBe("Example Feed");
			expect(result.data.channel.category).toEqual({ value: "Technology/AI", domain: "topics" });
			expect(result.data.channel.atomLink).toEqual({
				href: "https://example.com/feed.xml",
				rel: "self",
				type: "application/rss+xml",
			});
			expect(result.data.channel.dcCreator).toBe("Channel Editor");
			expect(result.data.channel.namespaces).toEqual({
				atom: "http://www.w3.org/2005/Atom",
				content: "http://purl.org/rss/1.0/modules/content/",
				dc: "http://purl.org/dc/elements/1.1/",
				slash: "http://purl.org/rss/1.0/modules/slash/",
				media: "http://search.yahoo.com/mrss/",
			});
			expect(result.data.items).toEqual([
				{
					title: "First Post",
					description: "Summary",
					guid: { value: "tag:example.com,2026:1", isPermaLink: false },
					contentEncoded: "<p>Full content</p>",
					slashComments: 7,
				},
			]);
		}
	});

	test("rejects invalid RSS roots and incomplete payloads", () => {
		let feed = XML.parse("<feed />");
		if (isFailure(feed)) throw feed.error;

		let invalidRoot = parseFeed(feed.data);
		expect(isFailure(invalidRoot)).toBe(true);
		if (isFailure(invalidRoot))
			expect(invalidRoot.error.message).toBe('Expected the root element to be "rss".');

		let missingChannelFields = XML.parse(
			'<rss version="2.0"><channel><title>x</title></channel></rss>',
		);
		if (isFailure(missingChannelFields)) throw missingChannelFields.error;

		let invalidChannel = parseFeed(missingChannelFields.data);
		expect(isFailure(invalidChannel)).toBe(true);
		if (isFailure(invalidChannel)) {
			expect(invalidChannel.error.message).toBe(
				"Channel must include title, description, and link.",
			);
		}
	});
});
