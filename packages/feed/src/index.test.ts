/**
 * Exercises the façade: that both formats sniff correctly and normalize to one
 * shape, that a conditional request reports a 304 without parsing, and that
 * discovery finds a feed from a page or from the feed URL itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { Feed } from "./index.js";

let FEED_URL = "https://example.com/feed.xml";
let PAGE_URL = "https://example.com/";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** The same feed in both formats, so normalization can be compared field by field. */
let RSS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
	<channel>
		<title>Example Feed</title>
		<link>https://example.com</link>
		<description>An example</description>
		<language>en-us</language>
		<lastBuildDate>Tue, 14 Apr 2026 11:00:00 GMT</lastBuildDate>
		<atom:link href="https://example.com/feed.xml" rel="self" type="application/rss+xml"/>
		<image>
			<url>https://example.com/logo.png</url>
			<title>Example Feed</title>
			<link>https://example.com</link>
		</image>
		<item>
			<guid isPermaLink="false">post-1</guid>
			<title>Hello World</title>
			<link>https://example.com/posts/hello</link>
			<description>A short summary</description>
			<content:encoded>&lt;p&gt;Full post content&lt;/p&gt;</content:encoded>
			<author>ada@example.com (Ada Lovelace)</author>
			<category>greeting</category>
			<pubDate>Tue, 14 Apr 2026 09:00:00 GMT</pubDate>
			<enclosure url="https://example.com/posts/hello.mp3" length="12345" type="audio/mpeg"/>
		</item>
	</channel>
</rss>`;

let ATOM_XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en-us">
	<id>https://example.com</id>
	<title>Example Feed</title>
	<subtitle>An example</subtitle>
	<updated>2026-04-14T11:00:00Z</updated>
	<logo>https://example.com/logo.png</logo>
	<link href="https://example.com" rel="alternate" type="text/html"/>
	<link href="https://example.com/feed.xml" rel="self" type="application/atom+xml"/>
	<entry>
		<id>post-1</id>
		<title>Hello World</title>
		<updated>2026-04-14T09:00:00Z</updated>
		<published>2026-04-14T09:00:00Z</published>
		<summary>A short summary</summary>
		<content type="html">&lt;p&gt;Full post content&lt;/p&gt;</content>
		<author><name>Ada Lovelace</name><email>ada@example.com</email></author>
		<category term="greeting"/>
		<link href="https://example.com/posts/hello" rel="alternate" type="text/html"/>
		<link href="https://example.com/posts/hello.mp3" rel="enclosure" type="audio/mpeg" length="12345"/>
	</entry>
</feed>`;

describe("Feed.parse", () => {
	test("sniffs and reads an RSS document", () => {
		let result = Feed.parse(RSS_XML, { url: FEED_URL });
		expect(isSuccess(result)).toBe(true);
		if (!isSuccess(result)) return;

		expect(result.data.format).toBe("rss");
		expect(result.data.title).toBe("Example Feed");
	});

	test("sniffs and reads an Atom document", () => {
		let result = Feed.parse(ATOM_XML, { url: FEED_URL });
		expect(isSuccess(result)).toBe(true);
		if (!isSuccess(result)) return;

		expect(result.data.format).toBe("atom");
		expect(result.data.title).toBe("Example Feed");
	});

	test("normalizes both formats to the same feed-level shape", () => {
		let rss = Feed.parse(RSS_XML, { url: FEED_URL });
		let atom = Feed.parse(ATOM_XML, { url: FEED_URL });
		if (!isSuccess(rss) || !isSuccess(atom)) throw new Error("expected both to parse");

		for (let feed of [rss.data, atom.data]) {
			expect(feed.title).toBe("Example Feed");
			expect(feed.description).toBe("An example");
			expect(feed.siteUrl).toBe("https://example.com/");
			expect(feed.feedUrl).toBe("https://example.com/feed.xml");
			expect(feed.language).toBe("en-us");
			expect(feed.imageUrl).toBe("https://example.com/logo.png");
		}
	});

	test("normalizes both formats to the same item shape", () => {
		let rss = Feed.parse(RSS_XML, { url: FEED_URL });
		let atom = Feed.parse(ATOM_XML, { url: FEED_URL });
		if (!isSuccess(rss) || !isSuccess(atom)) throw new Error("expected both to parse");

		for (let feed of [rss.data, atom.data]) {
			let item = feed.items[0];
			expect(item?.guid).toBe("post-1");
			expect(item?.title).toBe("Hello World");
			expect(item?.url).toBe("https://example.com/posts/hello");
			expect(item?.summary).toBe("A short summary");
			expect(item?.contentHtml).toBe("<p>Full post content</p>");
			expect(item?.author).toEqual({ name: "Ada Lovelace", email: "ada@example.com" });
			expect(item?.categories).toEqual(["greeting"]);
			expect(item?.enclosures).toEqual([
				{ url: "https://example.com/posts/hello.mp3", type: "audio/mpeg", length: 12_345 },
			]);
			expect(item?.publishedAt?.toISOString()).toBe("2026-04-14T09:00:00.000Z");
		}
	});

	test("reads dates as Date objects", () => {
		let result = Feed.parse(RSS_XML, { url: FEED_URL });
		if (!isSuccess(result)) throw new Error("expected a feed");

		expect(result.data.updatedAt).toBeInstanceOf(Date);
		expect(result.data.updatedAt?.toISOString()).toBe("2026-04-14T11:00:00.000Z");
	});

	test("reports an unparseable date as absent rather than an invalid Date", () => {
		let result = Feed.parse(
			`<rss version="2.0"><channel><title>T</title><link>https://e.test</link>
				<description>D</description>
				<item><title>I</title><pubDate>not a date</pubDate></item>
			</channel></rss>`,
		);

		if (!isSuccess(result)) throw new Error("expected a feed");
		expect(result.data.items[0]?.publishedAt).toBeUndefined();
	});

	test("resolves relative links against the document URL", () => {
		let result = Feed.parse(
			`<feed xmlns="http://www.w3.org/2005/Atom">
				<id>urn:1</id><title>T</title><updated>2026-04-14T00:00:00Z</updated>
				<entry><id>urn:2</id><title>E</title><updated>2026-04-14T00:00:00Z</updated>
					<link href="/posts/one"/></entry>
			</feed>`,
			{ url: "https://example.com/feed.xml" },
		);

		if (!isSuccess(result)) throw new Error("expected a feed");
		expect(result.data.items[0]?.url).toBe("https://example.com/posts/one");
	});

	test("falls back through the author chain an entry leaves open", () => {
		let result = Feed.parse(
			`<feed xmlns="http://www.w3.org/2005/Atom">
				<id>urn:1</id><title>T</title><updated>2026-04-14T00:00:00Z</updated>
				<author><name>Feed Author</name></author>
				<entry><id>urn:2</id><title>E</title><updated>2026-04-14T00:00:00Z</updated></entry>
			</feed>`,
		);

		if (!isSuccess(result)) throw new Error("expected a feed");
		expect(result.data.items[0]?.author).toEqual({ name: "Feed Author" });
	});

	test("drops a later item repeating an earlier guid", () => {
		let result = Feed.parse(
			`<rss version="2.0"><channel><title>T</title><link>https://e.test</link>
				<description>D</description>
				<item><guid>a</guid><title>First</title></item>
				<item><guid>a</guid><title>Repeat</title></item>
				<item><guid>b</guid><title>Second</title></item>
			</channel></rss>`,
		);

		if (!isSuccess(result)) throw new Error("expected a feed");
		expect(result.data.items.map((item) => item.title)).toEqual(["First", "Second"]);
	});

	test("names RSS 1.0 rather than reporting a parse failure", () => {
		let result = Feed.parse(
			`<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><channel/></rdf:RDF>`,
		);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.message).toBe("RSS 1.0 (RDF) feeds are not supported.");
		}
	});

	test("names the root element of a document that is not a feed", () => {
		let result = Feed.parse(`<html><body/></html>`);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.message).toBe(`Expected an RSS or Atom document, found "html".`);
		}
	});
});

describe("Feed.fetch", () => {
	test("returns the feed and the validators to store", async () => {
		server.use(
			http.get(FEED_URL, () =>
				HttpResponse.text(RSS_XML, {
					headers: {
						"content-type": "application/rss+xml",
						etag: `"abc"`,
						"last-modified": "Tue, 14 Apr 2026 11:00:00 GMT",
					},
				}),
			),
		);

		let result = await Feed.fetch(FEED_URL);
		expect(isSuccess(result)).toBe(true);
		if (!isSuccess(result)) return;
		if (result.data.notModified) throw new Error("expected a document");

		expect(result.data.feed.title).toBe("Example Feed");
		expect(result.data.etag).toBe(`"abc"`);
		expect(result.data.lastModified).toBe("Tue, 14 Apr 2026 11:00:00 GMT");
	});

	test("sends the stored validators as preconditions", async () => {
		let seen: Record<string, string | null> = {};
		server.use(
			http.get(FEED_URL, ({ request }) => {
				seen["if-none-match"] = request.headers.get("if-none-match");
				seen["if-modified-since"] = request.headers.get("if-modified-since");
				return new HttpResponse(null, { status: 304 });
			}),
		);

		await Feed.fetch(FEED_URL, { etag: `"abc"`, lastModified: "Tue, 14 Apr 2026 11:00:00 GMT" });

		expect(seen["if-none-match"]).toBe(`"abc"`);
		expect(seen["if-modified-since"]).toBe("Tue, 14 Apr 2026 11:00:00 GMT");
	});

	test("never asks the origin to skip its cache, which would defeat the precondition", async () => {
		let cacheControl: string | null = "unset";
		server.use(
			http.get(FEED_URL, ({ request }) => {
				cacheControl = request.headers.get("cache-control");
				return HttpResponse.text(RSS_XML);
			}),
		);

		await Feed.fetch(FEED_URL);
		expect(cacheControl).toBeNull();
	});

	test("reports a 304 without a feed and carries the validators forward", async () => {
		server.use(http.get(FEED_URL, () => new HttpResponse(null, { status: 304 })));

		let result = await Feed.fetch(FEED_URL, { etag: `"abc"` });
		if (!isSuccess(result)) throw new Error("expected a result");

		expect(result.data.notModified).toBe(true);
		expect(result.data.feed).toBeUndefined();
		expect(result.data.status).toBe(304);
		expect(result.data.etag).toBe(`"abc"`);
	});

	test("accepts a feed served under any content type", async () => {
		server.use(
			http.get(FEED_URL, () =>
				HttpResponse.text(ATOM_XML, { headers: { "content-type": "application/octet-stream" } }),
			),
		);

		let result = await Feed.fetch(FEED_URL);
		expect(isSuccess(result)).toBe(true);
	});

	test("reports an error status rather than throwing", async () => {
		server.use(http.get(FEED_URL, () => new HttpResponse(null, { status: 500 })));

		let result = await Feed.fetch(FEED_URL);
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).toBe("Failed to fetch feed: 500");
	});

	test("reports a transport failure rather than throwing", async () => {
		server.use(http.get(FEED_URL, () => HttpResponse.error()));

		let result = await Feed.fetch(FEED_URL);
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.name).toBe("FeedFetchError");
	});
});

describe("Feed.discover", () => {
	test("finds the feed a page advertises", async () => {
		server.use(
			http.get(PAGE_URL, () =>
				HttpResponse.html(
					`<html><head>
						<link rel="alternate" type="application/rss+xml" title="Main" href="/feed.xml">
					</head><body>Hello</body></html>`,
				),
			),
		);

		let result = await Feed.discover(PAGE_URL);
		expect(isSuccess(result)).toBe(true);
		if (!isSuccess(result)) return;

		expect(result.data).toEqual([
			{ url: "https://example.com/feed.xml", type: "application/rss+xml", title: "Main" },
		]);
	});

	test("resolves a discovered href against a declared base", async () => {
		server.use(
			http.get(PAGE_URL, () =>
				HttpResponse.html(
					`<html><head>
						<base href="https://cdn.example.com/site/">
						<link rel="alternate" type="application/atom+xml" href="atom.xml">
					</head></html>`,
				),
			),
		);

		let result = await Feed.discover(PAGE_URL);
		if (!isSuccess(result)) throw new Error("expected a discovery");

		expect(result.data[0]?.url).toBe("https://cdn.example.com/site/atom.xml");
	});

	test("treats a URL that is already a feed as the answer, with no second request", async () => {
		let requests = 0;
		server.use(
			http.get(FEED_URL, () => {
				requests += 1;
				return HttpResponse.text(RSS_XML);
			}),
		);

		let result = await Feed.discover(FEED_URL);
		if (!isSuccess(result)) throw new Error("expected a discovery");

		expect(result.data).toEqual([{ url: FEED_URL, type: "application/rss+xml" }]);
		expect(requests).toBe(1);
	});

	test("ignores a link that is not a syndication type", async () => {
		server.use(
			http.get(PAGE_URL, () =>
				HttpResponse.html(
					`<html><head>
						<link rel="alternate" type="application/xml" href="/sitemap.xml">
						<link rel="stylesheet" href="/style.css">
						<link rel="alternate" type="application/rss+xml" href="/feed.xml">
					</head></html>`,
				),
			),
		);

		let result = await Feed.discover(PAGE_URL);
		if (!isSuccess(result)) throw new Error("expected a discovery");

		expect(result.data).toEqual([
			{ url: "https://example.com/feed.xml", type: "application/rss+xml" },
		]);
	});

	test("finds nothing on a page that advertises nothing", async () => {
		server.use(http.get(PAGE_URL, () => HttpResponse.html(`<html><body>Hello</body></html>`)));

		let result = await Feed.discover(PAGE_URL);
		if (!isSuccess(result)) throw new Error("expected a discovery");
		expect(result.data).toEqual([]);
	});
});
