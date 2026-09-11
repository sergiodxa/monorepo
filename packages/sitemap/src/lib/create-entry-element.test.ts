/**
 * Exercises createEntryElement's row name and node ordering per the sitemap protocol.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { createEntryElement } from "./create-entry-element.js";

describe("createEntryElement", () => {
	test("returns a url element carrying only loc when no optional fields are present", () => {
		let element = createEntryElement({ loc: new URL("https://example.com/page") }, "urlset");

		expect(element).toEqual({
			name: "url",
			children: [{ name: "loc", children: ["https://example.com/page"] }],
		});
	});

	test("returns sitemap nodes in protocol order", () => {
		let updatedAt = new Date("2024-01-15T12:30:00.000Z");
		let element = createEntryElement(
			{ loc: new URL("https://example.com/page"), updatedAt, frequency: "monthly", priority: 0.8 },
			"urlset",
		);

		expect(element).toEqual({
			name: "url",
			children: [
				{ name: "loc", children: ["https://example.com/page"] },
				{ name: "lastmod", children: ["2024-01-15T12:30:00.000Z"] },
				{ name: "changefreq", children: ["monthly"] },
				{ name: "priority", children: ["0.8"] },
			],
		});
	});

	test("returns a sitemap element carrying only loc and lastmod for an index row", () => {
		let element = createEntryElement(
			{
				loc: new URL("https://example.com/sitemap-blog.xml"),
				updatedAt: new Date("2024-01-15T12:30:00.000Z"),
				frequency: "monthly",
				priority: 0.8,
			},
			"index",
		);

		expect(element).toEqual({
			name: "sitemap",
			children: [
				{ name: "loc", children: ["https://example.com/sitemap-blog.xml"] },
				{ name: "lastmod", children: ["2024-01-15T12:30:00.000Z"] },
			],
		});
	});
});
