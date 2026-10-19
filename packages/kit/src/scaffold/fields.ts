/**
 * The fields `sdxc scaffold` and `sdxc make model` take as `name`, `name:type` or `name?`, the
 * type a bare name takes by convention, and what each type becomes in the layers that read it as
 * data: the table column, the form and tool schemas, and the samples a test fills it with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Result } from "@sdxc/result";
import type { AnyTable, ColumnBuilder, ColumnNamespace } from "remix/data-table";

import { failure, isFailure, success, wrap } from "@sdxc/result";
import { column, table } from "remix/data-table";

/** A field type `sdxc scaffold` and `sdxc make model` know. */
export type FieldTypeName =
	| "string"
	| "text"
	| "integer"
	| "boolean"
	| "date"
	| "timestamp"
	| "email"
	| "url"
	| "references";

/** The row a reference points at: its model, its table and the type of its `id`. */
export interface Reference {
	/** The referenced model's kebab-case name, as `sdxc make model` names its file. */
	model: string;
	table: string;
	/** `text` for the UUIDv7 ids models create, `integer` for a table keyed by a number. */
	key: "text" | "integer";
}

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
	/** A trailing `?` makes the column nullable, and its form control and command flag optional. */
	nullable: boolean;
	/** Set on a `references` field only. */
	reference?: Reference;
}

/** What one field type is in the layers that read it as data. */
export interface FieldType {
	/** The `remix/data-table` column, as source and as the builder the migration renders. */
	column: string;
	build: (c: ColumnNamespace) => ColumnBuilder;
	/**
	 * The test a submitted, non-blank value passes, as an expression over `value`, with the
	 * message a refusal shows; `null` for a box, which `coerce.boolean()` reads instead.
	 */
	test: { expression: string; message: string } | null;
	/** The expression over `value` that turns the submitted text into the column's value. */
	convert: string | null;
	/** The tool input's JSON Schema builder. */
	json: string;
	/** The command flag's builder: `string`, `number` or `boolean`. */
	flag: "string" | "number" | "boolean";
	/** A value a submission fills it with, as form text, a tool call, as JSON source, and a flag. */
	formSample: string;
	jsonSample: string;
	flagSample: string;
	/** A second value for a tool's update, as JSON source, different from the factory's. */
	changedSample: string;
	/** Form text the form schema refuses. */
	invalidSample: string;
}

/** What a string field's form value must be: something besides spaces. */
const NOT_BLANK = { expression: 'value.trim() !== ""', message: "Required" };

/** Every field type `sdxc scaffold` writes pages for, in the order the help lists them. */
export const FIELD_TYPES: Readonly<Record<Exclude<FieldTypeName, "references">, FieldType>> = {
	string: {
		column: "c.text()",
		build: (c) => c.text(),
		test: NOT_BLANK,
		convert: null,
		json: "s.string()",
		flag: "string",
		formSample: "Sample text",
		jsonSample: '"Sample text"',
		flagSample: "Sample text",
		changedSample: '"Changed text"',
		invalidSample: "  ",
	},
	text: {
		column: "c.text()",
		build: (c) => c.text(),
		test: NOT_BLANK,
		convert: null,
		json: "s.string()",
		flag: "string",
		formSample: "Sample text",
		jsonSample: '"Sample text"',
		flagSample: "Sample text",
		changedSample: '"Changed text"',
		invalidSample: "  ",
	},
	integer: {
		column: "c.integer()",
		build: (c) => c.integer(),
		test: { expression: "/^-?\\d+$/.test(value.trim())", message: "Expected a whole number" },
		convert: "Number(value)",
		json: "s.integer()",
		flag: "number",
		formSample: "42",
		jsonSample: "42",
		flagSample: "42",
		changedSample: "7",
		invalidSample: "1.5",
	},
	boolean: {
		column: "c.boolean()",
		build: (c) => c.boolean(),
		test: null,
		convert: null,
		json: "s.boolean()",
		flag: "boolean",
		formSample: "true",
		jsonSample: "true",
		flagSample: "true",
		changedSample: "true",
		invalidSample: "maybe",
	},
	date: {
		column: "c.text()",
		build: (c) => c.text(),
		test: { expression: "/^\\d{4}-\\d{2}-\\d{2}$/.test(value)", message: "Expected a date" },
		convert: null,
		json: "s.string()",
		flag: "string",
		formSample: "2026-01-31",
		jsonSample: '"2026-01-31"',
		flagSample: "2026-01-31",
		changedSample: '"2026-02-28"',
		invalidSample: "soon",
	},
	timestamp: {
		column: "c.integer()",
		build: (c) => c.integer(),
		test: {
			expression:
				"/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(:\\d{2})?$/.test(value) && !Number.isNaN(Date.parse(`${value}Z`))",
			message: "Expected a date and time",
		},
		convert: "Date.parse(`${value}Z`)",
		json: "s.integer()",
		flag: "number",
		formSample: "2026-01-31T09:30",
		jsonSample: "1769851800000",
		flagSample: "1769851800000",
		changedSample: "1772271000000",
		invalidSample: "soon",
	},
	email: {
		column: "c.text()",
		build: (c) => c.text(),
		test: { expression: "/^[^\\s@]+@[^\\s@]+$/.test(value)", message: "Expected an email address" },
		convert: null,
		json: "s.string()",
		flag: "string",
		formSample: "ada@example.com",
		jsonSample: '"ada@example.com"',
		flagSample: "ada@example.com",
		changedSample: '"grace@example.com"',
		invalidSample: "ada",
	},
	url: {
		column: "c.text()",
		build: (c) => c.text(),
		test: { expression: "URL.canParse(value)", message: "Expected a URL" },
		convert: null,
		json: "s.string()",
		flag: "string",
		formSample: "https://example.com/",
		jsonSample: '"https://example.com/"',
		flagSample: "https://example.com/",
		changedSample: '"https://example.org/"',
		invalidSample: "example",
	},
};

/** Every type a field may name, the reference included, in the order the help lists them. */
export const FIELD_TYPE_NAMES: readonly FieldTypeName[] = [
	"string",
	"text",
	"integer",
	"boolean",
	"date",
	"timestamp",
	"email",
	"url",
	"references",
];

/** The columns every table has, which a field cannot name. */
const RESERVED_COLUMNS = new Set(["id", "created_at", "updated_at"]);

/** Whole names that read as a box to tick: `published`, `archived`… */
const BOOLEAN_NAMES = new Set([
	"active",
	"admin",
	"approved",
	"archived",
	"completed",
	"confirmed",
	"default",
	"deleted",
	"disabled",
	"done",
	"draft",
	"enabled",
	"featured",
	"hidden",
	"locked",
	"pinned",
	"private",
	"public",
	"published",
	"read",
	"verified",
	"visible",
]);

/** The first words that ask a yes-or-no question: `is_public`, `has_paid`, `can_comment`. */
const BOOLEAN_PREFIXES = new Set(["is", "has", "can", "should", "was", "allow", "allows"]);

/** Whole names that count something. */
const INTEGER_NAMES = new Set([
	"age",
	"count",
	"level",
	"position",
	"priority",
	"quantity",
	"rank",
	"rating",
	"score",
	"year",
]);

/** The last words of a name that counts something: `view_count`, `price_cents`. */
const INTEGER_SUFFIXES = new Set(["count", "cents"]);

/** Whole names, and last words, that hold more than a line of text. */
const TEXT_NAMES = new Set([
	"bio",
	"body",
	"comment",
	"content",
	"description",
	"details",
	"excerpt",
	"message",
	"notes",
	"summary",
]);

/** Whole names that hold a web address beside the `url` suffix. */
const URL_NAMES = new Set(["homepage", "website"]);

/** Whole names that hold a calendar day beside the `on` and `date` suffixes. */
const DATE_NAMES = new Set(["birthday", "birthdate"]);

/**
 * The type a bare name takes by convention, from its snake_case words. The rules are checked in
 * this order, so `published_at` is a timestamp and `published` a box, and a name no rule
 * matches is a `string`.
 */
export function conventionalType(words: readonly string[]): FieldTypeName {
	let name = words.join("_");
	let first = words[0] ?? "";
	let last = words.at(-1) ?? "";
	let compound = words.length > 1;
	if (compound && last === "id") return "references";
	if (compound && last === "at") return "timestamp";
	if ((compound && (last === "on" || last === "date")) || DATE_NAMES.has(name)) return "date";
	if ((compound && BOOLEAN_PREFIXES.has(first)) || BOOLEAN_NAMES.has(name)) return "boolean";
	if ((compound && INTEGER_SUFFIXES.has(last)) || INTEGER_NAMES.has(name)) return "integer";
	if (last === "email") return "email";
	if (last === "url" || URL_NAMES.has(name)) return "url";
	if (TEXT_NAMES.has(last)) return "text";
	return "string";
}

/**
 * Parses `specs` into fields. Each spec is a name with an optional `:type`, and a trailing `?` on
 * either part makes the field nullable; a bare name takes {@link conventionalType}, and an
 * explicit type always wins. `author:references` and a bare `author_id` both write `author_id`,
 * pointing at the `authors` table until {@link resolveReferences} reads the model's own table.
 * A reserved, repeated or invalid name, an unknown type, a nullable box and a password column are
 * failures naming the spec.
 */
export function parseFields(specs: readonly string[]): Result<Field[], Error> {
	let fields: Field[] = [];
	for (let spec of specs) {
		let [rawName = "", rawType, ...rest] = spec.split(":");
		if (rest.length > 0) return failure(new Error(`"${spec}" is not a field; write name:type`));
		let nullable = rawName.endsWith("?") || (rawType?.endsWith("?") ?? false);
		let name = rawName.replace(/\?$/, "");
		let explicit = rawType?.replace(/\?$/, "");
		let words = name
			.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
			.split(/[\s_-]+/)
			.filter((word) => word !== "")
			.map((word) => word.toLowerCase());
		if (explicit === "references" && words.at(-1) !== "id") words.push("id");
		let column = words.join("_");
		if (!/^[a-z][a-z0-9_]*$/.test(column)) {
			return failure(new Error(`"${name}" is not a field name; start it with a letter`));
		}
		if (RESERVED_COLUMNS.has(column)) {
			return failure(new Error(`${column} is a column of every table; name it otherwise`));
		}
		if (words.includes("password") && !["hash", "digest"].includes(words.at(-1) ?? "")) {
			return failure(
				new Error(
					`${column} would keep a password as typed; store only its hash, in a column such as password_hash`,
				),
			);
		}
		if (fields.some((field) => field.column === column)) {
			return failure(new Error(`${column} is listed twice`));
		}
		let type = explicit === undefined || explicit === "" ? conventionalType(words) : explicit;
		if (!isFieldType(type)) {
			return failure(
				new Error(`"${type}" in "${spec}" is not a field type; use ${FIELD_TYPE_NAMES.join(", ")}`),
			);
		}
		if (type === "boolean" && nullable) {
			return failure(new Error(`${column} is a box, ticked or not; drop the ? from "${spec}"`));
		}
		let [first = "", ...others] = words;
		let field: Field = {
			column,
			label: capitalize(words.join(" ")),
			flag: words.join("-"),
			key: first + others.map(capitalize).join(""),
			type,
			nullable,
		};
		if (type === "references") {
			let model = words.slice(0, -1);
			if (model.length === 0) {
				return failure(new Error(`"${spec}" names no model; write author:references`));
			}
			field.reference = {
				model: model.join("-"),
				table: pluralize(model.join("_")),
				key: "text",
			};
		}
		fields.push(field);
	}
	return success(fields);
}

/** Whether `value` names a field type. */
function isFieldType(value: string): value is FieldTypeName {
	return FIELD_TYPE_NAMES.includes(value as FieldTypeName);
}

/**
 * `fields` with each reference pointing at the table its model in `app/models/` declares, and at
 * that table's `id` type. A reference to a model the project lacks keeps the plural table name,
 * as `sdxc scaffold` names tables, and a text id.
 */
export async function resolveReferences(root: string, fields: readonly Field[]): Promise<Field[]> {
	let resolved: Field[] = [];
	for (let field of fields) {
		if (field.reference === undefined) {
			resolved.push(field);
			continue;
		}
		let source = await wrap(() =>
			readFile(join(root, "app/models", `${field.reference?.model}.ts`), "utf8"),
		);
		if (isFailure(source)) {
			resolved.push(field);
			continue;
		}
		let table = /\btable\(\s*\{\s*name:\s*["']([^"']+)["']/.exec(source.data)?.[1];
		let key: Reference["key"] = /\bid:\s*c(?:olumn)?\.(?:integer|bigint)\(/.test(source.data)
			? "integer"
			: "text";
		resolved.push({
			...field,
			reference: { ...field.reference, table: table ?? field.reference.table, key },
		});
	}
	return resolved;
}

/**
 * The `remix/data-table` column source of `field` in the table `table`: its type's builder, a
 * reference's foreign key named `<table>_<column>_fkey`, and `.nullable()` after a `?`.
 */
export function columnSource(field: Field, table: string): string {
	let source =
		field.reference === undefined
			? FIELD_TYPES[field.type as keyof typeof FIELD_TYPES].column
			: `c.${field.reference.key}().references(${JSON.stringify(field.reference.table)}, ${JSON.stringify(`${table}_${field.column}_fkey`)})`;
	return field.nullable ? `${source}.nullable()` : source;
}

/** The column `columnSource` writes, built with `c`, for a table rendered from it. */
export function buildColumn(field: Field, table: string, c: ColumnNamespace): ColumnBuilder {
	let builder =
		field.reference === undefined
			? FIELD_TYPES[field.type as keyof typeof FIELD_TYPES].build(c)
			: c[field.reference.key]().references(field.reference.table, `${table}_${field.column}_fkey`);
	return field.nullable ? builder.nullable() : builder;
}

/**
 * The table a model with `fields` declares under `name`, as the model stub writes it: a text `id`
 * key, each field's column, then the `created_at` and `updated_at` its timestamps stamp. Its
 * migration is rendered from this table, so the two always list the same columns.
 */
export function fieldsTable(name: string, fields: readonly Field[]): AnyTable {
	let columns: Record<string, ColumnBuilder> = { id: column.text().primaryKey() };
	for (let field of fields) columns[field.column] = buildColumn(field, name, column);
	columns.created_at = column.integer();
	columns.updated_at = column.integer();
	return table({ name, columns, timestamps: true });
}

/**
 * A factory attribute's source for `field`, text numbered by the sequence so two rows a test
 * creates differ. A nullable reference is `null`; a required one is `null` too, which the caller
 * leaves out, since only a test knows which row it should point at.
 */
export function factorySource(field: Field): string | null {
	if (field.reference !== undefined) return field.nullable ? "null" : null;
	if (field.type === "integer") return "({ sequence }) => sequence";
	if (field.type === "boolean") return "false";
	if (field.type === "date") return '"2026-01-01"';
	if (field.type === "timestamp") return "Date.UTC(2026, 0, 1)";
	if (field.type === "email") return "({ sequence }) => `person${sequence}@example.com`";
	if (field.type === "url") return "({ sequence }) => `https://example.com/${sequence}`";
	return `({ sequence }) => \`${field.label} \${sequence}\``;
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
