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

/** Which surfaces a scaffold feature `.spec` exercises. */
export interface SpecSurfaces {
	/** HTML pages under `routes/web`. */
	pages: boolean;
	/** JSON endpoints under `routes/api`. */
	api: boolean;
	mcp: boolean;
	command: boolean;
}

/**
 * Every placeholder the scaffold's stubs may use. `header` is the module JSDoc's author tags;
 * the rest derive from `resource`, the copy keys from its plural key (`posts.index.title`).
 * `surfaces` fills `uses` and `cases` for the feature `.spec`.
 */
export function placeholders(
	resource: Resource,
	header: string,
	surfaces: SpecSurfaces = { pages: true, api: false, mcp: false, command: false },
): Record<string, string> {
	let { singular, plural, fields } = resource;
	let copy = plural.key;
	let types = new Set(fields.map((field) => field.type));
	let table = plural.snake;
	let changed = fields.find((field) => field.type !== "boolean") ?? fields[0];
	let labelled = types.has("text") || types.has("timestamp");
	return {
		header,
		uses: specUses(surfaces),
		cases: specCases(resource, surfaces),
		CONSTANT: singular.snake.toUpperCase(),
		PLURAL_CONSTANT: plural.snake.toUpperCase(),
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

/** The `use` lines a feature `.spec` needs for the surfaces it exercises. */
function specUses(surfaces: SpecSurfaces): string {
	let lines: string[] = [];
	if (surfaces.pages) lines.push("use browser");
	if (surfaces.api) lines.push("use http");
	if (surfaces.command) lines.push("use cli");
	if (surfaces.mcp) lines.push("use mcp");
	return lines.join("\n");
}

/**
 * One black-box case per surface the scaffold wrote: a page visit, an HTTP list, a CLI list,
 * or an MCP list call — enough for the suite to compile and for an author to extend.
 */
function specCases(resource: Resource, surfaces: SpecSurfaces): string {
	let { singular, plural } = resource;
	let words = singular.title.toLowerCase();
	let pluralWords = plural.title.toLowerCase();
	let cases: string[] = [];
	if (surfaces.pages) {
		cases.push(
			[
				`test "the ${pluralWords} index page loads" {`,
				"\twhen {",
				`\t\tbrowser.open "/${plural.base}"`,
				"\t}",
				"\tthen {",
				`\t\texpect browser.heading "${plural.title}"`,
				"\t}",
				"}",
			].join("\n"),
		);
	}
	if (surfaces.api) {
		cases.push(
			[
				`test "GET /api/${plural.base} answers" {`,
				"\twhen {",
				`\t\tlet result = http.get "/api/${plural.base}" on "web"`,
				"\t}",
				"\tthen {",
				"\t\texpect result.status 200",
				"\t}",
				"}",
			].join("\n"),
		);
	}
	if (surfaces.command) {
		cases.push(
			[
				`test "${plural.base} list runs" {`,
				"\twhen {",
				`\t\tlet result = cli.run "bun" "run" "cli" "${plural.base}" "list" in "."`,
				"\t}",
				"\tthen {",
				"\t\texpect result.exit_code 0",
				"\t}",
				"}",
			].join("\n"),
		);
	}
	if (surfaces.mcp) {
		cases.push(
			[
				`test "list_${plural.snake} answers over /mcp" {`,
				"\twhen {",
				`\t\tlet result = mcp.call "/mcp" "list_${plural.snake}" {} on "web"`,
				"\t}",
				"\tthen {",
				"\t\texpect result.ok true",
				"\t\texpect result.is_error false",
				"\t}",
				"}",
			].join("\n"),
		);
	}
	if (cases.length === 0) {
		cases.push(
			[
				`test "the ${words} feature is reachable" {`,
				"\tthen {",
				'\t\texpect "todo" "todo"',
				"\t}",
				"}",
			].join("\n"),
		);
	}
	return cases.join("\n\n");
}

/** The local names `routes/api.ts` imports what the operations are written with under. */
export interface OperationLocals {
	/** `@sdxc/json-schema`'s namespace. */
	s: string;
	defineOperation: string;
	/** The contract's default export. */
	routes: string;
}

/**
 * The OpenAPI operations `scaffold --api` appends to `routes/api.ts`: the schema of a row as the
 * API answers it, then one operation per endpoint, typing each body the endpoint parses and
 * each response it sends, so `/api/openapi.json` documents exactly what the handlers do.
 */
export function apiOperations(resource: Resource, locals: OperationLocals): string {
	let { singular, plural, fields } = resource;
	let { s, defineOperation, routes } = locals;
	let one = singular.snake.toUpperCase();
	let many = plural.snake.toUpperCase();
	let words = singular.title.toLowerCase();
	let pluralWords = plural.title.toLowerCase();
	let schema = `${one}_SCHEMA`;
	let route = `${routes}.api.${plural.key}`;
	let tags = `tags: [${literal(plural.title)}],`;
	let params = `params: ${s}.object({ id: ${s}.string() }),`;
	let data = (inner: string) => `${s}.object({ data: ${inner} })`;
	let body = (optional: boolean) => [
		`body: ${s}.object({`,
		...jsonProperties(fields, s, optional),
		"}),",
	];
	let operation = (name: string, id: string, action: string, doc: string, lines: string[]) =>
		[
			`/** ${doc} */`,
			`export const ${name} = ${defineOperation}(${literal(id)}, ${route}.${action}, {`,
			...lines.map((line) => `\t${line}`),
			"});",
		].join("\n");
	let row = [
		`/** A ${words} as the API answers it. */`,
		`export const ${schema} = ${s}`,
		"\t.object({",
		`\t\tid: ${s}.string(),`,
		...jsonProperties(fields, s, false).map((line) => `\t${line}`),
		`\t\tcreated_at: ${s}.integer(),`,
		`\t\tupdated_at: ${s}.integer(),`,
		"\t})",
		`\t.meta({ id: ${literal(singular.pascal)} });`,
	].join("\n");
	return [
		row,
		operation(
			`${many}_INDEX`,
			`${plural.key}Index`,
			"index",
			`Every ${words} the caller may read, newest first.`,
			[
				`summary: ${literal(`List ${pluralWords}`)},`,
				tags,
				`responses: { 200: { description: ${literal(`The ${pluralWords}`)}, body: ${data(`${s}.array(${schema})`)} } },`,
			],
		),
		operation(`${one}_SHOW`, `${singular.key}Show`, "show", `One ${words} by its id.`, [
			`summary: ${literal(`Show a ${words}`)},`,
			tags,
			params,
			`responses: { 200: { description: ${literal(`The ${words}`)}, body: ${data(schema)} } },`,
			'problems: ["notFound"],',
		]),
		operation(
			`${one}_CREATE`,
			`${singular.key}Create`,
			"create",
			`A new ${words} from every field.`,
			[
				`summary: ${literal(`Create a ${words}`)},`,
				tags,
				...body(false),
				`responses: { 201: { description: ${literal(`The created ${words}`)}, body: ${data(schema)} } },`,
				'problems: ["validationError"],',
			],
		),
		operation(
			`${one}_UPDATE`,
			`${singular.key}Update`,
			"update",
			`The fields the body names on one ${words}; the rest keep their values.`,
			[
				`summary: ${literal(`Update a ${words}`)},`,
				tags,
				params,
				...body(true),
				`responses: { 200: { description: ${literal(`The saved ${words}`)}, body: ${data(schema)} } },`,
				'problems: ["validationError", "notFound"],',
			],
		),
		operation(
			`${one}_DESTROY`,
			`${singular.key}Destroy`,
			"destroy",
			`Deletes one ${words} by its id.`,
			[
				`summary: ${literal(`Delete a ${words}`)},`,
				tags,
				params,
				`responses: { 204: { description: ${literal(`The ${words} is gone`)} } },`,
				'problems: ["notFound"],',
			],
		),
	].join("\n\n");
}

/** The operation names `apiOperations` exports, in the order it writes them. */
export function apiOperationNames(resource: Resource): string[] {
	let one = resource.singular.snake.toUpperCase();
	let many = resource.plural.snake.toUpperCase();
	return [`${many}_INDEX`, `${one}_SHOW`, `${one}_CREATE`, `${one}_UPDATE`, `${one}_DESTROY`];
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
