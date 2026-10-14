/**
 * The readers that turn JSON Lines into values: `read` over a byte stream, validating each line
 * against an optional Standard Schema, and `parse` over a whole string. Both apply the line
 * rules `lines` defines, so a file reads the same whether it arrives streamed or in memory.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { failure, isFailure, success } from "@sdxc/result";

import type { ByteSource, LinesOptions } from "./lines.js";

import { JSONLError } from "./errors.js";
import { isBlank, lines } from "./lines.js";

/** One value read from the input, with the line it came from. */
export interface Entry<T> {
	value: T;
	/** 1-based, counting blank lines too. */
	number: number;
}

/** The line rules of {@link lines}, plus the schema every value must satisfy. */
export interface ReadOptions<Schema extends StandardSchemaV1 | undefined> extends LinesOptions {
	/** Validates every parsed line; a rejected line yields an `invalid-value` failure with its issues. */
	schema?: Schema;
}

/** The value a schema produces, or `unknown` when there is none. */
type Output<Schema> = Schema extends StandardSchemaV1
	? StandardSchemaV1.InferOutput<Schema>
	: unknown;

/**
 * Every value in `source`, one per non-blank line. A line that is not JSON, or that the schema
 * rejects, yields a failure with its line number and reading continues, so the caller decides
 * whether one bad row ends the run; only a line over `maxLineBytes` stops it.
 *
 * @yields Each value, or the failure for the line that could not be read.
 * @example
 * for await (let entry of read(body, { schema: Subject })) {
 *   if (isFailure(entry)) continue;
 *   entry.data.value;
 * }
 */
export async function* read<Schema extends StandardSchemaV1 | undefined = undefined>(
	source: ByteSource,
	options: ReadOptions<Schema> = {},
): AsyncGenerator<Result<Entry<Output<Schema>>, JSONLError>> {
	for await (let line of lines(source, options)) {
		if (isFailure(line)) {
			yield line;
			return;
		}
		let parsed = parseLine(line.data.text, line.data.number);
		if (isFailure(parsed)) {
			yield parsed;
			continue;
		}
		let entry = await validate(options.schema, parsed.data, line.data.number);
		yield entry as Result<Entry<Output<Schema>>, JSONLError>;
	}
}

/**
 * Every value in JSON Lines `text`, or the first line that is not JSON. The same line rules as
 * {@link read} apply: `\r\n` endings, blank lines skipped but counted, a leading byte-order mark ignored.
 *
 * @example parse('{"a":1}\n{"a":2}\n') // success([{ a: 1 }, { a: 2 }])
 */
export function parse(text: string): Result<unknown[], JSONLError> {
	let values: unknown[] = [];
	let body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
	let rows = body.split("\n");
	if (rows.at(-1) === "") rows.pop();
	for (let [index, row] of rows.entries()) {
		let line = row.endsWith("\r") ? row.slice(0, -1) : row;
		if (isBlank(line)) continue;
		let parsed = parseLine(line, index + 1);
		if (isFailure(parsed)) return parsed;
		values.push(parsed.data);
	}
	return success(values);
}

/** `JSON.parse` as a result, its engine message kept in the reason and the native error as `cause`. */
function parseLine(text: string, number: number): Result<unknown, JSONLError> {
	try {
		return success(JSON.parse(text));
	} catch (error) {
		let reason = error instanceof Error ? error.message : String(error);
		return failure(
			new JSONLError("invalid-json", `Line is not valid JSON (${reason})`, number, {
				cause: error,
			}),
		);
	}
}

/** The schema's verdict as an entry; a schema that validates asynchronously is awaited. */
async function validate(
	schema: StandardSchemaV1 | undefined,
	value: unknown,
	number: number,
): Promise<Result<Entry<unknown>, JSONLError>> {
	if (schema === undefined) return success({ value, number });
	let outcome = await schema["~standard"].validate(value);
	if (outcome.issues !== undefined) {
		let first = outcome.issues[0]?.message ?? "Value is invalid";
		return failure(
			new JSONLError("invalid-value", `Line does not match the schema: ${first}`, number, {
				issues: outcome.issues,
			}),
		);
	}
	return success({ value: outcome.value, number });
}
