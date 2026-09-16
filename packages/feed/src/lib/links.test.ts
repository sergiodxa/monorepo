/**
 * Covers the link relations the three formats and a response header declare, and the
 * ranking a push-protocol subscriber picks a hub by.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { Feed } from "../index.js";

import { fromLinkHeader } from "./links.js";

/** The address every document in this file is served from. */
const URL_ = "https://example.com/feed.xml";

/** The hub every document in this file advertises. */
const HUB = "https://hub.example.com/";

/** An Atom document declaring `self` and `hub`, in that order. */
const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
	<title>Example</title>
	<id>https://example.com/</id>
				<updated>2026-09-16T00:00:00Z</updated>
	<link rel="self" href="${URL_}"/>
	<link rel="hub" href="${HUB}"/>
</feed>`;

/** An RSS 2.0 document declaring both through the Atom namespace, as RSS has no element. */
const RSS = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
	<title>Example</title>
	<link>https://example.com</link>
	<description>An example feed</description>
	<atom:link rel="self" href="${URL_}"/>
	<atom:link rel="hub" href="${HUB}"/>
</channel></rss>`;

/** A JSON Feed declaring its own address and one hub. */
const JSON_FEED = JSON.stringify({
	version: "https://jsonfeed.org/version/1.1",
	title: "Example",
	feed_url: URL_,
	hubs: [{ type: "WebSub", url: HUB }],
	items: [],
});

/** The parsed document, refused loudly so each test below reads what it asserts on. */
function parsed(source: string): Feed {
	let feed = Feed.parse(source, { url: URL_ });
	if (isFailure(feed)) throw feed.error;
	return feed.data;
}

describe("link relations", () => {
	test.each([
		["atom", ATOM],
		["rss", RSS],
		["json", JSON_FEED],
	])("surfaces rel=hub from a %s document", (_format, source) => {
		let feed = parsed(source);

		expect(feed.links).toContainEqual(expect.objectContaining({ rel: "hub", href: HUB }));
		expect(Feed.selectHub([], feed.links)).toEqual({ url: HUB, source: "document" });
	});

	test("keeps rel=self beside it, so the topic a hub keys by is readable", () => {
		expect(parsed(ATOM).links.find((link) => link.rel === "self")?.href).toBe(URL_);
		expect(parsed(RSS).links.find((link) => link.rel === "self")?.href).toBe(URL_);
		expect(parsed(JSON_FEED).links.find((link) => link.rel === "self")?.href).toBe(URL_);
	});

	test("lower-cases the relation and resolves the target", () => {
		let feed = parsed(`<?xml version="1.0"?>
			<feed xmlns="http://www.w3.org/2005/Atom">
				<title>Example</title>
				<id>https://example.com/</id>
				<updated>2026-09-16T00:00:00Z</updated>
				<link rel="HUB" href="/hub"/>
			</feed>`);

		expect(feed.links).toContainEqual({ rel: "hub", href: "https://example.com/hub" });
	});
});

describe("choosing a hub", () => {
	test("takes the header's hub over the document's", () => {
		let header = fromLinkHeader(
			new Response(null, { headers: { link: `<https://header.example.com/>; rel="hub"` } }),
			URL_,
		);

		expect(Feed.selectHub(header, parsed(ATOM).links)).toEqual({
			url: "https://header.example.com/",
			source: "header",
		});
	});

	test("reads several relations off one header, in the order they were written", () => {
		let links = fromLinkHeader(
			new Response(null, {
				headers: { link: `<${URL_}>; rel="self", <${HUB}>; rel="hub"` },
			}),
			URL_,
		);

		expect(links).toEqual([
			{ rel: "self", href: URL_ },
			{ rel: "hub", href: HUB },
		]);
	});

	test("takes the first hub where several are declared", () => {
		let feed = parsed(`<?xml version="1.0"?>
			<feed xmlns="http://www.w3.org/2005/Atom">
				<title>Example</title>
				<id>https://example.com/</id>
				<updated>2026-09-16T00:00:00Z</updated>
				<link rel="hub" href="https://first.example.com/"/>
				<link rel="hub" href="https://second.example.com/"/>
			</feed>`);

		expect(Feed.selectHub([], feed.links)?.url).toBe("https://first.example.com/");
	});

	test("passes over a hub that is not reached over https", () => {
		let feed = parsed(`<?xml version="1.0"?>
			<feed xmlns="http://www.w3.org/2005/Atom">
				<title>Example</title>
				<id>https://example.com/</id>
				<updated>2026-09-16T00:00:00Z</updated>
				<link rel="hub" href="http://insecure.example.com/"/>
			</feed>`);

		expect(feed.links).toContainEqual(
			expect.objectContaining({ href: "http://insecure.example.com/" }),
		);
		expect(Feed.selectHub([], feed.links)).toBeUndefined();
	});

	test("answers with nothing for a feed advertising none", () => {
		expect(Feed.selectHub([], [])).toBeUndefined();
	});
});
