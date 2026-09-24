/**
 * Checks for `schema.pipe(...)`: the six `remix/data-schema` checks with their codes and
 * messages, plus pattern and item-count checks, each carrying the JSON Schema keyword
 * that documents it so the rule that runs and the rule that is published agree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import * as checks from "remix/data-schema/checks";

import type { Check } from "./types.js";

/**
 * Requires at least `length` characters, or items for an array, where it documents as
 * `minItems`.
 *
 * @param length - The inclusive minimum.
 * @example s.string().pipe(minLength(1));
 */
export function minLength(length: number): Check<string | readonly unknown[]> {
	return { ...(checks.minLength(length) as Check<unknown>), keywords: { minLength: length } };
}

/**
 * Requires at most `length` characters, or items for an array, where it documents as
 * `maxItems`.
 *
 * @param length - The inclusive maximum.
 * @example s.string().pipe(maxLength(255));
 */
export function maxLength(length: number): Check<string | readonly unknown[]> {
	return { ...(checks.maxLength(length) as Check<unknown>), keywords: { maxLength: length } };
}

/**
 * Requires a number greater than or equal to `limit`.
 *
 * @param limit - The inclusive minimum.
 * @example s.integer().pipe(min(60));
 */
export function min(limit: number): Check<number> {
	return { ...checks.min(limit), keywords: { minimum: limit } };
}

/**
 * Requires a number less than or equal to `limit`.
 *
 * @param limit - The inclusive maximum.
 * @example s.integer().pipe(max(3600));
 */
export function max(limit: number): Check<number> {
	return { ...checks.max(limit), keywords: { maximum: limit } };
}

/** Requires an email-shaped string, documented as `format: "email"`. */
export function email(): Check<string> {
	return { ...checks.email(), keywords: { format: "email" } };
}

/** Requires a string `new URL()` accepts, documented as `format: "uri"`. */
export function url(): Check<string> {
	return { ...checks.url(), keywords: { format: "uri" } };
}

/**
 * Requires a string matching `regex`, documented as `pattern: regex.source`. The check
 * tests a copy without the `g` and `y` flags, so it never carries `lastIndex` between calls.
 *
 * @param regex - The pattern; write it in the syntax JSON Schema and JavaScript share.
 * @example s.string().pipe(pattern(/^mon_[a-z0-9]{26}$/));
 */
export function pattern(regex: RegExp): Check<string> {
	let stateless = new RegExp(regex.source, regex.flags.replaceAll(/[gy]/g, ""));
	return {
		check: (value) => stateless.test(value),
		code: "string.pattern",
		values: { pattern: regex.source },
		message: `Expected string matching ${regex.source}`,
		keywords: { pattern: regex.source },
	};
}

/**
 * Requires an array of at least `count` items.
 *
 * @param count - The inclusive minimum.
 * @example s.array(s.string()).pipe(minItems(1));
 */
export function minItems(count: number): Check<readonly unknown[]> {
	return {
		check: (value) => value.length >= count,
		code: "array.min_items",
		values: { min: count },
		message: `Expected at least ${count} items`,
		keywords: { minItems: count },
	};
}

/**
 * Requires an array of at most `count` items.
 *
 * @param count - The inclusive maximum.
 * @example s.array(s.string()).pipe(maxItems(50));
 */
export function maxItems(count: number): Check<readonly unknown[]> {
	return {
		check: (value) => value.length <= count,
		code: "array.max_items",
		values: { max: count },
		message: `Expected at most ${count} items`,
		keywords: { maxItems: count },
	};
}
