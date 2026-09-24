/**
 * Exercises WebFinger against RFC 7033's examples: reading the query parameters,
 * selecting links by `rel`, the JRD reader and writer, and CORS on the descriptor.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import {
	MissingResourceError,
	parse,
	readQuery,
	select,
	stringify,
	webFinger,
} from "./webfinger.js";

/** The JRD example of RFC 7033 §4.4. */
const RFC_EXAMPLE = JSON.stringify({
	subject: "http://blog.example.com/article/id/314",
	aliases: ["http://blog.example.com/cool_new_thing", "http://blog.example.com/steve/article/7"],
	properties: {
		"http://blgx.example.net/ns/version": "1.3",
		"http://blgx.example.net/ns/ext": null,
	},
	links: [
		{ rel: "copyright", href: "http://www.example.com/copyright" },
		{
			rel: "author",
			href: "http://blog.example.com/author/steve",
			titles: { "en-us": "The Magical World of Steve", fr: "Le Monde Magique de Steve" },
			properties: { "http://example.com/role": "editor" },
		},
	],
});

describe(readQuery, () => {
	test("reads the resource and every rel, in order (§4.1)", () => {
		let url = new URL(
			"https://example.com/.well-known/webfinger?resource=acct%3Acarol%40example.com&rel=http%3A%2F%2Fopenid.net%2Fspecs%2Fconnect%2F1.0%2Fissuer&rel=self",
		);
		expect(unwrap(readQuery(url))).toEqual({
			resource: "acct:carol@example.com",
			rels: ["http://openid.net/specs/connect/1.0/issuer", "self"],
		});
	});

	test("fails without a resource (§4.2)", () => {
		let result = readQuery(new URL("https://example.com/.well-known/webfinger?rel=self"));
		expect(isFailure(result) && result.error).toBeInstanceOf(MissingResourceError);
		expect(
			isFailure(readQuery(new URL("https://example.com/.well-known/webfinger?resource="))),
		).toBe(true);
	});
});

describe(parse, () => {
	test("reads the RFC 7033 §4.4 example", () => {
		let jrd = unwrap(parse(RFC_EXAMPLE));
		expect(jrd.subject).toBe("http://blog.example.com/article/id/314");
		expect(jrd.aliases).toHaveLength(2);
		expect(jrd.properties["http://blgx.example.net/ns/ext"]).toBeNull();
		expect(jrd.links[0]).toEqual({
			rel: "copyright",
			type: null,
			href: "http://www.example.com/copyright",
			titles: {},
			properties: {},
		});
		expect(jrd.links[1]?.titles.fr).toBe("Le Monde Magique de Steve");
	});

	test("reads an empty object as an empty descriptor", () => {
		expect(unwrap(parse("{}"))).toEqual({ subject: null, aliases: [], properties: {}, links: [] });
	});

	test("reports a link without rel and a non-string alias", () => {
		let result = parse(JSON.stringify({ aliases: [1], links: [{ href: "https://x.example" }] }));
		expect(isFailure(result) && result.error.issues.map((issue) => issue.at)).toEqual([
			"/aliases/0",
			"/links/0/rel",
		]);
	});
});

describe(select, () => {
	test("keeps only the links asked for (§4.3)", () => {
		let jrd = unwrap(parse(RFC_EXAMPLE));
		expect(select(jrd, ["author"]).links.map((link) => link.rel)).toEqual(["author"]);
		expect(select(jrd, ["author"]).aliases).toEqual(jrd.aliases);
	});

	test("keeps every link when no rel is given", () => {
		let jrd = unwrap(parse(RFC_EXAMPLE));
		expect(select(jrd, [])).toBe(jrd);
	});
});

describe(stringify, () => {
	test("round-trips the RFC example to the same JSON", () => {
		expect(JSON.parse(stringify(unwrap(parse(RFC_EXAMPLE))))).toEqual(JSON.parse(RFC_EXAMPLE));
	});
});

describe("webFinger", () => {
	test("requires CORS on every answer (§5)", () => {
		expect(webFinger).toMatchObject({
			name: "webfinger",
			mediaType: "application/jrd+json",
			cors: true,
		});
	});
});
