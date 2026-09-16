/**
 * The whole of a rule's matching language: one field, one piece of text, and a
 * case-insensitive substring test with nothing else in it.
 *
 * It is a plain `includes` over normalized text because it runs inside the reader's own
 * single-threaded object on the path that also serves their timeline, and no input to
 * `includes` takes more than linear time — so a pattern a reader wrote, was handed, or
 * pasted from somewhere can never wedge the object evaluating it. Nothing here reaches a
 * database or a clock.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RuleField } from "~/database/schema";

import { RULE_ACTIONS, RULE_FIELDS, RULE_VALUE_LENGTH } from "~/database/schema";

/** The part of a post a rule reads, which is every field a rule may name. */
export interface RuleSubject {
	title: string;
	url: string | null;
	summary: string | null;
	author: string | null;
}

/** One rule, reduced to what deciding a match needs. */
export interface RuleTerm {
	field: RuleField;
	/** The needle, already folded by {@link foldRuleText}. */
	value: string;
}

/**
 * The form both the needle and the field are compared in: NFKC, then case-folded. Doing it
 * on both sides is what makes `Café` written two ways one word and `SPONSORED` the same
 * term as `sponsored`.
 *
 * @param input - Text from a form, or a field off an arriving item.
 */
export function foldRuleText(input: string): string {
	return input.normalize("NFKC").toLowerCase();
}

/**
 * Reads what somebody typed as a rule's term, or answers `null` for text that is not one.
 *
 * The term keeps the spelling the reader gave it and carries the folded form matching is
 * taken over, so the rule list prints their own words while the test ignores case.
 *
 * @param input - The text as it arrived from a form.
 * @example let term = foldRuleValue(" Sponsored "); // { value: "Sponsored", folded: "sponsored" }
 */
export function foldRuleValue(input: string): { value: string; folded: string } | null {
	let value = input.normalize("NFKC").trim();
	if (value.length === 0 || value.length > RULE_VALUE_LENGTH) return null;

	return { value, folded: value.toLowerCase() };
}

/**
 * What one rule looks at on one post, or `null` for a field the publisher left empty,
 * which no term matches.
 *
 * @param subject - The item being decided.
 * @param field - The field the rule names.
 */
export function ruleField(subject: RuleSubject, field: RuleField): string | null {
	if (field === "title") return subject.title;
	if (field === "url") return subject.url;
	if (field === "summary") return subject.summary;

	return subject.author;
}

/**
 * Whether one rule's term appears in the field it names.
 *
 * @param subject - The item being decided.
 * @param rule - The field and the already-folded needle.
 * @example if (matchesRule(item, { field: "title", value: "sponsored" })) drop(item);
 */
export function matchesRule(subject: RuleSubject, rule: RuleTerm): boolean {
	let field = ruleField(subject, rule.field);
	if (field === null) return false;

	return foldRuleText(field).includes(rule.value);
}

/** Whether a submitted value is one of the fields the column's `CHECK` allows. */
export function isRuleField(value: string): value is RuleField {
	return RULE_FIELDS.some((offered) => offered === value);
}

/** Whether a submitted value is one of the actions the column's `CHECK` allows. */
export function isRuleAction(value: string): value is (typeof RULE_ACTIONS)[number] {
	return RULE_ACTIONS.some((offered) => offered === value);
}
