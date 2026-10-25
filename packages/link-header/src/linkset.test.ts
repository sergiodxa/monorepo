/**
 * Tests for RFC 9264 link sets. The RFC's own figures are the fixtures: Figure 8's text
 * form and Figure 10's JSON form describe the same links, so each reads into the other,
 * and Figures 1 to 6 and 18 pin the JSON shape of every kind of target attribute.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { LinksetLink } from "./linkset.js";

import { parse, parseJson, stringify, stringifyJson, toHeader } from "./linkset.js";

/** RFC 9264 Figure 8: a set of links as `application/linkset`. */
const FIGURE_8 = `<https://authors.example.net/johndoe>
   ; rel="author"
   ; type="application/rdf+xml"
   ; anchor="https://example.org/resource1",
<https://example.org/resource1?version=3>
   ; rel="latest-version"
   ; type="text/html"
   ; anchor="https://example.org/resource1",
<https://example.org/resource1?version=2>
   ; rel="predecessor-version"
   ; type="text/html"
   ; anchor="https://example.org/resource1?version=3",
<https://example.org/resource1?version=1>
   ; rel="predecessor-version"
   ; type="text/html"
   ; anchor="https://example.org/resource1?version=2",
<https://example.org/resource1?version=1>
   ; rel="memento"
   ; type="text/html"
   ; datetime="Thu, 13 Jun 2019 09:34:33 GMT"
   ; anchor="https://example.org/resource1",
<https://example.org/resource1?version=2>
   ; rel="memento"
   ; type="text/html"
   ; datetime="Sun, 21 Jul 2019 12:22:04 GMT"
   ; anchor="https://example.org/resource1",
<https://authors.example.net/alice>
   ; rel="author"
   ; anchor="https://example.org/resource1#comment=1"`;

/** RFC 9264 Figure 10: the same links as `application/linkset+json`. */
const FIGURE_10 = `{ "linkset":
  [
    { "anchor": "https://example.org/resource1",
      "author": [
        { "href": "https://authors.example.net/johndoe",
          "type": "application/rdf+xml"
        }
      ],
      "memento": [
        { "href": "https://example.org/resource1?version=1",
          "type": "text/html",
          "datetime": "Thu, 13 Jun 2019 09:34:33 GMT"
        },
        { "href": "https://example.org/resource1?version=2",
          "type": "text/html",
          "datetime": "Sun, 21 Jul 2019 12:22:04 GMT"
        }
      ],
      "latest-version": [
        { "href": "https://example.org/resource1?version=3",
          "type": "text/html"
        }
      ]
    },
    { "anchor": "https://example.org/resource1?version=3",
      "predecessor-version": [
        { "href": "https://example.org/resource1?version=2",
          "type": "text/html"
        }
      ]
    },
    { "anchor": "https://example.org/resource1?version=2",
      "predecessor-version": [
        { "href": "https://example.org/resource1?version=1",
          "type": "text/html"
        }
      ]
    },
    { "anchor": "https://example.org/resource1#comment=1",
      "author": [
        { "href": "https://authors.example.net/alice"}
      ]
    }
  ]
}`;

/**
 * Figure 10 as RFC 9264 §4.2.4.3 says to write it: Figure 10 itself gives `datetime` as a
 * bare string, while an extension attribute's value is always an array.
 */
const FIGURE_10_NORMATIVE = FIGURE_10.replaceAll(/"datetime": ("[^"]+")/g, '"datetime": [$1]');

/** RFC 9264 Figure 3: two contexts, one with an extension relation type. */
const FIGURE_3 = `{ "linkset":
  [
    { "anchor": "https://example.net/bar",
      "next": [
        {"href": "https://example.com/foo1"}
      ]
    },
    { "anchor": "https://example.net/boo",
      "https://example.com/relations/baz" : [
        {"href": "https://example.com/foo2"}
      ]
    }
  ]
}`;

/** RFC 9264 Figure 5: `hreflang`, `type`, `title` and `title*` on one target. */
const FIGURE_5 = `{ "linkset":
  [
    { "anchor": "https://example.net/bar",
      "next": [
        { "href":     "https://example.com/foo",
          "type":     "text/html",
          "hreflang": [ "en" , "de" ],
          "title":    "Next chapter",
          "title*":   [ { "value": "nächstes Kapitel" ,
                          "language" : "de" } ]
        }
      ]
    }
  ]
}`;

/** RFC 9264 Figure 6: extension target attributes, one internationalized. */
const FIGURE_6 = `{ "linkset":
  [
    { "anchor": "https://example.net/bar",
      "next": [
        { "href": "https://example.com/foo",
          "type": "text/html",
          "foo":  [ "foovalue" ],
          "bar":  [ "barone", "bartwo" ],
          "baz*": [ { "value": "bazvalue" ,
                      "language" : "en" } ]
        }
      ]
    }
  ]
}`;

/** RFC 9264 Figure 18: a set declaring its profile with a `profile` link. */
const FIGURE_18 = `{ "linkset":
  [
    { "anchor": "https://id.gs1.org/01/9506000134352?linkType=all",
      "profile": [
            {"href": "https://www.gs1.org/voc/?show=linktypes"}
      ]
    },
     { "anchor": "https://id.gs1.org/01/9506000134352",
       "https://gs1.org/voc/whatsInTheBox": [
         {"href": "https://example.com/en/packContents/GB"}
       ]
    }
  ]
}`;

/** The links of Figure 5, as this package models them. */
const FIGURE_5_LINKS: LinksetLink[] = [
	{
		anchor: "https://example.net/bar",
		rel: "next",
		href: "https://example.com/foo",
		type: "text/html",
		hreflang: ["en", "de"],
		title: "Next chapter",
		internationalized: { title: [{ value: "nächstes Kapitel", language: "de" }] },
	},
];

/**
 * Reads a JSON fixture, failing the test when it does not parse.
 *
 * @param text - The fixture.
 */
function links(text: string): LinksetLink[] {
	let result = parseJson(text);
	if (isFailure(result)) throw result.error;
	return result.data;
}

describe(parseJson, () => {
	test("reads Figure 10's bare-string datetime as one extension value", () => {
		expect(links(FIGURE_10)[1]?.extensions).toEqual({
			datetime: ["Thu, 13 Jun 2019 09:34:33 GMT"],
		});
	});

	test("reads Figure 5's attributes into the link model", () => {
		expect(links(FIGURE_5)).toEqual(FIGURE_5_LINKS);
	});

	test("keeps an extension relation type's URI as the rel", () => {
		expect(links(FIGURE_3).map((link) => link.rel)).toEqual([
			"next",
			"https://example.com/relations/baz",
		]);
	});

	test("reads Figure 6's extension attributes as arrays", () => {
		expect(links(FIGURE_6)[0]).toEqual({
			anchor: "https://example.net/bar",
			rel: "next",
			href: "https://example.com/foo",
			type: "text/html",
			extensions: { foo: ["foovalue"], bar: ["barone", "bartwo"] },
			internationalized: { baz: [{ value: "bazvalue", language: "en" }] },
		});
	});

	test("reads a profile link and a GS1 extension relation type from Figure 18", () => {
		expect(links(FIGURE_18)).toEqual([
			{
				anchor: "https://id.gs1.org/01/9506000134352?linkType=all",
				rel: "profile",
				href: "https://www.gs1.org/voc/?show=linktypes",
			},
			{
				anchor: "https://id.gs1.org/01/9506000134352",
				rel: "https://gs1.org/voc/whatsInTheBox",
				href: "https://example.com/en/packContents/GB",
			},
		]);
	});

	test("ignores a JSON-LD @context beside linkset", () => {
		let document = JSON.stringify({
			"@context": "https://example.org/ctx",
			...(JSON.parse(FIGURE_3) as object),
		});
		expect(links(document)).toHaveLength(2);
	});

	test("reads an empty href as the delivering resource", () => {
		expect(links('{"linkset":[{"self":[{"href":""}]}]}')).toEqual([{ rel: "self", href: "" }]);
	});

	test("rejects a relation type whose value is not an array of target objects", () => {
		let result = parseJson(
			'{"linkset":[{"anchor":"https://www.example.com/.well-known/api-catalog","api-catalog":"https://www.example.net/.well-known/api-catalog"}]}',
		);

		expect(isFailure(result) && result.error.issues).toEqual([
			{
				at: "/linkset/0/api-catalog",
				message: 'The "api-catalog" links must be an array of link target objects.',
			},
		]);
	});

	test("reports every broken member at once, pointing through an extension relation's slashes", () => {
		let result = parseJson(
			JSON.stringify({
				linkset: [
					{ anchor: 1 },
					{ "https://example.com/rel": [{ type: "text/html" }] },
					{ next: [{ href: "/a", hreflang: "en", title: 1, "title*": [{ language: "en" }] }] },
				],
			}),
		);

		expect(isFailure(result) && result.error.issues.map((issue) => issue.at)).toEqual([
			"/linkset/0/anchor",
			"/linkset/1/https:~1~1example.com~1rel/0/href",
			"/linkset/2/next/0/hreflang",
			"/linkset/2/next/0/title",
			"/linkset/2/next/0/title*/0",
		]);
	});

	test("rejects a document that is not a link set", () => {
		expect(isFailure(parseJson("not json"))).toBe(true);
		expect(isFailure(parseJson("[]"))).toBe(true);
		expect(isFailure(parseJson('{"linkset":{}}'))).toBe(true);
	});
});

describe(stringifyJson, () => {
	test("writes Figure 5's links back as Figure 5", () => {
		expect(JSON.parse(stringifyJson(FIGURE_5_LINKS))).toEqual(JSON.parse(FIGURE_5));
	});

	test("round-trips Figures 3, 6 and 18", () => {
		for (let figure of [FIGURE_3, FIGURE_6, FIGURE_18]) {
			expect(JSON.parse(stringifyJson(links(figure)))).toEqual(JSON.parse(figure));
		}
	});

	test("groups links without an anchor into one context object with no anchor", () => {
		expect(
			JSON.parse(
				stringifyJson([
					{ rel: "next", href: "/2" },
					{ rel: "prev", href: "/0" },
				]),
			),
		).toEqual({ linkset: [{ next: [{ href: "/2" }], prev: [{ href: "/0" }] }] });
	});
});

describe(parse, () => {
	test("reads Figure 8 into the links Figure 10 describes", () => {
		expect(parse(FIGURE_8)).toHaveLength(7);
		expect(parse(FIGURE_8)).toEqual(expect.arrayContaining(links(FIGURE_10)));
		expect(JSON.parse(stringifyJson(parse(FIGURE_8)))).toEqual(JSON.parse(FIGURE_10_NORMATIVE));
	});

	test("reads an extension attribute in Figure 8 as repeatable", () => {
		expect(parse(FIGURE_8)[4]?.extensions).toEqual({ datetime: ["Thu, 13 Jun 2019 09:34:33 GMT"] });
	});

	test("decodes Figure 5's title* from its RFC 8187 encoding", () => {
		let [link] = parse(
			`<https://example.com/foo>; rel="next"; anchor="https://example.net/bar"; type="text/html"; hreflang="en"; hreflang="de"; title="Next chapter"; title*=UTF-8'de'n%c3%a4chstes%20Kapitel`,
		);

		expect([link]).toEqual(FIGURE_5_LINKS);
	});

	test("decodes an ISO-8859-1 value and drops an unsupported charset", () => {
		let [link] = parse(`</a>; rel="next"; title*=iso-8859-1'es'pr%F3ximo; foo*=koi8-r''x`);

		expect(link?.internationalized).toEqual({ title: [{ value: "próximo", language: "es" }] });
	});

	test("reads a line naming several relation types as one link per type", () => {
		expect(parse('</a>; rel="Next https://example.com/Rel"')).toEqual([
			{ rel: "next", href: "/a" },
			{ rel: "https://example.com/Rel", href: "/a" },
		]);
	});

	test("honours the first rel, anchor and title and keeps every hreflang", () => {
		expect(
			parse(
				'</a>; rel=next; rel=prev; anchor="/x"; anchor="/y"; title=one; title=two; hreflang=en; hreflang=de',
			),
		).toEqual([{ rel: "next", href: "/a", anchor: "/x", title: "one", hreflang: ["en", "de"] }]);
	});

	test("makes a header's links self-contained against the delivering resource", () => {
		expect(
			parse('</page/2>; rel="next", <https://cdn.example/s.css>; rel=preload; anchor="#top"', {
				context: "https://example.org/list?page=1",
			}),
		).toEqual([
			{
				anchor: "https://example.org/list?page=1",
				rel: "next",
				href: "https://example.org/page/2",
			},
			{
				anchor: "https://example.org/list?page=1#top",
				rel: "preload",
				href: "https://cdn.example/s.css",
			},
		]);
	});

	test("reads no links from an absent header", () => {
		expect(parse(null)).toEqual([]);
	});
});

describe(stringify, () => {
	test("writes Figure 8's links as a text form that reads back to the same links", () => {
		let text = stringify(parse(FIGURE_8));

		expect(text.split(",\n")).toHaveLength(7);
		expect(parse(text)).toEqual(parse(FIGURE_8));
	});

	test("encodes title* so a non-ASCII title survives the text form", () => {
		let text = stringify(FIGURE_5_LINKS);

		expect(text).toContain("title*=UTF-8'de'n%C3%A4chstes%20Kapitel");
		expect(parse(text)).toEqual(FIGURE_5_LINKS);
	});
});

describe(toHeader, () => {
	test("converts a JSON link set into a single-line Link header and back", () => {
		let header = toHeader(links(FIGURE_10));

		expect(header).not.toContain("\n");
		expect(isSuccess(parseJson(FIGURE_10))).toBe(true);
		expect(JSON.parse(stringifyJson(parse(header)))).toEqual(JSON.parse(FIGURE_10_NORMATIVE));
	});

	test("answers null for no links", () => {
		expect(toHeader([])).toBeNull();
	});
});
