/**
 * Generates a JSON Patch that turns one document into another, for a client that edits a
 * snapshot and sends operations, or an audit log that records what an update changed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { stringify } from "@sdxc/json-pointer";

import type { JSONObject, JSONValue } from "./json-value.js";
import type { Operation } from "./operation.js";

import { isEqual, isJSONObject } from "./json-value.js";

/**
 * A patch for which `apply(source, patch)` equals `target`. Objects are compared member by
 * member, arrays keep their shared leading and trailing elements and edit the span between
 * them in place, and anything else that changed is a `replace`. Equal documents give `[]`.
 *
 * @param source - The document the patch will be applied to.
 * @param target - The document applying the patch must produce.
 * @returns The operations, every `value` a copy that shares nothing with `target`.
 * @example diff({ tags: ["a", "c"] }, { tags: ["a", "b", "c"] }); // [{ op: "add", path: "/tags/1", value: "b" }]
 */
export function diff(source: JSONValue, target: JSONValue): Operation[] {
	let operations: Operation[] = [];
	diffValues(source, target, [], operations);
	return operations;
}

/** Appends the operations between two values at `path` to `operations`. */
function diffValues(
	source: JSONValue,
	target: JSONValue,
	path: (string | number)[],
	operations: Operation[],
): void {
	if (isEqual(source, target)) return;
	if (isJSONObject(source) && isJSONObject(target)) {
		diffObjects(source, target, path, operations);
		return;
	}
	if (Array.isArray(source) && Array.isArray(target)) {
		diffArrays(source, target, path, operations);
		return;
	}
	operations.push({ op: "replace", path: stringify(path), value: structuredClone(target) });
}

/** Removes the members `target` lacks, then adds or recurses into each of its members. */
function diffObjects(
	source: JSONObject,
	target: JSONObject,
	path: (string | number)[],
	operations: Operation[],
): void {
	for (let key of Object.keys(source)) {
		if (!Object.hasOwn(target, key))
			operations.push({ op: "remove", path: stringify([...path, key]) });
	}
	for (let [key, value] of Object.entries(target)) {
		if (Object.hasOwn(source, key)) {
			diffValues(source[key] as JSONValue, value, [...path, key], operations);
		} else {
			operations.push({
				op: "add",
				path: stringify([...path, key]),
				value: structuredClone(value),
			});
		}
	}
}

/**
 * Trims the common prefix and suffix, edits the overlapping span element by element, then
 * removes the extra source elements or inserts the extra target ones. Lengths only change
 * after every in-place edit, so each index is valid when its operation runs.
 */
function diffArrays(
	source: JSONValue[],
	target: JSONValue[],
	path: (string | number)[],
	operations: Operation[],
): void {
	let start = 0;
	while (
		start < source.length &&
		start < target.length &&
		isEqual(source[start] as JSONValue, target[start] as JSONValue)
	) {
		start++;
	}
	let sourceEnd = source.length;
	let targetEnd = target.length;
	while (
		sourceEnd > start &&
		targetEnd > start &&
		isEqual(source[sourceEnd - 1] as JSONValue, target[targetEnd - 1] as JSONValue)
	) {
		sourceEnd--;
		targetEnd--;
	}

	let shared = Math.min(sourceEnd - start, targetEnd - start);
	for (let offset = 0; offset < shared; offset++) {
		let position = start + offset;
		diffValues(
			source[position] as JSONValue,
			target[position] as JSONValue,
			[...path, position],
			operations,
		);
	}
	for (let position = sourceEnd - 1; position >= start + shared; position--) {
		operations.push({ op: "remove", path: stringify([...path, position]) });
	}
	for (let position = start + shared; position < targetEnd; position++) {
		operations.push({
			op: "add",
			path: stringify([...path, position]),
			value: structuredClone(target[position] as JSONValue),
		});
	}
}
