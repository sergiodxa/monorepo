/**
 * Narrows a management operation's own JSON Schema into `@sdxc/mcp`'s deliberately
 * narrow tool-argument subset — objects of scalars, enums and arrays, with no `$ref`,
 * `oneOf`/`anyOf`/`allOf`, tuple, record, or genuinely nullable value. An operation
 * whose schema needs one of those is reported as unsupported by returning `null`, so
 * the tool generator can fall back to a single JSON-encoded string argument instead of
 * refusing to expose the operation at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONSchema } from "@sdxc/json-schema";
import type { ObjectSchema, PropertySchema } from "@sdxc/mcp";

/** Copies `description`/`title` onto a draft schema when the source node declares them. */
function withDescribed(
	schema: JSONSchema,
	draft: Record<string, unknown>,
): Record<string, unknown> {
	if (schema.description !== undefined) draft.description = schema.description;
	if (schema.title !== undefined) draft.title = schema.title;
	return draft;
}

/**
 * Narrows one JSON Schema node into the tool-argument subset, or `null` when the node
 * uses a keyword the subset cannot express (a reference, a combinator, a tuple, a
 * record, or a value that is genuinely nullable rather than merely optional).
 *
 * @param schema - The node to narrow, as `@sdxc/json-schema` describes it.
 * @returns The narrowed property schema, or `null` when the node falls outside the subset.
 */
export function narrowProperty(schema: JSONSchema): PropertySchema | null {
	if (
		schema.$ref !== undefined ||
		schema.anyOf !== undefined ||
		schema.oneOf !== undefined ||
		schema.allOf !== undefined ||
		schema.const !== undefined ||
		schema.propertyNames !== undefined ||
		schema.prefixItems !== undefined
	) {
		return null;
	}

	if (Array.isArray(schema.type)) return null;

	switch (schema.type) {
		case "string": {
			if (schema.enum !== undefined) {
				if (!schema.enum.every((value) => typeof value === "string")) return null;
				return withDescribed(schema, {
					type: "string",
					enum: schema.enum,
				}) as unknown as PropertySchema;
			}

			let draft: Record<string, unknown> = { type: "string" };
			if (schema.minLength !== undefined) draft.minLength = schema.minLength;
			if (schema.maxLength !== undefined) draft.maxLength = schema.maxLength;
			if (schema.pattern !== undefined) draft.pattern = schema.pattern;
			if (schema.format !== undefined) draft.format = schema.format;
			if (schema.default !== undefined) draft.default = schema.default;
			return withDescribed(schema, draft) as unknown as PropertySchema;
		}

		case "number":
		case "integer": {
			if (schema.enum !== undefined) return null;
			let draft: Record<string, unknown> = { type: schema.type };
			if (schema.minimum !== undefined) draft.minimum = schema.minimum;
			if (schema.maximum !== undefined) draft.maximum = schema.maximum;
			if (schema.default !== undefined) draft.default = schema.default;
			return withDescribed(schema, draft) as unknown as PropertySchema;
		}

		case "boolean": {
			let draft: Record<string, unknown> = { type: "boolean" };
			if (schema.default !== undefined) draft.default = schema.default;
			return withDescribed(schema, draft) as unknown as PropertySchema;
		}

		case "array": {
			if (typeof schema.items !== "object" || schema.items === null) return null;
			let items = narrowProperty(schema.items);
			if (items === null) return null;
			let draft: Record<string, unknown> = { type: "array", items };
			if (schema.minItems !== undefined) draft.minItems = schema.minItems;
			if (schema.maxItems !== undefined) draft.maxItems = schema.maxItems;
			return withDescribed(schema, draft) as unknown as PropertySchema;
		}

		case "object":
			return narrowObject(schema);

		default:
			return null;
	}
}

/**
 * Narrows an object node, requiring every property to itself narrow and refusing a
 * record shape (`additionalProperties` carrying a schema, rather than a plain boolean)
 * that the subset has no way to bound.
 *
 * @param schema - The object node to narrow.
 * @returns The narrowed object schema, or `null` when it, or any property, falls
 * outside the subset.
 */
export function narrowObject(schema: JSONSchema): ObjectSchema | null {
	if (schema.type !== "object" || schema.properties === undefined) return null;
	if (typeof schema.additionalProperties === "object") return null;

	let properties: Record<string, PropertySchema> = {};
	for (let [name, property] of Object.entries(schema.properties)) {
		let narrowed = narrowProperty(property);
		if (narrowed === null) return null;
		properties[name] = narrowed;
	}

	let draft: Record<string, unknown> = { type: "object", properties };
	if (schema.required !== undefined && schema.required.length > 0) draft.required = schema.required;
	return withDescribed(schema, draft) as unknown as ObjectSchema;
}
