/**
 * Exercises the per-page robots directives shared by `X-Robots-Tag` and the `robots` meta tag:
 * the documented directive list, bot-scoped sets, value-carrying directives, `unavailable_after`
 * dates, merging a response's headers for one bot, and writing a set back.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import type { Directives } from "./directives.js";

import { directivesFor, parseDirectives, stringifyDirectives } from "./directives.js";

/** A set with every directive off, which each expectation below overrides. */
const EMPTY: Directives.Set = {
	botName: null,
	noindex: false,
	nofollow: false,
	noarchive: false,
	nosnippet: false,
	noimageindex: false,
	notranslate: false,
	other: [],
};

describe(parseDirectives, () => {
	test("reads the boolean directives, in any case and spacing", () => {
		expect(
			parseDirectives("NoIndex ,nofollow,  noarchive, nosnippet, noimageindex, notranslate"),
		).toEqual([
			{
				...EMPTY,
				noindex: true,
				nofollow: true,
				noarchive: true,
				nosnippet: true,
				noimageindex: true,
				notranslate: true,
			},
		]);
	});

	test("reads none as noindex and nofollow, and all, index and follow as the defaults", () => {
		expect(parseDirectives("none")).toEqual([{ ...EMPTY, noindex: true, nofollow: true }]);
		expect(parseDirectives("all, index, follow")).toEqual([EMPTY]);
	});

	test("reads the value-carrying directives", () => {
		expect(
			parseDirectives("max-snippet: 50, max-image-preview: large, max-video-preview:-1"),
		).toEqual([{ ...EMPTY, maxSnippet: 50, maxImagePreview: "large", maxVideoPreview: -1 }]);
	});

	test("reads unavailable_after in ISO 8601 and RFC 850 forms", () => {
		expect(parseDirectives("unavailable_after: 2026-12-31")[0]?.unavailableAfter).toEqual(
			new Date("2026-12-31"),
		);
		expect(
			parseDirectives("unavailable_after: Thursday, 31-Dec-26 15:00:00 GMT, noarchive")[0],
		).toEqual({
			...EMPTY,
			noarchive: true,
			unavailableAfter: new Date(Date.UTC(2026, 11, 31, 15)),
		});
	});

	test("keeps an unreadable value in other rather than guessing", () => {
		expect(parseDirectives("max-snippet: lots, unavailable_after: someday")).toEqual([
			{ ...EMPTY, other: ["max-snippet: lots", "unavailable_after: someday"] },
		]);
	});

	test("keeps unknown directives, lower-cased, in other", () => {
		expect(parseDirectives("noai, NoImageAI, indexifembedded")).toEqual([
			{ ...EMPTY, other: ["noai", "noimageai", "indexifembedded"] },
		]);
	});

	test("splits bot-scoped sets, a scope running until the next one", () => {
		expect(parseDirectives("googlebot: noindex, nofollow, otherbot: noarchive")).toEqual([
			{ ...EMPTY, botName: "googlebot", noindex: true, nofollow: true },
			{ ...EMPTY, botName: "otherbot", noarchive: true },
		]);
	});

	test("keeps the unscoped directives before the first bot in their own set", () => {
		expect(parseDirectives("noarchive, BingBot: noindex")).toEqual([
			{ ...EMPTY, noarchive: true },
			{ ...EMPTY, botName: "bingbot", noindex: true },
		]);
	});

	test("reads a bot-scoped value-carrying directive", () => {
		expect(parseDirectives("googlebot: max-snippet: 20")).toEqual([
			{ ...EMPTY, botName: "googlebot", maxSnippet: 20 },
		]);
	});

	test("reads an empty value as no sets", () => {
		expect(parseDirectives("")).toEqual([]);
		expect(parseDirectives(" , ")).toEqual([]);
	});
});

describe(directivesFor, () => {
	/** A response carrying the given `X-Robots-Tag` values, one header each. */
	function response(...tags: string[]) {
		let headers = new Headers();
		for (let tag of tags) headers.append("x-robots-tag", tag);
		return new Response(null, { headers });
	}

	test("merges the unscoped set with the bot's own, ignoring other bots", () => {
		let set = directivesFor(
			response("noarchive", "sergioreader: nosnippet", "otherbot: noindex"),
			"SergioReader/1.0 (+https://sergiodxa.com/bot)",
		);

		expect(set).toEqual({ ...EMPTY, noarchive: true, nosnippet: true });
	});

	test("keeps the most restrictive value where two sets disagree", () => {
		let set = directivesFor(
			response(
				"max-snippet: 100, max-image-preview: large, unavailable_after: 2027-01-01",
				"reader: max-snippet: 20, max-image-preview: standard, unavailable_after: 2026-10-01",
			),
			"reader",
		);

		expect(set).toMatchObject({
			maxSnippet: 20,
			maxImagePreview: "standard",
			unavailableAfter: new Date("2026-10-01"),
		});
	});

	test("answers every directive off for a response without the header", () => {
		expect(directivesFor(new Response(null), "reader")).toEqual(EMPTY);
	});

	test("reads noarchive scoped to the bot, the case an article cache checks", () => {
		expect(directivesFor(response("reader: noarchive"), "Reader/2").noarchive).toBe(true);
		expect(directivesFor(response("otherbot: noarchive"), "Reader/2").noarchive).toBe(false);
	});
});

describe(stringifyDirectives, () => {
	test("writes only what departs from the defaults", () => {
		expect(stringifyDirectives({ noindex: true })).toBe("noindex");
		expect(stringifyDirectives({})).toBe("");
	});

	test("spells out index and follow when explicit, byte for byte as a meta tag writes them", () => {
		expect(stringifyDirectives({}, { explicit: true })).toBe("index, follow");
		expect(stringifyDirectives({ noindex: true }, { explicit: true })).toBe("noindex, follow");
		expect(stringifyDirectives({ nofollow: true }, { explicit: true })).toBe("index, nofollow");
		expect(stringifyDirectives({ noindex: true, nofollow: true }, { explicit: true })).toBe(
			"noindex, nofollow",
		);
	});

	test("writes every field, scoped to a bot", () => {
		expect(
			stringifyDirectives({
				botName: "googlebot",
				noarchive: true,
				nosnippet: true,
				noimageindex: true,
				notranslate: true,
				maxSnippet: 50,
				maxImagePreview: "none",
				maxVideoPreview: 0,
				unavailableAfter: new Date(Date.UTC(2026, 11, 31)),
				other: ["noai"],
			}),
		).toBe(
			"googlebot: noarchive, nosnippet, noimageindex, notranslate, max-snippet: 50, max-image-preview: none, max-video-preview: 0, unavailable_after: 2026-12-31T00:00:00.000Z, noai",
		);
	});

	test("round-trips through parseDirectives", () => {
		let set: Directives.Set = {
			...EMPTY,
			botName: "reader",
			noindex: true,
			maxSnippet: 10,
			unavailableAfter: new Date(Date.UTC(2027, 0, 1)),
			other: ["noai"],
		};

		expect(parseDirectives(stringifyDirectives(set))).toEqual([set]);
	});
});
