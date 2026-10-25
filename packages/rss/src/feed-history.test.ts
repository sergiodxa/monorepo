/**
 * Reads and writes RFC 5005 Feed Paging and Archiving against the specification's own
 * RSS 2.0 examples (Appendix B): the `fh:complete` and `fh:archive` markers, and the
 * paging and archive relations carried as `atom:link`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { RSS } from "./index.js";

/** RFC 5005 Appendix B, "RSS 2.0-formatted Complete Feed". */
let COMPLETE_FEED = `<?xml version="1.0"?>
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
   <description>Here's looking at you, kid...
   </description>
   <pubDate>Tue, 03 Jun 2003 09:39:21 GMT</pubDate>
   <guid isPermaLink="false"
   >urn:uuid:1225c695-cfb8-4ebb-aaaa-80da344efa6a</guid>
  </item>
 </channel>
</rss>`;

/** RFC 5005 Appendix B, "RSS 2.0-formatted Paged Feed". */
let PAGED_FEED = `<?xml version="1.0"?>
<rss version="2.0"
 xmlns:atom="http://www.w3.org/2005/Atom">
 <channel>
  <title>Liftoff News</title>
  <link>http://liftoff.example.net/</link>
  <description>Liftoff to Space Exploration.</description>
  <atom:link rel="next"
   href="http://liftof.example.net/index.rss?page=2"/>
  <item>
   <title>Star City</title>
   <link>http://liftoff.example.net/2003/06/news-starcity</link>
   <description>How do Americans get ready to work with Russians
   aboard the International Space Station?</description>
   <pubDate>Tue, 03 Jun 2003 09:39:21 GMT</pubDate>
   <guid>http://liftoff.example.net/2003/06/03/starcity</guid>
  </item>
 </channel>
</rss>`;

/** RFC 5005 Appendix B, "RSS 2.0-formatted Archive Document". */
let ARCHIVE_DOCUMENT = `<?xml version="1.0"?>
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
   <description>Sky watchers in Europe, Asia, and parts of
   Alaska and Canada will experience a partial eclipse of the Sun
   on Saturday, May 31st.</description>
   <pubDate>Fri, 30 May 2003 11:06:42 GMT</pubDate>
   <guid>http://liftoff.example.net/2003/05/30/eclipse</guid>
  </item>
 </channel>
</rss>`;

describe("RFC 5005 markers", () => {
	test("reads fh:complete as a flag rather than an extension", () => {
		let channel = RSS.parse(COMPLETE_FEED).channel;

		expect(channel.fhComplete).toBe(true);
		expect(channel.fhArchive).toBeUndefined();
		expect(channel.extensions).toBeUndefined();
	});

	test("reads fh:archive with the current and prev-archive relations", () => {
		let channel = RSS.parse(ARCHIVE_DOCUMENT).channel;

		expect(channel.fhArchive).toBe(true);
		expect(channel.atomLink).toEqual([
			{ rel: "current", href: "http://liftoff.example.net/index.rss" },
			{ rel: "prev-archive", href: "http://liftoff.example.net/2003/04/index.rss" },
		]);
	});

	test("judges a marker by its namespace, whatever prefix binds it", () => {
		let source = COMPLETE_FEED.replace('xmlns:fh="', 'xmlns:h="').replace(
			"<fh:complete/>",
			"<h:complete/>",
		);

		expect(RSS.parse(source).channel.fhComplete).toBe(true);
	});

	test("keeps an fh-prefixed element of another namespace as an extension", () => {
		let source = COMPLETE_FEED.replace("http://purl.org/syndication/history/1.0", "urn:other");
		let channel = RSS.parse(source).channel;

		expect(channel.fhComplete).toBeUndefined();
		expect(channel.extensions?.map((element) => element.name)).toEqual(["fh:complete"]);
	});

	test("writes both markers back and round-trips them", () => {
		let complete = RSS.parse(COMPLETE_FEED).toString();
		let archive = RSS.parse(ARCHIVE_DOCUMENT).toString();

		expect(complete).toContain("<fh:complete/>");
		expect(archive).toContain("<fh:archive/>");
		expect(RSS.parse(complete).channel.fhComplete).toBe(true);
		expect(RSS.parse(archive).channel.fhArchive).toBe(true);
	});

	test("declares the namespace a built channel's marker needs", () => {
		let rss = new RSS({
			title: "NetMovies Queue",
			link: "http://netmovies.example.org/",
			description: "The DVDs you'll receive next.",
			fhComplete: true,
		});

		let xml = rss.toString();
		expect(xml).toContain('xmlns:fh="http://purl.org/syndication/history/1.0"');
		expect(xml).toContain("<fh:complete/>");
	});
});

describe("RFC 5005 link relations", () => {
	test("keeps the paged feed's next relation", () => {
		expect(RSS.parse(PAGED_FEED).channel.atomLink).toEqual({
			rel: "next",
			href: "http://liftof.example.net/index.rss?page=2",
		});
	});

	test("round-trips every paging and archive relation", () => {
		let relations = [
			"first",
			"last",
			"next",
			"previous",
			"prev-archive",
			"next-archive",
			"current",
		];
		let rss = new RSS({
			title: "Liftoff News",
			link: "http://liftoff.example.net/",
			description: "Liftoff to Space Exploration.",
			atomLink: relations.map((rel) => ({ rel, href: `http://liftoff.example.net/${rel}.rss` })),
		});

		expect(RSS.parse(rss.toString()).channel.atomLink).toEqual(
			relations.map((rel) => ({ rel, href: `http://liftoff.example.net/${rel}.rss` })),
		);
	});
});
