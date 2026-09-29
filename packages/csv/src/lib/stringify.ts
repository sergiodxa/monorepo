/**
 * Writes rows as one CSV string: objects in a declared column order under a header
 * record, or arrays of cells as bare records. `parse(stringify(rows))` reads the same
 * strings back.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { Cell, CellRecord, Column, StringifyOptions, WriteOptions } from "./types.js";

import { BOM, encodeRecord, resolveEncoding } from "./encode.js";
import { CSVStringifyError } from "./errors.js";

/**
 * Writes rows as CSV text, every record ending in CRLF.
 *
 * Objects are written under a header record, in the order `columns` lists them or, without
 * it, in the first row's key order; a key a row lacks writes an empty field. Arrays of cells
 * are written as records with no header.
 *
 * @param rows - Objects whose fields are cells, or arrays of cells
 * @param options - Writer settings
 * @returns The CSV text, or the first value that has no representation
 * @example stringify([{ name: "Ana", city: "Lima" }]).data // "name,city\r\nAna,Lima\r\n"
 * @example stringify([["a", 1]], { delimiter: ";" }).data // "a;1\r\n"
 */
export function stringify<Row extends CellRecord<Row>>(
	rows: readonly Row[],
	options?: StringifyOptions<Row>,
): Result<string, CSVStringifyError>;
export function stringify(
	rows: readonly (readonly Cell[])[],
	options?: WriteOptions,
): Result<string, CSVStringifyError>;
export function stringify(
	rows: readonly (Record<string, unknown> | readonly unknown[])[],
	options: StringifyOptions<Record<string, unknown>> = {},
): Result<string, CSVStringifyError> {
	let encoding = resolveEncoding(options);
	if (isFailure(encoding)) return encoding;

	let output = encoding.data.bom ? BOM : "";
	let first = rows[0];

	if (Array.isArray(first)) {
		for (let [index, row] of rows.entries()) {
			let record = encodeRecord(row as readonly unknown[], encoding.data, index, []);
			if (isFailure(record)) return record;
			output += record.data;
		}
		return success(output);
	}

	let columns = options.columns ?? columnsOf(first as Record<string, unknown> | undefined);
	if (columns.length === 0) return success(output);
	let keys = columns.map((column) => column.key);

	if (options.header ?? true) {
		let header = encodeRecord(headerCells(columns), encoding.data, undefined, keys);
		if (isFailure(header)) return header;
		output += header.data;
	}

	for (let [index, row] of rows.entries()) {
		if (Array.isArray(row)) {
			return failure(new CSVStringifyError("Cannot mix arrays and objects", { row: index }));
		}
		let record = encodeRecord(
			keys.map((key) => (row as Record<string, unknown>)[key]),
			encoding.data,
			index,
			keys,
		);
		if (isFailure(record)) return record;
		output += record.data;
	}

	return success(output);
}

/**
 * The columns a write without `columns` uses: the first row's own keys, in insertion order.
 *
 * @param row - The first row, if any
 * @returns One column per key, headed by the key
 */
export function columnsOf<Row extends object>(row: Row | undefined): Column<Row>[] {
	if (row === undefined) return [];
	return Object.keys(row).map((key) => ({ key: key as keyof Row & string }));
}

/**
 * The header record's cells: each column's header text, or its key.
 *
 * @param columns - The columns being written
 * @returns The header text in column order
 */
export function headerCells<Row>(columns: readonly Column<Row>[]): string[] {
	return columns.map((column) => column.header ?? column.key);
}
