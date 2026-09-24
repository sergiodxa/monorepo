/**
 * The official microformats parser test suite, run fixture by fixture: parse each
 * `.html` under the suite's base URL, write it as canonical JSON, and compare with the
 * `.json` beside it. The files are vendored under `docs/vendor/microformats-tests`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { readdirSync, readFileSync } from "node:fs";

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { parse, stringify } from "./index.js";

/** Where the suite sits, relative to this file. */
const SUITE = new URL("../../../docs/vendor/microformats-tests/", import.meta.url);

/**
 * The URL each suite's fixtures are parsed under, as its README states: the unit tests
 * use `example.test`, every other suite `example.com`.
 */
const BASE_URLS: Record<string, string> = {
	"microformats-v2-unit": "http://example.test",
};

const DEFAULT_BASE_URL = "http://example.com/";

/**
 * Where this parser departs from a fixture, and why. `types` narrows the departure to
 * the top-level items of those types and `properties` to those property names, both
 * removed from each side before comparing; with neither, the fixture is skipped.
 */
interface Divergence {
	reason: string;
	types?: string[];
	properties?: string[];
}

/**
 * Reason shared by the fixtures whose markup `@sdxc/html`'s tree construction reads
 * differently from an HTML5 parser: linkedom splits `class` on Unicode whitespace and
 * drops repeated tokens, and nests an `<a>` inside an `<a>` where HTML5 closes the first.
 */
const TREE_CONSTRUCTION = "linkedom builds a different tree than an HTML5 parser for this markup";

/** Classic markup the parsing specification's backcompat rules never read. */
const INCLUDE_PATTERN =
	"the classic include pattern (class=include, itemref, table headers) is not part of microformats2 backcompat parsing";

/**
 * Every departure from the suite. Each other fixture, and everything these entries do
 * not name, must match exactly.
 */
const DIVERGENCES: Record<string, Divergence> = {
	"microformats-v2-unit/implied/implied-url": {
		reason: TREE_CONSTRUCTION,
		types: [
			"h-test-a-onlychildoftype-root-a",
			"h-test-a-onlychildoftype-root-a-with-href",
			"h-test-a-onlychildoftype-root-a-with-href-empty",
			"h-test-a-onlychildoftype-type-sibling-after",
			"h-test-a-onlygrandchildoftype-root-a",
			"h-test-a-onlygrandchildoftype-root-a-with-href",
			"h-test-a-onlygrandchildoftype-root-a-with-href-empty",
			"h-test-a-onlygrandchildoftype-type-sibling-after",
		],
	},
	"microformats-v2-unit/names/names-microformats": {
		reason: TREE_CONSTRUCTION,
		types: Array.from({ length: 20 }, (_, index) => `h-t${index + 30}-test`),
	},
	"microformats-v2-unit/names/names-properties": {
		reason: TREE_CONSTRUCTION,
		properties: Array.from({ length: 20 }, (_, index) => `t${index + 30}-test`),
	},
	"microformats-v2-unit/names/tentative-names-properties-multi": {
		reason: TREE_CONSTRUCTION,
		types: ["h-1-test"],
	},
	"microformats-v2-unit/nested/nested-microformat-mistyped": {
		reason:
			"a u-* nested item's fallback value resolves as a URL, as in nested-microformat's h-test-as-u; the fixture notes no parser does otherwise",
		types: ["h-test-as-u-with-p-url", "h-test-as-u-with-dt-url", "h-test-as-u-with-e-url"],
	},
	"microformats-v2-unit/value/value-dt": {
		reason:
			"a value-class timezone is written without its colon, as microformats-v2/h-event/time expects for the same markup",
		types: ["h-test-acceptable"],
	},
	"microformats-v1/includes/hcarditemref": { reason: INCLUDE_PATTERN },
	"microformats-v1/includes/heventitemref": { reason: INCLUDE_PATTERN },
	"microformats-v1/includes/hyperlink": { reason: INCLUDE_PATTERN },
	"microformats-v1/includes/object": { reason: INCLUDE_PATTERN },
	"microformats-v1/includes/table": { reason: INCLUDE_PATTERN },
};

/** A document as the suite writes it, the shape compared here. */
interface WireDocument {
	items: { type: string[]; properties: Record<string, unknown> }[];
}

/** Removes what a divergence names from a wire document, leaving everything else. */
function without(document: WireDocument, divergence: Divergence | undefined): WireDocument {
	if (!divergence) return document;
	let types = new Set(divergence.types ?? []);
	let items = document.items
		.filter((item) => !types.has(item.type[0] ?? ""))
		.map((item) => {
			let properties = { ...item.properties };
			for (let name of divergence.properties ?? []) delete properties[name];
			return { ...item, properties };
		});
	return { ...document, items };
}

/** Every `.html` fixture path under a suite directory, relative to the suite root. */
function fixtures(suite: string): string[] {
	let entries = readdirSync(new URL(`${suite}/`, SUITE), { recursive: true, encoding: "utf8" });
	return entries
		.filter((entry) => entry.endsWith(".html"))
		.map((entry) => `${suite}/${entry.slice(0, -".html".length)}`)
		.sort();
}

/** Reads one fixture file as text. */
function read(path: string): string {
	return readFileSync(new URL(path, SUITE), "utf8");
}

describe.each(["microformats-v2", "microformats-v2-unit", "microformats-mixed", "microformats-v1"])(
	"%s",
	(suite) => {
		for (let fixture of fixtures(suite)) {
			let divergence = DIVERGENCES[fixture];
			let skipped = divergence !== undefined && !divergence.types && !divergence.properties;
			test.skipIf(skipped)(fixture, () => {
				let baseUrl = BASE_URLS[suite] ?? DEFAULT_BASE_URL;
				let document = unwrap(parse(read(`${fixture}.html`), baseUrl));
				let actual = JSON.parse(stringify(document)) as WireDocument;
				let expected = JSON.parse(read(`${fixture}.json`)) as WireDocument;
				expect(without(actual, divergence)).toEqual(without(expected, divergence));
			});
		}
	},
);
