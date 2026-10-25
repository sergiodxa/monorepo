/**
 * Exercises the `RSS` class against the RSS 2.0 spec and common namespace
 * extensions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { XML } from "@sdxc/xml";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { RSS, RSSFetchError, RSSParseError, RSSStringifyError } from "./index.js";

let FEED_URL = "https://example.com/feed.xml";

/** Builds a feed holding `channel` and no items. */
function create(channel: RSS.Channel): RSS {
	return unwrap(RSS.fromJSON({ channel, items: [] }));
}

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
		let rss = create({
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

	test("setChannel replaces and clones channel metadata", () => {
		let rss = create({
			title: "Test Feed",
			description: "A test feed",
			link: "https://example.com",
		});

		unwrap(
			rss.addItem({
				guid: "1",
				title: "First Post",
				description: "This is the first post",
			}),
		);

		let channel: RSS.Channel = {
			...rss.channel,
			description: "An updated feed description",
			language: "en-us",
		};

		unwrap(rss.setChannel(channel));
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

	test("setChannel refuses a channel missing a required field and keeps the one it had", () => {
		let rss = create({
			title: "Test Feed",
			description: "A test feed",
			link: "https://example.com",
		});

		let result = rss.setChannel({ ...rss.channel, description: "" });

		expect(isFailure(result) && result.error).toEqual(
			new RSSParseError("Channel must include title, description, and link."),
		);
		expect(rss.channel.description).toBe("A test feed");
	});

	test("addItem adds and clones items", () => {
		let rss = create({
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

		unwrap(rss.addItem(item));
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
		let rss = create({
			title: "Test Feed",
			description: "A test feed",
			link: "https://example.com",
		});

		let result = rss.addItem({ guid: "1" } as RSS.Item);

		expect(isFailure(result) && result.error).toEqual(
			new RSSParseError("Item must include at least a title or description."),
		);
		expect(rss.items).toEqual([]);
	});

	test("removeItem removes item by guid value", () => {
		let rss = create({
			title: "Test Feed",
			description: "A test feed",
			link: "https://example.com",
		});

		unwrap(
			rss.addItem({
				guid: { value: "1", isPermaLink: false },
				title: "First Post",
				description: "This is the first post",
			}),
		);

		unwrap(
			rss.addItem({
				guid: "2",
				title: "Second Post",
				description: "This is the second post",
			}),
		);

		rss.removeItem("1");

		expect(rss.items).toHaveLength(1);
		expect(rss.items[0]?.guid).toBe("2");
	});

	test("toJSON returns the full feed payload", () => {
		let rss = create({
			title: "Test Feed",
			description: "A test feed",
			link: "https://example.com",
			category: ["News", { value: "Tech", domain: "topics" }],
			atomLink: { href: "https://example.com/feed.xml", rel: "self", type: "application/rss+xml" },
		});

		unwrap(
			rss.addItem({
				guid: { value: "1", isPermaLink: false },
				title: "First Post",
				description: "This is the first post",
				category: "Updates",
				contentEncoded: "<p>Full content</p>",
			}),
		);

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

	test("stringify outputs RSS XML with optional channel and item elements", () => {
		let rss = create({
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

		unwrap(
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
			}),
		);

		let output = unwrap(RSS.stringify(rss));

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
		let rss = unwrap(RSS.parse(FULL_SPEC_XML));

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

		let rss = unwrap(RSS.fromXML(parsed.data));

		expect(rss.channel.title).toBe("Example Feed");
		expect(rss.items[0]?.title).toBe("First Post");
		expect(rss.items[0]?.contentEncoded).toBe("<p>Full content</p>");
	});

	test("parse answers an invalid RSS document with a parse failure", () => {
		let results = [
			RSS.parse("<feed />"),
			RSS.parse('<rss version="2.0"><channel><title>x</title></channel></rss>'),
			RSS.parse(
				'<rss version="2.0"><channel><title>x</title><description>y</description><link>z</link><item><link>z</link></item></channel></rss>',
			),
			RSS.parse("<rss"),
		];

		expect(results.map((result) => isFailure(result) && result.error)).toEqual([
			new RSSParseError('Expected the root element to be "rss".'),
			new RSSParseError("Channel must include title, description, and link."),
			new RSSParseError("Item must include at least a title or description."),
			expect.any(RSSParseError),
		]);
	});

	test("fromJSON refuses plain data whose channel or item misses a requirement", () => {
		let channel = { title: "Feed", description: "Description", link: "https://example.com" };
		let noLink = RSS.fromJSON({ channel: { ...channel, link: "" }, items: [] });
		let emptyItem = RSS.fromJSON({ channel, items: [{ title: "A" }, {} as RSS.Item] });

		expect(isFailure(noLink) && noLink.error.message).toBe(
			"Channel must include title, description, and link.",
		);
		expect(isFailure(emptyItem) && emptyItem.error.message).toBe(
			"Item must include at least a title or description.",
		);
	});

	test("stringify writes plain data in one call, refusing data that misses a requirement", () => {
		let channel = { title: "Feed", description: "Description", link: "https://example.com" };
		let written = RSS.stringify({ channel, items: [{ title: "A" }] });
		let refused = RSS.stringify({ channel, items: [{ title: "A" }, {} as RSS.Item] });

		expect(unwrap(RSS.parse(unwrap(written))).items).toEqual([{ title: "A" }]);
		expect(isFailure(refused) && refused.error).toBeInstanceOf(RSSParseError);
	});

	test("stringify reports a name XML cannot hold as a stringify failure", () => {
		let result = RSS.stringify({
			channel: {
				title: "Feed",
				description: "Description",
				link: "https://example.com",
				extensions: [{ name: "1bad" }],
			},
			items: [],
		});

		expect(isFailure(result) && result.error).toBeInstanceOf(RSSStringifyError);
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

		let rss = unwrap(await RSS.fetch(FEED_URL));

		expect(rss.channel.title).toBe("Example Feed");
		expect(requests).toBe(1);
	});

	test("fetch answers an error status or a response that is not XML with a fetch failure", async () => {
		server.use(
			http.get(FEED_URL, () => new HttpResponse(null, { status: 503 })),
			http.get("https://example.com/page.html", () => HttpResponse.html("<html />")),
		);

		let failed = await RSS.fetch(FEED_URL);
		let html = await RSS.fetch("https://example.com/page.html");

		expect(isFailure(failed) && failed.error).toEqual(
			new RSSFetchError("Failed to fetch RSS feed: 503"),
		);
		expect(isFailure(html) && html.error).toEqual(
			new RSSFetchError('Expected an XML response, received "text/html".'),
		);
	});
});
