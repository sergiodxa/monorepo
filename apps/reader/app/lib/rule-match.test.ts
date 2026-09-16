/**
 * Tests the whole of a rule's matching language, which is a case-insensitive substring
 * test and nothing else: what a term may be, what folding makes equal, and which fields a
 * rule can read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	foldRuleText,
	foldRuleValue,
	isRuleAction,
	isRuleField,
	matchesRule,
	ruleField,
} from "~/app/lib/rule-match";
import { RULE_VALUE_LENGTH } from "~/database/schema";

/** A post as the language reads it, defaulting the fields a test is not about. */
function post(overrides: Partial<Parameters<typeof matchesRule>[0]> = {}) {
	return { title: "A post", url: null, summary: null, author: null, ...overrides };
}

describe("reading a term", () => {
	test("keeps the spelling the reader gave it, and folds the form it matches by", () => {
		expect(foldRuleValue("  Sponsored  ")).toEqual({ value: "Sponsored", folded: "sponsored" });
	});

	test("refuses a term of nothing but space, and one longer than a filter usefully is", () => {
		expect(foldRuleValue("   ")).toBeNull();
		expect(foldRuleValue("x".repeat(RULE_VALUE_LENGTH + 1))).toBeNull();
		expect(foldRuleValue("x".repeat(RULE_VALUE_LENGTH))).not.toBeNull();
	});

	test("normalizes to NFKC, so two spellings of one word are one term", () => {
		expect(foldRuleText("ＳＰＯＮＳＯＲＥＤ")).toBe(foldRuleText("sponsored"));
	});
});

describe("matching a post", () => {
	test("finds the term anywhere in the field, ignoring case", () => {
		expect(
			matchesRule(post({ title: "A SPONSORED slot" }), { field: "title", value: "sponsored" }),
		).toBe(true);
	});

	test("matches nothing on a field the publisher left empty", () => {
		expect(matchesRule(post({ author: null }), { field: "author", value: "desk" })).toBe(false);
	});

	test("reads each of the four fields a rule may name", () => {
		let subject = post({
			title: "Title",
			url: "https://example.com/link",
			summary: "Summary",
			author: "Author",
		});

		expect(ruleField(subject, "title")).toBe("Title");
		expect(ruleField(subject, "url")).toBe("https://example.com/link");
		expect(ruleField(subject, "summary")).toBe("Summary");
		expect(ruleField(subject, "author")).toBe("Author");
	});

	/**
	 * The language has no worst case by construction, so the pattern that wedges a backtracking
	 * engine is here as an ordinary term that matches nothing.
	 */
	test("treats a regular expression as the text it is", () => {
		let pattern = `(a+)+$`;

		expect(
			matchesRule(post({ title: "aaaaaaaaaaaaaaaaaaaaaaaaX" }), { field: "title", value: pattern }),
		).toBe(false);

		expect(
			matchesRule(post({ title: `a title with (a+)+$ in it` }), { field: "title", value: pattern }),
		).toBe(true);
	});
});

describe("what the named lists allow", () => {
	test("accepts only a field and an action the column's CHECK carries", () => {
		expect(isRuleField("title")).toBe(true);
		expect(isRuleField("body")).toBe(false);

		expect(isRuleAction("mark_read")).toBe(true);
		expect(isRuleAction("save")).toBe(false);
	});
});
