/**
 * The AI Preferences statement format: an RFC 9651 Dictionary of usage-category labels mapped
 * to the Tokens `y` and `n`. Shared by the robots.txt `Content-Usage` rule and the HTTP field,
 * which carry the same statement in two places.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure } from "@sdxc/result";
import { Token, parse as parseField, stringify as stringifyField } from "@sdxc/structured-fields";

import type { Robots } from "../index.js";

/** An RFC 9651 Dictionary key; a label outside it has no serialization. */
const KEY = /^[a-z*][a-z0-9_\-.*]*$/;

/**
 * Reads a statement of preference. A label set to the Token `y` is allowed and `n` disallowed;
 * any other value leaves that label unknown, parameters are dropped, and text that is not a
 * valid Dictionary (an uppercase label included) leaves every category unknown.
 *
 * @param value - The statement, such as `train-ai=n, search=y`.
 * @returns The labels with an explicit preference.
 */
export function readPreferences(value: string): Robots.UsagePreferences {
	let preferences: Robots.UsagePreferences = {};
	let parsed = parseField(value, "dictionary");
	if (isFailure(parsed)) return preferences;

	for (let [label, member] of Object.entries(parsed.data)) {
		if (!("value" in member) || !(member.value instanceof Token)) continue;
		if (member.value.value === "y") preferences[label] = true;
		if (member.value.value === "n") preferences[label] = false;
	}

	return preferences;
}

/**
 * Writes a statement of preference in canonical Dictionary form; unknown categories and labels
 * that cannot be Dictionary keys are left out, so the result always reads back the same.
 *
 * @param preferences - `true` to allow a category, `false` to disallow it.
 * @returns The statement, `""` when no category has a preference.
 */
export function writePreferences(preferences: Robots.UsagePreferences): string {
	let dictionary: Record<string, Token> = {};
	for (let [label, allowed] of Object.entries(preferences)) {
		if (allowed === undefined || !KEY.test(label)) continue;
		dictionary[label] = new Token(allowed ? "y" : "n");
	}

	let text = stringifyField(dictionary, "dictionary");
	return isFailure(text) ? "" : text.data;
}

/**
 * Combines statements so the most restrictive preference wins: a category any statement
 * disallows is disallowed, one any statement allows is otherwise allowed, and the rest stay
 * unknown.
 *
 * @param statements - The statements that apply to one asset, in any order.
 * @example combinePreferences(fromRobotsTxt, fromHeader)
 */
export function combinePreferences(
	...statements: Robots.UsagePreferences[]
): Robots.UsagePreferences {
	let combined: Robots.UsagePreferences = {};
	for (let statement of statements) {
		for (let [label, allowed] of Object.entries(statement)) {
			if (allowed === undefined) continue;
			combined[label] = (combined[label] ?? true) && allowed;
		}
	}
	return combined;
}
