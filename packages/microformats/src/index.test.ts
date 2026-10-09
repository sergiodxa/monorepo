/**
 * Exercises the parse-and-serialize surface beyond the official suite: the failure a
 * source with no markup produces, reading a tree built elsewhere, the JSON round trip
 * with its wire names, the Micropub item schema, and the two lookup helpers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { parseDocument } from "@sdxc/html/document";
import { isFailure, unwrap } from "@sdxc/result";
import { parseSafe } from "remix/data-schema";
import { describe, expect, test } from "vitest";

import type { MF2 } from "./index.js";

import {
	findItem,
	fromDocument,
	ITEM_SCHEMA,
	MicroformatsParseError,
	MicroformatsShapeError,
	parse,
	parseJSON,
	stringify,
	values,
} from "./index.js";

/** A reply as a typical IndieWeb site marks one up, with a `rel=me` in its head. */
const REPLY = `<!doctype html>
<html lang="en">
<head><link rel="me" href="https://github.com/ada"><link rel="webmention" href="/webmention"></head>
<body>
	<article class="h-entry" id="reply">
		<span class="p-author h-card"><a class="p-name u-url" href="/">Ada</a> <img class="u-photo" src="/ada.jpg" alt="Ada's face"></span>
		<a class="u-in-reply-to" href="https://sergiodxa.com/articles/some-slug">In reply to</a>
		<div class="e-content"><p>Great post, see <a href="/notes/1">my note</a>.</p></div>
		<time class="dt-published" datetime="2026-09-23T10:15:00-03:00">yesterday</time>
		<a class="u-url" href="/replies/1">permalink</a>
	</article>
</body>
</html>`;

describe(parse, () => {
	test("reads an entry, its nested author card and the page's rels", () => {
		let document = unwrap(parse(REPLY, "https://ada.example/replies/1"));

		expect(document.items).toEqual([
			{
				type: ["h-entry"],
				id: "reply",
				lang: "en",
				properties: {
					author: [
						{
							type: ["h-card"],
							lang: "en",
							value: "Ada",
							properties: {
								name: ["Ada"],
								url: ["https://ada.example/"],
								photo: [{ value: "https://ada.example/ada.jpg", alt: "Ada's face" }],
							},
						},
					],
					"in-reply-to": ["https://sergiodxa.com/articles/some-slug"],
					content: [
						{
							html: '<p>Great post, see <a href="https://ada.example/notes/1">my note</a>.</p>',
							value: "Great post, see my note.",
							lang: "en",
						},
					],
					published: ["2026-09-23T10:15:00-03:00"],
					url: ["https://ada.example/replies/1"],
				},
			},
		]);
		expect(document.rels).toEqual({
			me: ["https://github.com/ada"],
			webmention: ["https://ada.example/webmention"],
		});
		expect(document.relUrls["https://github.com/ada"]).toEqual({ rels: ["me"] });
	});

	test("fails on a source carrying no markup", () => {
		let result = parse("   ", "https://example.com/");

		expect(isFailure(result) && result.error).toBeInstanceOf(MicroformatsParseError);
	});

	test("keeps rel keys such as __proto__ as own entries without touching Object.prototype", () => {
		let source = '<a rel="__proto__" href="__proto__">x</a><a rel="me" href="constructor">y</a>';

		let document = unwrap(parse(source, "about:blank"));

		expect(Object.keys(document.relUrls)).toEqual(["__proto__", "constructor"]);
		expect(Object.getOwnPropertyDescriptor(document.relUrls, "__proto__")?.value).toEqual({
			rels: ["__proto__"],
			text: "x",
		});
		expect(Object.getOwnPropertyDescriptor(document.rels, "__proto__")?.value).toEqual([
			"__proto__",
		]);
		expect(Object.getPrototypeOf(document.relUrls)).toBe(Object.prototype);
		expect(Object.prototype).not.toHaveProperty("rels");
		expect(stringify(document)).toContain(
			'"rel-urls":{"__proto__":{"rels":["__proto__"],"text":"x"}',
		);
	});

	test("trims text with long inner space runs in linear time", () => {
		let gap = "\t".repeat(100_000);
		let source = `<div class="h-entry"><p class="p-name"> a${gap}b </p><div class="e-content"> a${gap}b </div></div>`;
		let started = performance.now();

		let document = unwrap(parse(source, "https://example.com/"));

		expect(performance.now() - started).toBeLessThan(1000);
		expect(document.items[0]?.properties["name"]).toEqual([`a${gap}b`]);
		expect(document.items[0]?.properties["content"]).toEqual([
			{ html: `a${gap}b`, value: `a${gap}b` },
		]);
	});

	test("resolves against <base href>, itself resolved against the page URL", () => {
		let source = `<base href="/blog/"><a class="h-card" href="ada">Ada</a>`;

		let document = unwrap(parse(source, "https://example.com/index.html"));

		expect(document.items[0]?.properties.url).toEqual(["https://example.com/blog/ada"]);
	});

	test("leaves classic roots unread when backcompat is off", () => {
		let source = `<div class="vcard"><span class="fn">Ada</span></div>`;

		expect(unwrap(parse(source, "https://example.com/")).items).toHaveLength(1);
		expect(unwrap(parse(source, "https://example.com/", { backcompat: false })).items).toEqual([]);
	});

	test("lends a time-only dt-* the date an earlier one in the item named", () => {
		let source = `<div class="h-event">
			<span class="p-name">Party</span>
			<time class="dt-start" datetime="2026-09-24 19:00">tonight</time>
			until <time class="dt-end">23:30</time>
		</div>`;

		let [event] = unwrap(parse(source, "https://example.com/")).items;

		expect(event?.properties.end).toEqual(["2026-09-24 23:30"]);
	});
});

describe(fromDocument, () => {
	test("reads a tree @sdxc/html already built, as parse does", () => {
		let tree = unwrap(parseDocument(REPLY));

		expect(fromDocument(tree, "https://ada.example/replies/1")).toEqual(
			unwrap(parse(REPLY, "https://ada.example/replies/1")),
		);
	});
});

describe(stringify, () => {
	test("writes relUrls under its wire name", () => {
		let document = unwrap(parse(REPLY, "https://ada.example/replies/1"));

		let json = JSON.parse(stringify(document)) as Record<string, unknown>;

		expect(Object.keys(json)).toEqual(["items", "rels", "rel-urls"]);
	});

	test("writes an item as it is, which is Micropub's q=source answer", () => {
		let item: MF2.Item = { type: ["h-entry"], properties: { content: ["hello"] } };

		expect(stringify(item)).toBe('{"type":["h-entry"],"properties":{"content":["hello"]}}');
	});
});

describe(parseJSON, () => {
	test("reads back what stringify wrote", () => {
		let document = unwrap(parse(REPLY, "https://ada.example/replies/1"));

		expect(unwrap(parseJSON(stringify(document)))).toEqual(document);
	});

	test("reads a document written with items alone", () => {
		let document = unwrap(parseJSON('{"items":[{"type":["h-card"],"properties":{}}]}'));

		expect(document).toEqual({
			items: [{ type: ["h-card"], properties: {} }],
			rels: {},
			relUrls: {},
		});
	});

	test("fails with the schema issues on JSON that is not an mf2 document", () => {
		let result = parseJSON('{"items":[{"type":"h-card"}]}');

		if (!isFailure(result)) throw new Error("Expected a failure.");
		expect(result.error).toBeInstanceOf(MicroformatsShapeError);
		expect(result.error.issues.length).toBeGreaterThan(0);
	});

	test("fails with no issues on text that is not JSON", () => {
		let result = parseJSON("<html>");

		if (!isFailure(result)) throw new Error("Expected a failure.");
		expect(result.error.issues).toEqual([]);
	});
});

describe("ITEM_SCHEMA", () => {
	test("accepts a Micropub JSON create body", () => {
		let body = {
			type: ["h-entry"],
			properties: {
				content: ["Hello world"],
				category: ["indieweb", "micropub"],
				photo: [{ value: "https://example.com/photo.jpg", alt: "A sunset" }],
			},
		};

		let result = parseSafe(ITEM_SCHEMA, body);

		expect(result).toEqual({ success: true, value: body });
	});

	test("reads { html } content with the value its markup reads as", () => {
		let body = {
			type: ["h-entry"],
			properties: { content: [{ html: "<p>Hello <b>world</b></p>" }] },
		};

		let result = parseSafe(ITEM_SCHEMA, body);

		expect(result.success && result.value.properties.content).toEqual([
			{ html: "<p>Hello <b>world</b></p>", value: "Hello world" },
		]);
	});

	test("gives a nested item written without a value its first name", () => {
		let body = {
			type: ["h-entry"],
			properties: {
				location: [
					{ type: ["h-card"], properties: { name: ["Café"], url: ["https://cafe.example"] } },
				],
			},
		};

		let result = parseSafe(ITEM_SCHEMA, body);

		expect(result.success && result.value.properties.location).toEqual([
			{
				type: ["h-card"],
				properties: { name: ["Café"], url: ["https://cafe.example"] },
				value: "Café",
			},
		]);
	});

	test("rejects an item whose type is not a list", () => {
		expect(parseSafe(ITEM_SCHEMA, { type: "h-entry", properties: {} }).success).toBe(false);
	});
});

describe(findItem, () => {
	test("finds an item nested in a property before one among children", () => {
		let document = unwrap(parse(REPLY, "https://ada.example/replies/1"));

		expect(findItem(document, "h-card")?.properties.name).toEqual(["Ada"]);
		expect(findItem(document, "h-feed")).toBeNull();
	});

	test("searches children depth-first", () => {
		let source = `<div class="h-feed"><div class="h-entry"><span class="p-name">First</span></div></div>`;

		let document = unwrap(parse(source, "https://example.com/"));

		expect(findItem(document.items, "h-entry")?.properties.name).toEqual(["First"]);
	});
});

describe(values, () => {
	test("reads every kind of value as a string", () => {
		let document = unwrap(parse(REPLY, "https://ada.example/replies/1"));
		let entry = findItem(document, "h-entry");
		if (!entry) throw new Error("Expected an entry.");

		expect(values(entry, "author")).toEqual(["Ada"]);
		expect(values(entry, "content")).toEqual(["Great post, see my note."]);
		expect(values(findItem(document, "h-card") ?? entry, "photo")).toEqual([
			"https://ada.example/ada.jpg",
		]);
		expect(values(entry, "missing")).toEqual([]);
	});
});
