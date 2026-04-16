import { describe, expect, test } from "bun:test";

import { cloneChannel, cloneItem } from "./clone";

describe("rss clone helpers", () => {
	test("clones channel data deeply enough to prevent mutation leaks", () => {
		let channel = {
			title: "Feed",
			description: "Description",
			link: "https://example.com",
			category: [{ value: "Tech", domain: "topics" }],
			atomLink: [{ href: "https://example.com/feed.xml", rel: "self" }],
			dcCreator: ["Editor"],
			namespaces: { media: "http://search.yahoo.com/mrss/" },
			extensions: [
				{
					name: "media:rating",
					attributes: { scheme: "urn:simple" },
					children: ["adult"],
				},
			],
		};

		let clone = cloneChannel(channel);
		if (Array.isArray(clone.category) && typeof clone.category[0] !== "string") {
			clone.category[0].value = "Changed";
		}
		if (Array.isArray(clone.atomLink)) clone.atomLink[0].href = "https://changed.example.com";
		if (clone.namespaces) clone.namespaces.media = "changed";
		if (clone.extensions?.[0]?.attributes) clone.extensions[0].attributes.scheme = "changed";

		expect(channel.category).toEqual([{ value: "Tech", domain: "topics" }]);
		expect(channel.atomLink).toEqual([{ href: "https://example.com/feed.xml", rel: "self" }]);
		expect(channel.namespaces).toEqual({ media: "http://search.yahoo.com/mrss/" });
		expect(channel.extensions?.[0]?.attributes).toEqual({ scheme: "urn:simple" });
	});

	test("clones item data deeply enough to prevent mutation leaks", () => {
		let item = {
			guid: { value: "tag:example.com,2026:1", isPermaLink: false },
			category: [{ value: "Updates", domain: "topics" }],
			enclosure: [{ url: "https://example.com/file.mp3", length: 12, type: "audio/mpeg" }],
			atomLink: [{ href: "https://example.com/post.json", rel: "alternate" }],
			dcCreator: ["Jane"],
			extensions: [
				{
					name: "media:thumbnail",
					attributes: { url: "https://example.com/thumb.jpg" },
					children: [],
				},
			],
		};

		let clone = cloneItem(item);
		if (typeof clone.guid !== "string" && clone.guid) clone.guid.value = "changed";
		if (Array.isArray(clone.category) && typeof clone.category[0] !== "string") {
			clone.category[0].value = "Changed";
		}
		if (Array.isArray(clone.enclosure)) clone.enclosure[0].url = "https://changed.example.com";
		if (Array.isArray(clone.atomLink))
			clone.atomLink[0].href = "https://changed.example.com/post.json";
		if (clone.extensions?.[0]?.attributes) clone.extensions[0].attributes.url = "changed";

		expect(item.guid).toEqual({ value: "tag:example.com,2026:1", isPermaLink: false });
		expect(item.category).toEqual([{ value: "Updates", domain: "topics" }]);
		expect(item.enclosure).toEqual([
			{ url: "https://example.com/file.mp3", length: 12, type: "audio/mpeg" },
		]);
		expect(item.atomLink).toEqual([{ href: "https://example.com/post.json", rel: "alternate" }]);
		expect(item.extensions?.[0]?.attributes).toEqual({ url: "https://example.com/thumb.jpg" });
	});
});
