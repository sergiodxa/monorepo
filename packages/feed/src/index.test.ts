/**
 * Exercises the façade: that every format sniffs correctly and normalizes to one
 * shape, that a conditional request reports a 304 without parsing, that discovery
 * finds a feed from a page or from the feed URL itself, and that a retrieval holds
 * an origin to the size cap and the redirect limit it is given.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { Feed, FeedLimitError } from "./index.js";

let FEED_URL = "https://example.com/feed.xml";
let JSON_URL = "https://example.com/feed.json";
let PAGE_URL = "https://example.com/";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** The same feed in every format, so normalization can be compared field by field. */
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

let JSON_FEED = JSON.stringify({
	version: "https://jsonfeed.org/version/1.1",
	title: "Example Feed",
	home_page_url: "https://example.com/",
	feed_url: JSON_URL,
	description: "An example",
	language: "en-us",
	icon: "https://example.com/logo.png",
	items: [
		{
			id: "post-1",
			url: "https://example.com/posts/hello",
			title: "Hello World",
			summary: "A short summary",
			content_html: "<p>Full post content</p>",
			authors: [{ name: "Ada Lovelace" }],
			tags: ["greeting"],
			date_published: "2026-04-14T09:00:00Z",
			date_modified: "2026-04-14T11:00:00Z",
			attachments: [
				{
					url: "https://example.com/posts/hello.mp3",
					mime_type: "audio/mpeg",
					size_in_bytes: 12_345,
				},
			],
		},
	],
});

/** Serves a document in pieces and without a length, so only a count over the stream refuses it. */
function streamOf(source: string): ReadableStream<Uint8Array> {
	let bytes = new TextEncoder().encode(source);

	return new ReadableStream({
		start(controller) {
			for (let offset = 0; offset < bytes.length; offset += 8) {
				controller.enqueue(bytes.slice(offset, offset + 8));
			}
			controller.close();
		},
	});
}

/** Each format's document beside the URL it is published at. */
let DOCUMENTS = [
	{ format: "rss", source: RSS_XML, url: FEED_URL },
	{ format: "atom", source: ATOM_XML, url: FEED_URL },
	{ format: "json", source: JSON_FEED, url: JSON_URL },
];

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

	test("sniffs and reads a JSON Feed document", () => {
		let result = Feed.parse(JSON_FEED, { url: JSON_URL });
		expect(isSuccess(result)).toBe(true);
		if (!isSuccess(result)) return;

		expect(result.data.format).toBe("json");
		expect(result.data.title).toBe("Example Feed");
	});

	test("normalizes every format to the same feed-level shape", () => {
		for (let { format, source, url } of DOCUMENTS) {
			let result = Feed.parse(source, { url });
			if (!isSuccess(result)) throw new Error(`expected ${format} to parse`);

			let feed = result.data;
			expect(feed.title).toBe("Example Feed");
			expect(feed.description).toBe("An example");
			expect(feed.siteUrl).toBe("https://example.com/");
			expect(feed.feedUrl).toBe(url);
			expect(feed.language).toBe("en-us");
			expect(feed.imageUrl).toBe("https://example.com/logo.png");
			expect(feed.updatedAt?.toISOString()).toBe("2026-04-14T11:00:00.000Z");
		}
	});

	test("normalizes every format to the same item shape", () => {
		for (let { format, source, url } of DOCUMENTS) {
			let result = Feed.parse(source, { url });
			if (!isSuccess(result)) throw new Error(`expected ${format} to parse`);

			let item = result.data.items[0];
			expect(item?.guid).toBe("post-1");
			expect(item?.title).toBe("Hello World");
			expect(item?.url).toBe("https://example.com/posts/hello");
			expect(item?.summary).toBe("A short summary");
			expect(item?.contentHtml).toBe("<p>Full post content</p>");
			expect(item?.author?.name).toBe("Ada Lovelace");
			expect(item?.categories).toEqual(["greeting"]);
			expect(item?.enclosures).toEqual([
				{ url: "https://example.com/posts/hello.mp3", type: "audio/mpeg", length: 12_345 },
			]);
			expect(item?.publishedAt?.toISOString()).toBe("2026-04-14T09:00:00.000Z");
		}
	});

	test("reads the author's address from the mailbox the XML formats carry", () => {
		for (let source of [RSS_XML, ATOM_XML]) {
			let result = Feed.parse(source, { url: FEED_URL });
			if (!isSuccess(result)) throw new Error("expected a feed");

			expect(result.data.items[0]?.author).toEqual({
				name: "Ada Lovelace",
				email: "ada@example.com",
			});
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

describe("Feed.parse, on a JSON Feed", () => {
	test("keeps a plain-text body apart from an HTML one", () => {
		let result = Feed.parse(
			JSON.stringify({
				version: "https://jsonfeed.org/version/1.1",
				title: "Microblog",
				items: [{ id: "1", content_text: "Cats are neat." }],
			}),
		);

		if (!isSuccess(result)) throw new Error("expected a feed");
		expect(result.data.items[0]?.contentText).toBe("Cats are neat.");
		expect(result.data.items[0]?.contentHtml).toBeUndefined();
	});

	test("falls back to the feed's authors, including the single one 1.0 wrote", () => {
		let result = Feed.parse(
			JSON.stringify({
				version: "https://jsonfeed.org/version/1",
				title: "Old Blog",
				author: { name: "Feed Author", url: "https://example.com/author" },
				items: [{ id: "1", content_text: "Hi" }],
			}),
		);

		if (!isSuccess(result)) throw new Error("expected a feed");
		expect(result.data.items[0]?.author).toEqual({
			name: "Feed Author",
			url: "https://example.com/author",
		});
	});

	test("links an item through its id when the id is a URL, as the format advises", () => {
		let result = Feed.parse(
			JSON.stringify({
				version: "https://jsonfeed.org/version/1.1",
				title: "Blog",
				items: [{ id: "https://example.com/posts/hello", content_text: "Hi" }],
			}),
		);

		if (!isSuccess(result)) throw new Error("expected a feed");
		expect(result.data.items[0]?.url).toBe("https://example.com/posts/hello");
	});

	test("resolves relative links against the document URL", () => {
		let result = Feed.parse(
			JSON.stringify({
				version: "https://jsonfeed.org/version/1.1",
				title: "Blog",
				home_page_url: "/",
				items: [{ id: "1", url: "/posts/one", content_text: "Hi" }],
			}),
			{ url: JSON_URL },
		);

		if (!isSuccess(result)) throw new Error("expected a feed");
		expect(result.data.siteUrl).toBe("https://example.com/");
		expect(result.data.items[0]?.url).toBe("https://example.com/posts/one");
	});

	test("names JSON that declares no feed version", () => {
		let result = Feed.parse(JSON.stringify({ title: "An API response" }));

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.name).toBe("FeedFormatError");
			expect(result.error.message).toBe("Expected a JSON Feed document.");
		}
	});

	test("reports text that opens as JSON and is not", () => {
		let result = Feed.parse("{ not json");

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.name).toBe("FeedParseError");
	});

	test("reads a value that was parsed for some other purpose first", () => {
		let result = Feed.fromJSON(JSON.parse(JSON_FEED), { url: JSON_URL });

		if (!isSuccess(result)) throw new Error("expected a feed");
		expect(result.data.format).toBe("json");
		expect(result.data.items[0]?.guid).toBe("post-1");
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

	test("retrieves a JSON Feed under the media type the format defines", async () => {
		server.use(
			http.get(JSON_URL, () =>
				HttpResponse.text(JSON_FEED, { headers: { "content-type": "application/feed+json" } }),
			),
		);

		let result = await Feed.fetch(JSON_URL);
		if (!isSuccess(result) || result.data.notModified) throw new Error("expected a feed");

		expect(result.data.feed.format).toBe("json");
		expect(result.data.feed.title).toBe("Example Feed");
	});

	test("reports a transport failure rather than throwing", async () => {
		server.use(http.get(FEED_URL, () => HttpResponse.error()));

		let result = await Feed.fetch(FEED_URL);
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.name).toBe("FeedFetchError");
	});

	test("reads a document that fits under the cap", async () => {
		server.use(http.get(FEED_URL, () => HttpResponse.text(RSS_XML)));

		let result = await Feed.fetch(FEED_URL, { maxBytes: RSS_XML.length });
		if (!isSuccess(result) || result.data.notModified) throw new Error("expected a feed");

		expect(result.data.feed.title).toBe("Example Feed");
	});

	test("refuses a body that grows past the cap as it arrives", async () => {
		server.use(http.get(FEED_URL, () => new HttpResponse(streamOf(RSS_XML))));

		let result = await Feed.fetch(FEED_URL, { maxBytes: 16 });
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error).toBeInstanceOf(FeedLimitError);
			expect(result.error.message).toContain("exceeded the 16 byte cap");
		}
	});

	test("refuses an oversized Content-Length without reading the body", async () => {
		server.use(
			http.get(FEED_URL, () =>
				HttpResponse.text(RSS_XML, { headers: { "content-length": "20000000" } }),
			),
		);

		let result = await Feed.fetch(FEED_URL);
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error).toBeInstanceOf(FeedLimitError);
			expect(result.error.message).toContain("declared 20000000 bytes");
		}
	});

	test("follows a chain within the limit and reports where it ended", async () => {
		server.use(
			http.get(
				PAGE_URL,
				() => new HttpResponse(null, { status: 301, headers: { location: "/feed" } }),
			),
			http.get("https://example.com/feed", () => HttpResponse.redirect(FEED_URL, 302)),
			http.get(FEED_URL, () => HttpResponse.text(RSS_XML)),
		);

		let result = await Feed.fetch(PAGE_URL, { maxRedirects: 2 });
		if (!isSuccess(result) || result.data.notModified) throw new Error("expected a feed");

		expect(result.data.url).toBe(FEED_URL);
		expect(result.data.feed.title).toBe("Example Feed");
	});

	test("refuses a chain past the limit", async () => {
		server.use(
			http.get(/https:\/\/example\.com\/hop\/\d+/, ({ request }) => {
				let hop = Number(new URL(request.url).pathname.split("/").at(-1));
				return HttpResponse.redirect(`https://example.com/hop/${hop + 1}`, 302);
			}),
		);

		let result = await Feed.fetch("https://example.com/hop/1", { maxRedirects: 3 });
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error).toBeInstanceOf(FeedLimitError);
			expect(result.error.message).toContain("more than 3 redirects");
		}
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

	test("finds the JSON Feed a page advertises", async () => {
		server.use(
			http.get(PAGE_URL, () =>
				HttpResponse.html(
					`<html><head>
						<link rel="alternate" type="application/feed+json" title="JSON" href="/feed.json">
					</head></html>`,
				),
			),
		);

		let result = await Feed.discover(PAGE_URL);
		if (!isSuccess(result)) throw new Error("expected a discovery");

		expect(result.data).toEqual([{ url: JSON_URL, type: "application/feed+json", title: "JSON" }]);
	});

	test("prefers the JSON Feed media type over the generic one", async () => {
		server.use(
			http.get(PAGE_URL, () =>
				HttpResponse.html(
					`<html><head>
						<link rel="alternate" type="application/json" href="/other.json">
						<link rel="alternate" type="application/feed+json" href="/feed.json">
					</head></html>`,
				),
			),
		);

		let result = await Feed.discover(PAGE_URL);
		if (!isSuccess(result)) throw new Error("expected a discovery");

		expect(result.data).toEqual([{ url: JSON_URL, type: "application/feed+json" }]);
	});

	test("accepts the generic JSON type when a page names no better-typed feed", async () => {
		server.use(
			http.get(PAGE_URL, () =>
				HttpResponse.html(
					`<html><head>
						<link rel="alternate" type="application/json" href="/feed.json">
					</head></html>`,
				),
			),
		);

		let result = await Feed.discover(PAGE_URL);
		if (!isSuccess(result)) throw new Error("expected a discovery");

		expect(result.data).toEqual([{ url: JSON_URL, type: "application/json" }]);
	});

	test("treats a URL that is already a JSON Feed as the answer", async () => {
		server.use(http.get(JSON_URL, () => HttpResponse.text(JSON_FEED)));

		let result = await Feed.discover(JSON_URL);
		if (!isSuccess(result)) throw new Error("expected a discovery");

		expect(result.data).toEqual([{ url: JSON_URL, type: "application/feed+json" }]);
	});

	test("finds nothing at a URL serving JSON that is not a feed", async () => {
		server.use(http.get(JSON_URL, () => HttpResponse.json({ ok: true })));

		let result = await Feed.discover(JSON_URL);
		if (!isSuccess(result)) throw new Error("expected a discovery");

		expect(result.data).toEqual([]);
	});

	test("finds nothing on a page that advertises nothing", async () => {
		server.use(http.get(PAGE_URL, () => HttpResponse.html(`<html><body>Hello</body></html>`)));

		let result = await Feed.discover(PAGE_URL);
		if (!isSuccess(result)) throw new Error("expected a discovery");
		expect(result.data).toEqual([]);
	});

	test("reports the URL a followed chain ended at, which is the feed's identity", async () => {
		server.use(
			http.get(
				PAGE_URL,
				() => new HttpResponse(null, { status: 301, headers: { location: "/feed" } }),
			),
			http.get("https://example.com/feed", () => HttpResponse.redirect(FEED_URL, 302)),
			http.get(FEED_URL, () => HttpResponse.text(RSS_XML)),
		);

		let result = await Feed.discover(PAGE_URL);
		if (!isSuccess(result)) throw new Error("expected a discovery");

		expect(result.data).toEqual([{ url: FEED_URL, type: "application/rss+xml" }]);
	});

	test("refuses a chain past the limit", async () => {
		server.use(
			http.get(/https:\/\/example\.com\/hop\/\d+/, ({ request }) => {
				let hop = Number(new URL(request.url).pathname.split("/").at(-1));
				return HttpResponse.redirect(`https://example.com/hop/${hop + 1}`, 302);
			}),
		);

		let result = await Feed.discover("https://example.com/hop/1");
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(FeedLimitError);
	});

	test("refuses a page that grows past the cap as it arrives", async () => {
		server.use(http.get(PAGE_URL, () => new HttpResponse(streamOf("<html></html>"))));

		let result = await Feed.discover(PAGE_URL, { maxBytes: 4 });
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(FeedLimitError);
	});
});
