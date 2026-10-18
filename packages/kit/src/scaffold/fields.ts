/**
 * The fields `sdxc scaffold` takes as `name:type`, and what each type becomes in the layers that
 * read it as data: the table column, the form and tool schemas, and the samples a test fills it
 * with, valid and refused. `render.ts` writes the source each layer spells per type.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { ColumnBuilder, ColumnNamespace } from "remix/data-table";

import { failure, success } from "@sdxc/result";

/** A field type `sdxc scaffold` knows. */
export type FieldTypeName = "string" | "text" | "integer" | "boolean" | "date";

/** One parsed field. */
export interface Field {
	/** The column's snake_case name, which is also the form field's and the row's key. */
	column: string;
	/** The column as words, the first capitalized: `published_on` reads `Published on`. */
	label: string;
	/** The command flag's kebab-case name. */
	flag: string;
	/** The command flag's camelCase key. */
	key: string;
	type: FieldTypeName;
}

/** What one field type is in the layers that read it as data. */
export interface FieldType {
	/** The `remix/data-table` column, as source and as the builder the migration renders. */
	column: string;
	build: (c: ColumnNamespace) => ColumnBuilder;
	/** The `f.field(…)` the form validator reads it with, and whether it uses `coerce`. */
	schema: string;
	coerces: boolean;
	/** The tool input's JSON Schema builder. */
	json: string;
	/** A value a submission fills it with, as form text, and a tool call, as JSON source. */
	formSample: string;
	jsonSample: string;
	/** A second value for a tool's update, as JSON source, different from the factory's. */
	changedSample: string;
	/** Form text the form schema refuses. */
	invalidSample: string;
}

/** The refinement a text field's form schema ends with, since an empty input submits `""`. */
const NOT_BLANK = '.refine((value) => value.trim() !== "", "Required")';

/** Every field type, in the order the help lists them. */
export const FIELD_TYPES: Readonly<Record<FieldTypeName, FieldType>> = {
	string: {
		column: "c.text()",
		build: (c) => c.text(),
		schema: `f.field(s.string()${NOT_BLANK})`,
		coerces: false,
		json: "s.string()",
		formSample: "Sample text",
		jsonSample: '"Sample text"',
		changedSample: '"Changed text"',
		invalidSample: "  ",
	},
	text: {
		column: "c.text()",
		build: (c) => c.text(),
		schema: `f.field(s.string()${NOT_BLANK})`,
		coerces: false,
		json: "s.string()",
		formSample: "Sample text",
		jsonSample: '"Sample text"',
		changedSample: '"Changed text"',
		invalidSample: "  ",
	},
	integer: {
		column: "c.integer()",
		build: (c) => c.integer(),
		schema: 'f.field(coerce.number().refine(Number.isInteger, "Expected a whole number"))',
		coerces: true,
		json: "s.integer()",
		formSample: "42",
		jsonSample: "42",
		changedSample: "7",
		invalidSample: "1.5",
	},
	boolean: {
		column: "c.boolean()",
		build: (c) => c.boolean(),
		schema: "f.field(s.defaulted(coerce.boolean(), false))",
		coerces: true,
		json: "s.boolean()",
		formSample: "true",
		jsonSample: "true",
		changedSample: "true",
		invalidSample: "maybe",
	},
	date: {
		column: "c.text()",
		build: (c) => c.text(),
		schema:
			'f.field(s.string().refine((value) => /^\\d{4}-\\d{2}-\\d{2}$/.test(value), "Expected a date"))',
		coerces: false,
		json: "s.string()",
		formSample: "2026-01-31",
		jsonSample: '"2026-01-31"',
		changedSample: '"2026-02-28"',
		invalidSample: "soon",
	},
};

/** The columns every table has, which a field cannot name. */
const RESERVED_COLUMNS = new Set(["id", "created_at", "updated_at"]);

/**
 * Parses `specs`, each `name` or `name:type`, into fields. A name in any case becomes its
 * snake_case column; a reserved column, a repeated one, a name that does not start with a letter
 * or an unknown type is a failure naming it, and so is an empty list.
 */
export function parseFields(specs: readonly string[]): Result<Field[], Error> {
	if (specs.length === 0) {
		return failure(new Error("Give the scaffold at least one field, such as title:string"));
	}
	let fields: Field[] = [];
	for (let spec of specs) {
		let [name = "", type = "string", ...rest] = spec.split(":");
		if (rest.length > 0) return failure(new Error(`"${spec}" is not a field; write name:type`));
		if (!isFieldType(type)) {
			let known = Object.keys(FIELD_TYPES).join(", ");
			return failure(new Error(`"${type}" in "${spec}" is not a field type; use ${known}`));
		}
		let words = name
			.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
			.split(/[\s_-]+/)
			.filter((word) => word !== "")
			.map((word) => word.toLowerCase());
		let column = words.join("_");
		if (!/^[a-z][a-z0-9_]*$/.test(column)) {
			return failure(new Error(`"${name}" is not a field name; start it with a letter`));
		}
		if (RESERVED_COLUMNS.has(column)) {
			return failure(
				new Error(`${column} is a column of every scaffolded table; name it otherwise`),
			);
		}
		if (fields.some((field) => field.column === column)) {
			return failure(new Error(`${column} is listed twice`));
		}
		let [first = "", ...others] = words;
		fields.push({
			column,
			label: capitalize(words.join(" ")),
			flag: words.join("-"),
			key: first + others.map(capitalize).join(""),
			type,
		});
	}
	return success(fields);
}

/** Whether `value` names a field type. */
function isFieldType(value: string): value is FieldTypeName {
	return Object.hasOwn(FIELD_TYPES, value);
}

/**
 * The plural of a kebab-case `name`, pluralizing its last word by three English rules: a
 * sibilant ending adds `es`, a consonant before `y` becomes `ies`, and anything else adds `s`.
 */
export function pluralize(name: string): string {
	if (/(s|x|z|ch|sh)$/.test(name)) return `${name}es`;
	if (/[^aeiou]y$/.test(name)) return `${name.slice(0, -1)}ies`;
	return `${name}s`;
}

/** `word` with its first letter upper case. */
function capitalize(word: string): string {
	return word.charAt(0).toUpperCase() + word.slice(1);
}
