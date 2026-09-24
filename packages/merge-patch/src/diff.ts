/**
 * Generates the merge patch between two JSON values, the inverse of `apply`, for a client
 * that edits a snapshot and sends only what changed, or a server that writes only the
 * members a patch touched.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { JSONObject, JSONValue } from "./json-value.js";

import { isJSONObject, setMember } from "./json-value.js";

/** Signals that the target sets an object member to `null`, which a merge patch reads as removal. */
export class UnrepresentableChangeError extends Error {
	override name = "UnrepresentableChangeError";

	/** RFC 6901 JSON Pointer to the member holding `null` in the target. */
	readonly pointer: string;

	/** @param pointer - The member, as a JSON Pointer into the target. */
	constructor(pointer: string) {
		super(`A merge patch cannot set ${pointer} to null; null removes the member.`);
		this.pointer = pointer;
	}
}

/**
 * The smallest merge patch that turns `source` into `target`: removed members become
 * `null`, changed arrays and scalars are sent whole, and `{}` means two objects are equal.
 * A non-object target is its own patch, so two equal non-objects produce the target.
 *
 * @param source - The value the patch will be applied to.
 * @param target - The value applying the patch must produce.
 * @returns The patch, or the first member whose `null` value no merge patch can write.
 * @example diff({ a: 1, b: [1] }, { b: [2], c: 3 }) // success({ a: null, b: [2], c: 3 })
 */
export function diff(
	source: JSONValue,
	target: JSONValue,
): Result<JSONValue, UnrepresentableChangeError> {
	if (!isJSONObject(target)) return success(structuredClone(target));
	if (!isJSONObject(source)) return copyObject(target, "");
	return diffObjects(source, target, "");
}

/** Extends a JSON Pointer by one member, escaping `~` and `/` per RFC 6901. */
function childPointer(pointer: string, key: string): string {
	return `${pointer}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`;
}

/** The member-wise patch between two objects, recursing wherever both sides hold an object. */
function diffObjects(
	source: JSONObject,
	target: JSONObject,
	pointer: string,
): Result<JSONObject, UnrepresentableChangeError> {
	let patch: JSONObject = {};

	for (let key of Object.keys(source)) {
		if (!Object.hasOwn(target, key)) setMember(patch, key, null);
	}

	for (let [key, next] of Object.entries(target)) {
		let at = childPointer(pointer, key);
		if (next === null) return failure(new UnrepresentableChangeError(at));

		let previous = Object.hasOwn(source, key) ? source[key] : undefined;

		if (isJSONObject(next)) {
			let member = isJSONObject(previous) ? diffObjects(previous, next, at) : copyObject(next, at);
			if (isFailure(member)) return member;
			/** An empty member patch between two objects means nothing below it changed. */
			if (isJSONObject(previous) && Object.keys(member.data).length === 0) continue;
			setMember(patch, key, member.data);
			continue;
		}

		if (previous !== undefined && isEqual(previous, next)) continue;
		setMember(patch, key, structuredClone(next));
	}

	return success(patch);
}

/**
 * Copies an object the patch adds whole. Applying it merges into `{}`, which drops every
 * `null` member at any depth, so one of those anywhere inside makes the target unreachable.
 */
function copyObject(
	value: JSONObject,
	pointer: string,
): Result<JSONObject, UnrepresentableChangeError> {
	return diffObjects({}, value, pointer);
}

/** Structural equality over JSON values, with object members compared regardless of order. */
function isEqual(left: JSONValue, right: JSONValue): boolean {
	if (left === right) return true;

	if (Array.isArray(left) || Array.isArray(right)) {
		if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
		return left.every((item, index) => isEqual(item, right[index] as JSONValue));
	}

	if (!isJSONObject(left) || !isJSONObject(right)) return false;
	let keys = Object.keys(left);
	if (keys.length !== Object.keys(right).length) return false;
	return keys.every(
		(key) => Object.hasOwn(right, key) && isEqual(left[key] as JSONValue, right[key] as JSONValue),
	);
}
