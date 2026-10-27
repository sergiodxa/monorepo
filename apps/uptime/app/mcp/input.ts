/**
 * Flattens a path-id object schema with an OpenAPI body schema into one tool input, so a
 * model sees every field at the top level the way REST path params and bodies combine.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { InferInput, InferOutput, JSONSchema, Schema } from "@sdxc/json-schema";

import { toJSONSchema, withJSONSchema } from "@sdxc/json-schema";
import * as s from "@sdxc/json-schema";
import { unwrap } from "@sdxc/result";
import * as ds from "remix/data-schema";

/**
 * Merges two object schemas into one flat input: typically a path-id schema plus an
 * `UPDATE_*_BODY`, validating both and describing their properties together.
 *
 * @param left - The path-id (or other required) object schema.
 * @param right - The body object schema whose keys sit beside the id.
 */
export function flattenInput<
	L extends Schema<Record<string, unknown>, Record<string, unknown>>,
	R extends Schema<Record<string, unknown>, Record<string, unknown>>,
>(left: L, right: R): Schema<InferInput<L> & InferInput<R>, InferOutput<L> & InferOutput<R>> {
	let leftDoc = unwrap(toJSONSchema(left));
	let rightDoc = unwrap(toJSONSchema(right));
	let properties: Record<string, JSONSchema> = {
		...(isObjectDoc(leftDoc) ? (leftDoc.properties ?? {}) : {}),
		...(isObjectDoc(rightDoc) ? (rightDoc.properties ?? {}) : {}),
	};
	let required = [
		...new Set([
			...(isObjectDoc(leftDoc) && Array.isArray(leftDoc.required) ? leftDoc.required : []),
			...(isObjectDoc(rightDoc) && Array.isArray(rightDoc.required) ? rightDoc.required : []),
		]),
	];
	let json: JSONSchema = { type: "object", properties };
	if (required.length > 0) json.required = required;

	return withJSONSchema(
		ds.any().transform((value: unknown) => {
			let a = s.parse(left, value) as Record<string, unknown>;
			let b = s.parse(right, value) as Record<string, unknown>;
			return { ...a, ...b };
		}),
		json,
	) as Schema<InferInput<L> & InferInput<R>, InferOutput<L> & InferOutput<R>>;
}

/** Whether a JSON Schema document describes an object with optional properties. */
function isObjectDoc(doc: JSONSchema): doc is JSONSchema & {
	type?: string;
	properties?: Record<string, JSONSchema>;
	required?: string[];
} {
	return typeof doc === "object" && doc !== null && !Array.isArray(doc);
}
