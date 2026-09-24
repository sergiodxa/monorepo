/**
 * Parses and serializes RFC 9651 Structured Field Values: the grammar new HTTP fields such
 * as `Priority`, `Cache-Status` and `Idempotency-Key` are written against, with a value
 * model that round-trips, typed parsing through a schema, and `Headers` helpers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { failure, isFailure, success } from "@sdxc/result";
import { ValidationError } from "remix/data-schema";

import type { SF } from "./lib/types.js";

import { StructuredFieldParseError, StructuredFieldStringifyError } from "./lib/errors.js";
import { parseField } from "./lib/parse.js";
import { stringifyField } from "./lib/stringify.js";

export type { SF } from "./lib/types.js";

export { StructuredFieldParseError, StructuredFieldStringifyError } from "./lib/errors.js";
export { Decimal, DisplayString, Token } from "./lib/values.js";
export { ValidationError };

/**
 * Parses a field value into the untyped model. Any error fails the whole field, as RFC 9651
 * requires, so a failure never carries a partial value.
 *
 * @param text - The field value; several field lines joined with `,` (as `Headers#get` does)
 * @param type - The top-level type the field's definition fixes
 * @returns The model, or where the text stops being valid
 * @example parse("u=1, i", "dictionary")
 */
export function parse<Type extends SF.FieldType>(
	text: string,
	type: Type,
): Result<SF.ValueOf[Type], StructuredFieldParseError>;
/**
 * Parses a field value, then validates the model against a schema, so the caller receives
 * the schema's typed output or a failure naming why the field does not fit it.
 *
 * @param text - The field value
 * @param type - The top-level type the field's definition fixes
 * @param schema - A synchronous schema over the model, such as one built with `sf.*`
 * @returns The schema's output, or a parse or validation failure
 */
export function parse<Type extends SF.FieldType, Schema extends SF.SyncSchema>(
	text: string,
	type: Type,
	schema: Schema,
): Result<StandardSchemaV1.InferOutput<Schema>, StructuredFieldParseError | ValidationError>;
export function parse(
	text: string,
	type: SF.FieldType,
	schema?: SF.SyncSchema,
): Result<unknown, StructuredFieldParseError | ValidationError> {
	let parsed = parseField(text, type);
	if (isFailure(parsed) || schema === undefined) return parsed;
	return validateModel(parsed.data, schema);
}

/**
 * Runs a schema over a parsed model. A schema that answers with a Promise despite its type
 * fails validation, keeping every parse synchronous.
 *
 * @param model - The parsed field
 * @param schema - The caller's schema
 * @returns The schema's output, or its issues
 */
function validateModel(model: unknown, schema: SF.SyncSchema): Result<unknown, ValidationError> {
	let result: StandardSchemaV1.Result<unknown> | Promise<unknown> =
		schema["~standard"].validate(model);
	if (result instanceof Promise) {
		return failure(new ValidationError([{ message: "Schema must validate synchronously" }]));
	}
	if (result.issues) return failure(new ValidationError(result.issues));
	return success(result.value);
}

/**
 * Serializes a value to its canonical field text. An empty List or Dictionary succeeds with
 * `""`, which RFC 9651 reads as "do not send the field".
 *
 * @param value - The model, or any member written as its bare value
 * @param type - The top-level type the field's definition fixes; a Dictionary keyed
 *   `value` and `params` looks like an Item, so the value alone cannot say which to write
 * @returns The text, or the path to the value with no RFC 9651 representation
 * @example stringify({ value: 10, params: { w: 60 } }, "item") // "10;w=60"
 */
export function stringify<Type extends SF.FieldType>(
	value: SF.InputOf[Type],
	type: Type,
): Result<string, StructuredFieldStringifyError> {
	return stringifyField(value, type);
}

/**
 * Reads a field from `Headers`. Repeated field lines arrive joined with `, `, which is how
 * RFC 9651 combines them.
 *
 * @param headers - The request or response headers
 * @param name - The field name
 * @param type - The top-level type the field's definition fixes
 * @returns The model, `null` when the field is absent, or why it is invalid
 */
export function getField<Type extends SF.FieldType>(
	headers: Headers,
	name: string,
	type: Type,
): Result<SF.ValueOf[Type] | null, StructuredFieldParseError>;
/**
 * Reads a field from `Headers` and validates it against a schema.
 *
 * @param headers - The request or response headers
 * @param name - The field name
 * @param type - The top-level type the field's definition fixes
 * @param schema - A synchronous schema over the model
 * @returns The schema's output, `null` when the field is absent, or why it does not fit
 */
export function getField<Type extends SF.FieldType, Schema extends SF.SyncSchema>(
	headers: Headers,
	name: string,
	type: Type,
	schema: Schema,
): Result<StandardSchemaV1.InferOutput<Schema> | null, StructuredFieldParseError | ValidationError>;
export function getField(
	headers: Headers,
	name: string,
	type: SF.FieldType,
	schema?: SF.SyncSchema,
): Result<unknown, StructuredFieldParseError | ValidationError> {
	let text = headers.get(name);
	if (text === null) return success(null);
	return schema === undefined ? parse(text, type) : parse(text, type, schema);
}

/**
 * Writes a field onto `Headers`, replacing any earlier value. An empty List or Dictionary
 * deletes the field instead, since RFC 9651 treats an empty one as absent.
 *
 * @param headers - The headers to write
 * @param name - The field name
 * @param value - The model, or any member written as its bare value
 * @param type - The top-level type the field's definition fixes
 * @returns Success once written, or why the value has no representation, leaving
 *   `headers` untouched
 */
export function setField<Type extends SF.FieldType>(
	headers: Headers,
	name: string,
	value: SF.InputOf[Type],
	type: Type,
): Result<void, StructuredFieldStringifyError> {
	let text = stringifyField(value, type);
	if (isFailure(text)) return text;
	if (text.data === "") headers.delete(name);
	else headers.set(name, text.data);
	return success(undefined);
}
