/**
 * Renders the parts of the API reference the OpenAPI document already holds — each
 * endpoint's scope, error table and JSON Schema blocks, and the table of problem types —
 * into the Markdown of a reference page, so the prose around them stays hand-written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Operation } from "@sdxc/openapi";

import { toJSONSchema } from "@sdxc/json-schema";
import { failure, isFailure, success, type Result } from "@sdxc/result";

import { buildApiDocument } from "~/app/http/openapi/document";
import { apiProblems } from "~/app/services/api-problems";

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

/**
 * Replaces each placeholder in `content` with the reference the document holds for it.
 * A page with none comes back unchanged.
 *
 * @param content - The page's Markdown.
 * @returns The expanded Markdown, or the first placeholder naming no operation.
 */
export function expandReference(content: string): Result<string, ReferenceError> {
	if (!content.includes("<!-- ")) return success(content);

	let operations = new Map(
		buildApiDocument()
			.operations()
			.map((operation) => [operation.operationId, operation]),
	);

	let missing: string[] = [];
	let expanded = content.replace(OPERATION_MARKER, (_, name: string) => {
		let operation = operations.get(name);
		if (operation) return renderOperation(operation);
		missing.push(name);
		return "";
	});
	if (missing.length > 0) {
		return failure(new ReferenceError(`No API operation named ${missing.join(", ")}`));
	}

	return success(expanded.replace(PROBLEM_TYPES_MARKER, () => renderProblemTypes()));
}

/**
 * One endpoint's generated reference: its required scope, the problems it answers with,
 * and the JSON Schema of its request and response bodies.
 *
 * @param operation - The operation the placeholder names.
 */
function renderOperation(operation: Operation): string {
	let parts: string[] = [];

	let scopes = (operation.spec.security ?? []).flatMap((requirement) =>
		Object.values(requirement).flat(),
	);
	parts.push(
		scopes.length === 0
			? "**Authentication:** none"
			: `**Required scope:** ${scopes.map((scope) => `\`${scope}\``).join(", ")}`,
	);

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
