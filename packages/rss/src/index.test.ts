/**
 * Exercises the `RSS` class against the RSS 2.0 spec and common namespace
 * extensions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { XML } from "@sdxc/xml";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { RSS } from "./index";

let FEED_URL = "https://example.com/feed.xml";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let FULL_SPEC_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:slash="http://purl.org/rss/1.0/modules/slash/" xmlns:media="http://search.yahoo.com/mrss/">
	<channel>
		<title>Example Feed</title>
		<link>https://example.com</link>
		<description>Full spec example</description>
		<language>en-us</language>
		<copyright>Copyright 2026 Example</copyright>
		<managingEditor>editor@example.com (Editor)</managingEditor>
		<webMaster>webmaster@example.com (Webmaster)</webMaster>
		<pubDate>Tue, 14 Apr 2026 10:00:00 GMT</pubDate>
		<lastBuildDate>Tue, 14 Apr 2026 11:00:00 GMT</lastBuildDate>
		<category>News</category>
		<category domain="topics">Technology/AI</category>
		<generator>Unit Test</generator>
		<docs>https://www.rssboard.org/rss-specification</docs>
		<cloud domain="rpc.example.com" port="80" path="/RPC2" registerProcedure="pingMe" protocol="xml-rpc" />
		<ttl>60</ttl>
		<image>
			<url>https://example.com/image.png</url>
			<title>Example Feed</title>
			<link>https://example.com</link>
			<description>Channel image</description>
			<width>88</width>
			<height>31</height>
		</image>
		<rating>(PICS-1.1)</rating>
		<textInput>
			<title>Search</title>
			<description>Search the site</description>
			<name>q</name>
			<link>https://example.com/search</link>
		</textInput>
		<skipHours>
			<hour>1</hour>
			<hour>23</hour>
		</skipHours>
		<skipDays>
			<day>Saturday</day>
			<day>Sunday</day>
		</skipDays>
		<atom:link href="https://example.com/feed.xml" rel="self" type="application/rss+xml" />
		<dc:creator>Channel Editor</dc:creator>
		<media:rating scheme="urn:simple">adult</media:rating>
		<item>
			<title>First Post</title>
			<link>https://example.com/posts/1</link>
			<description><![CDATA[Summary <strong>HTML</strong>]]></description>
			<author>author@example.com (Author)</author>
			<category>Updates</category>
			<category domain="topics">Technology/AI</category>
			<comments>https://example.com/posts/1#comments</comments>
			<enclosure url="https://example.com/audio.mp3" length="12345" type="audio/mpeg" />
			<guid isPermaLink="false">tag:example.com,2026:1</guid>
			<pubDate>Tue, 14 Apr 2026 09:00:00 GMT</pubDate>
			<source url="https://source.example.com/feed.xml">Source Feed</source>
			<content:encoded><![CDATA[<p>Full content</p>]]></content:encoded>
			<atom:link href="https://example.com/posts/1.json" rel="alternate" type="application/json" />
			<dc:creator>Jane Doe</dc:creator>
			<slash:comments>7</slash:comments>
			<media:thumbnail url="https://example.com/thumb.jpg" width="320" height="180" />
		</item>
	</channel>
</rss>`;

describe("RSS", () => {
	test("creates RSS with channel", () => {
		let rss = new RSS({
			title: "Test Feed",
			description: "A test feed",
			link: "https://example.com",
		});

		expect(rss.channel).toEqual({
			title: "Test Feed",
			description: "A test feed",
			link: "https://example.com",
		});
	});

	test("channel setter replaces and clones channel metadata", () => {
		let rss = new RSS({
			title: "Test Feed",
			description: "A test feed",
			link: "https://example.com",
		});

		rss.addItem({
			guid: "1",
			title: "First Post",
			description: "This is the first post",
		});

		let channel: RSS.Channel = {
			...rss.channel,
			description: "An updated feed description",
			language: "en-us",
		};

		rss.channel = channel;
		channel.description = "Mutated";

		expect(rss.channel).toEqual({
			title: "Test Feed",
			description: "An updated feed description",
			link: "https://example.com",
			language: "en-us",
		});
		expect(rss.items).toHaveLength(1);
		expect(rss.items[0]?.title).toBe("First Post");
	});

	test("channel setter validates required fields", () => {
		let rss = new RSS({
			title: "Test Feed",
			description: "A test feed",
			link: "https://example.com",
		});

		expect(() => {
			rss.channel = {
				...rss.channel,
				description: "",
			};
		}).toThrow("Channel must include title, description, and link.");
	});

	test("addItem adds and clones items", () => {
		let rss = new RSS({
			title: "Test Feed",
			description: "A test feed",
			link: "https://example.com",
		});

		let item: RSS.Item = {
			guid: "1",
			title: "First Post",
			description: "This is the first post",
			link: "https://example.com/post/1",
			pubDate: "Tue, 14 Apr 2026 09:00:00 GMT",
		};

		rss.addItem(item);
		item.title = "Mutated";

		expect(rss.items).toHaveLength(1);
		expect(rss.items[0]).toEqual({
			guid: "1",
			title: "First Post",
			description: "This is the first post",
			link: "https://example.com/post/1",
			pubDate: "Tue, 14 Apr 2026 09:00:00 GMT",
		});
	});

	test("addItem validates that items have a title or description", () => {
		let rss = new RSS({
			title: "Test Feed",
			description: "A test feed",
			link: "https://example.com",
		});

		expect(() => {
			rss.addItem({ guid: "1" } as RSS.Item);
		}).toThrow("Item must include at least a title or description.");
	});

	test("removeItem removes item by guid value", () => {
		let rss = new RSS({
			title: "Test Feed",
			description: "A test feed",
			link: "https://example.com",
		});

		rss.addItem({
			guid: { value: "1", isPermaLink: false },
			title: "First Post",
			description: "This is the first post",
		});

		rss.addItem({
			guid: "2",
			title: "Second Post",
			description: "This is the second post",
		});

		rss.removeItem("1");

		expect(rss.items).toHaveLength(1);
		expect(rss.items[0]?.guid).toBe("2");
	});

	test("toJSON returns the full feed payload", () => {
		let rss = new RSS({
			title: "Test Feed",
			description: "A test feed",
			link: "https://example.com",
			category: ["News", { value: "Tech", domain: "topics" }],
			atomLink: { href: "https://example.com/feed.xml", rel: "self", type: "application/rss+xml" },
		});

		rss.addItem({
			guid: { value: "1", isPermaLink: false },
			title: "First Post",
			description: "This is the first post",
			category: "Updates",
			contentEncoded: "<p>Full content</p>",
		});

		expect(rss.toJSON()).toEqual({
			channel: {
				title: "Test Feed",
				description: "A test feed",
				link: "https://example.com",
				category: [
					"News",
					{ value: "Tech", domain: "topics", attributes: undefined, extensions: undefined },
				],
				atomLink: {
					href: "https://example.com/feed.xml",
					rel: "self",
					type: "application/rss+xml",
					attributes: undefined,
					extensions: undefined,
				},
				namespaces: undefined,
				attributes: undefined,
				extensions: undefined,
			},
			items: [
				{
					guid: { value: "1", isPermaLink: false, attributes: undefined, extensions: undefined },
					title: "First Post",
					description: "This is the first post",
					category: "Updates",
					contentEncoded: "<p>Full content</p>",
					attributes: undefined,
					extensions: undefined,
				},
			],
		});
	});

	test("toString outputs RSS XML with optional channel and item elements", () => {
		let rss = new RSS({
			title: "Test Feed",
			description: "A test feed",
			link: "https://example.com",
			language: "en-us",
			copyright: "Copyright 2026",
			managingEditor: "editor@example.com (Editor)",
			webMaster: "webmaster@example.com (Webmaster)",
			pubDate: "Tue, 14 Apr 2026 10:00:00 GMT",
			lastBuildDate: "Tue, 14 Apr 2026 11:00:00 GMT",
			category: ["News", { value: "Technology/AI", domain: "topics" }],
			generator: "Unit Test",
			docs: "https://www.rssboard.org/rss-specification",
			cloud: {
				domain: "rpc.example.com",
				port: 80,
				path: "/RPC2",
				registerProcedure: "pingMe",
				protocol: "xml-rpc",
			},
			ttl: 60,
			image: {
				url: "https://example.com/image.png",
				title: "Test Feed",
				link: "https://example.com",
				description: "Channel image",
				width: 88,
				height: 31,
			},
			rating: "(PICS-1.1)",
			textInput: {
				title: "Search",
				description: "Search the site",
				name: "q",
				link: "https://example.com/search",
			},
			skipHours: [1, 23],
			skipDays: ["Saturday", "Sunday"],
			atomLink: { href: "https://example.com/feed.xml", rel: "self", type: "application/rss+xml" },
			dcCreator: "Channel Editor",
			namespaces: { media: "http://search.yahoo.com/mrss/" },
			extensions: [
				{
					name: "media:rating",
					attributes: { scheme: "urn:simple" },
					children: ["adult"],
				},
			],
		});

		rss.addItem({
			guid: { value: "tag:example.com,2026:1", isPermaLink: false },
			title: "First Post",
			description: "Summary <strong>HTML</strong>",
			link: "https://example.com/posts/1",
			author: "author@example.com (Author)",
			category: ["Updates", { value: "Technology/AI", domain: "topics" }],
			comments: "https://example.com/posts/1#comments",
			enclosure: { url: "https://example.com/audio.mp3", length: 12345, type: "audio/mpeg" },
			pubDate: "Tue, 14 Apr 2026 09:00:00 GMT",
			source: { value: "Source Feed", url: "https://source.example.com/feed.xml" },
			contentEncoded: "<p>Full content</p>",
			atomLink: {
				href: "https://example.com/posts/1.json",
				rel: "alternate",
				type: "application/json",
			},
			dcCreator: "Jane Doe",
			slashComments: 7,
			extensions: [
				{
					name: "media:thumbnail",
					attributes: {
						url: "https://example.com/thumb.jpg",
						width: "320",
						height: "180",
					},
					children: [],
				},
			],
		});

		let output = rss.toString();

		expect(output).toContain('<?xml version="1.0" encoding="UTF-8"?>');
		expect(output).toContain('<rss version="2.0"');
		expect(output).toContain('xmlns:atom="http://www.w3.org/2005/Atom"');
		expect(output).toContain('xmlns:content="http://purl.org/rss/1.0/modules/content/"');
		expect(output).toContain('xmlns:dc="http://purl.org/dc/elements/1.1/"');
		expect(output).toContain('xmlns:slash="http://purl.org/rss/1.0/modules/slash/"');
		expect(output).toContain("<language>en-us</language>");
		expect(output).toContain("<category>News</category>");
		expect(output).toContain('<category domain="topics">Technology/AI</category>');
		expect(output).toContain(
			'<cloud domain="rpc.example.com" port="80" path="/RPC2" registerProcedure="pingMe" protocol="xml-rpc"/>',
		);
		expect(output).toContain("<ttl>60</ttl>");
		expect(output).toContain("<image>");
		expect(output).toContain("<textInput>");
		expect(output).toContain("<skipHours>");
		expect(output).toContain("<skipDays>");
		expect(output).toContain(
			'<atom:link href="https://example.com/feed.xml" rel="self" type="application/rss+xml"/>',
		);
		expect(output).toContain("<dc:creator>Channel Editor</dc:creator>");
		expect(output).toContain('<guid isPermaLink="false">tag:example.com,2026:1</guid>');
		expect(output).toContain(
			'<enclosure url="https://example.com/audio.mp3" length="12345" type="audio/mpeg"/>',
		);
		expect(output).toContain("<content:encoded>&lt;p&gt;Full content&lt;/p&gt;</content:encoded>");
		expect(output).toContain("<slash:comments>7</slash:comments>");
		expect(output).toContain(
			'<media:thumbnail url="https://example.com/thumb.jpg" width="320" height="180"/>',
		);
	});

	test("parse reads the full RSS 2.0 model plus common namespace extensions", () => {
		let rss = RSS.parse(FULL_SPEC_XML);

		expect(rss.channel).toEqual({
			title: "Example Feed",
			description: "Full spec example",
			link: "https://example.com",
			language: "en-us",
			copyright: "Copyright 2026 Example",
			managingEditor: "editor@example.com (Editor)",
			webMaster: "webmaster@example.com (Webmaster)",
			pubDate: "Tue, 14 Apr 2026 10:00:00 GMT",
			lastBuildDate: "Tue, 14 Apr 2026 11:00:00 GMT",
			category: ["News", { value: "Technology/AI", domain: "topics" }],
			generator: "Unit Test",
			docs: "https://www.rssboard.org/rss-specification",
			cloud: {
				domain: "rpc.example.com",
				port: 80,
				path: "/RPC2",
				registerProcedure: "pingMe",
				protocol: "xml-rpc",
			},
			ttl: 60,
			image: {
				url: "https://example.com/image.png",
				title: "Example Feed",
				link: "https://example.com",
				description: "Channel image",
				width: 88,
				height: 31,
			},
			rating: "(PICS-1.1)",
			textInput: {
				title: "Search",
				description: "Search the site",
				name: "q",
				link: "https://example.com/search",
			},
			skipHours: [1, 23],
			skipDays: ["Saturday", "Sunday"],
			atomLink: {
				href: "https://example.com/feed.xml",
				rel: "self",
				type: "application/rss+xml",
			},
			dcCreator: "Channel Editor",
			namespaces: {
				atom: "http://www.w3.org/2005/Atom",
				content: "http://purl.org/rss/1.0/modules/content/",
				dc: "http://purl.org/dc/elements/1.1/",
				slash: "http://purl.org/rss/1.0/modules/slash/",
				media: "http://search.yahoo.com/mrss/",
			},
			extensions: [
				{
					name: "media:rating",
					attributes: { scheme: "urn:simple" },
					children: ["adult"],
				},
			],
		});

		expect(rss.items).toEqual([
			{
				title: "First Post",
				link: "https://example.com/posts/1",
				description: "Summary <strong>HTML</strong>",
				author: "author@example.com (Author)",
				category: ["Updates", { value: "Technology/AI", domain: "topics" }],
				comments: "https://example.com/posts/1#comments",
				enclosure: {
					url: "https://example.com/audio.mp3",
					length: 12345,
					type: "audio/mpeg",
				},
				guid: { value: "tag:example.com,2026:1", isPermaLink: false },
				pubDate: "Tue, 14 Apr 2026 09:00:00 GMT",
				source: {
					value: "Source Feed",
					url: "https://source.example.com/feed.xml",
				},
				contentEncoded: "<p>Full content</p>",
				atomLink: {
					href: "https://example.com/posts/1.json",
					rel: "alternate",
					type: "application/json",
				},
				dcCreator: "Jane Doe",
				slashComments: 7,
				extensions: [
					{
						name: "media:thumbnail",
						attributes: {
							url: "https://example.com/thumb.jpg",
							width: "320",
							height: "180",
						},
						children: [],
					},
				],
			},
		]);
	});

	test("fromXML extracts an RSS feed from a parsed XML instance", () => {
		let parsed = XML.parse(FULL_SPEC_XML);
		if (isFailure(parsed)) throw parsed.error;

		let rss = RSS.fromXML(parsed.data);

		expect(rss.channel.title).toBe("Example Feed");
		expect(rss.items[0]?.title).toBe("First Post");
		expect(rss.items[0]?.contentEncoded).toBe("<p>Full content</p>");
	});

	test("parse rejects invalid RSS documents", () => {
		expect(() => RSS.parse("<feed />")).toThrow('Expected the root element to be "rss".');
		expect(() => RSS.parse('<rss version="2.0"><channel><title>x</title></channel></rss>')).toThrow(
			"Channel must include title, description, and link.",
		);
		expect(() =>
			RSS.parse(
				'<rss version="2.0"><channel><title>x</title><description>y</description><link>z</link><item><link>z</link></item></channel></rss>',
			),
		).toThrow("Item must include at least a title or description.");
	});

	test("fetch accepts XML content types and parses the response body", async () => {
		let requests = 0;

		server.use(
			http.get(FEED_URL, () => {
				requests++;
				return new HttpResponse(FULL_SPEC_XML, {
					headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
				});
			}),
		);

		let rss = await RSS.fetch(FEED_URL);

		expect(rss.channel.title).toBe("Example Feed");
		expect(requests).toBe(1);
	});
});
