/**
 * Turns cells into RFC 4180 fields and records, shared by the string and stream writers
 * so the bytes a stream sends are exactly the text `stringify` returns for the same rows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { Delimiter, WriteOptions } from "./types.js";

import { CSVStringifyError } from "./errors.js";

/**
 * The resolved settings every record is encoded with.
 */
export interface Encoding {
	delimiter: Delimiter;
	bom: boolean;
	escapeFormulas: boolean;
}

/**
 * Every record ends in CRLF, as RFC 4180 §2.1 specifies.
 */
export const RECORD_END = "\r\n";

/**
 * The byte order mark Excel reads as "this file is UTF-8".
 */
export const BOM = "﻿";

/**
 * The delimiters the writer accepts, checked at runtime for untyped callers.
 */
const DELIMITERS = new Set<string>([",", ";", "\t"]);

/**
 * The first characters that make a spreadsheet read a cell as a formula (OWASP's CSV
 * injection list).
 */
const FORMULA_TRIGGERS = new Set(["=", "+", "-", "@", "\t", "\r"]);

/**
 * Resolves write options to the settings records are encoded with, rejecting a delimiter
 * outside the three the package supports.
 *
 * @param options - Caller settings
 * @returns The encoding, or why the options cannot be used
 */
export function resolveEncoding(options: WriteOptions): Result<Encoding, CSVStringifyError> {
	let delimiter = options.delimiter ?? ",";
	if (!DELIMITERS.has(delimiter)) {
		return failure(new CSVStringifyError(`Unknown delimiter ${JSON.stringify(delimiter)}`));
	}
	return success({
		delimiter,
		bom: options.bom ?? false,
		escapeFormulas: options.escapeFormulas ?? true,
	});
}

/**
 * Encodes one record, CRLF included. A record of a single empty field is written as `""`
 * so a reader tells it apart from a blank line.
 *
 * @param cells - The record's cells, in column order
 * @param encoding - Resolved settings
 * @param row - Index of the row in the input, for errors
 * @param columns - Column names, for errors
 * @returns The encoded record, or the first cell that has no representation
 */
export function encodeRecord(
	cells: readonly unknown[],
	encoding: Encoding,
	row: number | undefined,
	columns: readonly string[],
): Result<string, CSVStringifyError> {
	let fields: string[] = [];
	for (let [index, cell] of cells.entries()) {
		let text = cellText(cell);
		if (text === null) {
			return failure(
				new CSVStringifyError(`Cannot write ${describe(cell)}`, {
					row,
					column: columns[index] ?? String(index),
				}),
			);
		}
		fields.push(
			quote(typeof cell === "string" ? neutralize(text, encoding) : text, encoding.delimiter),
		);
	}

	if (fields.length === 1 && fields[0] === "") return success(`""${RECORD_END}`);
	return success(fields.join(encoding.delimiter) + RECORD_END);
}

/**
 * The text a cell writes, or `null` for a value outside the cell types, an invalid date
 * or a number with no finite value.
 *
 * @param cell - A value from the input
 * @returns The field text before quoting
 */
function cellText(cell: unknown): string | null {
	if (cell === null || cell === undefined) return "";
	if (typeof cell === "string") return cell;
	if (typeof cell === "number") return Number.isFinite(cell) ? String(cell) : null;
	if (typeof cell === "bigint" || typeof cell === "boolean") return String(cell);
	if (cell instanceof Date) return Number.isNaN(cell.getTime()) ? null : cell.toISOString();
	return null;
}

/**
 * Names a rejected value for an error message.
 *
 * @param cell - The rejected value
 * @returns A short description such as `NaN` or `an object`
 */
function describe(cell: unknown): string {
	if (typeof cell === "number") return String(cell);
	if (cell instanceof Date) return "an invalid Date";
	if (Array.isArray(cell)) return "an array";
	return typeof cell === "object" ? "an object" : `a ${typeof cell}`;
}

/**
 * Prefixes `'` to a string a spreadsheet would run as a formula; applied to strings only,
 * since a number cell's type says it is data.
 *
 * @param text - A string cell
 * @param encoding - Whether neutralization is on
 * @returns The text a spreadsheet shows as-is
 */
function neutralize(text: string, encoding: Encoding): string {
	if (!encoding.escapeFormulas || text === "") return text;
	return FORMULA_TRIGGERS.has(text[0]!) ? `'${text}` : text;
}

/**
 * Quotes a field when RFC 4180 requires it (delimiter, quote, line break), and when it
 * has leading or trailing spaces, which some readers trim from unquoted fields.
 *
 * @param text - The field text
 * @param delimiter - The field separator in use
 * @returns The field as written
 */
function quote(text: string, delimiter: Delimiter): string {
	let needsQuotes =
		text.includes(delimiter) ||
		text.includes('"') ||
		text.includes("\n") ||
		text.includes("\r") ||
		text.startsWith(" ") ||
		text.endsWith(" ");
	return needsQuotes ? `"${text.replaceAll('"', '""')}"` : text;
}
