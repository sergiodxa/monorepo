/**
 * Reads CSV text into records keyed by the header, or into rows of fields. Every field
 * is a string: typing belongs to the caller's schema, since a guessed number cannot be
 * turned back into the `"007"` it was read from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { Delimiter, ParseOptions, Parsed, ParseWarning } from "./types.js";

import { CSVParseError } from "./errors.js";

/**
 * One record as the tokenizer read it, with the line it started on for error messages.
 */
interface RawRecord {
	fields: string[];
	line: number;
}

/**
 * The delimiters the reader accepts, checked at runtime for untyped callers.
 */
const DELIMITERS = new Set<string>([",", ";", "\t"]);

/**
 * Reads CSV text. With `header` (the default) the first record names the keys of every
 * later one; without it each record is an array of fields.
 *
 * Records may end in CRLF, LF or a lone CR, a leading BOM is dropped, and blank lines are
 * skipped. A bare `"` inside an unquoted field is kept and reported in `warnings`.
 *
 * @param source - The CSV text
 * @param options - Reader settings
 * @returns The records and warnings, or the structural problem that stopped the read
 * @example parse("name,city\r\nAna,Lima").data.rows // [{ name: "Ana", city: "Lima" }]
 * @example parse("a;b", { header: false, delimiter: ";" }).data.rows // [["a", "b"]]
 */
export function parse(
	source: string,
	options?: ParseOptions & { header?: true },
): Result<Parsed<Record<string, string>>, CSVParseError>;
export function parse(
	source: string,
	options: ParseOptions & { header: false },
): Result<Parsed<string[]>, CSVParseError>;
export function parse(
	source: string,
	options: ParseOptions = {},
): Result<Parsed<Record<string, string>> | Parsed<string[]>, CSVParseError> {
	let delimiter = options.delimiter ?? ",";
	if (!DELIMITERS.has(delimiter)) {
		return failure(new CSVParseError(`Unknown delimiter ${JSON.stringify(delimiter)}`, 1));
	}

	let warnings: ParseWarning[] = [];
	let tokenized = tokenize(source, delimiter, warnings);
	if (isFailure(tokenized)) return tokenized;

	let records = tokenized.data;
	let width = records[0]?.fields.length ?? 0;
	for (let record of records) {
		if (record.fields.length !== width) {
			return failure(
				new CSVParseError(`Expected ${width} fields, found ${record.fields.length}`, record.line),
			);
		}
	}

	if (options.header === false) {
		return success({ rows: records.map((record) => record.fields), warnings });
	}

	let [head, ...body] = records;
	if (!head) return success({ rows: [], warnings });

	let seen = new Set<string>();
	for (let name of head.fields) {
		if (seen.has(name)) {
			return failure(new CSVParseError(`Duplicate header ${JSON.stringify(name)}`, head.line));
		}
		seen.add(name);
	}

	let rows = body.map((record) =>
		Object.fromEntries(head.fields.map((name, index) => [name, record.fields[index] ?? ""])),
	);
	return success({ rows, warnings });
}

/**
 * Splits text into records of fields in one pass, tracking physical lines, including the
 * ones inside quoted fields, so a failure points where an editor would show it.
 *
 * @param source - The CSV text, possibly starting with a BOM
 * @param delimiter - The field separator
 * @param warnings - Collects recoverable departures from RFC 4180
 * @returns Every non-blank record, or the first structural problem
 */
function tokenize(
	source: string,
	delimiter: Delimiter,
	warnings: ParseWarning[],
): Result<RawRecord[], CSVParseError> {
	let records: RawRecord[] = [];
	let fields: string[] = [];
	let recordLine = 1;
	let line = 1;
	let index = source.charCodeAt(0) === 0xfeff ? 1 : 0;
	let atRecordStart = true;

	/**
	 * Closes the record being read. A record of one empty unquoted field is a blank line,
	 * which the reader skips; the writer quotes a genuinely empty single field.
	 *
	 * @param quotedLast - Whether the record's last field was quoted
	 */
	let endRecord = (quotedLast: boolean) => {
		if (!(fields.length === 1 && fields[0] === "" && !quotedLast)) {
			records.push({ fields, line: recordLine });
		}
		fields = [];
		atRecordStart = true;
	};

	/**
	 * Consumes the line break at `index`, treating CRLF as one.
	 */
	let skipLineBreak = () => {
		if (source[index] === "\r" && source[index + 1] === "\n") index += 2;
		else index += 1;
		line += 1;
	};

	while (index < source.length) {
		if (atRecordStart) {
			recordLine = line;
			atRecordStart = false;
		}

		let quoted = source[index] === '"';
		let value = "";

		if (quoted) {
			let openedOn = line;
			index += 1;
			let closed = false;
			while (index < source.length) {
				let char = source[index]!;
				if (char === '"') {
					if (source[index + 1] === '"') {
						value += '"';
						index += 2;
						continue;
					}
					index += 1;
					closed = true;
					break;
				}
				if (char === "\n" || (char === "\r" && source[index + 1] !== "\n")) line += 1;
				value += char;
				index += 1;
			}
			if (!closed) return failure(new CSVParseError("Unterminated quoted field", openedOn));

			let next = source[index];
			if (next !== undefined && next !== delimiter && next !== "\r" && next !== "\n") {
				return failure(new CSVParseError("Unexpected text after a closing quote", line));
			}
		} else {
			let start = index;
			let warned = false;
			while (index < source.length) {
				let char = source[index]!;
				if (char === delimiter || char === "\r" || char === "\n") break;
				if (char === '"' && !warned) {
					warnings.push({ line, message: "Bare quote inside an unquoted field kept as text" });
					warned = true;
				}
				index += 1;
			}
			value = source.slice(start, index);
		}

		fields.push(value);

		let next = source[index];
		if (next === delimiter) {
			index += 1;
			if (index === source.length) fields.push("");
			continue;
		}
		if (next === "\r" || next === "\n") skipLineBreak();
		endRecord(quoted);
	}

	if (!atRecordStart) endRecord(false);
	return success(records);
}
