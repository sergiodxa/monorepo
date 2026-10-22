/**
 * Tests for the RFC 8288 `Link` header parser and serializer.
 *
 * The whole reason this parser exists is that `header.split(",")` is wrong, so the
 * cases that break a naive split lead: a URI-Reference containing a comma, and a
 * quoted parameter value containing a comma or a semicolon.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vite-plus/test";

import { parse, serializeLink, stringify } from "./index.js";

describe(parse, () => {
	test("returns nothing for an absent header", () => {
		expect(parse(null)).toEqual([]);
		expect(parse("")).toEqual([]);
	});

	test("parses a single link", () => {
		let links = parse('<https://api.example.com/monitors?page=2>; rel="next"');

		expect(links).toHaveLength(1);
		expect(links[0]?.target).toBe("https://api.example.com/monitors?page=2");
		expect(links[0]?.rels).toEqual(["next"]);
		expect(links[0]?.params).toEqual({});
	});

	test("does not split on a comma inside the URI reference", () => {
		let links = parse('</assets/a,b.css>; rel="preload"; as="style"');

		expect(links).toHaveLength(1);
		expect(links[0]?.target).toBe("/assets/a,b.css");
		expect(links[0]?.rels).toEqual(["preload"]);
		expect(links[0]?.params).toEqual({ as: "style" });
	});

	test("does not split on a comma inside a quoted parameter value", () => {
		let links = parse('</a>; rel="next"; title="one, two"');

		expect(links).toHaveLength(1);
		expect(links[0]?.rels).toEqual(["next"]);
		expect(links[0]?.params).toEqual({ title: "one, two" });
	});

	test("does not split parameters on a semicolon inside a quoted value", () => {
		let links = parse('</a>; title="one; two"; rel="next"');

		expect(links).toHaveLength(1);
		expect(links[0]?.rels).toEqual(["next"]);
		expect(links[0]?.params).toEqual({ title: "one; two" });
	});

	test("parses several links, commas in URLs and all", () => {
		let links = parse(
			'</a,b.css>; rel="preload", <https://api.example.com/x?page=1>; rel="first", </c>; rel=next',
		);

		expect(links.map((link) => link.target)).toEqual([
			"/a,b.css",
			"https://api.example.com/x?page=1",
			"/c",
		]);
		expect(links.map((link) => link.rels)).toEqual([["preload"], ["first"], ["next"]]);
	});

	test("accepts an unquoted rel token", () => {
		expect(parse("</a>; rel=canonical")[0]?.rels).toEqual(["canonical"]);
	});

	test("lowercases relation types, which are case-insensitive", () => {
		expect(parse('</a>; rel="NEXT"')[0]?.rels).toEqual(["next"]);
	});

	test("splits a multi-valued rel on whitespace", () => {
		expect(parse('</a>; rel="next preload"')[0]?.rels).toEqual(["next", "preload"]);
	});

	test("honours only the first rel, as RFC 8288 requires", () => {
		expect(parse('</a>; rel="next"; rel="prev"')[0]?.rels).toEqual(["next"]);
	});

	test("keeps a link with no rel at all", () => {
		let links = parse("</a>");

		expect(links).toHaveLength(1);
		expect(links[0]?.rels).toEqual([]);
		expect(links[0]?.params).toEqual({});
	});

	test("preserves the source text so foreign parameters survive a merge", () => {
		let raw = '</style.css>; rel="preload"; as="style"; crossorigin';
		expect(parse(raw)[0]?.raw).toBe(raw);
	});

	test("unescapes a quoted rel value", () => {
		expect(parse('</a>; rel="\\n\\ext"')[0]?.rels).toEqual(["next"]);
	});

	test("drops an entry with no URI reference", () => {
		expect(parse('rel="next", </a>; rel="prev"')).toHaveLength(1);
	});

	test("surfaces type so a feed can read it without a second scanner", () => {
		expect(parse('</feed.xml>; rel="self"; type="application/atom+xml"')[0]?.params).toEqual({
			type: "application/atom+xml",
		});
	});

	test("keeps the first of each parameter name", () => {
		expect(parse('</a>; rel="alternate"; type="a"; type="b"')[0]?.params).toEqual({ type: "a" });
	});

	test("never throws on malformed input", () => {
		expect(() => parse('rel="next", not-a-link')).not.toThrow();
		expect(parse('rel="next", not-a-link')).toEqual([]);
	});
});

describe("serializeLink / stringify", () => {
	test("renders a link-value with a quoted rel", () => {
		expect(serializeLink("https://api.example.com/x?page=2", "next")).toBe(
			'<https://api.example.com/x?page=2>; rel="next"',
		);
	});

	test("appends extra parameters after rel", () => {
		expect(serializeLink("/feed.xml", "self", { type: "application/atom+xml" })).toBe(
			'</feed.xml>; rel="self"; type="application/atom+xml"',
		);
	});

	test("joins link-values with a comma and a space", () => {
		expect(stringify(['</a>; rel="first"', '</b>; rel="last"'])).toBe(
			'</a>; rel="first", </b>; rel="last"',
		);
	});

	test("is null when there is nothing to write", () => {
		expect(stringify([])).toBeNull();
	});

	test("re-emits parsed links from their source text", () => {
		let header = '</a>; rel="preload"; as="style", </b>; rel="next"';
		expect(stringify(parse(header))).toBe(header);
	});

	test("round-trips through the parser", () => {
		let header = stringify([
			serializeLink("/a,b.css", "preload"),
			serializeLink("https://api.example.com/x?page=2", "next"),
		]);

		expect(parse(header).map((link) => link.target)).toEqual([
			"/a,b.css",
			"https://api.example.com/x?page=2",
		]);
	});
});
