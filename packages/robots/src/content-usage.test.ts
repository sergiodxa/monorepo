/**
 * Exercises the AI Preferences signals: the robots.txt `Content-Usage` rule read, written and
 * evaluated per path and agent (including the attachment draft's own example), and the HTTP
 * field read and written as an RFC 9651 Dictionary.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import {
	combinePreferences,
	getContentUsage,
	parseContentUsage,
	setContentUsage,
	stringifyContentUsage,
} from "./content-usage.js";

import type { Robots } from "./index.js";

import { contentUsage, parse, stringify } from "./index.js";

/** The attachment draft's §3.4 example, verbatim. */
const DRAFT_EXAMPLE = `User-Agent: *
Allow: /
Disallow: /never/
Content-Usage: train-ai=n
Content-Usage: /ai-ok/ train-ai=y

User-Agent: ExampleBot
Allow: /
Content-Usage: train-ai=y
`;

describe(parseContentUsage, () => {
	test("reads y and n Tokens for every label, extensions included", () => {
		expect(parseContentUsage("train-ai=n, ai-use=y, search=y, x-new=n")).toEqual({
			"train-ai": false,
			"ai-use": true,
			search: true,
			"x-new": false,
		});
	});

	test("leaves a label unknown when its value is not the Token y or n", () => {
		expect(parseContentUsage('train-ai, search="n", ai-use=yes')).toEqual({});
	});

	test("takes the last value of a repeated label and ignores parameters", () => {
		expect(parseContentUsage("train-ai;allow=n, train-ai=y")).toEqual({ "train-ai": true });
		expect(parseContentUsage('train-ai=y, train-ai, search=n, search="n"')).toEqual({});
	});

	test("leaves everything unknown for an uppercase label, since labels are case-sensitive", () => {
		expect(parseContentUsage("Train-AI=n, search=y")).toEqual({});
	});
});

describe(stringifyContentUsage, () => {
	test("writes a canonical Dictionary of Tokens, skipping unknown categories", () => {
		expect(stringifyContentUsage({ search: true, "train-ai": false, "ai-use": undefined })).toBe(
			"search=y, train-ai=n",
		);
	});

	test("drops a label that cannot be a Dictionary key", () => {
		expect(stringifyContentUsage({ "Train-AI": false, search: true })).toBe("search=y");
	});
});

describe(combinePreferences, () => {
	test("keeps the most restrictive preference per category", () => {
		expect(
			combinePreferences({ "train-ai": true, search: true }, { "train-ai": false }, {}),
		).toEqual({ "train-ai": false, search: true });
	});
});

describe("Content-Usage field", () => {
	test("round-trips through Headers", () => {
		let headers = new Headers();
		setContentUsage(headers, { search: true, "train-ai": false });
		expect(headers.get("content-usage")).toBe("search=y, train-ai=n");
		expect(getContentUsage(new Response(null, { headers }))).toEqual({
			search: true,
			"train-ai": false,
		});
	});

	test("deletes the field when no category has a preference", () => {
		let headers = new Headers({ "Content-Usage": "train-ai=n" });
		setContentUsage(headers, {});
		expect(headers.has("content-usage")).toBe(false);
	});

	test("reads an absent or invalid field as all unknown", () => {
		expect(getContentUsage(new Headers())).toEqual({});
		expect(getContentUsage(new Headers({ "Content-Usage": "train-ai=n," }))).toEqual({});
	});
});

describe("robots.txt Content-Usage rule", () => {
	test("reads rules with and without a path into their group", () => {
		let document = parse(
			"User-agent: *\nContent-Usage: train-ai=n # comment\nContent-Usage:\t/ai-ok/\ttrain-ai=y, search=y\n",
		);
		expect(document.groups[0]?.contentUsage).toEqual<Robots.ContentUsageRule[]>([
			{ preferences: { "train-ai": false } },
			{ pattern: "/ai-ok/", preferences: { "train-ai": true, search: true } },
		]);
	});

	test("ends the group's user-agent list like any other rule", () => {
		let document = parse("User-agent: a\nContent-Usage: search=y\nUser-agent: b\n");
		expect(document.groups).toHaveLength(2);
	});

	test("round-trips through stringify, keeping a leading rule outside every group", () => {
		let document = parse(`Content-Usage: search=y\n\n${DRAFT_EXAMPLE}`);
		expect(document.records).toEqual([{ name: "content-usage", value: "search=y" }]);
		expect(parse(stringify(document))).toEqual(document);
		expect(stringify(document)).toContain("Content-Usage: /ai-ok/ train-ai=y\n");
	});

	test("evaluates the draft's example table", () => {
		let document = parse(DRAFT_EXAMPLE);
		expect(contentUsage(document, "OtherBot", "/test")).toEqual({ "train-ai": false });
		expect(contentUsage(document, "OtherBot", "/never/test")).toBeNull();
		expect(contentUsage(document, "OtherBot", "https://example.com/ai-ok/test")).toEqual({
			"train-ai": true,
		});
		expect(contentUsage(document, "ExampleBot/1.0", "/never/test")).toEqual({ "train-ai": true });
	});

	test("combines rules tied at the longest match most-restrictive-first", () => {
		let document = parse(
			"User-agent: *\nContent-Usage: /a/ train-ai=y, search=y\nContent-Usage: /a/ train-ai=n\nContent-Usage: ai-use=n\n",
		);
		expect(contentUsage(document, "Bot", "/a/b")).toEqual({ "train-ai": false, search: true });
		expect(contentUsage(document, "Bot", "/b")).toEqual({ "ai-use": false });
	});

	test("answers {} for a crawlable path no rule covers", () => {
		let document = parse("User-agent: *\nContent-Usage: /blog/ train-ai=n\n");
		expect(contentUsage(document, "Bot", "/docs")).toEqual({});
	});
});
