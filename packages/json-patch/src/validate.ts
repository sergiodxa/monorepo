/**
 * Checks that a value is an RFC 6902 patch document before any operation runs, so a
 * malformed patch is refused whole and a valid one comes back typed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { parse } from "@sdxc/json-pointer";
import { failure, isFailure, success } from "@sdxc/result";

import type { JSONValue } from "./json-value.js";
import type { Operation } from "./operation.js";

import { JsonPatchError } from "./error.js";
import { isJSONObject } from "./json-value.js";

/**
 * Reads `value` as a patch document: an array of objects, each with a known `op`, a
 * JSON Pointer `path`, a `value` member for add, replace and test, and a JSON Pointer
 * `from` for move and copy. Unrecognized members are dropped, as section 4 requires.
 *
 * @param value - A parsed request body or any other candidate patch.
 * @returns The operations, or the first one that is malformed.
 * @example validate([{ op: "remove", path: "/a" }]); // success([{ op: "remove", path: "/a" }])
 */
export function validate(value: unknown): Result<Operation[], JsonPatchError> {
	if (!Array.isArray(value)) {
		return failure(new JsonPatchError("invalid-patch", null, "A JSON Patch must be an array."));
	}
	let operations: Operation[] = [];
	for (let [index, candidate] of value.entries()) {
		let operation = validateOperation(candidate, index);
		if (isFailure(operation)) return operation;
		operations.push(operation.data);
	}
	return success(operations);
}

/** One operation object checked against the members its `op` requires. */
function validateOperation(candidate: unknown, index: number): Result<Operation, JsonPatchError> {
	if (!isJSONObject(candidate)) return invalid(index, "An operation must be an object.");
	let path = pointerMember(candidate, "path", index);
	if (isFailure(path)) return path;

	switch (candidate.op) {
		case "add":
		case "replace":
		case "test": {
			let operand = valueMember(candidate, index);
			if (isFailure(operand)) return operand;
			return success({ op: candidate.op, path: path.data, value: operand.data });
		}
		case "remove":
			return success({ op: "remove", path: path.data });
		case "move":
		case "copy": {
			let from = pointerMember(candidate, "from", index);
			if (isFailure(from)) return from;
			if (candidate.op === "move" && path.data.startsWith(`${from.data}/`)) {
				return invalid(index, `"move" cannot place "${from.data}" inside itself.`);
			}
			return success({ op: candidate.op, from: from.data, path: path.data });
		}
		default:
			return invalid(
				index,
				`${JSON.stringify(candidate.op) ?? "undefined"} is not a JSON Patch operation.`,
			);
	}
}

/** A `path` or `from` member that holds a well-formed JSON Pointer. */
function pointerMember(
	candidate: Record<string, unknown>,
	member: "path" | "from",
	index: number,
): Result<string, JsonPatchError> {
	let pointer = candidate[member];
	if (typeof pointer !== "string") return invalid(index, `"${member}" must be a JSON Pointer.`);
	let tokens = parse(pointer);
	if (isFailure(tokens)) return invalid(index, `"${member}": ${tokens.error.message}`);
	return success(pointer);
}

/** The `value` member, which must be present even when it holds `null` or `false`. */
function valueMember(
	candidate: Record<string, unknown>,
	index: number,
): Result<JSONValue, JsonPatchError> {
	if (!Object.hasOwn(candidate, "value") || candidate.value === undefined) {
		return invalid(index, `"${String(candidate.op)}" requires a "value" member.`);
	}
	return success(candidate.value as JSONValue);
}

/** The failure for a malformed operation at `index`. */
function invalid(index: number, message: string): Result<never, JsonPatchError> {
	return failure(new JsonPatchError("invalid-patch", index, message));
}
