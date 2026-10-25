/**
 * Applies an RFC 6902 patch to a JSON document. The patch runs against one private copy,
 * so a failing operation leaves the caller's document exactly as it was: all operations
 * take effect or none do.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { get, parse, stringify } from "@sdxc/json-pointer";
import { failure, isFailure, success } from "@sdxc/result";

import type { JSONObject, JSONValue } from "./json-value.js";
import type { Operation } from "./operation.js";

import { JsonPatchError } from "./error.js";
import { isEqual, isJSONObject, setMember } from "./json-value.js";
import { validate } from "./validate.js";

/** An unsigned decimal integer with no leading zeros, the only array index RFC 6901 accepts. */
const ARRAY_INDEX = /^(?:0|[1-9]\d*)$/u;

/** The container a pointer's last token lands in, and that token. */
interface Slot {
	container: JSONValue;
	token: string;
}

/**
 * Applies `patch` to `document` in order and returns the patched copy. The patch is
 * validated first, so a malformed operation anywhere fails before any runs; the inputs
 * are never mutated and the result shares no object or array with them.
 *
 * @param document - The JSON document to patch.
 * @param patch - The operations; a value cast from untrusted JSON is still checked.
 * @returns The patched document, or the first operation that failed and why.
 * @example apply({ tags: ["a"] }, [{ op: "add", path: "/tags/-", value: "b" }]); // success({ tags: ["a", "b"] })
 */
export function apply(
	document: JSONValue,
	patch: readonly Operation[],
): Result<JSONValue, JsonPatchError> {
	let operations = validate(patch);
	if (isFailure(operations)) return operations;

	let working = structuredClone(document);
	for (let [index, operation] of operations.data.entries()) {
		let next = applyOperation(working, operation, index);
		if (isFailure(next)) return next;
		working = next.data;
	}
	return success(working);
}

/** One step against the working copy, which it mutates in place; returns the new root. */
function applyOperation(
	document: JSONValue,
	operation: Operation,
	index: number,
): Result<JSONValue, JsonPatchError> {
	switch (operation.op) {
		case "add":
			return add(document, operation.path, structuredClone(operation.value), index);
		case "remove": {
			let removed = remove(document, operation.path, index);
			if (isFailure(removed)) return removed;
			return success(document);
		}
		case "replace":
			return replace(document, operation.path, structuredClone(operation.value), index);
		case "move": {
			if (operation.from === operation.path) {
				let source = locate(document, operation.from, index);
				if (isFailure(source)) return source;
				return success(document);
			}
			let removed = remove(document, operation.from, index);
			if (isFailure(removed)) return removed;
			return add(document, operation.path, removed.data, index);
		}
		case "copy": {
			let source = locate(document, operation.from, index);
			if (isFailure(source)) return source;
			return add(document, operation.path, structuredClone(source.data), index);
		}
		case "test": {
			let actual = locate(document, operation.path, index);
			if (isFailure(actual)) return actual;
			if (isEqual(actual.data, operation.value)) return success(document);
			return fail(
				"test-failed",
				index,
				`"${operation.path}" does not hold the value the test expects.`,
			);
		}
	}
}

/**
 * Section 4.1: a new member, an array element inserted before the index (`-` or the
 * length appends), or the whole document at `""`. The target's parent must exist.
 */
function add(
	document: JSONValue,
	pointer: string,
	value: JSONValue,
	index: number,
): Result<JSONValue, JsonPatchError> {
	let slot = slotOf(document, pointer, index);
	if (isFailure(slot)) return slot;
	if (slot.data === null) return success(value);

	let { container, token } = slot.data;
	if (Array.isArray(container)) {
		let position = token === "-" ? container.length : arrayIndex(token);
		if (position === null || position > container.length) return unresolvable(pointer, index);
		container.splice(position, 0, value);
		return success(document);
	}
	if (isJSONObject(container)) {
		setMember(container, token, value);
		return success(document);
	}
	return unresolvable(pointer, index);
}

/** Section 4.2: detaches the existing member or element at `pointer` and returns it. */
function remove(
	document: JSONValue,
	pointer: string,
	index: number,
): Result<JSONValue, JsonPatchError> {
	let slot = slotOf(document, pointer, index);
	if (isFailure(slot)) return slot;
	if (slot.data === null)
		return fail("unresolvable", index, "The whole document cannot be removed.");

	let { container, token } = slot.data;
	if (Array.isArray(container)) {
		let position = arrayIndex(token);
		if (position === null || position >= container.length) return unresolvable(pointer, index);
		return success(container.splice(position, 1)[0] as JSONValue);
	}
	if (isJSONObject(container) && Object.hasOwn(container, token)) {
		let removed = container[token] as JSONValue;
		delete (container as JSONObject)[token];
		return success(removed);
	}
	return unresolvable(pointer, index);
}

/** Section 4.3: overwrites the value at `pointer`, which must already exist. */
function replace(
	document: JSONValue,
	pointer: string,
	value: JSONValue,
	index: number,
): Result<JSONValue, JsonPatchError> {
	let current = locate(document, pointer, index);
	if (isFailure(current)) return current;
	let slot = slotOf(document, pointer, index);
	if (isFailure(slot)) return slot;
	if (slot.data === null) return success(value);

	let { container, token } = slot.data;
	if (Array.isArray(container)) container[arrayIndex(token) as number] = value;
	else setMember(container as JSONObject, token, value);
	return success(document);
}

/** The value `pointer` selects, by reference into the working copy. */
function locate(
	document: JSONValue,
	pointer: string,
	index: number,
): Result<JSONValue, JsonPatchError> {
	let found = get(document, pointer);
	if (isFailure(found)) return unresolvable(pointer, index);
	return success(found.data as JSONValue);
}

/**
 * The existing container `pointer`'s last token lands in, or `null` for the root pointer.
 * A missing parent fails: section 4.1 never creates intermediate members.
 */
function slotOf(
	document: JSONValue,
	pointer: string,
	index: number,
): Result<Slot | null, JsonPatchError> {
	let tokens = parse(pointer);
	if (isFailure(tokens)) return fail("invalid-patch", index, tokens.error.message);
	let token = tokens.data.pop();
	if (token === undefined) return success(null);
	let container = locate(document, stringify(tokens.data), index);
	if (isFailure(container)) return unresolvable(pointer, index);
	return success({ container: container.data, token });
}

/** `token` as an array index, or `null` for `-`, `1e0`, `01` and anything else RFC 6901 rejects. */
function arrayIndex(token: string): number | null {
	if (!ARRAY_INDEX.test(token)) return null;
	let position = Number(token);
	return Number.isSafeInteger(position) ? position : null;
}

/** The failure for a pointer with nothing to act on. */
function unresolvable(pointer: string, index: number): Result<never, JsonPatchError> {
	return fail("unresolvable", index, `"${pointer}" does not resolve in the document.`);
}

/** A failure attributed to the operation at `index`. */
function fail(
	reason: JsonPatchError["reason"],
	index: number,
	message: string,
): Result<never, JsonPatchError> {
	return failure(new JsonPatchError(reason, index, message));
}
