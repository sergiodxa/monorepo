/**
 * The placeholder values `sdxc scaffold` renders its stubs with: the resource's names in every
 * spelling a stub needs, and the blocks written field by field, such as the model's columns or
 * the form's controls, so a stub stays plain text with no loop in it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Name } from "../make/names.js";

import { literal, memberAccess } from "../make/generate.js";
import { createTableStatement } from "../make/schema.js";

import type { Field, FieldType } from "./fields.js";

import { columnSource, factorySource, fieldIndexes, FIELD_TYPES, fieldsTable } from "./fields.js";

/** The resource a scaffold writes: its singular and plural names, and its fields. */
export interface Resource {
	/** The model's name: `post`. */
	singular: Name;
	/** The table's, the routes' and the folders' name: `posts`. */
	plural: Name;
	fields: Field[];
}

/**
 * Every placeholder the scaffold's stubs may use. `header` is the module JSDoc's author tags;
 * the rest derive from `resource`, the copy keys from its plural key (`posts.index.title`).
 */
export function placeholders(resource: Resource, header: string): Record<string, string> {
	let { singular, plural, fields } = resource;
	let copy = plural.key;
	let types = new Set(fields.map((field) => field.type));
	let table = plural.snake;
	let changed = fields.find((field) => field.type !== "boolean") ?? fields[0];
	let labelled = types.has("text") || types.has("timestamp");
	return {
		header,
		name: singular.base,
		key: singular.key,
		path: singular.key,
		Name: singular.pascal,
		title: singular.title,
		snake: singular.snake,
		words: singular.title.toLowerCase(),
		plural: plural.base,
		pluralKey: plural.key,
		Plural: plural.pascal,
		pluralTitle: plural.title,
		pluralSnake: plural.snake,
		pluralWords: plural.title.toLowerCase(),
		pluralMember: memberAccess([plural.base]),
		table: plural.snake,
		statement: [
			createTableStatement(fieldsTable(table, fields)),
			...fieldIndexes(table, fields),
		].join("\n\n"),
		firstColumn: fields[0]?.column ?? "id",
		columns: lines(fields, 2, (field) => `${field.column}: ${columnSource(field, table)},`),
		attributes: lines(fields, 1, (field) => `${field.column}: ${factorySource(field)},`),
		schemaImports: [
			'import * as s from "remix/data-schema";',
			types.has("boolean") ? 'import * as coerce from "remix/data-schema/coerce";' : null,
			'import * as f from "remix/data-schema/form-data";',
		]
			.filter((line) => line !== null)
			.join("\n"),
		schemaFields: lines(fields, 1, (field) => `${field.column}: ${formSchema(field)},`),
		formSample: entries(fields, (field) => literal(typeOf(field).formSample)),
		invalidForm: entries(fields, (field) => literal(typeOf(field).invalidSample)),
		jsonSample: entries(fields, (field) => typeOf(field).jsonSample),
		changedJson: changed === undefined ? "" : `${changed.column}: ${typeOf(changed).changedSample}`,
		formImports: [
			'import { HoneypotFields } from "@sdxc/honeypot/ui";',
			'import { Button } from "@sdxc/ui/button";',
			types.has("boolean") ? 'import { Checkbox } from "@sdxc/ui/checkbox";' : null,
			types.has("date") ? 'import { DateField } from "@sdxc/ui/date-field";' : null,
			'import { Form } from "@sdxc/ui/form";',
			types.has("timestamp") ? 'import { Input } from "@sdxc/ui/input";' : null,
			labelled ? 'import { Label } from "@sdxc/ui/label";' : null,
			["string", "integer", "email", "url"].some((type) => types.has(type as Field["type"]))
				? 'import { TextField } from "@sdxc/ui/text-field";'
				: null,
			types.has("text") ? 'import { TextArea } from "@sdxc/ui/textarea";' : null,
			labelled ? 'import { css } from "remix/component";' : null,
		]
			.filter((line) => line !== null)
			.join("\n"),
		formFields: fields.map((field) => indent(formControl(field, copy, plural.base), 5)).join("\n"),
		rowValues: lines(fields, 2, (field) => `${field.column}: ${formValue(field)},`),
		tableColumns: lines(
			fields,
			8,
			(field) => `<Table.Column>{ctx.intl.t("${copy}.fields.${field.column}")}</Table.Column>`,
		),
		tableCells: fields
			.map((field, index) => {
				let shown = display(field, copy);
				let content =
					index === 0
						? `<Link href={routes.${copy}.show.href({ id: row.id })}>{${shown}}</Link>`
						: `{${shown}}`;
				return indent(`<Table.Cell>${content}</Table.Cell>`, 9);
			})
			.join("\n"),
		detailRows: fields
			.map((field) =>
				indent(
					`<dt>{ctx.intl.t("${copy}.fields.${field.column}")}</dt>\n<dd>{${display(field, copy)}}</dd>`,
					5,
				),
			)
			.join("\n"),
		listValues: fields
			.map((field) => {
				let value = field.nullable ? `row.${field.column} ?? ""` : `row.${field.column}`;
				return typeOf(field).flag === "string" ? value : `String(${value})`;
			})
			.join(", "),
		createValues: lines(
			fields,
			2,
			(field) => `${field.column}: ctx.flags.${field.key}${field.nullable ? " ?? null" : ""},`,
		),
		createArgv: fields
			.map((field) =>
				field.type === "boolean"
					? literal(`--${field.flag}`)
					: `${literal(`--${field.flag}`)}, ${literal(typeOf(field).flagSample)}`,
			)
			.join(", "),
	};
}

/**
 * The copy every `resources/locales/*.json` gains under the plural key: each page's title and
 * buttons, a label per field, and the words a ticked and an unticked box read as.
 */
export function localeBlock(resource: Resource): Record<string, unknown> {
	let words = resource.singular.title.toLowerCase();
	let pluralWords = resource.plural.title.toLowerCase();
	return {
		index: { title: resource.plural.title, new: `New ${words}`, empty: `No ${pluralWords} yet.` },
		new: { title: `New ${words}`, submit: `Create ${words}` },
		show: {
			title: resource.singular.title,
			edit: `Edit ${words}`,
			delete: `Delete ${words}`,
			back: `Back to ${pluralWords}`,
		},
		edit: { title: `Edit ${words}`, submit: `Save ${words}` },
		fields: Object.fromEntries(resource.fields.map((field) => [field.column, field.label])),
		yes: "Yes",
		no: "No",
	};
}

/**
 * The tool input's properties, one line each, every one optional when `optional` says so; a
 * nullable field also takes `null`.
 */
export function jsonProperties(fields: readonly Field[], s: string, optional: boolean): string[] {
	return fields.map((field) => {
		let schema = typeOf(field).json.replace(/^s\./, `${s}.`);
		if (field.nullable) schema = `${s}.nullable(${schema})`;
		return `\t${field.column}: ${optional ? `${s}.optional(${schema})` : schema},`;
	});
}

/** A command flag per field, one line each, written with the contract's `flag` local. */
export function flagProperties(fields: readonly Field[], flag: string): string[] {
	return fields.map((field) => {
		let options = `{ description: ${literal(field.label)} }`;
		let required = `{ required: true, description: ${literal(field.label)} }`;
		let kind = typeOf(field).flag;
		let declared = `${flag}.${kind}(${literal(field.flag)}, ${kind === "boolean" || field.nullable ? options : required})`;
		return `\t${field.key}: ${declared},`;
	});
}

/** The type `field` is written as on a page; the scaffold refuses a reference before rendering. */
function typeOf(field: Field): FieldType {
	return FIELD_TYPES[field.type as keyof typeof FIELD_TYPES];
}

/**
 * The form schema of `field`: a box through `coerce.boolean()`, anything else read as text that
 * passes its type's test and is converted to the column's value. A nullable field reads a blank
 * or missing input as `null`.
 */
function formSchema(field: Field): string {
	if (field.type === "boolean") return "f.field(s.defaulted(coerce.boolean(), false))";
	let { test, convert } = typeOf(field);
	let refine = (expression: string, message: string) =>
		`.refine((value) => ${expression}, ${literal(message)})`;
	if (!field.nullable) {
		let checked = test === null ? "" : refine(test.expression, test.message);
		let converted = convert === null ? "" : `.transform((value) => ${convert})`;
		return `f.field(s.string()${checked}${converted})`;
	}
	let blank = 'value.trim() === ""';
	let checked =
		test === null || test.expression === 'value.trim() !== ""'
			? ""
			: refine(`${blank} || (${test.expression})`, test.message);
	return `f.field(s.defaulted(s.string(), "")${checked}.transform((value) => (${blank} ? null : ${convert ?? "value"})))`;
}

/** How a row's value reads in the edit form, as the text a submission would carry. */
function formValue(field: Field): string {
	let value = `row.${field.column}`;
	if (field.type === "boolean") return `${value} ? "true" : "false"`;
	let text = value;
	if (field.type === "integer") text = `String(${value})`;
	if (field.type === "timestamp") text = `new Date(${value}).toISOString().slice(0, 16)`;
	if (!field.nullable) return text;
	return text === value ? `${value} ?? ""` : `${value} === null ? "" : ${text}`;
}

/**
 * How a row's value reads on a page: a box as the copy's yes or no, a timestamp as its UTC ISO
 * text, anything else as it is, and a missing value as nothing.
 */
function display(field: Field, copy: string): string {
	let value = `row.${field.column}`;
	if (field.type === "boolean") {
		return `${value} ? ctx.intl.t("${copy}.yes") : ctx.intl.t("${copy}.no")`;
	}
	if (field.type !== "timestamp") return value;
	let shown = `new Date(${value}).toISOString()`;
	return field.nullable ? `${value} === null ? "" : ${shown}` : shown;
}

/** The `@sdxc/ui` control a field is edited with, filled from the form's `values`. */
function formControl(field: Field, copy: string, plural: string): string {
	let label = `intl.t("${copy}.fields.${field.column}")`;
	let value = `values.${field.column}`;
	let name = JSON.stringify(field.column);
	let required = field.nullable ? "" : " required";
	if (field.type === "boolean") {
		return `<Checkbox name=${name} value="true" defaultChecked={${value} === "true"}>\n\t{${label}}\n</Checkbox>`;
	}
	if (field.type === "date") {
		return `<DateField label={${label}} name=${name} defaultValue={${value}}${required} />`;
	}
	if (field.type === "text" || field.type === "timestamp") {
		let id = JSON.stringify(`${plural}-${field.column}`);
		let control =
			field.type === "text"
				? `<TextArea id=${id} name=${name} defaultValue={${value}}${required} />`
				: `<Input id=${id} type="datetime-local" name=${name} defaultValue={${value}}${required} />`;
		return [
			`<div mix={css({ display: "grid", gap: "0.375rem" })}>`,
			`\t<Label htmlFor=${id}>{${label}}</Label>`,
			`\t${control}`,
			"</div>",
		].join("\n");
	}
	let types: Partial<Record<Field["type"], string>> = {
		integer: "number",
		email: "email",
		url: "url",
	};
	let type = types[field.type] === undefined ? "" : ` type="${types[field.type]}"`;
	return `<TextField${type} label={${label}} name=${name} defaultValue={${value}}${required} />`;
}

/** One line per field, each indented by `depth` tabs. */
function lines(fields: readonly Field[], depth: number, line: (field: Field) => string): string {
	return fields.map((field) => indent(line(field), depth)).join("\n");
}

/** The fields as object-literal entries on one line, each value from `value`. */
function entries(fields: readonly Field[], value: (field: Field) => string): string {
	return fields.map((field) => `${field.column}: ${value(field)}`).join(", ");
}

/** Every line of `text` indented by `depth` tabs. */
function indent(text: string, depth: number): string {
	return text
		.split("\n")
		.map((line) => `${"\t".repeat(depth)}${line}`)
		.join("\n");
}
