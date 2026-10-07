/**
 * Reads the dotted path a condition names out of a context. A condition written
 * against a field the caller did not send has to see nothing there, so every
 * miss answers with `undefined`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONValue } from "@sdxc/types";

/** A canonical array index: no sign, no leading zero, so `roles.01` reads nothing. */
const ARRAY_INDEX = /^(?:0|[1-9]\d*)$/;

/** Whatever a context field may hold, plus the absence a miss answers with. */
export type ContextValue = Date | JSONValue | undefined;

/** What an expression is evaluated against: JSON fields, with `Date` values allowed. */
export interface Context {
	readonly [field: string]: ContextValue;
}

/**
 * Walks `path` segment by segment, so `plan.tier` reads a nested structure,
 * `country` a scalar and `roles.0` an array element. Every dot separates, so a
 * field is addressed by the shape it sits inside.
 *
 * @param context The fields an expression is evaluated against.
 * @param path A dotted path; an empty one resolves to nothing.
 * @returns The value at the path, or `undefined` when it resolves to nothing; a
 * field explicitly holding `null` reads back as `null`.
 * @example read({ plan: { tier: "pro" } }, "plan.tier") // "pro"
 */
export function read(context: object, path: string): ContextValue {
	if (path === "") return undefined;

	let current: unknown = context;
	for (let segment of path.split(".")) current = step(current, segment);

	return current as ContextValue;
}

/**
 * Descends one segment, answering with nothing whenever the value in hand has
 * no such member — a primitive, an array under a non-index segment, or an
 * object without the key.
 */
function step(value: unknown, segment: string): unknown {
	if (Array.isArray(value)) {
		return ARRAY_INDEX.test(segment) ? value[Number(segment)] : undefined;
	}

	if (!isTraversable(value)) return undefined;

	return Object.hasOwn(value, segment) ? value[segment] : undefined;
}

/**
 * Recognizes the structures a path descends into, which keeps a context field
 * carrying a `Date` a value a condition compares whole.
 */
function isTraversable(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !(value instanceof Date);
}
