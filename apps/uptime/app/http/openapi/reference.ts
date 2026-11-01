/**
 * Renders the parts of the API reference the OpenAPI document already holds — each
 * endpoint's scope, errors and body schemas, and the table of problem types — into a
 * reference page, as Markdown or as structured data the docs page draws as field tables.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Operation } from "@sdxc/openapi";

import { toJSONSchema } from "@sdxc/json-schema";
import { failure, isFailure, success, type Result } from "@sdxc/result";

import { buildApiDocument } from "~/app/http/openapi/document";
import { apiProblems } from "~/app/services/api/problems";

/**
 * A placeholder line a reference page writes where an endpoint's generated reference
 * goes, naming the operation: `<!-- operation: monitorsIndex -->`.
 */
const OPERATION_MARKER = /^<!-- operation: ([A-Za-z]+) -->$/gm;

/** The placeholder line for the table listing every problem type. */
const PROBLEM_TYPES_MARKER = /^<!-- problem-types -->$/gm;

/** A body an operation declares: one schema, or a record of media types to schemas. */
type DeclaredBody = NonNullable<Operation["spec"]["body"]>;

/** A body declared as one schema, which every API operation does. */
type BodySchema = Extract<DeclaredBody, Parameters<typeof toJSONSchema>[0]>;

/** Why a page's placeholders could not all be filled. */
export class ReferenceError extends Error {
	override name = "ReferenceError";
}

/**
 * Every operation name a page's placeholders mention, in page order, for a test that
 * checks each operation is documented exactly once.
 *
 * @param content - The page's Markdown.
 */
export function referencedOperations(content: string): string[] {
	return [...content.matchAll(OPERATION_MARKER)].map((match) => match[1] ?? "");
}

/** How a placeholder is filled in: rendered Markdown, or a tag the docs page draws. */
export type ReferenceMode = "markdown" | "tags";

/**
 * Replaces each placeholder in `content` with the reference the document holds for it.
 * In `tags` mode an operation becomes `<operation name="…" />`, which the docs page draws
 * from {@link operationReferences}; a page with no placeholders comes back unchanged.
 *
 * @param content - The page's Markdown.
 * @param mode - Markdown for the page's `.md` twin, tags for its HTML.
 * @returns The expanded Markdown, or the first placeholder naming no operation.
 */
export function expandReference(
	content: string,
	mode: ReferenceMode = "markdown",
): Result<string, ReferenceError> {
	if (!content.includes("<!-- ")) return success(content);

	let operations = new Map(
		buildApiDocument()
			.operations()
			.map((operation) => [operation.operationId, operation]),
	);

	let missing: string[] = [];
	let expanded = content.replace(OPERATION_MARKER, (_, name: string) => {
		let operation = operations.get(name);
		if (operation) {
			return mode === "tags" ? `<operation name="${name}" />` : renderOperation(operation);
		}
		missing.push(name);
		return "";
	});
	if (missing.length > 0) {
		return failure(new ReferenceError(`No API operation named ${missing.join(", ")}`));
	}

	return success(expanded.replace(PROBLEM_TYPES_MARKER, () => renderProblemTypes()));
}

/**
 * The line naming what an endpoint asks of its caller: the scopes a key needs, an API key
 * granted by no scope, which only the operator holds, or nothing at all.
 *
 * @param keyed - Whether the endpoint takes an API key.
 * @param scopes - The scopes the key must carry.
 */
function authentication(keyed: boolean, scopes: string[]): string {
	if (scopes.length > 0) {
		return `**Required scope:** ${scopes.map((scope) => `\`${scope}\``).join(", ")}`;
	}
	return keyed ? "**Authentication:** the operator's API key" : "**Authentication:** none";
}

/**
 * One endpoint's generated reference: its required scope, the problems it answers with,
 * and the JSON Schema of its request and response bodies.
 *
 * @param operation - The operation the placeholder names.
 */
function renderOperation(operation: Operation): string {
	let parts: string[] = [];

	let security = operation.spec.security ?? [];
	let scopes = security.flatMap((requirement) => Object.values(requirement).flat());
	parts.push(authentication(security.length > 0, scopes));

	let errors = errorRows(operation.spec.problems ?? []);
	if (errors.length > 0) {
		parts.push(
			"### Errors",
			table(
				["Status", "Type", "Description"],
				errors.map((entry) => [String(entry.status), `\`${entry.slug}\``, entry.title]),
			),
		);
	}

	let body = operation.spec.body;
	if (body !== undefined && isSchema(body)) {
		parts.push("### Request Body Schema", schemaBlock(body));
	}

	let statuses = Object.keys(operation.spec.responses);
	for (let status of statuses) {
		let response = operation.spec.responses[Number(status)];
		if (response?.body === undefined || !isSchema(response.body)) continue;
		let heading = statuses.length === 1 ? "### Response Schema" : `### Response Schema (${status})`;
		parts.push(heading, schemaBlock(response.body));
	}

	return parts.join("\n\n");
}

/**
 * The catalog entries an operation lists, ordered by status as the reference reads.
 *
 * @param names - The operation's problem names.
 */
function errorRows(names: readonly string[]) {
	let listed = new Set(names);
	return apiProblems
		.entries()
		.filter((entry) => listed.has(entry.name))
		.map((entry) => ({ ...entry, slug: slugOf(entry.type) }))
		.sort((a, b) => a.status - b.status);
}

/** The table of every problem type the API can answer with, ordered by status. */
function renderProblemTypes(): string {
	let rows = apiProblems
		.entries()
		.sort((a, b) => a.status - b.status)
		.map((entry) => [String(entry.status), `\`${slugOf(entry.type)}\``, entry.title]);
	return table(["Status", "Type", "Meaning"], rows);
}

/**
 * The last path segment of a problem `type`, the name the reference lists it under.
 *
 * @param type - The problem's `type` URL.
 */
function slugOf(type: string): string {
	return new URL(type).pathname.split("/").at(-1) ?? type;
}

/**
 * A fenced JSON block holding a schema's standalone JSON Schema.
 *
 * @param schema - A request or response body schema.
 */
function schemaBlock(schema: BodySchema): string {
	let converted = toJSONSchema(schema);
	let text = isFailure(converted)
		? `{ "error": ${JSON.stringify(converted.error.message)} }`
		: JSON.stringify(converted.data, null, "\t");
	return `\`\`\`json\n${text}\n\`\`\``;
}

/**
 * A Markdown table.
 *
 * @param header - The column names.
 * @param rows - The cells, row by row.
 */
function table(header: string[], rows: string[][]): string {
	let line = (cells: string[]) => `| ${cells.join(" | ")} |`;
	return [line(header), line(header.map(() => "---")), ...rows.map(line)].join("\n");
}

/**
 * Whether a declared body is one schema, the form every API operation uses, rather than a
 * record of media types.
 *
 * @param body - The declared body.
 */
function isSchema(body: DeclaredBody): body is BodySchema {
	return "~standard" in body;
}

/** One field of a body, as a props table lists it, with its nested fields under it. */
export interface FieldRow {
	name: string;
	type: string;
	default?: string;
	required?: boolean;
	description?: string;
	children?: FieldRow[];
}

/** Who may call an endpoint: keys with these scopes, the operator's key alone, or anyone. */
export type OperationAuth =
	| { kind: "scopes"; scopes: string[] }
	| { kind: "operator" }
	| { kind: "none" };

/** Everything the docs page draws for one endpoint from the OpenAPI document. */
export interface OperationReference {
	auth: OperationAuth;
	errors: Array<{ status: number; slug: string; title: string }>;
	/** The request body's fields, or `null` for an endpoint that takes none. */
	request: FieldRow[] | null;
	/** Each response that carries a body, by status, with its fields. */
	responses: Array<{ status: number; fields: FieldRow[] }>;
}

/** The references, built on the first API page an isolate serves and kept for the rest. */
const REFERENCES_CACHE = new Map<"api", Map<string, OperationReference>>();

/**
 * Every operation's reference keyed by operation name, built from the OpenAPI document
 * once per isolate, since the document is fixed for a deployment.
 */
export function operationReferences(): Map<string, OperationReference> {
	let cached = REFERENCES_CACHE.get("api");
	if (cached) return cached;
	let references = new Map<string, OperationReference>();
	for (let operation of buildApiDocument().operations()) {
		references.set(operation.operationId, referenceOf(operation));
	}
	REFERENCES_CACHE.set("api", references);
	return references;
}

/** Who may call an endpoint, from whether it takes a key and the scopes the key needs. */
function authOf(keyed: boolean, scopes: string[]): OperationAuth {
	if (scopes.length > 0) return { kind: "scopes", scopes };
	return keyed ? { kind: "operator" } : { kind: "none" };
}

/** The object schema a field nests: its own properties, or those of the items it lists. */
function nestedOf(field: JSONSchemaNode, element: JSONSchemaNode | null): JSONSchemaNode | null {
	if (field.properties) return field;
	if (element?.properties || element?.oneOf) return element;
	return null;
}

/** The types a field names, as a list whether the schema wrote one or several. */
function typesOf(field: JSONSchemaNode): string[] {
	if (Array.isArray(field.type)) return field.type;
	return field.type ? [field.type] : [];
}

/** One operation's reference. */
function referenceOf(operation: Operation): OperationReference {
	let security = operation.spec.security ?? [];
	let scopes = security.flatMap((requirement) => Object.values(requirement).flat());
	let auth = authOf(security.length > 0, scopes);

	let body = operation.spec.body;
	let request = body !== undefined && isSchema(body) ? fieldsOf(body) : null;

	let responses: OperationReference["responses"] = [];
	for (let status of Object.keys(operation.spec.responses)) {
		let response = operation.spec.responses[Number(status)];
		if (response?.body === undefined || !isSchema(response.body)) continue;
		responses.push({ status: Number(status), fields: fieldsOf(response.body) });
	}

	return {
		auth,
		errors: errorRows(operation.spec.problems ?? []).map(({ status, slug, title }) => ({
			status,
			slug,
			title,
		})),
		request,
		responses,
	};
}

/** A JSON Schema node, read structurally since a converted schema is plain JSON. */
interface JSONSchemaNode {
	type?: string | string[];
	properties?: Record<string, JSONSchemaNode>;
	required?: string[];
	items?: JSONSchemaNode;
	enum?: unknown[];
	const?: unknown;
	default?: unknown;
	description?: string;
	format?: string;
	minimum?: number;
	maximum?: number;
	minLength?: number;
	maxLength?: number;
	oneOf?: JSONSchemaNode[];
	anyOf?: JSONSchemaNode[];
	$ref?: string;
	$defs?: Record<string, JSONSchemaNode>;
}

/**
 * The fields of a body schema. A schema that converts with an error lists no fields, and
 * the page keeps its hand-written tables and examples.
 */
function fieldsOf(schema: BodySchema): FieldRow[] {
	let converted = toJSONSchema(schema);
	if (isFailure(converted)) return [];
	let root = converted.data as JSONSchemaNode;
	return rowsOf(root, root.$defs ?? {});
}

/** Follows a `#/$defs/…` reference to the definition it names. */
function resolve(node: JSONSchemaNode, defs: Record<string, JSONSchemaNode>): JSONSchemaNode {
	if (!node.$ref) return node;
	let name = node.$ref.split("/").at(-1) ?? "";
	return defs[name] ?? node;
}

/**
 * The rows an object schema lists: one per property, with nested objects and arrays of
 * objects as children. A union of objects lists one row per variant, named by the value
 * that tells the variants apart (`strategy: email`).
 */
function rowsOf(node: JSONSchemaNode, defs: Record<string, JSONSchemaNode>): FieldRow[] {
	let resolved = resolve(node, defs);
	let variants = resolved.oneOf ?? resolved.anyOf;
	if (variants && variants.every((variant) => resolve(variant, defs).properties)) {
		return variants.map((variant, index) => {
			let object = resolve(variant, defs);
			let tag = Object.entries(object.properties ?? {}).find(
				([, field]) => field.const !== undefined,
			);
			return {
				name: tag ? `${tag[0]}: ${String(tag[1].const)}` : `variant ${index + 1}`,
				type: "object",
				children: rowsOf(object, defs),
			};
		});
	}

	let required = new Set(resolved.required ?? []);
	return Object.entries(resolved.properties ?? {}).map(([name, raw]) => {
		let field = resolve(raw, defs);
		let element = field.items ? resolve(field.items, defs) : null;
		let nested = nestedOf(field, element);
		let row: FieldRow = { name, type: typeOf(field, defs), required: required.has(name) };
		let description = describe(field);
		if (description) row.description = description;
		if (field.default !== undefined) row.default = JSON.stringify(field.default);
		if (nested) row.children = rowsOf(nested, defs);
		return row;
	});
}

/** A field's type as a reader writes it: `string`, `integer | null`, `Monitor[]`. */
function typeOf(field: JSONSchemaNode, defs: Record<string, JSONSchemaNode>): string {
	if (field.const !== undefined) return JSON.stringify(field.const);
	let types = typesOf(field);
	let named = types.map((type) => {
		if (type !== "array" || !field.items) return type;
		let item = field.items.$ref
			? (field.items.$ref.split("/").at(-1) ?? "object")
			: typeOf(resolve(field.items, defs), defs);
		return `${item}[]`;
	});
	if (named.length === 0 && (field.oneOf || field.anyOf)) return "object";
	return named.join(" | ") || "object";
}

/**
 * What a field accepts beyond its type, in one line: its description, the values it may
 * take, its range or length, and its format.
 */
function describe(field: JSONSchemaNode): string | undefined {
	let parts: string[] = [];
	if (field.description) parts.push(field.description);
	let values = field.enum?.filter((value) => value !== null);
	if (values && values.length > 0)
		parts.push(
			`One of ${values.map((value) => `\`${typeof value === "string" ? value : JSON.stringify(value)}\``).join(", ")}.`,
		);
	if (field.minimum !== undefined || field.maximum !== undefined) {
		parts.push(`${field.minimum ?? "…"}–${field.maximum ?? "…"}.`);
	}
	if (field.minLength !== undefined || field.maxLength !== undefined) {
		parts.push(`${field.minLength ?? 0}–${field.maxLength ?? "…"} characters.`);
	}
	if (field.format) parts.push(`Format: ${field.format}.`);
	return parts.length > 0 ? parts.join(" ") : undefined;
}
