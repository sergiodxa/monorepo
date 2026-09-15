/**
 * Exercises the `JSONFeed` class against JSON Feed 1.1: building a document,
 * reading one back, and the leniency the format asks a reader for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { JSONFeed, JSONFeedFetchError, JSONFeedParseError } from "./index.js";

let FEED_URL = "https://example.com/feed.json";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let FULL_SPEC_DOCUMENT = {
	version: "https://jsonfeed.org/version/1.1",
	title: "Example Feed",
	home_page_url: "https://example.com/",
	feed_url: FEED_URL,
	description: "Full spec example",
	user_comment: "Add this feed to a reader that speaks JSON Feed.",
	next_url: "https://example.com/feed.json?page=2",
	icon: "https://example.com/icon.png",
	favicon: "https://example.com/favicon.png",
	authors: [
		{ name: "Jane Doe", url: "https://example.com/jane", avatar: "https://example.com/j.png" },
	],
	language: "en-US",
	expired: false,
	hubs: [{ type: "WebSub", url: "https://hub.example.com/" }],
	_example: { about: "https://example.com/extension", flavour: "vanilla" },
	items: [
		{
			id: "https://example.com/posts/hello-world",
			url: "https://example.com/posts/hello-world",
			external_url: "https://elsewhere.example/thing",
			title: "Hello World",
			content_html: "<p>Full post content</p>",
			content_text: "Full post content",
			summary: "A short summary",
			image: "https://example.com/featured.png",
			banner_image: "https://example.com/banner.png",
			date_published: "2026-02-07T14:04:00-05:00",
			date_modified: "2026-02-08T09:00:00-05:00",
			authors: [{ name: "John Roe" }],
			tags: ["updates", "web"],
			language: "en",
			attachments: [
				{
					url: "https://example.com/episode.m4a",
					mime_type: "audio/x-m4a",
					title: "Episode audio",
					size_in_bytes: 89970236,
					duration_in_seconds: 6629,
				},
			],
			_example: { rating: 5 },
		},
	],
};

describe("JSONFeed", () => {
	test("builds a feed and writes the version the package implements", () => {
		let feed = new JSONFeed({ title: "My Blog" });

		feed.addItem({ id: "1", contentText: "Cats are neat." });

		expect(feed.version).toBe("https://jsonfeed.org/version/1.1");
		expect(feed.toJSON()).toEqual({
			version: "https://jsonfeed.org/version/1.1",
			title: "My Blog",
			items: [{ id: "1", content_text: "Cats are neat." }],
		});
	});

	test("writes the fields in the order the format lists them", () => {
		let feed = new JSONFeed({ title: "My Blog", homePageUrl: "https://example.com" });
		feed.addItem({ id: "1", contentText: "Hi" });

		expect(Object.keys(feed.toJSON())).toEqual(["version", "title", "home_page_url", "items"]);
	});

	test("leaves out the fields a feed never filled in", () => {
		let feed = new JSONFeed({ title: "My Blog", description: "", authors: [] });

		expect(feed.toJSON()).toEqual({
			version: "https://jsonfeed.org/version/1.1",
			title: "My Blog",
			items: [],
		});
	});

	test("requires a title", () => {
		expect(() => new JSONFeed({ title: "" })).toThrow(JSONFeedParseError);
		expect(() => new JSONFeed({ title: "" })).toThrow("Feed must include a title.");
	});

	test("requires an item id", () => {
		let feed = new JSONFeed({ title: "My Blog" });

		expect(() => feed.addItem({ id: "", contentText: "Hi" })).toThrow("Item must include an id.");
	});

	test("hands back clones, so a caller cannot reach into the instance", () => {
		let feed = new JSONFeed({ title: "My Blog", authors: [{ name: "Jane" }] });
		feed.addItem({ id: "1", title: "Post", tags: ["one"] });

		let metadata = feed.feed;
		let [author] = metadata.authors ?? [];
		if (author) author.name = "Changed";

		let [item] = feed.items;
		item?.tags?.push("two");

		expect(feed.feed.authors).toEqual([{ name: "Jane" }]);
		expect(feed.items[0]?.tags).toEqual(["one"]);
	});

	test("replaces the metadata and keeps the items", () => {
		let feed = new JSONFeed({ title: "My Blog" });
		feed.addItem({ id: "1", contentText: "Hi" });

		feed.feed = { ...feed.feed, language: "en-US" };

		expect(feed.feed.language).toBe("en-US");
		expect(feed.items).toHaveLength(1);
	});

	test("removes the item carrying an id", () => {
		let feed = new JSONFeed({ title: "My Blog" });
		feed.addItem({ id: "1", contentText: "One" });
		feed.addItem({ id: "2", contentText: "Two" });

		feed.removeItem("1");
		feed.removeItem("missing");

		expect(feed.items.map((item) => item.id)).toEqual(["2"]);
	});

	test("round-trips the whole format, extensions included, under the format's own names", () => {
		let parsed = JSONFeed.parse(JSON.stringify(FULL_SPEC_DOCUMENT));
		if (isFailure(parsed)) throw parsed.error;

		expect(parsed.data.toJSON()).toEqual(FULL_SPEC_DOCUMENT);
		expect(parsed.data.feed.homePageUrl).toBe("https://example.com/");
		expect(parsed.data.items[0]?.datePublished).toBe("2026-02-07T14:04:00-05:00");
		expect(parsed.data.items[0]?.attachments?.[0]).toEqual({
			url: "https://example.com/episode.m4a",
			mimeType: "audio/x-m4a",
			title: "Episode audio",
			sizeInBytes: 89_970_236,
			durationInSeconds: 6629,
		});
	});

	test("serializes to text a reader can parse back", () => {
		let feed = new JSONFeed({ title: "My Blog", homePageUrl: "https://example.com" });
		feed.addItem({ id: "1", contentHtml: "<p>Hello</p>" });

		expect(JSON.parse(feed.toString())).toEqual({
			version: "https://jsonfeed.org/version/1.1",
			title: "My Blog",
			home_page_url: "https://example.com",
			items: [{ id: "1", content_html: "<p>Hello</p>" }],
		});
	});

	test("pretty-prints through JSON.stringify, since toJSON writes the document", () => {
		let feed = new JSONFeed({ title: "My Blog" });

		expect(JSON.stringify(feed, null, "\t")).toContain('\n\t"title": "My Blog"');
	});

	test("keeps the version a 1.0 document declared", () => {
		let parsed = JSONFeed.parse(
			JSON.stringify({
				version: "https://jsonfeed.org/version/1",
				title: "Old Blog",
				author: { name: "Jane" },
				items: [{ id: "1", content_text: "Hi", author: { name: "Jane" } }],
			}),
		);
		if (isFailure(parsed)) throw parsed.error;

		expect(parsed.data.version).toBe("https://jsonfeed.org/version/1");
		expect(parsed.data.feed.author).toEqual({ name: "Jane" });
		expect(parsed.data.items[0]?.author).toEqual({ name: "Jane" });
	});

	test("reads a value that was parsed for some other purpose first", () => {
		let parsed = JSONFeed.fromJSON(FULL_SPEC_DOCUMENT);
		if (isFailure(parsed)) throw parsed.error;

		expect(parsed.data.feed.title).toBe("Example Feed");
		expect(parsed.data.items).toHaveLength(1);
	});

	test("reports the version a value declares", () => {
		expect(JSONFeed.version(FULL_SPEC_DOCUMENT)).toBe("https://jsonfeed.org/version/1.1");
		expect(JSONFeed.version({ version: "https://jsonfeed.org/version/1" })).toBe(
			"https://jsonfeed.org/version/1",
		);
		expect(JSONFeed.version({ version: "2.0" })).toBeUndefined();
		expect(JSONFeed.version("not an object")).toBeUndefined();
	});

	test("refuses JSON that is not a feed", () => {
		let notJson = JSONFeed.parse('<rss version="2.0"></rss>');
		expect(isFailure(notJson) && notJson.error).toBeInstanceOf(JSONFeedParseError);

		let notAFeed = JSONFeed.fromJSON({ title: "Missing a version" });
		expect(isFailure(notAFeed) && notAFeed.error.message).toBe("Expected a JSON Feed version URL.");

		let untitled = JSONFeed.fromJSON({ version: "https://jsonfeed.org/version/1.1", items: [] });
		expect(isFailure(untitled) && untitled.error.message).toBe("Feed must include a title.");

		let itemless = JSONFeed.fromJSON({ version: "https://jsonfeed.org/version/1.1", title: "x" });
		expect(isFailure(itemless) && itemless.error.message).toBe("Feed must include an items array.");
	});

	test("fetches a feed, asking for the media type the format defines", async () => {
		let accept: string | null = null;

		server.use(
			http.get(FEED_URL, ({ request }) => {
				accept = request.headers.get("accept");
				return HttpResponse.json(FULL_SPEC_DOCUMENT, {
					headers: { "Content-Type": "application/feed+json" },
				});
			}),
		);

		let result = await JSONFeed.fetch(FEED_URL);
		if (isFailure(result)) throw result.error;

		expect(accept).toBe("application/feed+json, application/json");
		expect(result.data.feed.title).toBe("Example Feed");
		expect(JSONFeed.mediaType).toBe("application/feed+json");
	});

	test("reports a retrieval that answered with an error status", async () => {
		server.use(http.get(FEED_URL, () => new HttpResponse(null, { status: 404 })));

		let result = await JSONFeed.fetch(FEED_URL);

		expect(isFailure(result) && result.error).toBeInstanceOf(JSONFeedFetchError);
		expect(isFailure(result) && result.error.message).toBe("Failed to fetch JSON Feed: 404");
	});
});
