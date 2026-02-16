import { describe, expect, test } from "bun:test";

import { RSS } from "./index";

describe("RSS", () => {
	test("creates RSS with channel", () => {
		let rss = new RSS({
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

	test("addItem adds item to feed", () => {
		let rss = new RSS({
			title: "Test Feed",
			description: "A test feed",
			link: "https://example.com",
		});

		rss.addItem({
			guid: "1",
			title: "First Post",
			description: "This is the first post",
			link: "https://example.com/post/1",
			pubDate: "2024-01-01T00:00:00.000Z",
		});

		expect(rss.items).toHaveLength(1);
		expect(rss.items[0]).toEqual({
			guid: "1",
			title: "First Post",
			description: "This is the first post",
			link: "https://example.com/post/1",
			pubDate: "2024-01-01T00:00:00.000Z",
		});
	});

	test("removeItem removes item by guid", () => {
		let rss = new RSS({
			title: "Test Feed",
			description: "A test feed",
			link: "https://example.com",
		});

		rss.addItem({
			guid: "1",
			title: "First Post",
			description: "This is the first post",
			link: "https://example.com/post/1",
			pubDate: "2024-01-01T00:00:00.000Z",
		});

		rss.addItem({
			guid: "2",
			title: "Second Post",
			description: "This is the second post",
			link: "https://example.com/post/2",
			pubDate: "2024-01-02T00:00:00.000Z",
		});

		rss.removeItem("1");

		expect(rss.items).toHaveLength(1);
		expect(rss.items[0].guid).toBe("2");
	});

	test("toJSON returns channel and items", () => {
		let rss = new RSS({
			title: "Test Feed",
			description: "A test feed",
			link: "https://example.com",
		});

		rss.addItem({
			guid: "1",
			title: "First Post",
			description: "This is the first post",
			link: "https://example.com/post/1",
			pubDate: "2024-01-01T00:00:00.000Z",
		});

		let json = rss.toJSON();

		expect(json).toEqual({
			channel: {
				title: "Test Feed",
				description: "A test feed",
				link: "https://example.com",
			},
			items: [
				{
					guid: "1",
					title: "First Post",
					description: "This is the first post",
					link: "https://example.com/post/1",
					pubDate: "2024-01-01T00:00:00.000Z",
				},
			],
		});
	});

	test("toString outputs valid RSS XML format", () => {
		let rss = new RSS({
			title: "Test Feed",
			description: "A test feed",
			link: "https://example.com",
		});

		rss.addItem({
			guid: "1",
			title: "First Post",
			description: "This is the first post",
			link: "https://example.com/post/1",
			pubDate: "2024-01-01T00:00:00.000Z",
		});

		let output = rss.toString();

		expect(output).toContain('<?xml version="1.0" encoding="UTF-8"?>');
		expect(output).toContain('<rss version="2.0">');
		expect(output).toContain("<channel>");
		expect(output).toContain("<title>Test Feed</title>");
		expect(output).toContain("<description>A test feed</description>");
		expect(output).toContain("<link>https://example.com</link>");
		expect(output).toContain("<item>");
		expect(output).toContain("<guid>1</guid>");
		expect(output).toContain("<title>First Post</title>");
		expect(output).toContain("<description>This is the first post</description>");
		expect(output).toContain("<link>https://example.com/post/1</link>");
		expect(output).toContain("<pubDate>2024-01-01T00:00:00.000Z</pubDate>");
		expect(output).toContain("</item>");
		expect(output).toContain("</channel>");
		expect(output).toContain("</rss>");
	});

	test("toString outputs empty items when no items added", () => {
		let rss = new RSS({
			title: "Test Feed",
			description: "A test feed",
			link: "https://example.com",
		});

		let output = rss.toString();

		expect(output).toContain('<?xml version="1.0" encoding="UTF-8"?>');
		expect(output).toContain("<title>Test Feed</title>");
		expect(output).not.toContain("<item>");
	});

	test("toString outputs multiple items", () => {
		let rss = new RSS({
			title: "Test Feed",
			description: "A test feed",
			link: "https://example.com",
		});

		rss.addItem({
			guid: "1",
			title: "First Post",
			description: "This is the first post",
			link: "https://example.com/post/1",
			pubDate: "2024-01-01T00:00:00.000Z",
		});

		rss.addItem({
			guid: "2",
			title: "Second Post",
			description: "This is the second post",
			link: "https://example.com/post/2",
			pubDate: "2024-01-02T00:00:00.000Z",
		});

		let output = rss.toString();

		expect(output).toContain("<guid>1</guid>");
		expect(output).toContain("<guid>2</guid>");
		expect(output).toContain("<title>First Post</title>");
		expect(output).toContain("<title>Second Post</title>");
	});
});
