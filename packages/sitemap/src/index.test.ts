/**
 * Exercises Sitemap in both directions: URL collection, size counting and XML
 * serialization, and reading a published document back through parse and fetch.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { XML } from "@sdxc/xml";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { Sitemap, SitemapFetchError, SitemapParseError } from "./index.js";

const SITEMAP_URL = "https://example.com/sitemap.xml";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/**
 * Parses source the way a caller holding a document does, so a test names the
 * sitemap rules it exercises rather than the two steps that reach them.
 */
function parse(source: string) {
	return Sitemap.parse(unwrap(XML.parse(source)));
}

/**
 * Wraps rows in a `<urlset>`, so each test writes only the row it is about.
 */
function urlset(rows: string) {
	return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows}</urlset>`;
}

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

	describe("parse", () => {
		test("reads the entries of a urlset", () => {
			let result = parse(
				urlset(
					`<url><loc>https://example.com/</loc><lastmod>2026-09-11T14:32:00+02:00</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`,
				),
			);

			expect(isSuccess(result)).toBe(true);
			let sitemap = unwrap(result);

			expect(sitemap.kind).toBe("urlset");
			expect(sitemap.size).toBe(1);
			expect([...sitemap.entries]).toEqual([
				{
					loc: new URL("https://example.com/"),
					updatedAt: new Date("2026-09-11T14:32:00+02:00"),
					frequency: "weekly",
					priority: 0.8,
				},
			]);
		});

		test("reads an entry carrying only a loc", () => {
			let result = parse(urlset(`<url><loc>https://example.com/about</loc></url>`));

			expect([...unwrap(result).entries]).toEqual([{ loc: new URL("https://example.com/about") }]);
		});

		test("reads a sitemapindex as an index", () => {
			let result = parse(
				`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://example.com/sitemap-blog.xml</loc><lastmod>2026-09-11</lastmod></sitemap></sitemapindex>`,
			);

			let sitemap = unwrap(result);

			expect(sitemap.kind).toBe("index");
			expect([...sitemap.entries]).toEqual([
				{
					loc: new URL("https://example.com/sitemap-blog.xml"),
					updatedAt: new Date("2026-09-11T00:00:00.000Z"),
				},
			]);
		});

		test("reads elements bound to a prefix", () => {
			let result = parse(
				`<sm:urlset xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9"><sm:url><sm:loc>https://example.com/</sm:loc></sm:url></sm:urlset>`,
			);

			expect(unwrap(result).size).toBe(1);
		});

		test("fails naming the root when the document is not a sitemap", () => {
			let result = parse(`<html><body><h1>Not found</h1></body></html>`);

			expect(isFailure(result)).toBe(true);
			if (!isFailure(result)) return;

			expect(result.error).toBeInstanceOf(SitemapParseError);
			expect(result.error.message).toBe(
				"Expected a <urlset> or <sitemapindex> root, received <html>.",
			);
		});

		test("reads an empty urlset as a sitemap with no entries", () => {
			let result = parse(urlset(""));

			expect(unwrap(result).size).toBe(0);
		});

		test("skips a row without a loc and keeps the rest of the document", () => {
			let result = parse(
				urlset(
					`<url><lastmod>2026-09-11</lastmod></url><url><loc>https://example.com/kept</loc></url>`,
				),
			);

			expect([...unwrap(result).entries]).toEqual([{ loc: new URL("https://example.com/kept") }]);
		});

		test("skips a row whose loc is relative", () => {
			let result = parse(urlset(`<url><loc>/relative</loc></url>`));

			expect(unwrap(result).size).toBe(0);
		});

		test("keeps the entry when lastmod cannot be read", () => {
			let result = parse(
				urlset(`<url><loc>https://example.com/</loc><lastmod>last tuesday</lastmod></url>`),
			);

			expect([...unwrap(result).entries]).toEqual([{ loc: new URL("https://example.com/") }]);
		});

		test("ignores a changefreq outside the protocol enum", () => {
			let result = parse(
				urlset(`<url><loc>https://example.com/</loc><changefreq>fortnightly</changefreq></url>`),
			);

			expect([...unwrap(result).entries]).toEqual([{ loc: new URL("https://example.com/") }]);
		});

		test("ignores a priority outside 0.0 and 1.0", () => {
			let result = parse(
				urlset(`<url><loc>https://example.com/</loc><priority>7</priority></url>`),
			);

			expect([...unwrap(result).entries]).toEqual([{ loc: new URL("https://example.com/") }]);
		});

		test("keeps a priority of 0", () => {
			let result = parse(
				urlset(`<url><loc>https://example.com/</loc><priority>0</priority></url>`),
			);

			expect([...unwrap(result).entries]).toEqual([
				{ loc: new URL("https://example.com/"), priority: 0 },
			]);
		});

		test("drops extension children", () => {
			let result = parse(
				urlset(
					`<url><loc>https://example.com/</loc><image:image><image:loc>https://example.com/a.png</image:loc></image:image><xhtml:link rel="alternate" hreflang="es" href="https://example.com/es"/></url>`,
				),
			);

			expect([...unwrap(result).entries]).toEqual([{ loc: new URL("https://example.com/") }]);
		});

		test("round-trips an index back to a sitemapindex", () => {
			let source = `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://example.com/sitemap-blog.xml</loc></sitemap></sitemapindex>`;
			let sitemap = unwrap(parse(source));

			expect(sitemap.toString()).toBe(
				`<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://example.com/sitemap-blog.xml</loc></sitemap></sitemapindex>`,
			);
		});

		test("appends to a parsed sitemap", () => {
			let sitemap = unwrap(parse(urlset(`<url><loc>https://example.com/</loc></url>`)));
			sitemap.append(new URL("https://example.com/added"));

			expect(sitemap.size).toBe(2);
			expect(sitemap.toString()).toContain("<loc>https://example.com/added</loc>");
		});
	});

	describe("fetch", () => {
		test("retrieves and parses a sitemap", async () => {
			server.use(
				http.get(SITEMAP_URL, () =>
					HttpResponse.xml(urlset(`<url><loc>https://example.com/</loc></url>`)),
				),
			);

			let result = await Sitemap.fetch(SITEMAP_URL);

			expect(unwrap(result).size).toBe(1);
		});

		test("parses a sitemap served as text/plain", async () => {
			server.use(
				http.get(SITEMAP_URL, () =>
					HttpResponse.text(urlset(`<url><loc>https://example.com/</loc></url>`)),
				),
			);

			let result = await Sitemap.fetch(SITEMAP_URL);

			expect(unwrap(result).size).toBe(1);
		});

		test("passes request options through", async () => {
			server.use(
				http.get(SITEMAP_URL, ({ request }) => {
					expect(request.headers.get("User-Agent")).toBe("crawler");
					return HttpResponse.xml(urlset(""));
				}),
			);

			let result = await Sitemap.fetch(SITEMAP_URL, { headers: { "User-Agent": "crawler" } });

			expect(isSuccess(result)).toBe(true);
		});

		test("fails naming the status when the request is refused", async () => {
			server.use(http.get(SITEMAP_URL, () => new HttpResponse(null, { status: 404 })));

			let result = await Sitemap.fetch(SITEMAP_URL);

			expect(isFailure(result)).toBe(true);
			if (!isFailure(result)) return;

			expect(result.error).toBeInstanceOf(SitemapFetchError);
			expect(result.error.message).toBe("Failed to fetch the sitemap: 404");
		});

		test("fails when the request never answers", async () => {
			server.use(http.get(SITEMAP_URL, () => HttpResponse.error()));

			let result = await Sitemap.fetch(SITEMAP_URL);

			expect(isFailure(result)).toBe(true);
			if (!isFailure(result)) return;

			expect(result.error).toBeInstanceOf(SitemapFetchError);
		});

		test("fails naming the root when an error page arrives under a 200", async () => {
			server.use(http.get(SITEMAP_URL, () => HttpResponse.xml("<html><body/></html>")));

			let result = await Sitemap.fetch(SITEMAP_URL);

			expect(isFailure(result)).toBe(true);
			if (!isFailure(result)) return;

			expect(result.error).toBeInstanceOf(SitemapParseError);
			expect(result.error.message).toContain("<html>");
		});

		test("fails when the body is not XML", async () => {
			server.use(http.get(SITEMAP_URL, () => HttpResponse.text("not xml at all")));

			let result = await Sitemap.fetch(SITEMAP_URL);

			expect(isFailure(result)).toBe(true);
		});
	});

	describe("validate", () => {
		test("reports nothing for a conforming sitemap", () => {
			let source = urlset(
				"<url><loc>https://example.com/</loc><lastmod>2026-09-11</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>",
			);

			expect(Sitemap.validate(source)).toEqual([]);
		});

		test("reports every field the protocol refuses, by row", () => {
			let source = urlset(
				[
					"<url><loc>/relative</loc></url>",
					"<url><lastmod>2026-09-11</lastmod></url>",
					"<url><loc>https://example.com/a</loc><lastmod>Sep 11 2026</lastmod><changefreq>sometimes</changefreq><priority>1.5</priority></url>",
					`<url><loc>https://example.com/${"a".repeat(2048)}</loc></url>`,
				].join(""),
			);

			expect(Sitemap.validate(source).map(({ rule, row }) => ({ rule, row }))).toEqual([
				{ rule: "loc", row: 1 },
				{ rule: "loc", row: 2 },
				{ rule: "lastmod", row: 3 },
				{ rule: "changefreq", row: 3 },
				{ rule: "priority", row: 3 },
				{ rule: "loc", row: 4 },
			]);
		});

		test("reports a URL on another host than the first", () => {
			let source = urlset(
				"<url><loc>https://example.com/</loc></url><url><loc>https://other.com/</loc></url>",
			);

			expect(Sitemap.validate(source)).toEqual([
				{
					rule: "host",
					row: 2,
					message:
						"Row 2: https://other.com/ is on other.com, but the first URL is on example.com.",
				},
			]);
		});

		test("checks every host against the sitemap's location when given", () => {
			let source = urlset("<url><loc>https://www.example.com/</loc></url>");

			let problems = Sitemap.validate(source, { location: new URL(SITEMAP_URL) });

			expect(problems.map((problem) => problem.rule)).toEqual(["host"]);
		});

		test("reports more than 50,000 rows", () => {
			let source = urlset("<url><loc>https://example.com/</loc></url>".repeat(50_001));

			expect(Sitemap.validate(source).map((problem) => problem.rule)).toEqual(["count"]);
		});

		test("reports a document over 50 MiB", () => {
			let source = urlset(`<url><loc>https://example.com/</loc></url>${" ".repeat(52_428_800)}`);

			expect(Sitemap.validate(source).map((problem) => problem.rule)).toEqual(["size"]);
		});

		test("reports source that is not a sitemap as one document problem", () => {
			expect(Sitemap.validate("<html/>")).toEqual([
				{
					rule: "document",
					message: "Expected a <urlset> or <sitemapindex> root, received <html>.",
				},
			]);
			expect(Sitemap.validate("not xml").map((problem) => problem.rule)).toEqual(["document"]);
		});

		test("leaves an index row's changefreq and priority unchecked", () => {
			let source =
				'<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://example.com/a.xml</loc><priority>9</priority></sitemap></sitemapindex>';

			expect(Sitemap.validate(source)).toEqual([]);
		});
	});

	describe("expand", () => {
		/** An index of `children`, each a sitemap under example.com. */
		function index(children: string[]) {
			let rows = children.map(
				(child) => `<sitemap><loc>https://example.com/${child}</loc></sitemap>`,
			);
			return `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows.join("")}</sitemapindex>`;
		}

		test("collects the pages of every child sitemap, nested indexes included", async () => {
			server.use(
				http.get("https://example.com/a.xml", () =>
					HttpResponse.xml(urlset("<url><loc>https://example.com/1</loc></url>")),
				),
				http.get("https://example.com/nested.xml", () =>
					HttpResponse.xml(index(["b.xml", "a.xml"])),
				),
				http.get("https://example.com/b.xml", () =>
					HttpResponse.xml(urlset("<url><loc>https://example.com/2</loc></url>")),
				),
			);

			let pages = unwrap(await unwrap(parse(index(["a.xml", "nested.xml"]))).expand());

			expect(pages.kind).toBe("urlset");
			expect([...pages.entries].map((entry) => entry.loc.href)).toEqual([
				"https://example.com/1",
				"https://example.com/2",
			]);
		});

		test("answers a urlset's own entries", async () => {
			let sitemap = unwrap(parse(urlset("<url><loc>https://example.com/</loc></url>")));

			let pages = unwrap(await sitemap.expand());

			expect(pages).not.toBe(sitemap);
			expect(pages.size).toBe(1);
		});

		test("fails naming the child that could not be read", async () => {
			server.use(
				http.get("https://example.com/gone.xml", () => new HttpResponse(null, { status: 404 })),
			);

			let result = await unwrap(parse(index(["gone.xml"]))).expand();

			expect(isFailure(result)).toBe(true);
			if (!isFailure(result)) return;
			expect(result.error).toBeInstanceOf(SitemapFetchError);
			expect(result.error.message).toBe(
				"https://example.com/gone.xml: Failed to fetch the sitemap: 404",
			);
		});
	});
});
