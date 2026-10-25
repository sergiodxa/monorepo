/**
 * Normalizes RFC 5005 Feed Paging and Archiving out of every format, using the
 * specification's own examples: `complete` and `archive` from the `fh:` markers, and the
 * paging and archive addresses from each format's relations.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { Feed } from "./index.js";

/** RFC 5005 §2, "Atom-formatted Complete Feed". */
let ATOM_COMPLETE = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
 xmlns:fh="http://purl.org/syndication/history/1.0">
 <title>NetMovies Queue</title>
 <subtitle>The DVDs you'll receive next.</subtitle>
 <link href="http://example.org/"/>
 <fh:complete/>
 <link rel="self"
  href="http://netmovies.example.org/jdoe/queue/index.atom"/>
 <updated>2003-12-13T18:30:02Z</updated>
 <author>
   <name>John Doe</name>
 </author>
 <id>urn:uuid:60a76c80-d399-11d9-b93C-0003939e0af6</id>
 <entry>
   <title>Casablanca</title>
   <link href="http://netmovies.example.org/movies/Casablanca"/>
   <id>urn:uuid:1225c695-cfb8-4ebb-aaaa-80da344efa6a</id>
   <updated>2003-12-13T18:30:02Z</updated>
   <summary>Here's looking at you, kid...</summary>
 </entry>
</feed>`;

/** RFC 5005 §3, "Atom-formatted Paged Feed". */
let ATOM_PAGED = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
 <title>Example Feed</title>
 <link href="http://example.org/"/>
 <link rel="self" href="http://example.org/index.atom"/>
 <link rel="next" href="http://example.org/index.atom?page=2"/>
 <updated>2003-12-13T18:30:02Z</updated>
 <author>
   <name>John Doe</name>
 </author>
 <id>urn:uuid:60a76c80-d399-11d9-b93C-0003939e0af6</id>
 <entry>
   <title>Atom-Powered Robots Run Amok</title>
   <link href="http://example.org/2003/12/13/atom03"/>
   <id>urn:uuid:1225c695-cfb8-4ebb-aaaa-80da344efa6a</id>
   <updated>2003-12-13T18:30:02Z</updated>
   <summary>Some text.</summary>
 </entry>
</feed>`;

/** RFC 5005 §4, "Atom-formatted Subscription Document". */
let ATOM_SUBSCRIPTION = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
 <title>Example Feed</title>
 <link href="http://example.org/"/>
 <link rel="self" href="http://example.org/index.atom"/>
 <link rel="prev-archive"
  href="http://example.org/2003/11/index.atom"/>
 <updated>2003-12-13T18:30:02Z</updated>
 <author>
   <name>John Doe</name>
 </author>
 <id>urn:uuid:60a76c80-d399-11d9-b93C-0003939e0af6</id>
 <entry>
   <title>Atom-Powered Robots Run Amok</title>
   <link href="http://example.org/2003/12/13/atom03"/>
   <id>urn:uuid:1225c695-cfb8-4ebb-aaaa-80da344efa6a</id>
   <updated>2003-12-13T18:30:02Z</updated>
   <summary>Some text.</summary>
 </entry>
</feed>`;

/** RFC 5005 §4, "Atom-formatted Archive Document". */
let ATOM_ARCHIVE = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
 xmlns:fh="http://purl.org/syndication/history/1.0">
 <title>Example Feed</title>
 <link rel="current" href="http://example.org/index.atom"/>
 <link rel="self" href="http://example.org/2003/11/index.atom"/>
 <fh:archive/>
 <link rel="prev-archive"
  href="http://example.org/2003/10/index.atom"/>
 <updated>2003-11-24T12:00:00Z</updated>
 <author>
   <name>John Doe</name>
 </author>
 <id>urn:uuid:60a76c80-d399-11d9-b93C-0003939e0af6</id>
 <entry>
   <title>Atom-Powered Robots Scheduled To Run Amok</title>
   <link href="http://example.org/2003/11/24/robots_coming"/>
   <id>urn:uuid:cdef5c6d5-gff8-4ebb-assa-80dwe44efkjo</id>
   <updated>2003-11-24T12:00:00Z</updated>
   <summary>Some text from an old, different entry.</summary>
 </entry>
</feed>`;

/** RFC 5005 Appendix B, "RSS 2.0-formatted Complete Feed". */
let RSS_COMPLETE = `<?xml version="1.0"?>
<rss version="2.0"
 xmlns:fh="http://purl.org/syndication/history/1.0">
 <channel>
  <title>NetMovies Queue</title>
  <link>http://netmovies.example.org/</link>
  <description>The DVDs you'll receive next.</description>
  <fh:complete/>
  <item>
   <title>Casablanca</title>
   <link>http://netmovies.example.org/movies/Casablanca</link>
   <description>Here's looking at you, kid...</description>
   <pubDate>Tue, 03 Jun 2003 09:39:21 GMT</pubDate>
   <guid isPermaLink="false">urn:uuid:1225c695-cfb8-4ebb-aaaa-80da344efa6a</guid>
  </item>
 </channel>
</rss>`;

/** RFC 5005 Appendix B, "RSS 2.0-formatted Archive Document". */
let RSS_ARCHIVE = `<?xml version="1.0"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"
 xmlns:fh="http://purl.org/syndication/history/1.0">
 <channel>
  <title>Liftoff News</title>
  <link>http://liftoff.example.net/</link>
  <description>Liftoff to Space Exploration.</description>
  <lastBuildDate>Fri, 30 May 2003 11:06:42 GMT</lastBuildDate>
  <fh:archive/>
  <atom:link rel="current"
   href="http://liftoff.example.net/index.rss"/>
  <atom:link rel="prev-archive"
   href="http://liftoff.example.net/2003/04/index.rss"/>
  <item>
   <title>Upcoming Eclipse</title>
   <link>http://liftoff.example.net/2003/05/30/eclipse</link>
   <pubDate>Fri, 30 May 2003 11:06:42 GMT</pubDate>
   <guid>http://liftoff.example.net/2003/05/30/eclipse</guid>
  </item>
 </channel>
</rss>`;

describe("complete", () => {
	test("reads an Atom complete feed as the whole set", () => {
		let feed = unwrap(Feed.parse(ATOM_COMPLETE));

		expect(feed.complete).toBe(true);
		expect(feed.archive).toBe(false);
		expect(feed.toJSON().complete).toBe(true);
	});

	test("reads an RSS complete feed as the whole set", () => {
		expect(unwrap(Feed.parse(RSS_COMPLETE)).complete).toBe(true);
	});

	test("reads a feed without the marker as partial", () => {
		let feed = unwrap(Feed.parse(ATOM_PAGED));

		expect(feed.complete).toBe(false);
		expect(feed.toJSON().complete).toBeUndefined();
	});
});

describe("archive", () => {
	test("reads an Atom archive document with its paging addresses", () => {
		let feed = unwrap(Feed.parse(ATOM_ARCHIVE));

		expect(feed.archive).toBe(true);
		expect(feed.paging).toEqual({
			current: "http://example.org/index.atom",
			prevArchive: "http://example.org/2003/10/index.atom",
		});
	});

	test("reads an RSS archive document with its paging addresses", () => {
		let feed = unwrap(Feed.parse(RSS_ARCHIVE));

		expect(feed.archive).toBe(true);
		expect(feed.paging).toEqual({
			current: "http://liftoff.example.net/index.rss",
			prevArchive: "http://liftoff.example.net/2003/04/index.rss",
		});
	});

	test("reads a subscription document's prev-archive without calling it an archive", () => {
		let feed = unwrap(Feed.parse(ATOM_SUBSCRIPTION));

		expect(feed.archive).toBe(false);
		expect(feed.paging.prevArchive).toBe("http://example.org/2003/11/index.atom");
	});
});

describe("paging", () => {
	test("reads a paged feed's next page", () => {
		expect(unwrap(Feed.parse(ATOM_PAGED)).paging).toEqual({
			next: "http://example.org/index.atom?page=2",
		});
	});

	test("resolves every relation against the document, taking the first of each", () => {
		let source = ATOM_PAGED.replace(
			'<link rel="next" href="http://example.org/index.atom?page=2"/>',
			[
				'<link rel="first" href="index.atom"/>',
				'<link rel="last" href="index.atom?page=9"/>',
				'<link rel="next" href="index.atom?page=3"/>',
				'<link rel="next" href="index.atom?page=4"/>',
				'<link rel="prev" href="index.atom?page=1"/>',
				'<link rel="next-archive" href="2003/12/index.atom"/>',
			].join(""),
		);

		let feed = unwrap(Feed.parse(source, { url: "http://example.org/feeds/index.atom?page=2" }));

		expect(feed.paging).toEqual({
			first: "http://example.org/feeds/index.atom",
			last: "http://example.org/feeds/index.atom?page=9",
			next: "http://example.org/feeds/index.atom?page=3",
			previous: "http://example.org/feeds/index.atom?page=1",
			nextArchive: "http://example.org/feeds/2003/12/index.atom",
		});
	});

	test("reads a JSON Feed's next_url as the next page and nothing as a marker", () => {
		let feed = unwrap(
			Feed.parse(
				JSON.stringify({
					version: "https://jsonfeed.org/version/1.1",
					title: "Example",
					next_url: "https://example.org/feed.json?page=2",
					items: [{ id: "1", content_text: "One" }],
				}),
			),
		);

		expect(feed.paging).toEqual({ next: "https://example.org/feed.json?page=2" });
		expect(feed.links).toContainEqual({
			rel: "next",
			href: "https://example.org/feed.json?page=2",
		});
		expect(feed.complete).toBe(false);
		expect(feed.archive).toBe(false);
	});
});
