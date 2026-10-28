/**
 * Runtime check of a tool call's result against an optional
 * `@sdxc/json-schema` schema: prefers `structuredContent`, otherwise the first
 * text block parsed as JSON.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DescribedSchema, InferOutput } from "@sdxc/json-schema";
import type { Result } from "@sdxc/result";

import { parseSafe } from "@sdxc/json-schema";
import { failure, success } from "@sdxc/result";

import type { CallResult } from "./types.js";

import { InvalidToolResultError } from "./errors.js";

/** One segment of an issue path, as Standard Schema reports it. */
type PathSegment = PropertyKey | { readonly key: PropertyKey };

/**
 * Validates a successful tool result with `schema`. Prefers
 * `structuredContent`; when absent, parses the first text `content` block as
 * JSON. A tool result with `isError` is returned unchanged — that payload is
 * model-facing guidance, not structured output. Missing or unparseable payload
 * is a {@link InvalidToolResultError}.
 *
 * @param result The wire `tools/call` result.
 * @param schema The `@sdxc/json-schema` schema for the structured payload.
 */
export function validateToolResult<Schema extends DescribedSchema>(
	result: CallResult,
	schema: Schema,
): Result<CallResult<InferOutput<Schema>>, InvalidToolResultError> {
	if (result.isError) {
		return success(result as CallResult<InferOutput<Schema>>);
	}

	let candidate = payloadOf(result);
	if (candidate.status === "failure") return candidate;

	let parsed = parseSafe(schema, candidate.data);
	if (parsed.success) {
		return success({
			content: result.content,
			structuredContent: parsed.value as InferOutput<Schema>,
			...(result.isError === undefined ? {} : { isError: result.isError }),
		});
	}

	return failure(
		new InvalidToolResultError(parsed.issues.map((issue) => describeIssue(issue, candidate.data))),
	);
}

/**
 * The value a result schema should judge: `structuredContent` when present,
 * otherwise JSON from the first text content block.
 */
function payloadOf(result: CallResult): Result<unknown, InvalidToolResultError> {
	if (Object.hasOwn(result, "structuredContent")) {
		return success(result.structuredContent);
	}

	let text = result.content.find((block) => block.type === "text")?.text;
	if (text === undefined) {
		return failure(
			new InvalidToolResultError([
				"(root): Expected structuredContent or a text content block to validate",
			]),
		);
	}

	try {
		return success(JSON.parse(text) as unknown);
	} catch {
		return failure(
			new InvalidToolResultError([
				"(root): Text content was not JSON, and structuredContent was absent",
			]),
		);
	}
}

/** Formats one parse issue as `path: message`. */
function describeIssue(
	issue: { readonly message: string; readonly path?: readonly PathSegment[] | undefined },
	value: unknown,
): string {
	let path = "";
	let current = value;
	for (let segment of issue.path ?? []) {
		let key = typeof segment === "object" ? segment.key : segment;
		path = join(path, key);
		current = isRecord(current) ? current[String(key)] : undefined;
	}
	let message = path !== "" && current === undefined ? "Required" : issue.message;
	return `${path === "" ? "(root)" : path}: ${message}`;
}

/** Extends a path as `.name` or `[0]`. */
function join(path: string, key: PropertyKey): string {
	if (typeof key === "number") return `${path === "" ? "(root)" : path}[${key}]`;
	return path === "" ? String(key) : `${path}.${String(key)}`;
}

/** Narrows to a plain object. */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
