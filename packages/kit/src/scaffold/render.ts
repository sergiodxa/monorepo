/**
 * The placeholder values `sdxc scaffold` renders its stubs with: the resource's names in every
 * spelling a stub needs, and the blocks written field by field, such as the model's columns or
 * the form's controls, so a stub stays plain text with no loop in it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ColumnBuilder } from "remix/data-table";

import { column, table } from "remix/data-table";

import type { Name } from "../make/names.js";

import { memberAccess } from "../make/generate.js";
import { createTableStatement } from "../make/schema.js";

import type { Field } from "./fields.js";

import { FIELD_TYPES } from "./fields.js";

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
	let changed = fields.find((field) => field.type !== "boolean") ?? fields[0];
	return {
		header,
		name: singular.base,
		key: singular.key,
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
		statement: createTableStatement(runtimeTable(resource)),
		firstColumn: fields[0]?.column ?? "id",
		columns: lines(fields, 2, (field) => `${field.column}: ${FIELD_TYPES[field.type].column},`),
		attributes: lines(fields, 1, (field) => `${field.column}: ${factoryValue(field)},`),
		schemaImports: [
			'import * as s from "remix/data-schema";',
			fields.some((field) => FIELD_TYPES[field.type].coerces)
				? 'import * as coerce from "remix/data-schema/coerce";'
				: null,
			'import * as f from "remix/data-schema/form-data";',
		]
			.filter((line) => line !== null)
			.join("\n"),
		schemaFields: lines(
			fields,
			1,
			(field) => `${field.column}: ${FIELD_TYPES[field.type].schema},`,
		),
		formSample: entries(fields, (field) => JSON.stringify(FIELD_TYPES[field.type].formSample)),
		invalidForm: entries(fields, (field) => JSON.stringify(FIELD_TYPES[field.type].invalidSample)),
		jsonSample: entries(fields, (field) => FIELD_TYPES[field.type].jsonSample),
		changedJson:
			changed === undefined ? "" : `${changed.column}: ${FIELD_TYPES[changed.type].changedSample}`,
		formImports: [
			'import { HoneypotFields } from "@sdxc/honeypot/ui";',
			'import { Button } from "@sdxc/ui/button";',
			types.has("boolean") ? 'import { Checkbox } from "@sdxc/ui/checkbox";' : null,
			types.has("date") ? 'import { DateField } from "@sdxc/ui/date-field";' : null,
			'import { Form } from "@sdxc/ui/form";',
			types.has("text") ? 'import { Label } from "@sdxc/ui/label";' : null,
			types.has("string") || types.has("integer")
				? 'import { TextField } from "@sdxc/ui/text-field";'
				: null,
			types.has("text") ? 'import { TextArea } from "@sdxc/ui/textarea";' : null,
			types.has("text") ? 'import { css } from "remix/component";' : null,
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
			.map((field) =>
				field.type === "integer" || field.type === "boolean"
					? `String(row.${field.column})`
					: `row.${field.column}`,
			)
			.join(", "),
		createValues: lines(fields, 2, (field) => `${field.column}: ctx.flags.${field.key},`),
		createArgv: fields
			.map((field) =>
				field.type === "boolean"
					? JSON.stringify(`--${field.flag}`)
					: `${JSON.stringify(`--${field.flag}`)}, ${JSON.stringify(FIELD_TYPES[field.type].formSample)}`,
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

/** The tool input's properties, one line each, every one optional when `optional` says so. */
export function jsonProperties(fields: readonly Field[], s: string, optional: boolean): string[] {
	return fields.map((field) => {
		let schema = FIELD_TYPES[field.type].json.replace(/^s\./, `${s}.`);
		return `\t${field.column}: ${optional ? `${s}.optional(${schema})` : schema},`;
	});
}

/** A command flag per field, one line each, written with the contract's `flag` local. */
export function flagProperties(fields: readonly Field[], flag: string): string[] {
	return fields.map((field) => {
		let options = `{ description: ${JSON.stringify(field.label)} }`;
		let required = `{ required: true, description: ${JSON.stringify(field.label)} }`;
		let declared =
			field.type === "boolean"
				? `${flag}.boolean(${JSON.stringify(field.flag)}, ${options})`
				: `${flag}.${field.type === "integer" ? "number" : "string"}(${JSON.stringify(field.flag)}, ${required})`;
		return `\t${field.key}: ${declared},`;
	});
}

/** The table as `remix/data-table` builds it, which the migration's statement is rendered from. */
function runtimeTable(resource: Resource) {
	let columns: Record<string, ColumnBuilder> = { id: column.text().primaryKey() };
	for (let field of resource.fields) columns[field.column] = FIELD_TYPES[field.type].build(column);
	columns.created_at = column.integer();
	columns.updated_at = column.integer();
	return table({ name: resource.plural.snake, columns, timestamps: true });
}

/** A factory attribute: text numbered by the sequence, so two rows a test creates differ. */
function factoryValue(field: Field): string {
	if (field.type === "integer") return "({ sequence }) => sequence";
	if (field.type === "boolean") return "false";
	if (field.type === "date") return '"2026-01-01"';
	return `({ sequence }) => \`${field.label} \${sequence}\``;
}

/** How a row's value reads in the edit form, as the text a submission would carry. */
function formValue(field: Field): string {
	let value = `row.${field.column}`;
	if (field.type === "integer") return `String(${value})`;
	if (field.type === "boolean") return `${value} ? "true" : "false"`;
	return value;
}

/** How a row's value reads on a page: a box as the copy's yes or no, anything else as it is. */
function display(field: Field, copy: string): string {
	let value = `row.${field.column}`;
	if (field.type !== "boolean") return value;
	return `${value} ? ctx.intl.t("${copy}.yes") : ctx.intl.t("${copy}.no")`;
}

/** The `@sdxc/ui` control a field is edited with, filled from the form's `values`. */
function formControl(field: Field, copy: string, plural: string): string {
	let label = `intl.t("${copy}.fields.${field.column}")`;
	let value = `values.${field.column}`;
	let name = JSON.stringify(field.column);
	if (field.type === "boolean") {
		return `<Checkbox name=${name} value="true" defaultChecked={${value} === "true"}>\n\t{${label}}\n</Checkbox>`;
	}
	if (field.type === "date") {
		return `<DateField label={${label}} name=${name} defaultValue={${value}} required />`;
	}
	if (field.type === "text") {
		let id = JSON.stringify(`${plural}-${field.column}`);
		return [
			`<div mix={css({ display: "grid", gap: "0.375rem" })}>`,
			`\t<Label htmlFor=${id}>{${label}}</Label>`,
			`\t<TextArea id=${id} name=${name} defaultValue={${value}} required />`,
			"</div>",
		].join("\n");
	}
	let type = field.type === "integer" ? ' type="number"' : "";
	return `<TextField${type} label={${label}} name=${name} defaultValue={${value}} required />`;
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
