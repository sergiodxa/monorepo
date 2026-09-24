/**
 * Schema builders that validate like remix/data-schema and describe themselves as JSON
 * Schema 2020-12, so the schema a handler validates with is the schema an API publishes.
 * Import as a namespace: `import * as s from "@sdxc/json-schema"`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { ToJSONSchemaOptions } from "./convert.js";
export type { ObjectInput, ObjectOptions, ObjectOutput } from "./schema.js";
export type { Annotations, Check, JSONSchema, Schema } from "./types.js";
export type { InferInput, InferOutput } from "remix/data-schema";

export { toJSONSchema, withJSONSchema } from "./convert.js";
export { JSONSchemaConversionError } from "./error.js";
export {
	any,
	array,
	boolean,
	defaulted,
	enum_,
	integer,
	lazy,
	literal,
	null_,
	nullable,
	number,
	object,
	optional,
	record,
	string,
	tuple,
	union,
	variant,
} from "./schema.js";
export { parse, parseSafe, ValidationError } from "remix/data-schema";
