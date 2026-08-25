/**
 * Exercises Sitemap's URL collection, size counting, and XML serialization.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { Sitemap } from "./index";

describe("Sitemap", () => {
	describe("append", () => {
		test("adds a URL to the sitemap", () => {
			let sitemap = new Sitemap();
			sitemap.append(new URL("https://example.com/page"));
			expect(sitemap.size).toBe(1);
		});

		test("adds multiple URLs to the sitemap", () => {
			let sitemap = new Sitemap();
			sitemap.append(new URL("https://example.com/page1"));
			sitemap.append(new URL("https://example.com/page2"));
			sitemap.append(new URL("https://example.com/page3"));
			expect(sitemap.size).toBe(3);
		});

		test("adds URL with lastmod date", () => {
			let sitemap = new Sitemap();
			let date = new Date("2024-01-15T00:00:00.000Z");
			sitemap.append(new URL("https://example.com/page"), { updatedAt: date });
			expect(sitemap.size).toBe(1);
		});
	});

	describe("size", () => {
		test("returns 0 for empty sitemap", () => {
			let sitemap = new Sitemap();
			expect(sitemap.size).toBe(0);
		});

		test("returns correct count after adding URLs", () => {
			let sitemap = new Sitemap();
			expect(sitemap.size).toBe(0);
			sitemap.append(new URL("https://example.com/1"));
			expect(sitemap.size).toBe(1);
			sitemap.append(new URL("https://example.com/2"));
			expect(sitemap.size).toBe(2);
		});
	});

	describe("toString", () => {
		test("generates valid XML for empty sitemap", () => {
			let sitemap = new Sitemap();
			let xml = sitemap.toString();
			expect(xml).toBe(
				'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>',
			);
		});

		test("generates valid XML with single URL", () => {
			let sitemap = new Sitemap();
			sitemap.append(new URL("https://example.com/page"));
			let xml = sitemap.toString();
			expect(xml).toBe(
				'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/page</loc></url></urlset>',
			);
		});

		test("generates valid XML with URL and lastmod", () => {
			let sitemap = new Sitemap();
			let date = new Date("2024-01-15T12:30:00.000Z");
			sitemap.append(new URL("https://example.com/page"), { updatedAt: date });
			let xml = sitemap.toString();
			expect(xml).toBe(
				'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/page</loc><lastmod>2024-01-15T12:30:00.000Z</lastmod></url></urlset>',
			);
		});

		test("generates valid XML with multiple URLs", () => {
			let sitemap = new Sitemap();
			sitemap.append(new URL("https://example.com/page1"));
			sitemap.append(new URL("https://example.com/page2"));
			let xml = sitemap.toString();
			expect(xml).toContain("<url><loc>https://example.com/page1</loc></url>");
			expect(xml).toContain("<url><loc>https://example.com/page2</loc></url>");
			expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
			expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
			expect(xml).toMatch(/<\/urlset>$/);
		});

		test("generates valid XML with mixed URLs (with and without lastmod)", () => {
			let sitemap = new Sitemap();
			let date = new Date("2024-06-01T00:00:00.000Z");
			sitemap.append(new URL("https://example.com/with-date"), { updatedAt: date });
			sitemap.append(new URL("https://example.com/no-date"));
			let xml = sitemap.toString();
			expect(xml).toContain(
				"<url><loc>https://example.com/with-date</loc><lastmod>2024-06-01T00:00:00.000Z</lastmod></url>",
			);
			expect(xml).toContain("<url><loc>https://example.com/no-date</loc></url>");
		});

		test("generates valid XML with changefreq", () => {
			let sitemap = new Sitemap();
			sitemap.append(new URL("https://example.com/page"), { frequency: "weekly" });
			let xml = sitemap.toString();
			expect(xml).toContain("<changefreq>weekly</changefreq>");
		});

		test("generates valid XML with priority", () => {
			let sitemap = new Sitemap();
			sitemap.append(new URL("https://example.com/page"), { priority: 0.8 });
			let xml = sitemap.toString();
			expect(xml).toContain("<priority>0.8</priority>");
		});

		test("generates valid XML with all options", () => {
			let sitemap = new Sitemap();
			let date = new Date("2024-01-15T12:30:00.000Z");
			sitemap.append(new URL("https://example.com/page"), {
				updatedAt: date,
				frequency: "monthly",
				priority: 1.0,
			});
			let xml = sitemap.toString();
			expect(xml).toContain("<lastmod>2024-01-15T12:30:00.000Z</lastmod>");
			expect(xml).toContain("<changefreq>monthly</changefreq>");
			expect(xml).toContain("<priority>1</priority>");
		});

		test("escapes XML-sensitive characters in URLs", () => {
			let sitemap = new Sitemap();
			sitemap.append(new URL("https://example.com/search?q=fish&sort=asc"));
			let xml = sitemap.toString();
			expect(xml).toContain("<loc>https://example.com/search?q=fish&amp;sort=asc</loc>");
		});
	});
});
