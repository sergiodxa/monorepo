/**
 * The two ways across the boundary with other schemas: `toJSONSchema` converts any
 * Standard JSON Schema into a 2020-12 document, and `withJSONSchema` gives a schema
 * built with `remix/data-schema` directly the JSON Schema it accepts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";
import type { StandardJSONSchemaV1 } from "@standard-schema/spec";
import type { Schema as DataSchema } from "remix/data-schema";

import { success } from "@sdxc/result";

import type { JSONSchemaConversionError } from "./error.js";
import type { JSONSchema, Schema } from "./types.js";

import { convert, wrap } from "./node.js";

/** How `toJSONSchema` shapes its document. */
export interface ToJSONSchemaOptions {
	/** @default "input" */
	direction?: JSONSchema.Direction;
	/**
	 * `"defs"` collects named schemas under `$defs` and references them; `"inline"` writes
	 * them in place, keeping `$ref` only where a `lazy` schema recurses.
	 * @default "defs"
	 */
	refs?: "defs" | "inline";
}

/**
 * Converts a schema into a standalone JSON Schema 2020-12 document declaring `$schema`.
 * A schema from another library is asked through its Standard JSON Schema converter; a
 * nested schema that cannot describe itself is a failure naming its path.
 *
 * @param schema - Any Standard JSON Schema.
 * @param options - Which side of each `transform` to describe, and how named schemas appear.
 * @example let result = toJSONSchema(s.object({ name: s.string() }));
 * @example let result = toJSONSchema(schema, { direction: "output" });
 */
export function toJSONSchema(
	schema: StandardJSONSchemaV1,
	options: ToJSONSchemaOptions = {},
): Result<JSONSchema, JSONSchemaConversionError> {
	return convert(schema, options.direction ?? "input", options.refs ?? "defs");
}

/**
 * Pairs a schema built with `remix/data-schema` directly with a hand-written JSON Schema,
 * for a shape the combinators cannot express. One schema describes both sides; pass
 * `{ input, output }` for a schema whose `transform` changes the value's shape.
 *
 * @param schema - The validator, used unchanged.
 * @param jsonSchema - What it accepts, and optionally what it yields.
 * @example let slug = withJSONSchema(ds.string().refine(isSlug), { type: "string", pattern: "^[a-z0-9-]+$" });
 */
export function withJSONSchema<Input, Output>(
	schema: DataSchema<Input, Output>,
	jsonSchema: JSONSchema | { input: JSONSchema; output: JSONSchema },
): Schema<Input, Output> {
	let sides = isSided(jsonSchema) ? jsonSchema : { input: jsonSchema, output: jsonSchema };
	return wrap<Input, Output>(schema, {
		describe: (context) => success(structuredClone(sides[context.direction])),
	});
}

/** Whether the argument names both sides rather than being one schema. */
function isSided(
	jsonSchema: JSONSchema | { input: JSONSchema; output: JSONSchema },
): jsonSchema is { input: JSONSchema; output: JSONSchema } {
	let keys = Object.keys(jsonSchema);
	return keys.length === 2 && "input" in jsonSchema && "output" in jsonSchema;
}
