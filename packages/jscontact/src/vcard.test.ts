/**
 * Holds the vCard conversion to RFC 9555 and RFC 7095: each §2 figure converts to its Card,
 * the RFC 7095 author card reads the same from vCard text and jCard, and a Card converted to
 * vCard and back is unchanged, localizations and vendor properties included.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { VCard } from "./vcard.js";

import { AUTHOR_JCARD, AUTHOR_VCARD } from "./fixtures/rfc7095.js";
import {
	PROPERTY_EXAMPLES,
	LOCALIZED_NAME,
	LOCALIZED_TITLE,
	BASIC_CARD,
} from "./fixtures/rfc9553.js";
import { VCARD_TO_JSCONTACT } from "./fixtures/rfc9555.js";
import { fromVCard, parseVCard, readJCard, stringifyVCard, toVCard, writeJCard } from "./vcard.js";

import type { JSContact } from "./index.js";

import { parse } from "./index.js";

/** The one card of a vCard text, failing the test when it does not parse. */
function single(text: string): VCard {
	let result = parseVCard(text);
	if (isFailure(result)) throw result.error;
	expect(result.data).toHaveLength(1);
	return result.data[0] as VCard;
}

/**
 * Sorts the components of an unordered Name or Address, whose order carries no meaning;
 * RFC 9555 Figure 12 lists them in another order than its own left-to-right rule.
 */
function unordered(card: Record<string, unknown>): Record<string, unknown> {
	let copy = structuredClone(card);
	let objects = [copy.name, ...Object.values((copy.addresses as Record<string, unknown>) ?? {})];
	for (let object of objects as Array<
		{ components?: Array<{ kind: string }>; isOrdered?: boolean } | undefined
	>) {
		if (object?.components && !object.isOrdered) {
			object.components.sort((a, b) => a.kind.localeCompare(b.kind));
		}
	}
	return copy;
}

describe("fromVCard", () => {
	test.each(VCARD_TO_JSCONTACT)("converts $figure", ({ vcard, card }) => {
		let converted = fromVCard(
			single(["BEGIN:VCARD", "VERSION:4.0", ...vcard, "END:VCARD", ""].join("\r\n")),
		);
		expect(unordered(converted)).toEqual(unordered({ "@type": "Card", version: "2.0", ...card }));
		expect(isFailure(parse(converted))).toBe(false);
	});

	test("generates no uid for a vCard without UID (RFC 9982 §5)", () => {
		let converted = fromVCard(single("BEGIN:VCARD\r\nVERSION:4.0\r\nFN:A\r\nEND:VCARD\r\n"));
		expect(converted).toEqual({ "@type": "Card", version: "2.0", name: { full: "A" } });
	});

	test("ignores JSPROP properties as a whole when one is invalid", () => {
		let converted = fromVCard(
			single('BEGIN:VCARD\r\nJSPROP;JSPTR="a":1\r\nJSPROP;JSPTR="b":{\r\nEND:VCARD\r\n'),
		);
		expect(converted).toEqual({ "@type": "Card", version: "2.0" });
	});

	test("converts the RFC 7095 author card", () => {
		let converted = fromVCard(single(AUTHOR_VCARD));
		expect(converted).toMatchObject({
			name: {
				full: "Simon Perreault",
				components: [
					{ kind: "surname", value: "Perreault" },
					{ kind: "given", value: "Simon" },
					{ kind: "credential", value: "ing. jr" },
					{ kind: "credential", value: "M.Sc." },
				],
			},
			anniversaries: { "ANNIVERSARY-1": { kind: "birth", date: { month: 2, day: 3 } } },
			phones: {
				"PHONE-1": { contexts: { work: true }, features: { voice: true }, pref: 1 },
				"PHONE-2": { features: { mobile: true, voice: true, video: true, text: true } },
			},
			addresses: {
				"ADDR-1": {
					contexts: { work: true },
					coordinates: "geo:46.772673,-71.282945",
					timeZone: "-0500",
				},
			},
			vCardProps: [
				["anniversary", {}, "date-and-or-time", "2009-08-08T14:30-05:00"],
				["gender", {}, "text", "M"],
			],
		});
	});
});

describe("parseVCard and readJCard", () => {
	test("read the RFC 7095 author card alike, but for the appendix's own deviations", () => {
		let text = single(AUTHOR_VCARD).properties;
		let jcard = readJCard(AUTHOR_JCARD);
		if (isFailure(jcard)) throw jcard.error;
		let json = jcard.data.properties;
		expect(
			text.filter((property) => property.name !== "anniversary" && property.name !== "tz"),
		).toEqual(json.filter((property) => property.name !== "anniversary" && property.name !== "tz"));
		expect(text.find((property) => property.name === "anniversary")?.values).toEqual([
			"2009-08-08T14:30-05:00",
		]);
		expect(text.find((property) => property.name === "tz")).toEqual({
			name: "tz",
			parameters: {},
			type: "text",
			values: ["-0500"],
		});
	});

	test("skips malformed jCard properties and rejects a non-jCard", () => {
		let result = readJCard([
			"vcard",
			[["fn", {}, "text", "A"], ["fn"], null, ["fn", [], "text", "B"]],
		]);
		expect(result).toEqual({
			status: "success",
			data: { properties: [{ name: "fn", parameters: {}, type: "text", values: ["A"] }] },
		});
		expect(isFailure(readJCard(["card", []]))).toBe(true);
	});

	test("writes vCard text that reads back to the same properties", () => {
		let card = single(AUTHOR_VCARD);
		let text = stringifyVCard(card);
		expect(text.startsWith("BEGIN:VCARD\r\nVERSION:4.0\r\n")).toBe(true);
		expect(text.split("\r\n").every((line) => new TextEncoder().encode(line).length <= 75)).toBe(
			true,
		);
		expect(single(text)).toEqual(card);
		expect(writeJCard(card)[1][0]).toEqual(["version", {}, "text", "4.0"]);
	});

	test("decodes RFC 6868 caret escapes and folded UTF-8", () => {
		let card = single(
			[
				"BEGIN:VCARD",
				"VERSION:4.0",
				`ADR;LABEL="1 Main^nTown ^'Old^' ^^1":;;;;;;`,
				"NOTE:Grüße aus dem schönen München\\, mit viel Text der gefaltet werden mus",
				" s",
				"END:VCARD",
			].join("\r\n"),
		);
		expect(card.properties[1]?.parameters.label).toBe('1 Main\nTown "Old" ^1');
		expect(card.properties[2]?.values).toEqual([
			"Grüße aus dem schönen München, mit viel Text der gefaltet werden muss",
		]);
		expect(single(stringifyVCard(card))).toEqual(card);
	});

	test.each([
		["FN:A\r\n", /outside BEGIN/],
		["BEGIN:VCARD\r\nFN:A\r\n", /END:VCARD/],
		["BEGIN:VCARD\r\nFN\r\nEND:VCARD\r\n", /no ":"/],
	])("reports %j", (text, message) => {
		let result = parseVCard(text);
		if (!isFailure(result)) throw new Error("expected a failure");
		expect(result.error.message).toMatch(message);
	});
});

describe("toVCard", () => {
	test.each([
		["RFC 9553 Figure 6", BASIC_CARD],
		["RFC 9553 Figures 7 to 44", PROPERTY_EXAMPLES],
		["RFC 9553 Figure 39", LOCALIZED_NAME],
		["RFC 9553 Figure 40", LOCALIZED_TITLE],
	])("converts %s to vCard and back unchanged", (_, document) => {
		let card = document as unknown as JSContact.Card;
		let text = stringifyVCard(toVCard(card));
		expect(fromVCard(single(text))).toEqual(card);
	});

	test.each(VCARD_TO_JSCONTACT)("converts $figure back to the same Card", ({ vcard }) => {
		let card = fromVCard(
			single(["BEGIN:VCARD", "VERSION:4.0", ...vcard, "END:VCARD", ""].join("\r\n")),
		);
		expect(fromVCard(single(stringifyVCard(toVCard(card))))).toEqual(card);
	});

	test("writes a localization as LANGUAGE alternatives sharing an ALTID", () => {
		let text = stringifyVCard(toVCard(LOCALIZED_TITLE as unknown as JSContact.Card));
		expect(text).toContain("TITLE;PROP-ID=t1;ALTID=1:novelist");
		expect(text).toContain("TITLE;PROP-ID=t1;ALTID=1;LANGUAGE=es:escritor");
		expect(text).not.toContain("JSPROP");
	});

	test("orders N with JSCOMPS and derives FN (RFC 9555bis Figure 57)", () => {
		let text = stringifyVCard(
			toVCard({
				"@type": "Card",
				version: "2.0",
				name: {
					components: [
						{ kind: "given", value: "Jane" },
						{ kind: "surname", value: "Doe" },
					],
					isOrdered: true,
				},
			}),
		);
		expect(text).toContain('N;JSCOMPS=";1;0":Doe;Jane;;;;;');
		expect(text).toContain("FN;DERIVED=TRUE:Jane Doe");
	});

	test("carries vendor properties in JSPROP (RFC 9555 Figure 49)", () => {
		let text = stringifyVCard(
			toVCard({ "@type": "Card", version: "2.0", "example.com:foo": { bar: 1234 } }),
		);
		expect(text).toContain('JSPROP;JSPTR="example.com:foo":{"bar":1234}');
		expect(text).toContain("FN:");
	});
});
