/**
 * Exercises the `Atom` class against RFC 4287: the required elements, the three
 * text construct types, `xml:base` resolution, foreign extensions, and retrieval.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { Atom } from "./index.js";

let FEED_URL = "https://example.com/feed.xml";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let FULL_SPEC_XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/" xml:lang="en-us">
	<id>tag:example.com,2026:feed</id>
	<title>Example Feed</title>
	<subtitle type="html">A &lt;em&gt;full&lt;/em&gt; example</subtitle>
	<updated>2026-04-14T11:00:00Z</updated>
	<rights>Copyright 2026 Example</rights>
	<author><name>Ada Lovelace</name><uri>https://example.com/ada</uri><email>ada@example.com</email></author>
	<contributor><name>Grace Hopper</name></contributor>
	<link href="https://example.com/" rel="alternate" type="text/html"/>
	<link href="https://example.com/feed.xml" rel="self" type="application/atom+xml"/>
	<category term="news"/>
	<category term="ai" scheme="https://example.com/schemes" label="Artificial Intelligence"/>
	<generator uri="https://example.com/gen" version="1.0">Unit Test</generator>
	<icon>https://example.com/icon.png</icon>
	<logo>https://example.com/logo.png</logo>
	<media:rating scheme="urn:simple">adult</media:rating>
	<entry>
		<id>tag:example.com,2026:post-1</id>
		<title>Hello World</title>
		<updated>2026-04-14T10:30:00Z</updated>
		<published>2026-04-14T09:00:00Z</published>
		<summary>A short summary</summary>
		<content type="html">&lt;p&gt;Full post content&lt;/p&gt;</content>
		<author><name>Ada Lovelace</name></author>
		<link href="https://example.com/posts/hello" rel="alternate" type="text/html"/>
		<link href="https://example.com/posts/hello.mp3" rel="enclosure" type="audio/mpeg" length="12345"/>
		<category term="greeting"/>
		<rights>CC BY 4.0</rights>
	</entry>
	<entry>
		<id>tag:example.com,2026:post-2</id>
		<title type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml">A <em>marked up</em> title</div></title>
		<updated>2026-04-13T10:30:00Z</updated>
		<content type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml"><p>Body &amp; more</p></div></content>
	</entry>
</feed>`;

describe("Atom.parse", () => {
	test("reads every feed-level construct", () => {
		let result = Atom.parse(FULL_SPEC_XML);
		expect(isSuccess(result)).toBe(true);
		if (!isSuccess(result)) return;

		let feed = result.data.feed;
		expect(feed.id).toBe("tag:example.com,2026:feed");
		expect(feed.title).toBe("Example Feed");
		expect(feed.updated).toBe("2026-04-14T11:00:00Z");
		expect(feed.subtitle).toEqual({ value: "A <em>full</em> example", type: "html" });
		expect(feed.rights).toBe("Copyright 2026 Example");
		expect(feed.lang).toBe("en-us");
		expect(feed.icon).toBe("https://example.com/icon.png");
		expect(feed.logo).toBe("https://example.com/logo.png");
		expect(feed.generator).toEqual({
			value: "Unit Test",
			uri: "https://example.com/gen",
			version: "1.0",
		});
	});

	test("keeps every link with its relation rather than choosing one", () => {
		let result = Atom.parse(FULL_SPEC_XML);
		if (!isSuccess(result)) throw new Error("expected a feed");

		expect(result.data.feed.link).toEqual([
			{ href: "https://example.com/", rel: "alternate", type: "text/html" },
			{ href: "https://example.com/feed.xml", rel: "self", type: "application/atom+xml" },
		]);
	});

	test("collapses a bare category to its term and keeps a described one whole", () => {
		let result = Atom.parse(FULL_SPEC_XML);
		if (!isSuccess(result)) throw new Error("expected a feed");

		expect(result.data.feed.category).toEqual([
			"news",
			{ term: "ai", scheme: "https://example.com/schemes", label: "Artificial Intelligence" },
		]);
	});

	test("reads a person construct whole", () => {
		let result = Atom.parse(FULL_SPEC_XML);
		if (!isSuccess(result)) throw new Error("expected a feed");

		expect(result.data.feed.author).toEqual({
			name: "Ada Lovelace",
			uri: "https://example.com/ada",
			email: "ada@example.com",
		});
		expect(result.data.feed.contributor).toEqual({ name: "Grace Hopper" });
	});

	test("preserves a foreign element the parser does not model", () => {
		let result = Atom.parse(FULL_SPEC_XML);
		if (!isSuccess(result)) throw new Error("expected a feed");

		expect(result.data.feed.extensions).toEqual([
			{
				name: "media:rating",
				attributes: { scheme: "urn:simple" },
				children: ["adult"],
			},
		]);
		expect(result.data.feed.namespaces).toEqual({
			"": "http://www.w3.org/2005/Atom",
			media: "http://search.yahoo.com/mrss/",
		});
	});

	test("reads entries in document order with their own constructs", () => {
		let result = Atom.parse(FULL_SPEC_XML);
		if (!isSuccess(result)) throw new Error("expected a feed");

		let entries = result.data.entries;
		expect(entries).toHaveLength(2);

		expect(entries[0]?.id).toBe("tag:example.com,2026:post-1");
		expect(entries[0]?.title).toBe("Hello World");
		expect(entries[0]?.published).toBe("2026-04-14T09:00:00Z");
		expect(entries[0]?.summary).toBe("A short summary");
		expect(entries[0]?.content).toEqual({ type: "html", value: "<p>Full post content</p>" });
		expect(entries[0]?.rights).toBe("CC BY 4.0");
	});

	test("serializes an xhtml construct's wrapper contents, not the wrapper", () => {
		let result = Atom.parse(FULL_SPEC_XML);
		if (!isSuccess(result)) throw new Error("expected a feed");

		expect(result.data.entries[1]?.title).toEqual({
			value: "A <em>marked up</em> title",
			type: "xhtml",
		});
		expect(result.data.entries[1]?.content).toEqual({
			type: "xhtml",
			value: "<p>Body &amp; more</p>",
		});
	});

	test("reads an enclosure link's length as a number", () => {
		let result = Atom.parse(FULL_SPEC_XML);
		if (!isSuccess(result)) throw new Error("expected a feed");

		let links = result.data.entries[0]?.link;
		expect(Array.isArray(links) && links[1]).toEqual({
			href: "https://example.com/posts/hello.mp3",
			rel: "enclosure",
			type: "audio/mpeg",
			length: 12_345,
		});
	});
});

describe("Atom.parse namespaces", () => {
	test("accepts a document that binds Atom to a prefix", () => {
		let result = Atom.parse(
			`<a:feed xmlns:a="http://www.w3.org/2005/Atom">
				<a:id>urn:1</a:id><a:title>Prefixed</a:title><a:updated>2026-04-14T00:00:00Z</a:updated>
				<a:entry><a:id>urn:2</a:id><a:title>Entry</a:title><a:updated>2026-04-14T00:00:00Z</a:updated></a:entry>
			</a:feed>`,
		);

		expect(isSuccess(result)).toBe(true);
		if (!isSuccess(result)) return;
		expect(result.data.feed.title).toBe("Prefixed");
		expect(result.data.entries[0]?.id).toBe("urn:2");
	});

	test("refuses a feed element bound to another namespace", () => {
		let result = Atom.parse(`<feed xmlns="http://example.com/not-atom"><id>urn:1</id></feed>`);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.message).toBe("Expected the root element in the Atom namespace.");
		}
	});

	test("refuses a document rooted at something other than feed", () => {
		let result = Atom.parse(`<rss version="2.0"><channel/></rss>`);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.message).toBe(`Expected the root element to be "feed".`);
		}
	});
});

describe("Atom.parse xml:base", () => {
	test("resolves relative references against the document URI", () => {
		let result = Atom.parse(
			`<feed xmlns="http://www.w3.org/2005/Atom">
				<id>urn:1</id><title>T</title><updated>2026-04-14T00:00:00Z</updated>
				<link href="/home"/>
				<entry><id>urn:2</id><title>E</title><updated>2026-04-14T00:00:00Z</updated>
					<link href="posts/one"/></entry>
			</feed>`,
			"https://example.com/feeds/atom.xml",
		);

		if (!isSuccess(result)) throw new Error("expected a feed");
		expect(result.data.feed.link).toEqual({ href: "https://example.com/home" });
		expect(result.data.entries[0]?.link).toEqual({
			href: "https://example.com/feeds/posts/one",
		});
	});

	test("composes a relative xml:base with the one enclosing it", () => {
		let result = Atom.parse(
			`<feed xmlns="http://www.w3.org/2005/Atom" xml:base="https://example.com/blog/">
				<id>urn:1</id><title>T</title><updated>2026-04-14T00:00:00Z</updated>
				<entry xml:base="2026/"><id>urn:2</id><title>E</title><updated>2026-04-14T00:00:00Z</updated>
					<link href="post.html"/></entry>
			</feed>`,
		);

		if (!isSuccess(result)) throw new Error("expected a feed");
		expect(result.data.entries[0]?.link).toEqual({
			href: "https://example.com/blog/2026/post.html",
		});
	});

	test("keeps a relative reference when no base is in scope", () => {
		let result = Atom.parse(
			`<feed xmlns="http://www.w3.org/2005/Atom">
				<id>urn:1</id><title>T</title><updated>2026-04-14T00:00:00Z</updated>
				<link href="/home"/>
			</feed>`,
		);

		if (!isSuccess(result)) throw new Error("expected a feed");
		expect(result.data.feed.link).toEqual({ href: "/home" });
	});
});

describe("Atom.parse required elements", () => {
	test("refuses a feed with no id", () => {
		let result = Atom.parse(
			`<feed xmlns="http://www.w3.org/2005/Atom"><title>T</title><updated>2026-04-14T00:00:00Z</updated></feed>`,
		);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).toBe("Feed must include an id.");
	});

	test("refuses an entry with no updated timestamp", () => {
		let result = Atom.parse(
			`<feed xmlns="http://www.w3.org/2005/Atom">
				<id>urn:1</id><title>T</title><updated>2026-04-14T00:00:00Z</updated>
				<entry><id>urn:2</id><title>E</title></entry>
			</feed>`,
		);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.message).toBe("Entry must include an updated timestamp.");
		}
	});

	test("reports malformed XML as a parse failure", () => {
		let result = Atom.parse(`<feed xmlns="http://www.w3.org/2005/Atom"><id>urn:1</id>`);
		expect(isFailure(result)).toBe(true);
	});
});

describe("Atom instance", () => {
	let feed = {
		id: "urn:feed",
		title: "Built",
		updated: "2026-04-14T00:00:00Z",
	};

	test("hands out clones rather than its own state", () => {
		let atom = new Atom({ ...feed, author: { name: "Ada" } });
		let read = atom.feed;
		if (!Array.isArray(read.author) && read.author) read.author.name = "Someone else";

		expect(atom.feed.author).toEqual({ name: "Ada" });
	});

	test("removes an entry by id and ignores an id it does not hold", () => {
		let atom = new Atom(feed);
		atom.addEntry({ id: "urn:a", title: "A", updated: "2026-04-14T00:00:00Z" });
		atom.addEntry({ id: "urn:b", title: "B", updated: "2026-04-14T00:00:00Z" });

		atom.removeEntry("urn:a");
		atom.removeEntry("urn:missing");

		expect(atom.entries.map((entry) => entry.id)).toEqual(["urn:b"]);
	});

	test("refuses an entry missing a required element", () => {
		let atom = new Atom(feed);
		expect(() => atom.addEntry({ id: "", title: "A", updated: "x" })).toThrow(
			"Entry must include an id.",
		);
	});

	test("round-trips a document through serialization", () => {
		let parsed = Atom.parse(FULL_SPEC_XML);
		if (!isSuccess(parsed)) throw new Error("expected a feed");

		let reparsed = Atom.parse(parsed.data.toString());
		if (!isSuccess(reparsed)) throw new Error("expected the serialized feed to parse");

		expect(reparsed.data.feed.id).toBe(parsed.data.feed.id);
		expect(reparsed.data.feed.title).toBe("Example Feed");
		expect(reparsed.data.entries).toHaveLength(2);
		expect(reparsed.data.entries[0]?.content).toEqual({
			type: "html",
			value: "<p>Full post content</p>",
		});
	});

	test("declares the Atom namespace on the root it writes", () => {
		let atom = new Atom(feed);
		expect(atom.toString()).toContain(`xmlns="http://www.w3.org/2005/Atom"`);
	});
});

describe("Atom.fetch", () => {
	test("retrieves and parses a feed", async () => {
		server.use(
			http.get(FEED_URL, () =>
				HttpResponse.text(FULL_SPEC_XML, {
					headers: { "content-type": "application/atom+xml" },
				}),
			),
		);

		let result = await Atom.fetch(new URL(FEED_URL));
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data.feed.title).toBe("Example Feed");
	});

	test("accepts a feed served under any content type", async () => {
		server.use(
			http.get(FEED_URL, () =>
				HttpResponse.text(FULL_SPEC_XML, {
					headers: { "content-type": "application/octet-stream" },
				}),
			),
		);

		let result = await Atom.fetch(new URL(FEED_URL));
		expect(isSuccess(result)).toBe(true);
	});

	test("reports a error status rather than throwing", async () => {
		server.use(http.get(FEED_URL, () => new HttpResponse(null, { status: 404 })));

		let result = await Atom.fetch(new URL(FEED_URL));
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).toBe("Failed to fetch Atom feed: 404");
	});

	test("reports a transport failure rather than throwing", async () => {
		server.use(http.get(FEED_URL, () => HttpResponse.error()));

		let result = await Atom.fetch(new URL(FEED_URL));
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.name).toBe("AtomFetchError");
	});
});
