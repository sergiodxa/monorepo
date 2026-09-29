/**
 * Runtime validation of a tool call's arguments through the tool's own input schema, the
 * same schema `tools/list` published, so a client is held to exactly the contract it was
 * told. It runs before a handler is entered, so `ctx.input` arrives parsed and typed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { InferOutput, JSONSchema } from "@sdxc/json-schema";
import type { Result } from "@sdxc/result";

import { parseSafe } from "@sdxc/json-schema";
import { failure, success } from "@sdxc/result";

import type { Tool, ToolSchema } from "./tools.js";

import { InvalidArgumentsError } from "./errors.js";

/** One segment of an issue's path, as Standard Schema reports it. */
type PathSegment = PropertyKey | { readonly key: PropertyKey };

/**
 * Parses a call's arguments with the tool's input schema, collecting every failed
 * constraint. Absent arguments parse as `{}`, and a `null` the published schema does not
 * accept counts as an omitted property, since models spell an omitted optional as `null`.
 *
 * @param tool The tool being called.
 * @param value The `arguments` object from a `tools/call` request, possibly absent.
 * @returns What the schema's parse yields, or every failed constraint.
 * @example
 * let checked = validateArguments(toolset.searchPosts, { query: "remix" });
 */
export function validateArguments<Schema extends ToolSchema>(
	tool: Tool<Schema>,
	value: unknown,
): Result<InferOutput<Schema>, InvalidArgumentsError> {
	let candidate = withoutNulls(tool.descriptor.inputSchema, value ?? {});
	let parsed = parseSafe(tool.input, candidate);
	if (parsed.success) return success(parsed.value as InferOutput<Schema>);

	return failure(
		new InvalidArgumentsError(parsed.issues.map((issue) => describeIssue(issue, candidate))),
	);
}

/**
 * Removes every `null` property whose published schema has no `null` in it, walking into
 * nested objects and array items. A property the schema does not declare keeps its value
 * for the parse to strip, and a `$ref` or composition keeps it for the parse to judge.
 */
function withoutNulls(schema: JSONSchema | boolean | undefined, value: unknown): unknown {
	if (typeof schema !== "object") return value;

	if (Array.isArray(value)) {
		let items = schema.items;
		if (typeof items !== "object") return value;
		return value.map((item) => withoutNulls(items, item));
	}

	let properties = schema.properties;
	if (typeof value !== "object" || value === null || properties === undefined) return value;

	let kept: Record<string, unknown> = {};
	for (let [name, entry] of Object.entries(value)) {
		let property = properties[name];
		if (entry === null && property !== undefined && !acceptsNull(property)) continue;
		kept[name] = withoutNulls(property, entry);
	}
	return kept;
}

/** Whether a published schema admits `null`, assumed so when only a `$ref` or `allOf` could tell. */
function acceptsNull(schema: JSONSchema): boolean {
	if (schema.type !== undefined) {
		return Array.isArray(schema.type) ? schema.type.includes("null") : schema.type === "null";
	}
	let members = schema.anyOf ?? schema.oneOf;
	return members === undefined || members.some(acceptsNull);
}

/**
 * Formats an issue as `path: message`, `(root)` naming the arguments object itself. A
 * property absent from the arguments reads "Required", since the type the schema expected
 * would suggest the caller sent the wrong kind of value.
 */
function describeIssue(
	issue: { readonly message: string; readonly path?: readonly PathSegment[] | undefined },
	value: unknown,
): string {
	let path = "";
	let current = value;
	for (let segment of issue.path ?? []) {
		let key = typeof segment === "object" ? segment.key : segment;
		path = join(path, key);
		current = isRecord(current) ? current[key] : undefined;
	}

	let message = path !== "" && current === undefined ? "Required" : issue.message;
	return `${label(path)}: ${message}`;
}

function label(path: string): string {
	return path === "" ? "(root)" : path;
}

/** Extends a path the way it reads in code: `.name` for a property, `[0]` for an index. */
function join(path: string, key: PropertyKey): string {
	if (typeof key === "number") return `${label(path)}[${key}]`;
	return path === "" ? String(key) : `${path}.${String(key)}`;
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
	return typeof value === "object" && value !== null;
}
