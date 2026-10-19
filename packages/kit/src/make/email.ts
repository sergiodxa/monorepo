/**
 * `sdxc make email <name> field ...`: the fields become the email's props, typed by the
 * conventions `make model` uses, and each one is declared in the props schema, rendered in the
 * template's body, and given a sample its `preview()` and its test share.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { Field, FieldTypeName } from "../scaffold/fields.js";

import { parseFields } from "../scaffold/fields.js";

import type { Name } from "./names.js";

import { literal } from "./generate.js";

/** The fields an email given none is built from: a heading that is its subject, and a body. */
const DEFAULT_FIELDS = ["heading", "body:text"];

/** The `remix/data-schema` builder each field type's prop is declared with. */
const SCHEMAS: Readonly<Record<Exclude<FieldTypeName, "references">, string>> = {
	string: "string()",
	text: "string()",
	integer: "number()",
	boolean: "boolean()",
	date: "string()",
	timestamp: "number()",
	email: "string()",
	url: "string()",
};

/** The types whose value is text, the first of which is the email's subject and heading. */
const TEXT_TYPES = new Set<FieldTypeName>(["string", "text"]);

/** What `make email` writes from its fields. */
export interface EmailPlan {
	/** The lines inside `email({ … })`, given the local the schema builder is imported as. */
	declaration: (s: string) => string[];
	/** The stub placeholders the template and its test read. */
	placeholders: Record<string, string>;
}

/**
 * Plans the email `name` with the props `specs` describe, or `heading` and `body` without any.
 * A reference, an index and a unique field describe a table rather than an email, so each is
 * refused naming the spec.
 */
export function planEmail(specs: readonly string[], name: Name): Result<EmailPlan, Error> {
	let parsed = parseFields(specs.length === 0 ? DEFAULT_FIELDS : specs);
	if (isFailure(parsed)) return parsed;
	for (let [position, field] of parsed.data.entries()) {
		let spec = specs[position] ?? field.column;
		if (field.type === "references") {
			return failure(new Error(`"${spec}" references a table; an email's props hold values`));
		}
		if (field.index !== null) {
			return failure(new Error(`"${spec}" indexes a column; an email's props have none`));
		}
	}
	let fields = parsed.data;
	let heading = fields.find((field) => TEXT_TYPES.has(field.type) && !field.nullable) ?? null;
	let samples = new Map(fields.map((field) => [field.key, sample(field)]));
	let preview = `{ ${fields.map((field) => `${field.key}: ${samples.get(field.key)}`).join(", ")} }`;
	let shown = fields.find((field) => field !== heading && TEXT_TYPES.has(field.type)) ?? heading;
	let subjectSample = heading === null ? literal(name.title) : (samples.get(heading.key) ?? "");
	return success({
		declaration: (s) => [
			`props: ${s}.object({`,
			...fields.map((field) => `\t${field.key}: ${schema(field, s)},`),
			"}),",
		],
		placeholders: {
			subject:
				heading === null
					? `() => ${literal(name.title)}`
					: `({ ${heading.key} }) => ${heading.key}`,
			layoutTitle: heading === null ? literal(name.title) : `{handle.props.${heading.key}}`,
			body: [...(heading === null ? [] : [heading]), ...fields.filter((field) => field !== heading)]
				.map((field) => `\t\t\t${element(field, field === heading)}`)
				.join("\n"),
			preview,
			sample: preview,
			subjectSample,
			textSample: shown === null ? subjectSample : (samples.get(shown.key) ?? subjectSample),
		},
	});
}

/** The prop's schema, optional when its spec ended in `?`. */
function schema(field: Field, s: string): string {
	let builder = `${s}.${SCHEMAS[field.type as keyof typeof SCHEMAS]}`;
	return field.nullable ? `${s}.optional(${builder})` : builder;
}

/** A value of the prop's type, distinct per text field so a test can tell them apart. */
function sample(field: Field): string {
	if (field.type === "integer") return "42";
	if (field.type === "timestamp") return "1769851800000";
	if (field.type === "boolean") return "true";
	if (field.type === "date") return literal("2026-01-31");
	if (field.type === "email") return literal("ada@example.com");
	if (field.type === "url") return literal("https://example.com/");
	return literal(`Sample ${field.label.toLowerCase()}`);
}

/** The JSX one prop renders as, guarded when the prop is optional. */
function element(field: Field, heading: boolean): string {
	let value = `handle.props.${field.key}`;
	if (field.type === "boolean")
		return `{${value} ? <Email.Text>${field.label}</Email.Text> : null}`;
	let shown = shape(field, value, heading);
	return field.nullable ? `{${value} === undefined ? null : ${shown}}` : shown;
}

/** The element a present prop renders as, by its type. */
function shape(field: Field, value: string, heading: boolean): string {
	if (heading) return `<Email.Heading>{${value}}</Email.Heading>`;
	if (field.type === "url") return `<Email.Button href={${value}}>${field.label}</Email.Button>`;
	if (field.type === "email") {
		return `<Email.Text>\n\t\t\t\t<Email.Link href={\`mailto:\${${value}}\`}>{${value}}</Email.Link>\n\t\t\t</Email.Text>`;
	}
	return `<Email.Text>{${value}}</Email.Text>`;
}
