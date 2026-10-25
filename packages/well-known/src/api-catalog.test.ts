/**
 * Tests for the RFC 9727 API catalog. The RFC's examples are the fixtures: Appendix A.1's
 * RFC 8631 relations, A.2's bookmarks, A.4's nested catalogs, and §5.1's mixed catalog as
 * erratum 9009 corrects it, since the printed one breaks RFC 9264.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure } from "@sdxc/result";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { ApiCatalog } from "./api-catalog.js";

import { apiCatalog, build, MEDIA_TYPE, parse, stringify } from "./api-catalog.js";
import { serve, wellKnown } from "./middleware.js";

/** RFC 9727 Appendix A.1: three APIs described through RFC 8631 relations. */
const APPENDIX_A1 = `{
 "linkset": [
  {
   "anchor": "https://developer.example.com/apis/foo_api",
   "service-desc": [
    {
     "href": "https://developer.example.com/apis/foo_api/spec",
     "type": "application/yaml"
    }
   ],
   "status": [
    {
     "href": "https://developer.example.com/apis/foo_api/status",
     "type": "application/json"
    }
   ],
   "service-doc": [
    {
     "href": "https://developer.example.com/apis/foo_api/doc",
     "type": "text/html"
    }
   ],
   "service-meta": [
    {
     "href": "https://developer.example.com/apis/foo_api/policies",
     "type": "text/xml"
    }
   ]
  },
  {
   "anchor": "https://developer.example.com/apis/bar_api",
   "service-desc": [
    {
     "href": "https://developer.example.com/apis/bar_api/spec",
     "type": "application/yaml"
    }
   ],
   "status": [
    {
     "href": "https://developer.example.com/apis/bar_api/status",
     "type": "application/json"
    }
   ],
   "service-doc": [
    {
     "href": "https://developer.example.com/apis/bar_api/doc",
     "type": "text/plain"
    }
   ]
  },
  {
   "anchor": "https://apis.example.net/apis/cantona_api",
   "service-desc": [
    {
     "href": "https://apis.example.net/apis/cantona_api/spec",
     "type": "text/n3"
    }
   ],
   "service-doc": [
    {
     "href": "https://apis.example.net/apis/cantona_api/doc",
     "type": "text/html"
    }
   ]
  }
 ]
}`;

/** RFC 9727 Appendix A.2: the APIs as `item` bookmarks of the catalog. */
const APPENDIX_A2 = `{ "linkset":
 [
   { "anchor": "https://www.example.com/.well-known/api-catalog",
     "item": [
       {"href": "https://developer.example.com/apis/foo_api"},
       {"href": "https://developer.example.com/apis/bar_api"},
       {"href": "https://developer.example.com/apis/cantona_api"}
     ]
   }
 ]
}`;

/** RFC 9727 Appendix A.4: a catalog of catalogs. */
const APPENDIX_A4 = `{
  "linkset": [
    {
      "anchor": "https://www.example.com/.well-known/api-catalog",
      "api-catalog": [
        {
          "href": "https://apis.example.com/iot/api-catalog"
        },
        {
          "href": "https://ecommerce.example.com/api-catalog"
        },
        {
          "href": "https://developer.example.com/gaming/api-catalog"
        }
      ]
    }
  ]
}`;

/** RFC 9727 §5.1 as printed: `api-catalog` holds a bare string. */
const SECTION_5_1_PRINTED = `{
 "linkset": [
  {
   "anchor": "https://www.example.com/.well-known/api-catalog",
   "item": [
    {
     "href": "https://developer.example.com/apis/foo_api"
    },
    {
     "href": "https://developer.example.com/apis/bar_api"
    },
    {
     "href": "https://developer.example.com/apis/cantona_api"
    }
   ],
   "api-catalog": "https://www.example.net/.well-known/api-catalog"
  }
 ]
}`;

/** RFC 9727 §5.1 as erratum 9009 corrects it, with the link in an array of target objects. */
const SECTION_5_1_CORRECTED = SECTION_5_1_PRINTED.replace(
	'"api-catalog": "https://www.example.net/.well-known/api-catalog"',
	'"api-catalog": [{ "href": "https://www.example.net/.well-known/api-catalog" }]',
);

/**
 * Reads a fixture, failing the test when it does not parse.
 *
 * @param text - The fixture.
 */
function read(text: string): ApiCatalog {
	let result = parse(text);
	if (isFailure(result)) throw result.error;
	return result.data;
}

/**
 * The context objects of a link set document.
 *
 * @param text - The document.
 */
function linksetOf(text: string): unknown[] {
	return (JSON.parse(text) as { linkset: unknown[] }).linkset;
}

describe(parse, () => {
	test("reads every Appendix A example", () => {
		expect(read(APPENDIX_A1).links).toHaveLength(9);
		expect(read(APPENDIX_A2).links.map((link) => link.rel)).toEqual(["item", "item", "item"]);
		expect(read(APPENDIX_A4).links.map((link) => link.rel)).toEqual([
			"api-catalog",
			"api-catalog",
			"api-catalog",
		]);
	});

	test("reads §5.1 as erratum 9009 corrects it", () => {
		expect(read(SECTION_5_1_CORRECTED).links.at(-1)).toEqual({
			anchor: "https://www.example.com/.well-known/api-catalog",
			rel: "api-catalog",
			href: "https://www.example.net/.well-known/api-catalog",
		});
	});

	test("rejects §5.1 as printed, whose api-catalog member is no array", () => {
		let result = parse(SECTION_5_1_PRINTED);

		expect(isFailure(result) && result.error.format).toBe("api-catalog");
		expect(isFailure(result) && result.error.issues.map((issue) => issue.at)).toEqual([
			"/linkset/0/api-catalog",
		]);
	});

	test("rejects a catalog that links to nothing", () => {
		expect(isFailure(parse('{"linkset":[]}'))).toBe(true);
	});
});

describe(build, () => {
	/** A.2 hosts cantona_api on developer.example.com, A.1 on apis.example.net; A.1's host wins. */
	test("writes Appendix A.1's descriptions anchored at each API, after A.2's item links", () => {
		let catalog = build({
			url: "https://www.example.com/.well-known/api-catalog",
			apis: [
				{
					url: "https://developer.example.com/apis/foo_api",
					serviceDesc: [
						{ href: "https://developer.example.com/apis/foo_api/spec", type: "application/yaml" },
					],
					status: [
						{ href: "https://developer.example.com/apis/foo_api/status", type: "application/json" },
					],
					serviceDoc: [
						{ href: "https://developer.example.com/apis/foo_api/doc", type: "text/html" },
					],
					serviceMeta: [
						{ href: "https://developer.example.com/apis/foo_api/policies", type: "text/xml" },
					],
				},
				{
					url: "https://developer.example.com/apis/bar_api",
					serviceDesc: [
						{ href: "https://developer.example.com/apis/bar_api/spec", type: "application/yaml" },
					],
					status: [
						{ href: "https://developer.example.com/apis/bar_api/status", type: "application/json" },
					],
					serviceDoc: [
						{ href: "https://developer.example.com/apis/bar_api/doc", type: "text/plain" },
					],
				},
				{
					url: "https://apis.example.net/apis/cantona_api",
					serviceDesc: [
						{ href: "https://apis.example.net/apis/cantona_api/spec", type: "text/n3" },
					],
					serviceDoc: [
						{ href: "https://apis.example.net/apis/cantona_api/doc", type: "text/html" },
					],
				},
			],
		});
		let linkset = linksetOf(stringify(catalog));

		expect(linkset[0]).toEqual(
			linksetOf(
				APPENDIX_A2.replace("developer.example.com/apis/cantona", "apis.example.net/apis/cantona"),
			)[0],
		);
		expect(linkset.slice(1)).toEqual(linksetOf(APPENDIX_A1));
	});

	test("writes Appendix A.4's nested catalogs", () => {
		let catalog = build({
			url: "https://www.example.com/.well-known/api-catalog",
			apis: [],
			catalogs: [
				"https://apis.example.com/iot/api-catalog",
				"https://ecommerce.example.com/api-catalog",
				"https://developer.example.com/gaming/api-catalog",
			],
		});

		expect(JSON.parse(stringify(catalog))).toEqual(JSON.parse(APPENDIX_A4));
	});

	test("resolves paths against the catalog's URL and titles the item link", () => {
		let catalog = build({
			url: new URL("https://api.example.com/.well-known/api-catalog"),
			apis: [{ url: "/v1", title: "Example API", status: [{ href: "/health" }] }],
		});

		expect(catalog.links).toEqual([
			{
				anchor: "https://api.example.com/.well-known/api-catalog",
				rel: "item",
				href: "https://api.example.com/v1",
				title: "Example API",
			},
			{
				anchor: "https://api.example.com/v1",
				rel: "status",
				href: "https://api.example.com/health",
			},
		]);
	});
});

describe("apiCatalog served through wellKnown", () => {
	let router = createRouter({
		middleware: [
			wellKnown({
				"api-catalog": serve(apiCatalog, (ctx) =>
					build({
						url: new URL("/.well-known/api-catalog", ctx.url),
						apis: [
							{ url: "/v1", serviceDesc: [{ href: "/v1/openapi.json", type: "application/json" }] },
						],
					}),
				),
			}),
		],
	});

	test("answers GET with the link set media type and its RFC 9727 profile", async () => {
		let response = await router.fetch("https://example.com/.well-known/api-catalog");

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe(
			'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"',
		);
		expect(MEDIA_TYPE).toBe(response.headers.get("Content-Type"));
		expect(read(await response.text()).links).toHaveLength(2);
	});

	test("answers HEAD with the api-catalog Link and no body", async () => {
		let response = await router.fetch(
			new Request("https://example.com/.well-known/api-catalog", { method: "HEAD" }),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("Link")).toBe('</.well-known/api-catalog>; rel="api-catalog"');
		expect(await response.text()).toBe("");
	});

	test("answers a CORS preflight", async () => {
		let response = await router.fetch(
			new Request("https://example.com/.well-known/api-catalog", { method: "OPTIONS" }),
		);

		expect(response.status).toBe(204);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
	});
});
