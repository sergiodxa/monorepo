/**
 * Reads and writes RFC 5005 Feed Paging and Archiving against the specification's own
 * Atom examples: the `fh:complete` and `fh:archive` markers, and the paging and archive
 * link relations, which round-trip as ordinary links.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { Atom } from "./index.js";

/** RFC 5005 §2, "Atom-formatted Complete Feed". */
let COMPLETE_FEED = `<?xml version="1.0" encoding="utf-8"?>
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
let PAGED_FEED = `<?xml version="1.0" encoding="utf-8"?>
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

/** RFC 5005 §4, "Atom-formatted Archive Document". */
let ARCHIVE_DOCUMENT = `<?xml version="1.0" encoding="utf-8"?>
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

describe("RFC 5005 markers", () => {
	test("reads fh:complete as a flag rather than a foreign element", () => {
		let feed = unwrap(Atom.parse(COMPLETE_FEED)).feed;

		expect(feed.complete).toBe(true);
		expect(feed.archive).toBeUndefined();
		expect(feed.extensions).toBeUndefined();
	});

	test("reads fh:archive alongside the current and prev-archive links", () => {
		let feed = unwrap(Atom.parse(ARCHIVE_DOCUMENT)).feed;

		expect(feed.archive).toBe(true);
		expect(feed.complete).toBeUndefined();
		expect(feed.link).toEqual([
			{ rel: "current", href: "http://example.org/index.atom" },
			{ rel: "self", href: "http://example.org/2003/11/index.atom" },
			{ rel: "prev-archive", href: "http://example.org/2003/10/index.atom" },
		]);
	});

	test("judges a marker by its namespace, whatever prefix binds it", () => {
		let source = COMPLETE_FEED.replace('xmlns:fh="', 'xmlns:h="').replace(
			"<fh:complete/>",
			"<h:complete/>",
		);
		expect(unwrap(Atom.parse(source)).feed.complete).toBe(true);
	});

	test("keeps an fh-prefixed element of another namespace as an extension", () => {
		let source = COMPLETE_FEED.replace("http://purl.org/syndication/history/1.0", "urn:other");
		let feed = unwrap(Atom.parse(source)).feed;

		expect(feed.complete).toBeUndefined();
		expect(feed.extensions?.map((element) => element.name)).toEqual(["fh:complete"]);
	});

	test("writes both markers back and round-trips them", () => {
		let complete = unwrap(Atom.parse(COMPLETE_FEED));
		let archive = unwrap(Atom.parse(ARCHIVE_DOCUMENT));

		expect(complete.toString()).toContain("<fh:complete/>");
		expect(archive.toString()).toContain("<fh:archive/>");
		expect(unwrap(Atom.parse(complete.toString())).feed.complete).toBe(true);

		let reread = unwrap(Atom.parse(archive.toString())).feed;
		expect(reread.archive).toBe(true);
		expect(reread.link).toContainEqual({
			rel: "prev-archive",
			href: "http://example.org/2003/10/index.atom",
		});
	});

	test("declares the namespace a built feed's marker needs", () => {
		let atom = new Atom({
			id: "urn:uuid:60a76c80-d399-11d9-b93C-0003939e0af6",
			title: "NetMovies Queue",
			updated: "2003-12-13T18:30:02Z",
			complete: true,
		});

		let xml = atom.toString();
		expect(xml).toContain('xmlns:fh="http://purl.org/syndication/history/1.0"');
		expect(xml).toContain("<fh:complete/>");
	});

	test("writes the marker under the prefix the feed already binds", () => {
		let atom = new Atom({
			id: "urn:example",
			title: "Example",
			updated: "2003-12-13T18:30:02Z",
			archive: true,
			namespaces: { history: "http://purl.org/syndication/history/1.0" },
		});

		let xml = atom.toString();
		expect(xml).toContain("<history:archive/>");
		expect(xml).not.toContain("xmlns:fh=");
	});
});

describe("RFC 5005 link relations", () => {
	test("keeps the paged feed's next relation as written", () => {
		let feed = unwrap(Atom.parse(PAGED_FEED)).feed;

		expect(feed.link).toContainEqual({ rel: "next", href: "http://example.org/index.atom?page=2" });
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
		let atom = new Atom({
			id: "urn:example",
			title: "Example",
			updated: "2003-12-13T18:30:02Z",
			link: relations.map((rel) => ({ rel, href: `http://example.org/${rel}.atom` })),
		});

		let link = unwrap(Atom.parse(atom.toString())).feed.link;
		expect(link).toEqual(relations.map((rel) => ({ rel, href: `http://example.org/${rel}.atom` })));
	});
});
