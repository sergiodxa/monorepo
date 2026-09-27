/**
 * The field-mapping engine behind the OAuth metadata documents (RFC 8414, OpenID
 * Connect Discovery, RFC 9728): one table maps each camelCase field to its registered
 * member name and kind, and drives reading, writing and defaults from that one place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { failure, success } from "@sdxc/result";

import { WellKnownParseError } from "../parse-error.js";

import type { JsonObject } from "./json.js";

import { pointer, readExtensions, readJsonObject } from "./json.js";

/**
 * How a member's JSON value maps to its field: `text` is a string, `url` one absolute
 * URL, `urls` and `strings` lists, `boolean` a flag, and `localized` a human-readable
 * string with `#`-tagged language variants (RFC 9728 §2.1).
 */
export type FieldKind = "text" | "url" | "urls" | "strings" | "boolean" | "localized";

/** One row of the mapping table. */
export interface Field {
	/** The member name the specification registers. */
	wire: string;
	kind: FieldKind;
	/** A missing member fails the parse instead of taking the default. */
	required?: boolean;
	/** The value an absent boolean member means, which `stringify` leaves unwritten. */
	default?: boolean;
	/** The only values a `strings` member may list. */
	values?: readonly string[];
}

/** A document's mapping table, keyed by camelCase field name. */
export type FieldTable = Record<string, Field>;

/** A human-readable value with its language-tagged variants. */
interface Localized {
	value: string;
	translations: Record<string, string>;
}

/**
 * The value an absent member takes: `null` for single values, an empty list for
 * lists, and the specification's default for flags.
 *
 * @param field - The row to default.
 */
function defaultOf(field: Field): unknown {
	if (field.kind === "urls" || field.kind === "strings") return [];
	if (field.kind === "boolean") return field.default ?? false;
	return null;
}

/**
 * Every field of a table at its default, for `define` to lay the app's values over.
 *
 * @param table - The document's mapping table.
 */
export function defaults(table: FieldTable): Record<string, unknown> {
	let result: Record<string, unknown> = {};
	for (let [name, field] of Object.entries(table)) result[name] = defaultOf(field);
	return result;
}

/**
 * Whether a member name is one the table registers, counting the `#`-tagged variants of
 * a localized member, so extensions never shadow or duplicate a standard member.
 *
 * @param table - The document's mapping table.
 * @param member - A member name from the document.
 */
function isStandardMember(table: FieldTable, member: string): boolean {
	let [base] = member.split("#");
	for (let field of Object.values(table)) {
		if (field.wire === member) return true;
		if (field.kind === "localized" && field.wire === base) return true;
	}
	return false;
}

/**
 * Whether a string is an absolute URL.
 *
 * @param value - Any decoded value.
 */
function isUrl(value: unknown): value is string {
	return typeof value === "string" && URL.canParse(value);
}

/**
 * Reads one member into its field's value, collecting an issue when the member has the
 * wrong shape; the returned value is then meaningless and the parse fails.
 *
 * @param body - The decoded document.
 * @param field - The row to read.
 * @param issues - Where problems are collected.
 */
function readField(body: JsonObject, field: Field, issues: WellKnownParseError.Issue[]): unknown {
	let at = pointer(field.wire);
	let value = body[field.wire];

	if (field.kind === "localized") return readLocalized(body, field, issues);

	if (value === undefined || value === null) {
		if (field.required)
			issues.push({ at, message: `The required member "${field.wire}" is missing.` });
		return defaultOf(field);
	}

	switch (field.kind) {
		case "text": {
			if (typeof value === "string" && value.length > 0) return value;
			issues.push({ at, message: `"${field.wire}" is not a non-empty string.` });
			return null;
		}
		case "url": {
			if (isUrl(value)) return new URL(value);
			issues.push({ at, message: `"${field.wire}" is not an absolute URL.` });
			return null;
		}
		case "boolean": {
			if (typeof value === "boolean") return value;
			issues.push({ at, message: `"${field.wire}" is not a boolean.` });
			return defaultOf(field);
		}
		case "urls":
		case "strings": {
			return readList(value, field, issues);
		}
	}
	return null;
}

/**
 * Reads a list member, checking each entry, so a single bad entry is reported at its
 * own index.
 *
 * @param value - The member's decoded value.
 * @param field - The row being read.
 * @param issues - Where problems are collected.
 */
function readList(value: unknown, field: Field, issues: WellKnownParseError.Issue[]): unknown[] {
	if (!Array.isArray(value)) {
		issues.push({ at: pointer(field.wire), message: `"${field.wire}" is not an array.` });
		return [];
	}

	let result: unknown[] = [];
	for (let [index, entry] of value.entries()) {
		let at = pointer(field.wire, index);
		if (field.kind === "urls") {
			if (isUrl(entry)) result.push(new URL(entry));
			else
				issues.push({ at, message: `"${field.wire}" lists a value that is not an absolute URL.` });
			continue;
		}
		if (typeof entry !== "string") {
			issues.push({ at, message: `"${field.wire}" lists a value that is not a string.` });
			continue;
		}
		if (field.values && !field.values.includes(entry)) {
			issues.push({
				at,
				message: `"${field.wire}" lists "${entry}", which is not one of ${field.values.join(", ")}.`,
			});
			continue;
		}
		result.push(entry);
	}
	return result;
}

/**
 * Reads a human-readable member and its `member#tag` variants into one value.
 *
 * @param body - The decoded document.
 * @param field - The localized row.
 * @param issues - Where problems are collected.
 */
function readLocalized(
	body: JsonObject,
	field: Field,
	issues: WellKnownParseError.Issue[],
): Localized | null {
	let translations: Record<string, string> = {};
	for (let [member, value] of Object.entries(body)) {
		if (!member.startsWith(`${field.wire}#`)) continue;
		if (typeof value === "string") translations[member.slice(field.wire.length + 1)] = value;
		else issues.push({ at: pointer(member), message: `"${member}" is not a string.` });
	}

	let value = body[field.wire];
	if (value === undefined || value === null) {
		if (field.required)
			issues.push({
				at: pointer(field.wire),
				message: `The required member "${field.wire}" is missing.`,
			});
		let [first] = Object.values(translations);
		return first === undefined ? null : { value: first, translations };
	}
	if (typeof value !== "string") {
		issues.push({ at: pointer(field.wire), message: `"${field.wire}" is not a string.` });
		return null;
	}
	return { value, translations };
}

/** How a metadata document is read. */
export interface ReadOptions<Extensions extends object> {
	format: string;
	table: FieldTable;
	extensions?: StandardSchemaV1<unknown, Extensions>;
	/** Checks the read fields against what the caller expected, adding issues on a mismatch. */
	check?: (fields: Record<string, unknown>, issues: WellKnownParseError.Issue[]) => void;
}

/**
 * Reads a metadata document through its table. Members outside the table become the
 * extensions, validated by the schema when one is given. Every issue is collected
 * before failing, so the error names all of them.
 *
 * @param text - The served JSON.
 * @param options - The table, the extension schema and the identity check.
 * @template Extensions - The extension members the schema produces.
 */
export function readMetadata<Extensions extends object>(
	text: string,
	options: ReadOptions<Extensions>,
): Result<Record<string, unknown> & { extensions: Extensions }, WellKnownParseError> {
	let decoded = readJsonObject(text, options.format);
	if (decoded.status === "failure") return decoded;
	let body = decoded.data;

	let issues: WellKnownParseError.Issue[] = [];
	let fields: Record<string, unknown> = {};
	for (let [name, field] of Object.entries(options.table))
		fields[name] = readField(body, field, issues);

	if (issues.length === 0) options.check?.(fields, issues);

	let members: JsonObject = {};
	for (let [member, value] of Object.entries(body)) {
		if (!isStandardMember(options.table, member)) members[member] = value;
	}
	let extensions = readExtensions(members, options.extensions, issues);

	if (issues.length > 0 || extensions === null) {
		return failure(new WellKnownParseError(options.format, issues));
	}
	return success({ ...fields, extensions });
}

/**
 * Writes a document through its table, omitting `null` members, optional empty lists and
 * default flags; a required list is written even when empty so the output parses back.
 * Extensions never replace a standard member: any member name the table registers is dropped.
 *
 * @param document - The typed document.
 * @param table - The document's mapping table.
 */
export function writeMetadata(document: object, table: FieldTable): string {
	let fields = document as Record<string, unknown>;
	let output: JsonObject = {};

	let extensions = fields.extensions;
	if (typeof extensions === "object" && extensions !== null) {
		for (let [member, value] of Object.entries(extensions)) {
			if (!isStandardMember(table, member)) output[member] = value;
		}
	}

	for (let [name, field] of Object.entries(table)) {
		let value = fields[name];
		if (value === null || value === undefined) continue;
		if (Array.isArray(value)) {
			if (value.length === 0 && !field.required) continue;
			output[field.wire] = value.map((entry) => (entry instanceof URL ? entry.href : entry));
			continue;
		}
		if (field.kind === "boolean") {
			if (value !== (field.default ?? false)) output[field.wire] = value;
			continue;
		}
		if (field.kind === "localized") {
			let localized = value as Localized;
			output[field.wire] = localized.value;
			for (let [tag, text] of Object.entries(localized.translations))
				output[`${field.wire}#${tag}`] = text;
			continue;
		}
		output[field.wire] = value instanceof URL ? value.href : value;
	}

	return JSON.stringify(output);
}
