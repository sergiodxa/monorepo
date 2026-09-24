/**
 * The JSON side every JSON well-known reader shares: decoding text into an object,
 * JSON Pointers for issues, and validating extension members through a Standard
 * Schema, so each document reports its failures in the same shape.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { failure, success } from "@sdxc/result";

import { WellKnownParseError } from "../parse-error.js";

/** A decoded JSON object, read member by member. */
export type JsonObject = Record<string, unknown>;

/**
 * A JSON Pointer (RFC 6901) to a member, escaping `~` and `/` so a member name holding
 * either still points at itself.
 *
 * @param segments - Member names and array indexes, outermost first.
 */
export function pointer(...segments: Array<string | number>): string {
	return segments
		.map((segment) => `/${String(segment).replace(/~/g, "~0").replace(/\//g, "~1")}`)
		.join("");
}

/**
 * Whether a decoded value is a plain JSON object.
 *
 * @param value - Any decoded JSON value.
 */
export function isObject(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Decodes a document's text, which every JSON well-known document requires to be an
 * object at the top level.
 *
 * @param text - The served text.
 * @param format - The registered name, for the error.
 */
export function readJsonObject(
	text: string,
	format: string,
): Result<JsonObject, WellKnownParseError> {
	let json: unknown;
	try {
		json = JSON.parse(text);
	} catch {
		return failure(
			new WellKnownParseError(format, [{ at: "", message: "The document is not valid JSON." }]),
		);
	}
	if (!isObject(json)) {
		return failure(
			new WellKnownParseError(format, [{ at: "", message: "The document is not a JSON object." }]),
		);
	}
	return success(json);
}

/**
 * Validates extension members through a schema, mapping its issues to JSON Pointers
 * into the document. A schema must validate synchronously, since `parse` returns a
 * `Result` rather than a promise.
 *
 * @param members - The members outside the specification.
 * @param schema - The schema, or `undefined` to keep the members unchecked.
 * @param issues - Where schema issues are collected.
 * @returns The validated extensions, or `null` when the schema rejected them.
 */
export function readExtensions<Extensions extends object>(
	members: JsonObject,
	schema: StandardSchemaV1<unknown, Extensions> | undefined,
	issues: WellKnownParseError.Issue[],
): Extensions | null {
	if (schema === undefined) return members as Extensions;

	let result = schema["~standard"].validate(members);
	if (result instanceof Promise) {
		issues.push({ at: "", message: "The extension schema must validate synchronously." });
		return null;
	}
	if (result.issues === undefined) return result.value;

	for (let issue of result.issues) {
		let path = (issue.path ?? []).map((segment) =>
			typeof segment === "object" ? String(segment.key) : String(segment),
		);
		issues.push({ at: pointer(...path), message: issue.message });
	}
	return null;
}
