/**
 * Reads a `PatchOp` request body (RFC 7644 §3.5.2) into typed operations, validating the
 * envelope, each `op` and each `path` before anything is applied, so a malformed request
 * fails whole with the `scimType` RFC 7644 assigns it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { Patch } from "../../patch.js";

import { isWireObject, readKey } from "../attributes.js";
import { PATCH_OP_SCHEMA } from "../constants.js";
import { badRequest, ScimError } from "../error.js";
import { parsePatchPath } from "../filter/parse.js";

/** The operations RFC 7644 §3.5.2 defines. */
const OPS = new Set<string>(["add", "remove", "replace"]);

/**
 * An operation's error, prefixed with its index so the client can find it.
 *
 * @param index - The operation's position in `Operations`
 * @param error - The underlying error
 * @returns The error with its location
 */
function atOperation(index: number, error: ScimError): ScimError {
	return new ScimError(error.status, `Operations[${index}]: ${error.message}`, {
		scimType: error.scimType ?? undefined,
	});
}

/**
 * Reads one operation. `remove` without a path is `noTarget`, and `add`/`replace` need a
 * value, which must be an object of attributes when the path is omitted.
 *
 * @param raw - The operation as sent
 * @returns The operation, or why it is invalid
 */
function parseOperation(raw: unknown): Patch.Operation | ScimError {
	if (!isWireObject(raw)) return badRequest("invalidSyntax", "Each operation must be an object.");

	let op = readKey(raw, "op");
	let name = typeof op === "string" ? op.toLowerCase() : "";
	if (!OPS.has(name)) {
		return badRequest("invalidSyntax", 'op must be "add", "remove" or "replace".');
	}

	let rawPath = readKey(raw, "path");
	let path: Patch.Path | null = null;
	if (typeof rawPath === "string" && rawPath.trim() !== "") {
		let parsed = parsePatchPath(rawPath);
		if (isFailure(parsed)) return parsed.error;
		path = parsed.data;
	} else if (rawPath !== undefined && rawPath !== null && rawPath !== "") {
		return badRequest("invalidPath", "path must be a string.");
	}

	let value = readKey(raw, "value");
	if (name === "remove") {
		if (path === null) return badRequest("noTarget", "remove requires a path.");
	} else if (value === undefined) {
		return badRequest("invalidValue", `${name} requires a value.`);
	} else if (path === null && !isWireObject(value)) {
		return badRequest("invalidValue", `${name} without a path requires an object of attributes.`);
	}

	return { op: name as Patch.Operation["op"], path, value };
}

/**
 * Parses a PATCH request body. `schemas` must name the `PatchOp` URN and `Operations` must
 * hold at least one operation; `op` is read case-insensitively, since Entra ID sends
 * `"Replace"`.
 *
 * @param body - The decoded JSON body
 * @returns The operations, or the first reason the body is invalid
 * @example parsePatch({ schemas: [PATCH_OP_SCHEMA], Operations: [{ op: "replace", path: "active", value: false }] })
 */
export function parsePatch(body: unknown): Result<Patch.Operation[], ScimError> {
	if (!isWireObject(body))
		return failure(badRequest("invalidSyntax", "The body must be an object."));

	let schemas = readKey(body, "schemas");
	let declared =
		Array.isArray(schemas) &&
		schemas.some(
			(urn) => typeof urn === "string" && urn.toLowerCase() === PATCH_OP_SCHEMA.toLowerCase(),
		);
	if (!declared)
		return failure(badRequest("invalidSyntax", `schemas must include ${PATCH_OP_SCHEMA}.`));

	let raw = readKey(body, "Operations");
	if (!Array.isArray(raw) || raw.length === 0) {
		return failure(badRequest("invalidSyntax", "Operations must be a non-empty array."));
	}

	let operations: Patch.Operation[] = [];
	for (let [index, item] of raw.entries()) {
		let operation = parseOperation(item);
		if (operation instanceof ScimError) return failure(atOperation(index, operation));
		operations.push(operation);
	}
	return success(operations);
}
