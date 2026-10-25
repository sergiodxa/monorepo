/**
 * Holds `parse`, `localize` and `applyPatch` to RFC 9553 and RFC 9982: the specification's
 * own Cards validate and survive a round trip, and each MUST the schema enforces rejects
 * the document that breaks it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import {
	BASIC_CARD,
	GROUP_CARD,
	LOCALIZED_NAME,
	LOCALIZED_TITLE,
	PROPERTY_EXAMPLES,
} from "./fixtures/rfc9553.js";

import type { JSContact } from "./index.js";

import { applyPatch, isUTCDateTime, localize, parse, stringify } from "./index.js";

/** The Card a document parses to, failing the test when it does not. */
function card(source: unknown): JSContact.Card {
	let result = parse(source);
	if (isFailure(result)) throw result.error;
	return result.data;
}

/** The first issue message of a document that must not parse. */
function problem(source: unknown): string {
	let result = parse(source);
	if (isSuccess(result)) throw new Error("expected an invalid Card");
	return result.error.message;
}

describe("parse", () => {
	test.each([
		["Figure 6", BASIC_CARD],
		["Figure 11", GROUP_CARD],
		["Figures 7 to 44", PROPERTY_EXAMPLES],
		["Figure 39", LOCALIZED_NAME],
		["Figure 40", LOCALIZED_TITLE],
	])("accepts RFC 9553 %s and keeps it unchanged", (_, document) => {
		expect(card(document)).toEqual(document);
		expect(card(stringify(card(document)))).toEqual(document);
	});

	test("accepts a version 2.0 Card without uid, as RFC 9982 allows", () => {
		expect(card({ "@type": "Card", version: "2.0" })).toEqual({ "@type": "Card", version: "2.0" });
	});

	test("rejects a version 1.0 Card without uid", () => {
		expect(problem({ "@type": "Card", version: "1.0" })).toMatch(/uid/);
	});

	test.each([
		[{ "@type": "Card", version: "3.0" }, /registered version/],
		[{ "@type": "Card" }, /version/],
		[{ "@type": "Contact", version: "2.0" }, /@type/],
		[{ "@type": "Card", version: "2.0", kind: "Individual" }, /case-sensitive/],
		[{ "@type": "Card", version: "2.0", Name: { full: "x" } }, /case-sensitive/],
		[{ "@type": "Card", version: "2.0", members: { a: true } }, /group/],
		[{ "@type": "Card", version: "2.0", name: {} }, /components or full/],
		[
			{
				"@type": "Card",
				version: "2.0",
				name: { components: [{ kind: "separator", value: " " }], isOrdered: true },
			},
			/Separators/,
		],
		[
			{
				"@type": "Card",
				version: "2.0",
				name: { components: [{ kind: "given", value: "A" }], defaultSeparator: " " },
			},
			/Separators/,
		],
		[
			{
				"@type": "Card",
				version: "2.0",
				name: { components: [{ kind: "given", value: "A" }], sortAs: { surname: "A" } },
			},
			/sortAs/,
		],
		[{ "@type": "Card", version: "2.0", emails: { "bad key": { address: "a@b.c" } } }, /Id/],
		[
			{ "@type": "Card", version: "2.0", emails: { e: { address: "a@b.c", pref: 101 } } },
			/1 to 100/,
		],
		[{ "@type": "Card", version: "2.0", organizations: { o: {} } }, /name or units/],
		[{ "@type": "Card", version: "2.0", onlineServices: { o: { service: "x" } } }, /uri or user/],
		[
			{ "@type": "Card", version: "2.0", addresses: { a: { contexts: { work: true } } } },
			/Address needs/,
		],
		[{ "@type": "Card", version: "2.0", created: "2010-10-10T10:10:10.000Z" }, /UTCDateTime/],
		[
			{
				"@type": "Card",
				version: "2.0",
				anniversaries: { a: { kind: "birth", date: { day: 3 } } },
			},
			/anniversaries\.a\.date/,
		],
		[
			{ "@type": "Card", version: "2.0", localizations: { fr: { localizations: {} } } },
			/localizations/,
		],
	])("rejects %j", (document, message) => {
		expect(problem(document)).toMatch(message);
	});

	test("reports text that is not JSON", () => {
		expect(problem("{")).toMatch(/not JSON/);
	});
});

describe("isUTCDateTime", () => {
	test.each([
		["2010-10-10T10:10:10.003Z", true],
		["2010-10-10T10:10:10Z", true],
		["2010-10-10T10:10:10.000Z", false],
		["2010-10-10T10:10:10.30Z", false],
		["2010-02-30T10:10:10Z", false],
		["2010-10-10t10:10:10z", false],
	])("%s is %s", (value, valid) => {
		expect(isUTCDateTime(value)).toBe(valid);
	});
});

describe("localize", () => {
	test("replaces a top-level property (Figure 39)", () => {
		let result = localize(card(LOCALIZED_NAME), "UK-cyrl");
		if (isFailure(result)) throw result.error;
		expect(result.data.language).toBe("uk-Cyrl");
		expect(result.data.localizations).toBeUndefined();
		expect(result.data.name?.components?.[1]).toEqual({ kind: "given", value: "Иван" });
	});

	test("patches inside a map (Figure 40)", () => {
		let result = localize(card(LOCALIZED_TITLE), "es");
		if (isFailure(result)) throw result.error;
		expect(result.data.titles).toEqual({ t1: { kind: "title", name: "escritor" } });
	});

	test("answers the Card unchanged for a language it has no patch for", () => {
		let document = card(LOCALIZED_TITLE);
		expect(localize(document, "de")).toEqual({ status: "success", data: document });
	});
});

describe("applyPatch", () => {
	let base = { a: { b: 1 }, list: [1, 2] };

	test("sets, removes and replaces array members without touching the input", () => {
		let result = applyPatch(base, { "a/c": 2, "a/b": null, "list/1": 3 });
		expect(result).toEqual({ status: "success", data: { a: { c: 2 }, list: [1, 3] } });
		expect(base).toEqual({ a: { b: 1 }, list: [1, 2] });
	});

	test.each([
		[{ a: 1, "a/b": 2 }, /overlap/],
		[{ "x/y": 1 }, /does not exist/],
		[{ "list/2": 1 }, /array member/],
		[{ "list/0": null }, /array member/],
		[{ "list/-": 1 }, /valid patch pointer/],
	])("rejects %j whole", (patch, message) => {
		let result = applyPatch(base, patch);
		if (isSuccess(result)) throw new Error("expected a failure");
		expect(result.error.message).toMatch(message);
	});
});
