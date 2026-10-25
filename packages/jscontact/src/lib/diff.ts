/**
 * Computes the PatchObject that turns one Card into another, the inverse of `applyPatch`.
 * A vCard conversion derives a language's `localizations` entry with it, and the JSPROP
 * properties that carry what vCard has no property for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSContact } from "../types.js";

/** What a diff may produce. */
export interface DiffOptions {
	/**
	 * Whether a patch may point inside an array of the same length; JSPROP pointers must not.
	 *
	 * @default false
	 */
	arrays?: boolean;
	/** Property names compared only at the top level, such as `@type`, which nested objects imply. */
	topLevelOnly?: ReadonlySet<string>;
}

/** Whether a value is a plain JSON object. */
function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Escapes one reference token for a JSON Pointer. */
function token(key: string | number): string {
	return String(key).replace(/~/g, "~0").replace(/\//g, "~1");
}

/** Deep equality of JSON values, ignoring the order of object keys. */
export function equal(left: unknown, right: unknown): boolean {
	if (left === right) return true;
	if (Array.isArray(left) && Array.isArray(right)) {
		return left.length === right.length && left.every((item, index) => equal(item, right[index]));
	}
	if (isObject(left) && isObject(right)) {
		let keys = Object.keys(left);
		return (
			keys.length === Object.keys(right).length &&
			keys.every((key) => Object.hasOwn(right, key) && equal(left[key], right[key]))
		);
	}
	return false;
}

/**
 * The patches that turn `from` into `to`: a changed or added property is set, a removed one
 * is `null`, and objects present in both are compared member by member.
 *
 * @param from - The object the patch applies to
 * @param to - The object it should produce
 * @param options - Whether to point into arrays, and which names to compare only at the top
 * @returns The PatchObject, empty when the two are equal
 */
export function diff(from: object, to: object, options: DiffOptions = {}): JSContact.PatchObject {
	let patch: JSContact.PatchObject = {};
	walk(from, to, "", 0, patch, options);
	return patch;
}

/** Adds the patches for one pair of values at a path. */
function walk(
	from: unknown,
	to: unknown,
	path: string,
	depth: number,
	patch: JSContact.PatchObject,
	options: DiffOptions,
): void {
	if (equal(from, to)) return;
	if (isObject(from) && isObject(to)) {
		let skip = depth > 0 ? options.topLevelOnly : undefined;
		for (let key of new Set([...Object.keys(from), ...Object.keys(to)])) {
			if (skip?.has(key)) continue;
			let child = path === "" ? token(key) : `${path}/${token(key)}`;
			if (!Object.hasOwn(to, key)) patch[child] = null;
			else if (!Object.hasOwn(from, key)) patch[child] = to[key];
			else walk(from[key], to[key], child, depth + 1, patch, options);
		}
		return;
	}
	if (options.arrays && Array.isArray(from) && Array.isArray(to) && from.length === to.length) {
		for (let index = 0; index < to.length; index++) {
			walk(from[index], to[index], `${path}/${token(index)}`, depth + 1, patch, options);
		}
		return;
	}
	patch[path] = to;
}
