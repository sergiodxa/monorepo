/**
 * Tests for the `Link` header parser.
 *
 * The whole reason this parser exists is that `header.split(",")` is wrong, so the
 * cases that break a naive split lead: a URI reference containing a comma, and a
 * quoted parameter value containing a comma or a semicolon.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { parseLinkHeader, serializeLink, serializeLinkHeader } from "./link";

describe("parseLinkHeader", () => {
	test("returns nothing for an absent header", () => {
		expect(parseLinkHeader(null)).toEqual([]);
		expect(parseLinkHeader("")).toEqual([]);
	});

	test("parses a single link", () => {
		let links = parseLinkHeader('<https://api.example.com/monitors?page=2>; rel="next"');

		expect(links).toHaveLength(1);
		expect(links[0]?.target).toBe("https://api.example.com/monitors?page=2");
		expect(links[0]?.rels).toEqual(["next"]);
	});

	test("does not split on a comma inside the URI reference", () => {
		let links = parseLinkHeader('</assets/a,b.css>; rel="preload"; as="style"');

		expect(links).toHaveLength(1);
		expect(links[0]?.target).toBe("/assets/a,b.css");
		expect(links[0]?.rels).toEqual(["preload"]);
	});

	test("does not split on a comma inside a quoted parameter value", () => {
		let links = parseLinkHeader('</a>; rel="next"; title="one, two"');

		expect(links).toHaveLength(1);
		expect(links[0]?.rels).toEqual(["next"]);
	});

	test("does not split parameters on a semicolon inside a quoted value", () => {
		let links = parseLinkHeader('</a>; title="one; two"; rel="next"');

		expect(links).toHaveLength(1);
		expect(links[0]?.rels).toEqual(["next"]);
	});

	test("parses several links, commas in URLs and all", () => {
		let links = parseLinkHeader(
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
		expect(parseLinkHeader("</a>; rel=canonical")[0]?.rels).toEqual(["canonical"]);
	});

	test("lowercases relation types, which are case-insensitive", () => {
		expect(parseLinkHeader('</a>; rel="NEXT"')[0]?.rels).toEqual(["next"]);
	});

	test("splits a multi-valued rel on whitespace", () => {
		expect(parseLinkHeader('</a>; rel="next preload"')[0]?.rels).toEqual(["next", "preload"]);
	});

	test("honours only the first rel, as RFC 8288 requires", () => {
		expect(parseLinkHeader('</a>; rel="next"; rel="prev"')[0]?.rels).toEqual(["next"]);
	});

	test("keeps a link with no rel at all", () => {
		let links = parseLinkHeader("</a>");

		expect(links).toHaveLength(1);
		expect(links[0]?.rels).toEqual([]);
	});

	test("preserves the source text so foreign parameters survive a merge", () => {
		let raw = '</style.css>; rel="preload"; as="style"; crossorigin';
		expect(parseLinkHeader(raw)[0]?.raw).toBe(raw);
	});

	test("unescapes a quoted rel value", () => {
		expect(parseLinkHeader('</a>; rel="\\n\\ext"')[0]?.rels).toEqual(["next"]);
	});

	test("drops an entry with no URI reference", () => {
		expect(parseLinkHeader('rel="next", </a>; rel="prev"')).toHaveLength(1);
	});
});

describe("serializeLink / serializeLinkHeader", () => {
	test("renders a link-value with a quoted rel", () => {
		expect(serializeLink("https://api.example.com/x?page=2", "next")).toBe(
			'<https://api.example.com/x?page=2>; rel="next"',
		);
	});

	test("joins link-values with a comma and a space", () => {
		expect(serializeLinkHeader(['</a>; rel="first"', '</b>; rel="last"'])).toBe(
			'</a>; rel="first", </b>; rel="last"',
		);
	});

	test("is null when there is nothing to write", () => {
		expect(serializeLinkHeader([])).toBeNull();
	});

	test("round-trips through the parser", () => {
		let header = serializeLinkHeader([
			serializeLink("/a,b.css", "preload"),
			serializeLink("https://api.example.com/x?page=2", "next"),
		]);

		expect(parseLinkHeader(header).map((link) => link.target)).toEqual([
			"/a,b.css",
			"https://api.example.com/x?page=2",
		]);
	});
});
